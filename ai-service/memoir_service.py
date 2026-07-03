import asyncio
import json
import os
from openai import AsyncOpenAI
from typing import List, Dict, Callable, Awaitable, Tuple
from quality_gates import verify_facts, check_coherence, CEREBRAS_RATE_LIMITER

# --- Model configuration ---

CEREBRAS_CLIENT = AsyncOpenAI(
    base_url=os.getenv("CEREBRAS_BASE_URL", "https://api.cerebras.ai/v1"),
    api_key=os.getenv("CEREBRAS_API_KEY") or "mock-key"
)

# Models loaded dynamically from environment variables
ORCHESTRATOR_MODEL = os.getenv("CEREBRAS_ORCHESTRATOR_MODEL", "llama-3.3-70b")
CHAPTER_MODEL = os.getenv("CEREBRAS_CHAPTER_MODEL", "llama-3.3-70b")
THEMES_MODEL = os.getenv("CEREBRAS_THEMES_MODEL", "llama-3.3-70b")
VOICE_MODEL = os.getenv("CEREBRAS_VOICE_MODEL", "llama-3.3-70b")
EDITOR_MODEL = os.getenv("CEREBRAS_EDITOR_MODEL", "llama-3.3-70b")

# --- Agent Prompts ---

ORCHESTRATOR_SYSTEM = """
You are the orchestrating intelligence for a biography generation system.
You will receive a complete corpus of a person's life memories, documents,
photos, audio transcripts, and journal conversations.

Your job is to produce a structured biography plan — NOT the biography itself.

IMPORTANT: The `date` field on each memory entry reflects when the file was
UPLOADED to this app, not when the event described occurred. A childhood photo
scanned last week will have a recent date. You MUST infer the actual time period
of each memory by reading its text content carefully — look for explicit dates,
age references, school/college/work contexts, season references, and cultural
markers. Do NOT trust the `date` field for era classification; use it only as a
rough hint when no content-based date can be found.

Output a JSON object with this exact structure:
{
  "person_name": "...",
  "inferred_birth_decade": "...",
  "chapters": [
    {
      "chapter_number": 1,
      "title": "...",
      "era_tag": "childhood|youth|early_adult|adult|recent",
      "memory_ids": ["list of memory IDs assigned to this chapter"],
      "key_events": ["brief list of major events to cover"],
      "people_to_introduce": ["names of important people first appearing here"],
      "emotional_tone": "..."
    }
  ],
  "cross_era_themes": [
    {
      "theme": "...",
      "description": "...",
      "appears_in_chapters": [1, 3, 5]
    }
  ],
  "voice_samples": ["3-5 direct quotes from journal entries that best capture the person's voice"],
  "recurring_people": [{"name": "...", "relationship": "...", "appears_in_chapters": [...]}],
  "recurring_places": [{"place": "...", "significance": "...", "appears_in_chapters": [...]}]
}

Output ONLY the JSON object. No preamble, no explanation.
"""

ORCHESTRATOR_USER = """
Here is the complete memory corpus for this person:

{corpus_json}

Plan their biography. Infer the true chronological order of events from the
content of each memory (not the upload date). Reason carefully about what the
most important events and themes are, and how to structure a compelling narrative arc.
"""

ERA_AGENT_SYSTEM = """
You are a biographer writing one chapter of a person's life story.
You have been given:
1. A curated set of their memories, documents, and journal excerpts from this period
2. A chapter brief from the biography director
3. A Voice Guide describing the person's authentic voice and speaking style
4. A Character Sheet listing recurring people across the biography (so you never re-introduce someone already established)
5. Key people and places to introduce or develop
6. The emotional tone this chapter should carry
7. A target word count for this chapter

Write in third person, past tense, warm and literary style.
Write prose — no bullet points, no headers within the chapter body, no lists.
Aim for the target word count range given in the brief.
Every fact you state must come from the provided memories — do not invent.

If a memory includes a PHOTO URL, embed the image at a natural point in the narrative
using markdown: ![brief caption](url). Only do this when the photo enriches the prose.

If memories for this period are very sparse, write a short, graceful bridge paragraph
that acknowledges the gap poetically ("These years left few records behind, though...").
Do NOT write "[GAP: ...]" tags — always write prose, even for sparse eras.

End the chapter with a natural transition that points toward the next era of life.
"""

