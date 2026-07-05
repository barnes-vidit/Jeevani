import asyncio
from typing import List, Dict, Any
from datetime import datetime


class HarvestService:
    """
    Phase 1: Pull every memory the user has ever stored.

    Decision 5: No Pinecone involved here. All document text is fetched directly
    from MongoDB (memories.chunks) and chat history from journalentries.
    Mongo is the source of truth; Pinecone is a rebuildable shortcut used only
    during live chat.
    """

    def __init__(self, mongo_db):
        # Note: pinecone_index argument removed — harvest no longer needs it.
        self.db = mongo_db

    async def harvest_all(self, user_id: str) -> List[Dict[str, Any]]:
        """Returns unified memory corpus sorted chronologically."""
        memories, journals = await asyncio.gather(
            self._fetch_all_memories(user_id),
            self._fetch_all_journals(user_id),
        )

        # Build corpus from MongoDB Memory documents
        corpus = []
        for mem in memories:
            created_at = mem.get('createdAt', datetime.now())
            if not isinstance(created_at, datetime):
                created_at = datetime.now()

            # Reconstruct full text from ordered chunks (Decision 3)
            chunks = mem.get('chunks', [])
            if chunks:
                # Sort by chunk index to restore document order
                ordered_chunks = sorted(chunks, key=lambda c: c.get('index', 0))
                full_text = '\n\n'.join(c.get('text', '') for c in ordered_chunks)
            else:
                # Graceful fallback for documents processed before Decision 3 landed
                full_text = ''

            # Determine if this is an image (for photo embedding in biography)
            file_type = mem.get('fileType', '')
            is_image = file_type.startswith('image/')
            cloud_url = mem.get('cloudUrl', '')

            if not full_text and not is_image:
                # Skip documents with no usable content
                continue

            corpus.append({
                'id': str(mem['_id']),
                'era': self._assign_era(created_at),
                'date': created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
                'source_type': file_type if file_type else 'document',
                'original_name': mem.get('originalName', ''),
                'text': full_text,
                'summary': mem.get('summary', ''),
                'image_url': cloud_url if is_image else ''
            })

        # Add journal entries (user messages only — the actual spoken life content)
        for journal in journals:
            date = journal.get('created_at', datetime.now())
            if not isinstance(date, datetime):
                date = datetime.now()
            messages = journal.get('messages', [])
            user_messages = [m['content'] for m in messages if m.get('role') == 'user']
            if user_messages:
                corpus.append({
                    'id': f"journal_{journal['_id']}",
                    'era': self._assign_era(date),
                    'date': date.isoformat() if isinstance(date, datetime) else str(date),
                    'source_type': 'journal',
                    'original_name': f"Journal entry {journal.get('date', '')}",
                    'text': '\n'.join(user_messages),
                    'summary': journal.get('summary', '')  # Decision 4: include session summary if present
                })

        # Sort chronologically
        corpus.sort(key=lambda x: x['date'])
        return corpus

    async def _fetch_all_memories(self, user_id: str) -> List[Dict]:
        """
        Fetch all Memory documents for the user from MongoDB, sorted by upload date.
        Each document includes its full text via the chunks array (Decision 3).
        """
        cursor = self.db['memories'].find(
            {"clerkUserId": user_id},
            sort=[("createdAt", 1)]
        )
        return await cursor.to_list(length=None)

    async def _fetch_all_journals(self, user_id: str) -> List[Dict]:
        """Fetches all journal entries from MongoDB."""
        cursor = self.db['journalentries'].find(
            {"userId": user_id},
            sort=[("created_at", 1)]
        )
        return await cursor.to_list(length=None)

    def _assign_era(self, date: datetime) -> str:
        """
        Assigns era tag based on upload date.
        The Orchestrator will refine these based on content context
        (e.g. "school", "university", "first job") during planning.
        """
        now = datetime.now()
        try:
            years_ago = (now - date).days / 365
        except Exception:
            return 'recent'

        if years_ago > 15:
            return 'childhood'
        elif years_ago > 10:
            return 'youth'
        elif years_ago > 5:
            return 'early_adult'
        elif years_ago > 2:
            return 'adult'
        else:
            return 'recent'
