import os
import asyncio
import time
from openai import AsyncOpenAI
from typing import List, Dict

class AsyncRateLimiter:
    """Limits request execution rate using an async lock and minimum interval."""
    def __init__(self, requests_per_minute: float):
        self.interval = 60.0 / requests_per_minute
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.interval:
                wait_time = self.interval - elapsed
                await asyncio.sleep(wait_time)
            self._last_call = time.monotonic()

# Enforce spacing of ~13.3 seconds between requests to safely stay below 5 RPM
CEREBRAS_RATE_LIMITER = AsyncRateLimiter(4.5)

_client = AsyncOpenAI(
    base_url=os.getenv("CEREBRAS_BASE_URL", "https://api.cerebras.ai/v1"),
    api_key=os.getenv("CEREBRAS_API_KEY")
)
_COHERENCE_MODEL = os.getenv("CEREBRAS_COHERENCE_MODEL", "llama-3.3-70b")
_FACT_CHECKER_MODEL = os.getenv("CEREBRAS_FACT_CHECKER_MODEL", "llama-3.3-70b")

FACT_VERIFIER_SYSTEM = """
You are a careful fact-editor for a biography manuscript.
You will receive:
1. A complete biography manuscript
2. The original source corpus (memories, documents, journal excerpts)

Your job is to CORRECT the manuscript, not merely flag it:
- For every specific factual claim (dates, names, places, events), check whether the
  source corpus supports it.
- If a claim is well-supported by the corpus, leave it exactly as written.
- If a claim cannot be verified in the corpus but is plausible given context, soften
  it with hedging language — e.g. change "in 1987" to "around 1987" or add phrases
  like "as he later recalled," "by family accounts," or "reportedly."
- If a claim directly contradicts the corpus (wrong name, wrong city, wrong year),
  correct it to match what the corpus actually says.
- If a claim appears to have been entirely invented with no basis in the corpus
  whatsoever, remove that sentence gracefully so the surrounding prose still reads
  naturally.

Return the fully corrected manuscript — clean prose, no annotation tags of any kind. Preserve any inline images (markdown image tags) exactly as they are.
Do not add editor's notes. Do not explain your changes. Just return the corrected text.
"""

COHERENCE_SYSTEM = """
You are a continuity editor for a biography manuscript.
Your job is to FIX problems you find — not tag them.

Read the manuscript carefully and correct any of the following:
1. Timeline impossibilities (e.g., person described as a child in a chapter that follows
   a chapter where they were already an adult) — resolve by adjusting the conflicting
   description to match the most credible chronology.
2. Character inconsistencies (same person referred to by two different names without
   explanation) — standardise to whichever name is used most consistently.
3. Orphaned references ("as we saw earlier" with no prior mention) — either remove the
   callback phrase or briefly supply the missing context inline.
4. Factual contradictions between chapters (different years given for the same event) —
   pick the most specific / best-supported version and make it consistent throughout.

Return the fully corrected manuscript — clean prose, no annotation tags of any kind. Preserve any inline images (markdown image tags) exactly as they are.
If no issues are found, return the manuscript unchanged.
Do not add editor's notes. Do not explain your changes. Just return the corrected text.
"""


async def _run_cerebras(system: str, user: str, model: str) -> str:
    await CEREBRAS_RATE_LIMITER.acquire()
    response = await _client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        max_tokens=32000
    )
    return response.choices[0].message.content


async def verify_facts(manuscript: str, corpus: List[Dict]) -> str:
    """Cross-reference every factual claim in the manuscript against the source corpus."""
    corpus_text = '\n\n---\n\n'.join([
        f"[{m.get('source_type', 'unknown')} | {m.get('original_name', '')} | {m.get('date', '')}]\n{m.get('text', '')[:2500]}"
        for m in corpus if m.get('text')
    ])
    user_prompt = (
        f"Biography manuscript:\n{manuscript}\n\n"
        f"Source corpus:\n{corpus_text[:50000]}\n\n"
        "Flag any factual claims in the manuscript not supported by the source corpus."
    )
    try:
        return await _run_cerebras(FACT_VERIFIER_SYSTEM, user_prompt, _FACT_CHECKER_MODEL)
    except Exception as e:
        print(f"[quality_gates] fact verifier error: {e}")
        return manuscript


async def check_coherence(manuscript: str) -> str:
    """Check for timeline, character, and cross-chapter consistency issues."""
    user_prompt = (
        f"Biography manuscript:\n\n{manuscript}\n\n"
        "Check for timeline inconsistencies, character name mismatches, "
        "orphaned references, and factual contradictions between chapters."
    )
    try:
        return await _run_cerebras(COHERENCE_SYSTEM, user_prompt, _COHERENCE_MODEL)
    except Exception as e:
        print(f"[quality_gates] coherence checker error: {e}")
        return manuscript