ERA_AGENT_USER = """
Chapter brief:
{chapter_brief}

Voice Guide (write this chapter in a style consistent with this voice):
{voice_guide}

Character Sheet (recurring people — do NOT re-introduce them as strangers):
{character_sheet}

Memories assigned to this chapter:
{memory_chunks}

Write this chapter of the biography. Target word count: {word_min}–{word_max} words.
"""

THEMES_SYSTEM = """
You are a literary analyst working on a biography.
You will read a complete corpus of a person's life memories.

Your job is to identify the deep recurring themes of their life.
Look for:
- Values that appear consistently across decades
- Relationships that kept evolving (parents, siblings, partners, mentors)
- Places that held symbolic importance
- Emotional patterns (how they handled hardship, what brought joy)
- Professional or creative throughlines
- Contradictions and how they resolved over time

Output a document called "Life Leitmotifs" — written as flowing prose paragraphs,
not a list. This document will be given to the assembler to weave into the full biography
as recurring threads that connect the chapters.

Length: 400–600 words.
"""

THEMES_USER = """
Complete memory corpus:
{full_corpus}

Identify and write the life leitmotifs document.
"""

VOICE_SYSTEM = """
You are a writing style analyst.
You will read a person's journal entries and conversations to extract their authentic voice.

Produce a "Voice Guide" document covering:
1. Sentence structure (long and complex? short and punchy? mixed?)
2. Vocabulary register (formal? casual? technical? colloquial?)
3. Humor style (dry? self-deprecating? absent? absurdist?)
4. Emotional expressiveness (guarded? open? philosophical? practical?)
5. Characteristic phrases or expressions they repeat
6. How they describe people they love vs. people they struggle with
7. Three example sentences in their style (invented, capturing the essence)

This guide will be given to the era agents and assembler to ensure the biography
sounds like it was written *about* them in a way they would recognize as true.

Length: 300–500 words.
"""

VOICE_USER = """
Journal entries and conversation history:
{journal_text}

Produce the Voice Guide.
"""
ASSEMBLER_SYSTEM = """
You are a senior biographer and literary editor.
You have received:
- Multiple chapter drafts covering different eras of a person's life
- A "Life Leitmotifs" document identifying recurring themes
- A "Voice Guide" describing the person's authentic voice and style

Your job is to:
1. Weave the chapters into one continuous, seamless narrative
2. Write a compelling opening (Prologue or Introduction) that draws the reader in
3. Write a reflective Epilogue
4. Ensure the leitmotifs appear as natural recurring threads, not forced references
5. Apply the voice guide to unify tone across chapters
6. Resolve any contradictions between chapters
7. Write chapter transitions that feel organic, not mechanical
8. Add a title for the biography
9. Convert any remaining [GAP: ...] annotations into graceful narrative prose
   (e.g., "These years left few records behind, though shadows of them linger...")
   Never leave raw annotation tags in the final output.
10. Do not remove or alter any inline images (markdown image tags) embedded in the chapter drafts — preserve them exactly in their correct locations in the narrative.

The final biography should read like a book a respected publisher would consider.
Not a diary. Not a report. A genuine narrative account of a human life.

Output format: structured markdown with chapter headings.
Use # for the biography title, ## for chapter titles, ### for section breaks within chapters.
"""


ASSEMBLER_USER = """
Chapter drafts:
{era_drafts}

Life Leitmotifs:
{leitmotifs}

Voice Guide:
{voice_guide}

Assemble the complete biography. Reason carefully about narrative arc, pacing,
and how to make the whole greater than the sum of its parts.
"""

EDITOR_SYSTEM = """
You are a professional copy editor working on a biography manuscript.
Your job is prose quality only — do not change facts, do not add new events,
do not alter the structure or chapter order.

Focus on:
1. Sentence variety (avoid monotonous rhythm)
2. Word choice (replace weak or generic words with precise ones)
3. Repetition (same word or phrase used too close together)
4. Pacing (identify sections that drag and tighten them; identify thin sections)
5. Transitions between paragraphs (ensure flow)
6. Opening lines of each chapter (should hook the reader)
7. Consistency of tense (all past tense) and person (all third person)

Return the full edited manuscript. Do not add editor's notes or comments.
Do not remove any inline images (markdown image tags) — preserve them exactly.
"""

EDITOR_USER = """
Manuscript to edit:
{assembled_manuscript}

Return the polished final manuscript.
"""


# --- LLM callers ---

