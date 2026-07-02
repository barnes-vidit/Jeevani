import asyncio
from typing import List, Dict, Any
from datetime import datetime


class HarvestService:
    """
    Phase 1: Pull every memory the user has ever stored.
    No semantic search — this is a complete data dump.
    """

    def __init__(self, pinecone_index, mongo_db):
        self.index = pinecone_index
        self.db = mongo_db

    async def harvest_all(self, user_id: str) -> List[Dict[str, Any]]:
        """Returns unified memory corpus sorted chronologically."""
        memories, journals, metadata = await asyncio.gather(
            self._fetch_all_vectors(user_id),
            self._fetch_all_journals(user_id),
            self._fetch_all_metadata(user_id)
        )

        # Build metadata lookup for fast access
        meta_lookup = {str(m['_id']): m for m in metadata}

        # Collapse vector chunks back to source documents
        doc_map = {}
        for vec in memories:
            doc_id = vec.metadata.get('docId', vec.id)
            if doc_id not in doc_map:
                created_at = meta_lookup.get(doc_id, {}).get('createdAt', datetime.now())
                if not isinstance(created_at, datetime):
                    created_at = datetime.now()
                doc_map[doc_id] = {
                    'doc_id': doc_id,
                    'source_type': vec.metadata.get('type', 'document'),
                    'original_name': vec.metadata.get('originalName', ''),
                    'chunks': [],
                    'created_at': created_at,
                    'summary': meta_lookup.get(doc_id, {}).get('summary', ''),
                    'image_url': vec.metadata.get('cloudUrl', '') if vec.metadata.get('type') == 'image' else ''
                }
            chunk_text = vec.metadata.get('text', '')
            if chunk_text:
                doc_map[doc_id]['chunks'].append(chunk_text)

        # Combine chunks per document into full text
        corpus = []
        for doc_id, doc in doc_map.items():
            corpus.append({
                'id': doc_id,
                'era': self._assign_era(doc['created_at']),
                'date': doc['created_at'].isoformat() if isinstance(doc['created_at'], datetime) else str(doc['created_at']),
                'source_type': doc['source_type'],
                'original_name': doc['original_name'],
                'text': '\n\n'.join(doc['chunks']),
                'summary': doc['summary'],
                'image_url': doc.get('image_url', '')
            })

        # Add journal entries as a special source type
        for journal in journals:
            date = journal.get('created_at', datetime.now())
            if not isinstance(date, datetime):
                date = datetime.now()
            messages = journal.get('messages', [])
            # Only include user messages — filter out AI responses
            user_messages = [m['content'] for m in messages if m.get('role') == 'user']
            if user_messages:
                corpus.append({
                    'id': f"journal_{journal['_id']}",
                    'era': self._assign_era(date),
                    'date': date.isoformat() if isinstance(date, datetime) else str(date),
                    'source_type': 'journal',
                    'original_name': f"Journal entry {journal.get('date', '')}",
                    'text': '\n'.join(user_messages),
                    'summary': ''
                })

        # Sort chronologically
        corpus.sort(key=lambda x: x['date'])
        return corpus

    async def _fetch_all_vectors(self, user_id: str) -> List[Any]:
        """
        Fetches ALL vectors for user — no semantic query, just filter scan.
        Runs sync Pinecone call in thread pool to avoid blocking the event loop.
        Note: top_k=1000 — raise limit in Pinecone index settings if user has more vectors.
        """
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: self.index.query(
                vector=[0.0] * 768,   # Dummy vector — we want filter scan, not similarity
                top_k=1000,
                filter={"userId": user_id},
                include_metadata=True
            )
        )
        return results.matches

    async def _fetch_all_journals(self, user_id: str) -> List[Dict]:
        """Fetches all journal entries from MongoDB."""
        cursor = self.db['journalentries'].find(
            {"userId": user_id},
            sort=[("created_at", 1)]
        )
        return await cursor.to_list(length=None)

    async def _fetch_all_metadata(self, user_id: str) -> List[Dict]:
        """Fetches all Memory documents from MongoDB."""
        cursor = self.db['memories'].find({"clerkUserId": user_id})
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
