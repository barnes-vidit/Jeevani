import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import asyncio
import sys
import os
import json
from dotenv import load_dotenv

# Load environment variables before importing services that initialize OpenAI clients
load_dotenv(override=True)

# Ensure parent directory is in sys.path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.synthetic_dataset import get_synthetic_corpus
import memoir_service
import quality_gates

# MOCK RESPONSES FOR THE BIOGRAPHY GENERATION PIPELINE
MOCK_ORCHESTRATOR_PLAN = {
    "person_name": "Arthur Pendelton",
    "inferred_birth_decade": "1940s",
    "chapters": [
        {
            "chapter_number": 1,
            "title": "A Sandbox in Seattle",
            "era_tag": "childhood",
            "memory_ids": ["mem_01"],
            "key_events": ["Playing in the sandbox with Sarah"],
            "people_to_introduce": ["Sarah"],
            "emotional_tone": "nostalgic"
        },
        {
            "chapter_number": 2,
            "title": "Star Constellations and Library Days",
            "era_tag": "youth",
            "memory_ids": ["mem_02", "mem_03", "mem_04"],
            "key_events": ["Graduating high school", "Meeting Clara in the library", "Graduating university"],
            "people_to_introduce": ["Clara"],
            "emotional_tone": "romantic and hopeful"
        },
        {
            "chapter_number": 3,
            "title": "Teaching and Building the Future",
            "era_tag": "early_adult",
            "memory_ids": ["mem_05", "mem_06", "mem_07"],
            "key_events": ["Getting married", "Starting teaching at Garfield HS", "Building backyard observatory"],
            "people_to_introduce": [],
            "emotional_tone": "productive"
        },
        {
            "chapter_number": 4,
            "title": "The Golden Sunset",
            "era_tag": "recent",
            "memory_ids": ["mem_08", "mem_09", "mem_10"],
            "key_events": ["Retiring from Garfield HS", "Observing the night skies"],
            "people_to_introduce": [],
            "emotional_tone": "reflective"
        }
    ],
    "cross_era_themes": [
        {
            "theme": "Astronomy",
            "description": "Arthur's lifelong love for stargazing and space.",
            "appears_in_chapters": [2, 3, 4]
        }
    ],
    "voice_samples": [
        "Clara brought me hot chamomile tea.",
        "Met Clara at the university library today."
    ],
    "recurring_people": [
        {"name": "Clara", "relationship": "wife", "appears_in_chapters": [2, 3, 4]},
        {"name": "Sarah", "relationship": "sister", "appears_in_chapters": [1, 3]}
    ],
    "recurring_places": [
        {"place": "backyard observatory", "significance": "A place of lifelong dreaming and astronomical hobby.", "appears_in_chapters": [3, 4]}
    ]
}

MOCK_VOICE_GUIDE = "Voice Guide: Warm, reflective, slightly formal third-person narrator using astronomical metaphors."
MOCK_LEITMOTIFS = "Life Leitmotifs: A passion for stargazing, dedication to teaching, and loving partnership with Clara."
MOCK_CHAPTER_DRAFTS = {
    "childhood": "Arthur spent his childhood in Seattle. Here is a photo: ![Arthur and Sarah playing](https://res.cloudinary.com/demo/image/upload/v1/childhood_sandbox.jpg)",
    "youth": "Arthur attended the University of Washington and met Clara at the library in 1969.",
    "early_adult": "Arthur married Clara in August 1972 and began teaching at Garfield High.",
    "recent": "Arthur retired in 2012, or so he recalled, while sitting in his backyard observatory."
}
MOCK_ASSEMBLED = "# The Starry Life of Arthur\n\n## Childhood\nArthur spent his childhood in Seattle. ![Arthur and Sarah playing](https://res.cloudinary.com/demo/image/upload/v1/childhood_sandbox.jpg)\n\n## Youth\nArthur attended the University of Washington and met Clara at the library in 1969.\n\n## Early Adulthood\nArthur married Clara in August 1972 and began teaching at Garfield High.\n\n## Recent Years\nArthur retired in 2012, or so he recalled, while sitting in his backyard observatory."
MOCK_POLISHED = MOCK_ASSEMBLED
MOCK_FACT_CHECKED = MOCK_ASSEMBLED.replace("Arthur retired in 2012", "Arthur retired in June 2014")
MOCK_COHERENCE_RESOLVED = MOCK_FACT_CHECKED