async def run_cerebras(system: str, user: str, model: str, max_tokens: int = 8000) -> str:
    """Call Cerebras API for memoir tasks using environment-specified model."""
    await CEREBRAS_RATE_LIMITER.acquire()
    response = await CEREBRAS_CLIENT.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        max_tokens=max_tokens
    )
    return response.choices[0].message.content


# --- Agent functions ---

async def orchestrate(corpus: List[Dict]) -> Dict:
    """Phase 2, Step 1: Plan the biography structure."""
    trimmed = []
    for m in corpus:
        entry = dict(m)
        entry['text'] = m['text'][:3000] if m.get('text') else ''
        trimmed.append(entry)

    corpus_json = json.dumps(trimmed, indent=2, default=str)
    result = await run_cerebras(
        ORCHESTRATOR_SYSTEM,
        ORCHESTRATOR_USER.format(corpus_json=corpus_json),
        model=ORCHESTRATOR_MODEL,
        max_tokens=8000
    )
    try:
        start = result.find('{')
        end = result.rfind('}') + 1
        return json.loads(result[start:end])
    except Exception as e:
        print(f"[memoir] Orchestrator JSON parse error: {e}")
        return {"chapters": [], "cross_era_themes": [], "voice_samples": [], "recurring_people": [], "recurring_places": []}


def _calculate_word_target(num_memories: int) -> tuple:
    """Scale chapter length with memory richness: sparse eras get shorter chapters."""
    target = min(3500, max(800, num_memories * 250))
    word_min = max(500, target - 300)
    word_max = min(3500, target + 300)
    return word_min, word_max


def _build_character_sheet(recurring_people: List[Dict], chapter_number: int) -> str:
    """Build a character sheet for people introduced in prior chapters."""
    prior_people = [
        p for p in recurring_people
        if any(c < chapter_number for c in p.get('appears_in_chapters', []))
    ]
    if not prior_people:
        return "No recurring characters established yet — introduce people naturally."
    lines = ["People already introduced in earlier chapters (do not re-introduce as strangers):"]
    for p in prior_people:
        lines.append(f"- {p['name']} ({p['relationship']})")
    return '\n'.join(lines)


async def write_era_chapter(
    chapter_brief: Dict,
    memory_chunks: List[Dict],
    voice_guide: str,
    recurring_people: List[Dict]
) -> str:
    """One era agent writes one chapter draft."""
    word_min, word_max = _calculate_word_target(len(memory_chunks))
    character_sheet = _build_character_sheet(recurring_people, chapter_brief.get('chapter_number', 1))

    chunk_parts = []
    for m in memory_chunks:
        text_block = (
            f"[{m.get('source_type', 'document')} — {m.get('original_name', '')} — {m.get('date', '')}]\n"
            f"{m.get('text', '')[:5000]}"
        )
        if m.get('image_url'):
            text_block += f"\n[PHOTO URL: {m['image_url']}]"
        chunk_parts.append(text_block)

    chunks_text = '\n\n---\n\n'.join(chunk_parts) if chunk_parts else "[No memories assigned to this chapter]"

    return await run_cerebras(
        ERA_AGENT_SYSTEM,
        ERA_AGENT_USER.format(
            chapter_brief=json.dumps(chapter_brief, indent=2, default=str),
            voice_guide=voice_guide,
            character_sheet=character_sheet,
            memory_chunks=chunks_text,
            word_min=word_min,
            word_max=word_max
        ),
        model=CHAPTER_MODEL,
        max_tokens=6000
    )


async def find_themes(full_corpus: List[Dict]) -> str:
    """Themes agent — cross-era pattern analysis."""
    corpus_text = '\n\n---\n\n'.join([m['text'][:1200] for m in full_corpus if m.get('text')])
    if not corpus_text.strip():
        return "No memories found to analyze for themes."
    return await run_cerebras(
        THEMES_SYSTEM,
        THEMES_USER.format(full_corpus=corpus_text[:100000]),
        model=THEMES_MODEL,
        max_tokens=2000
    )


async def extract_voice(corpus: List[Dict]) -> str:
    """Voice agent — reads journal entries to extract writing style."""
    journal_entries = [m for m in corpus if m.get('source_type') == 'journal']
    journal_text = '\n\n'.join([m['text'] for m in journal_entries[:30] if m.get('text')])
    if not journal_text.strip():
        return "No journal entries found. Write in a warm, reflective, literary third-person style."
    return await run_cerebras(
        VOICE_SYSTEM,
        VOICE_USER.format(journal_text=journal_text[:30000]),
        model=VOICE_MODEL,
        max_tokens=2000
    )