class TestBiographyGenerationUnit(unittest.TestCase):
    """Unit tests for utility functions inside memoir_service."""

    def test_unit_calculate_word_target(self):
        """Verify target word counts scale properly with memory count."""
        # 0 memories -> should scale to lower bound
        w_min, w_max = memoir_service._calculate_word_target(0)
        self.assertEqual(w_min, 500)
        self.assertEqual(w_max, 1100)

        # 5 memories -> 5 * 250 = 1250 target -> 950 to 1550 range
        w_min, w_max = memoir_service._calculate_word_target(5)
        self.assertEqual(w_min, 950)
        self.assertEqual(w_max, 1550)

        # 20 memories -> 20 * 250 = 5000 target -> capped at 3500 -> 3200 to 3500 range
        w_min, w_max = memoir_service._calculate_word_target(20)
        self.assertEqual(w_min, 3200)
        self.assertEqual(w_max, 3500)

    def test_unit_build_character_sheet(self):
        """Verify character sheet lists people introduced in prior chapters."""
        recurring_people = [
            {"name": "Clara", "relationship": "wife", "appears_in_chapters": [2, 3]},
            {"name": "Sarah", "relationship": "sister", "appears_in_chapters": [1, 2]}
        ]

        # Chapter 1: should have no prior characters
        sheet = memoir_service._build_character_sheet(recurring_people, 1)
        self.assertIn("No recurring characters established yet", sheet)

        # Chapter 2: should list Sarah (appeared in chapter 1)
        sheet = memoir_service._build_character_sheet(recurring_people, 2)
        self.assertIn("Sarah (sister)", sheet)
        self.assertNotIn("Clara", sheet)

        # Chapter 3: should list both Clara and Sarah
        sheet = memoir_service._build_character_sheet(recurring_people, 3)
        self.assertIn("Sarah (sister)", sheet)
        self.assertIn("Clara (wife)", sheet)


class TestBiographyGenerationMocked(unittest.IsolatedAsyncioTestCase):
    """End-to-End simulation of the biography generation pipeline using Mock LLMs."""

    @patch("memoir_service.run_cerebras")
    @patch("quality_gates._run_cerebras")
    async def test_mock_pipeline_execution(self, mock_gate_cerebras, mock_cerebras):
        """Verify the full pipeline completes successfully and registers progress states."""
        # Set up mock returns
        # run_cerebras gets called sequentially:
        # 1. Orchestrate (returns plan JSON string)
        # 2. Extract Voice & Find Themes (called in gather; returns voice guide & themes)
        # 3. Write Era Chapters (called in gather for 4 chapters; returns drafts)
        # 4. Assemble (returns assembled string)
        # 5. Edit (returns polished string)
        
        # Define mock behaviors
        mock_cerebras.side_effect = [
            json.dumps(MOCK_ORCHESTRATOR_PLAN), # 1. Orchestrate
            MOCK_VOICE_GUIDE,                   # 2. Extract Voice
            MOCK_LEITMOTIFS,                    # 3. Find Themes
            MOCK_CHAPTER_DRAFTS["childhood"],   # 4. Chapter 1
            MOCK_CHAPTER_DRAFTS["youth"],       # 5. Chapter 2
            MOCK_CHAPTER_DRAFTS["early_adult"], # 6. Chapter 3
            MOCK_CHAPTER_DRAFTS["recent"],      # 7. Chapter 4
            MOCK_ASSEMBLED,                     # 8. Assemble
            MOCK_POLISHED                       # 9. Edit
        ]
        
        # Quality gates call run_cerebras in quality_gates.py
        mock_gate_cerebras.side_effect = [
            MOCK_FACT_CHECKED,          # verify_facts
            MOCK_COHERENCE_RESOLVED     # check_coherence
        ]

        progress_updates = []
        async def mock_update_progress(phase: str, pct: int):
            progress_updates.append((phase, pct))

        corpus = get_synthetic_corpus()
        
        # Execute the pipeline
        final_manuscript, plan = await memoir_service.generate_biography(
            _user_id="test_user_123",
            corpus=corpus,
            update_progress=mock_update_progress
        )

        # Validate progress updates
        expected_phases = ["planning", "writing", "assembling", "editing", "verifying"]
        actual_phases = [update[0] for update in progress_updates]
        for phase in expected_phases:
            self.assertIn(phase, actual_phases)

        # Check final output matches mocked coherence resolution (which corrected the retirement year)
        self.assertIn("Arthur retired in June 2014", final_manuscript)
        self.assertIn("![Arthur and Sarah playing](https://res.cloudinary.com/demo/image/upload/v1/childhood_sandbox.jpg)", final_manuscript)
        self.assertEqual(plan["person_name"], "Arthur Pendelton")