async def assemble(era_drafts: Dict[str, str], leitmotifs: str, voice_guide: str) -> str:
    """Assembler agent — weaves all drafts into one continuous narrative."""
    drafts_text = '\n\n===\n\n'.join([
        f"CHAPTER: {era}\n\n{draft}"
        for era, draft in era_drafts.items()
    ])
    return await run_cerebras(
        ASSEMBLER_SYSTEM,
        ASSEMBLER_USER.format(
            era_drafts=drafts_text,
            leitmotifs=leitmotifs,
            voice_guide=voice_guide
        ),
        model=ORCHESTRATOR_MODEL,
        max_tokens=32000
    )


async def edit(manuscript: str) -> str:
    """Editor agent — final prose polish using DeepSeek."""
    return await run_cerebras(
        EDITOR_SYSTEM,
        EDITOR_USER.format(assembled_manuscript=manuscript),
        model=EDITOR_MODEL,
        max_tokens=32000
    )


# --- Full pipeline ---

async def generate_biography(
    _user_id: str,
    corpus: List[Dict],
    update_progress: Callable[[str, int], Awaitable[None]]
) -> Tuple[str, Dict]:
    """
    Full pipeline. update_progress(phase, pct) updates the BiographyJob in MongoDB.
    Returns (manuscript, plan) tuple.
    """
    await update_progress('planning', 10)

    # Step 1: Orchestrate — plan the biography structure
    plan = await orchestrate(corpus)
    await update_progress('planning', 20)

    chapters = plan.get('chapters', [])
    recurring_people = plan.get('recurring_people', [])

    # Fallback: if orchestrator returned no chapters, create one per era
    if not chapters:
        eras = list({m['era'] for m in corpus})
        chapters = [
            {'chapter_number': i + 1, 'era_tag': era, 'title': era.replace('_', ' ').title(),
             'memory_ids': [], 'key_events': [], 'emotional_tone': 'reflective'}
            for i, era in enumerate(eras)
        ]

    # Step 2: Phase A — extract voice and themes first (voice is needed by era agents)
    await update_progress('writing', 25)
    voice_guide, leitmotifs = await asyncio.gather(
        extract_voice(corpus),
        find_themes(corpus)
    )

    # Step 3: Phase B — build memory lookup, then run era agents with voice context
    corpus_by_id = {m['id']: m for m in corpus}

    # Pre-compute the set of all memory IDs that the orchestrator explicitly assigned
    # so the fallback can hand unassigned memories to chapters that got none.
    all_assigned_ids = set()
    for ch in chapters:
        all_assigned_ids.update(ch.get('memory_ids', []))

    async def write_chapter(chapter: Dict):
        chapter_memories = [
            corpus_by_id[mid] for mid in chapter.get('memory_ids', [])
            if mid in corpus_by_id
        ]
        if not chapter_memories:
            # The upload-date era tag is unreliable (uploaded today ≠ event happened today).
            # Instead, give this chapter the memories the orchestrator left unassigned,
            # so the LLM can apply its own content-based chronological reasoning.
            unassigned = [m for m in corpus if m['id'] not in all_assigned_ids]
            chapter_memories = unassigned if unassigned else corpus
        era_tag = chapter.get('era_tag', 'unknown')
        draft = await write_era_chapter(chapter, chapter_memories, voice_guide, recurring_people)
        return era_tag, draft

    era_results = await asyncio.gather(*[write_chapter(ch) for ch in chapters])

    era_drafts = {}
    for era_tag, draft in era_results:
        if era_tag in era_drafts:
            era_drafts[era_tag] += '\n\n' + draft
        else:
            era_drafts[era_tag] = draft

    await update_progress('assembling', 65)

    # Step 4: Assemble into one continuous narrative
    assembled = await assemble(era_drafts, leitmotifs, voice_guide)
    await update_progress('editing', 80)

    # Step 5: Polish the prose
    polished = await edit(assembled)
    await update_progress('verifying', 90)

    # Phase 3: Quality gates
    fact_checked = await verify_facts(polished, corpus)
    await update_progress('verifying', 95)
    final = await check_coherence(fact_checked)

    return final, plan