async def run_live_tests():
    """Run live integration tests against the Cerebras endpoints."""
    print("\n================ LIVE INTEGRATION TEST ================")
    if not os.getenv("CEREBRAS_API_KEY") or os.getenv("CEREBRAS_API_KEY") == "your_cerebras_key_here":
        print("Skipping Live Test: CEREBRAS_API_KEY environment variable not set or is placeholder.")
        return

    corpus = get_synthetic_corpus()
    print(f"Loaded synthetic corpus with {len(corpus)} entries.")

    async def update_progress(phase: str, pct: int):
        print(f"  [Progress] Phase: {phase:<12} | Progress: {pct}%")

    print("\n[Step 1] Running live biography generation pipeline (this may take a few minutes)...")
    try:
        manuscript, plan = await memoir_service.generate_biography(
            _user_id="live_test_user",
            corpus=corpus,
            update_progress=update_progress
        )

        print("\n[Step 2] Validation of Plan Output:")
        print(f"  - Inferred Person Name: {plan.get('person_name')}")
        print(f"  - Inferred Birth Decade: {plan.get('inferred_birth_decade')}")
        print(f"  - Generated Chapters Count: {len(plan.get('chapters', []))}")
        for ch in plan.get('chapters', []):
            print(f"    * Chapter {ch.get('chapter_number')}: {ch.get('title')} ({ch.get('era_tag')})")
            print(f"      Assigned memories: {ch.get('memory_ids')}")

        print("\n[Step 3] Validation of final manuscript:")
        word_count = len(manuscript.split())
        print(f"  - Manuscript length: {word_count} words")
        
        # Verify photo integration
        has_photo = "childhood_sandbox.jpg" in manuscript or "https://res.cloudinary.com" in manuscript
        print(f"  - Injected sandbox photo URL: {'YES' if has_photo else 'NO'}")

        # Verify fact correction/hedging
        # The original document states retirement in June 2014. The journal entry claims 2012/2013.
        # Let's check what the quality gates did to 2012/2013.
        mentions_2012 = "2012" in manuscript
        mentions_2013 = "2013" in manuscript
        mentions_2014 = "2014" in manuscript
        print(f"  - Mentions retirement in 2012: {'YES' if mentions_2012 else 'NO'}")
        print(f"  - Mentions retirement in 2013: {'YES' if mentions_2013 else 'NO'}")
        print(f"  - Mentions retirement in 2014: {'YES' if mentions_2014 else 'NO'}")

        print("\n================ FULL MANUSCRIPT EXCERPT ================")
        lines = manuscript.split('\n')
        for line in lines[:60]: # Print first 60 lines
            print(line)
        if len(lines) > 60:
            print("...")
        print("=========================================================")

        # Save full manuscript to a file
        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generated_biography.md")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(manuscript)
        print(f"\nSaved full manuscript to: {out_path}")

        print("\nLive Integration Test Completed Successfully!")
    except Exception as e:
        print(f"\nLive integration test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if "--live" in sys.argv:
        asyncio.run(run_live_tests())
    else:
        unittest.main()
