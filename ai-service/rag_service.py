import os
from pinecone import Pinecone
from groq import Groq
from typing import List, Dict, Optional
import time
from google import genai
from google.genai import types

# Common words that add noise when matching query terms against file names.
# Filtered out before keyword re-ranking so only meaningful terms contribute.
_STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of',
    'my', 'your', 'his', 'her', 'our', 'its', 'was', 'is', 'are', 'be',
    'been', 'with', 'by', 'from', 'this', 'that', 'it', 'me', 'he', 'she',
    'we', 'they', 'but', 'not', 'what', 'when', 'how', 'did', 'do', 'about',
    'tell', 'me', 'you', 'i', 'am', 'so', 'just', 'like', 'more', 'some',
}


class PineconeRAG:
    def __init__(self):
        self.pc = None
        self.index = None
        self.embed_model = "models/gemini-embedding-001"
        self.groq_client = None
        self.genai_client = None  
        
        try:
            gemini_key = os.getenv("GEMINI_API_KEY")
            self.genai_client = genai.Client(api_key=gemini_key)
            
            groq_key = os.getenv("GROQ_API_KEY")
            self.groq_client = Groq(api_key=groq_key)
            self.model = "llama-3.3-70b-versatile"
            
            # Configure Pinecone
            self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
            self.index_name = "jeevani-index"
            
            # Create index if not exists (Basic check)
            try:
                existing_indexes = [i.name for i in self.pc.list_indexes()]
                if self.index_name not in existing_indexes:
                    from pinecone import ServerlessSpec
                    self.pc.create_index(
                        name=self.index_name,
                        dimension=768,
                        metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region="us-east-1")
                    )
            except Exception as e:
                print(f"Index check/creation warning: {e}")

            self.index = self.pc.Index(self.index_name)
            print("PineconeRAG initialized successfully")
            
        except Exception as e:
            print(f"CRITICAL: PineconeRAG initialization failed: {e}")
            pass

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text using google.genai Client"""
        result = self.genai_client.models.embed_content(
            model=self.embed_model,
            contents=text,
            config=types.EmbedContentConfig(
                output_dimensionality=768
            )
        )
        embedding = result.embeddings[0].values
        print("Embedding length:", len(embedding))
        return embedding

    def ingest_text(self, text: str, meta: Dict, chunk_size: int = 1000) -> Dict:
        """Chunk text, embed, and upsert to Pinecone.

        Returns a dict with:
          - chunks_processed (int): total number of chunks
          - chunks (list[dict]): ordered list of {index, text} for MongoDB storage
        """
        chunks = self._chunk_text(text, chunk_size)
        vectors = []
        chunk_records = []  # For MongoDB persistence (Decision 3)

        base_id = f"{meta.get('userId')}_{meta.get('docId')}"

        for i, chunk in enumerate(chunks):
            embedding = self.embed_text(chunk)
            vector_id = f"{base_id}_{i}"

            # Store only pointer metadata in Pinecone — full text lives in MongoDB (Decision 6)
            metadata = meta.copy()
            metadata['chunk_index'] = i
            # NOTE: 'text' is intentionally NOT stored here; MongoDB is the text source of truth

            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": metadata
            })

            chunk_records.append({"index": i, "text": chunk})

            if len(vectors) >= 50:
                self.index.upsert(vectors=vectors)
                vectors = []

        if vectors:
            self.index.upsert(vectors=vectors)

        return {"chunks_processed": len(chunks), "chunks": chunk_records}


    def generate_summary(self, text: str, original_name: str) -> str:
        """Generate a 2-3 sentence summary of a document using the LLM."""
        if not self.groq_client:
            return ""
        try:
            # Truncate to avoid token limits
            snippet = text[:3000]
            completion = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You summarize documents in 2-3 concise sentences."},
                    {"role": "user", "content": f"Summarize this document titled '{original_name}':\n\n{snippet}"}
                ],
                temperature=0.3,
                max_tokens=150,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Summary generation failed: {e}")
            return ""

    def _chunk_text(self, text: str, size: int, overlap: int = 150) -> List[str]:
        """Sentence-aware chunking with overlap to avoid context loss at boundaries."""
        import re
        # Split on sentence boundaries (period, exclamation, question mark followed by space)
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        
        chunks = []
        current_chunk = []
        current_len = 0
        
        for sentence in sentences:
            sentence_len = len(sentence)
            if current_len + sentence_len > size and current_chunk:
                # Save the current chunk
                chunks.append(" ".join(current_chunk))
                
                # Build overlap: keep trailing sentences that fit within overlap budget
                overlap_chunk = []
                overlap_len = 0
                for s in reversed(current_chunk):
                    if overlap_len + len(s) > overlap:
                        break
                    overlap_chunk.insert(0, s)
                    overlap_len += len(s) + 1
                
                current_chunk = overlap_chunk
                current_len = overlap_len
            
            current_chunk.append(sentence)
            current_len += sentence_len + 1
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks

    def search_similar(self, query: str, user_id: str, top_k: int = 10) -> List[Dict]:
        """Search Pinecone for semantically relevant vector IDs.

        Returns a list of dicts with keys:
          - vector_id  (str):  full Pinecone vector ID, e.g. '{userId}_{docId}_{chunkIndex}'
          - doc_id     (str):  MongoDB Memory _id
          - chunk_index (int): chunk position within that document
          - original_name (str): human-readable file name
          - score      (float): cosine similarity score
          - source_type (str): 'text', 'image', 'audio', 'chat', etc.

        Text is NOT returned here; caller must fetch it from MongoDB.
        """
        q_embedding = self.embed_text(query)

        results = self.index.query(
            vector=q_embedding,
            top_k=top_k,
            filter={"userId": user_id},
            include_metadata=True
        )

        # Keyword re-ranking on file name tokens.
        # Stopwords are filtered to prevent common words ('my', 'the', 'was')
        # from incorrectly boosting unrelated files.
        # Weight is 0.1 (down from 0.3) because file names carry limited signal;
        # the contextual query embedding (Phase A) makes cosine dominant.
        query_keywords = set(query.lower().split()) - _STOPWORDS
        ranked = []
        for match in results.matches:
            meta = match.metadata or {}
            # Split on both spaces and underscores/hyphens common in file names
            raw_name = meta.get('originalName', '').lower().replace('_', ' ').replace('-', ' ')
            name_words = set(raw_name.split()) - _STOPWORDS
            overlap = len(query_keywords & name_words)
            keyword_score = overlap / max(len(query_keywords), 1) if query_keywords else 0
            hybrid_score = 0.9 * match.score + 0.1 * keyword_score
            ranked.append((hybrid_score, match))

        ranked.sort(key=lambda x: x[0], reverse=True)

        matches = []
        for hybrid_score, match in ranked[:5]:
            meta = match.metadata or {}
            # Parse docId and chunkIndex from the vector ID: '{userId}_{docId}_{chunkIndex}'
            parts = match.id.rsplit('_', 1)
            chunk_index = int(parts[1]) if len(parts) == 2 and parts[1].isdigit() else 0
            doc_id = meta.get('docId', '')
            matches.append({
                'vector_id': match.id,
                'doc_id': doc_id,
                'chunk_index': chunk_index,
                'original_name': meta.get('originalName', 'Unknown'),
                'score': hybrid_score,
                'source_type': meta.get('type', 'document'),
            })

        return matches

    def generate_answer(
        self,
        context_parts: List[Dict],
        query: str,
        chat_history: List[Dict] = None
    ) -> str:
        """Generate a biographer response given pre-fetched context chunks.

        context_parts: list of dicts with 'original_name', 'score', 'text' keys.
        """
        if not self.groq_client:
            return "Error: AI Service not fully initialized (Missing Groq Client). Please check GROQ_API_KEY."

        if context_parts:
            context = "\n\n".join(
                f"Source ({c.get('score', 0):.2f}): {c.get('original_name', 'Unknown')}\n{c.get('text', '')}"
                for c in context_parts
            )
        else:
            context = "[No relevant archived memories found. Rely on the user's input.]"

        system_msg = {"role": "system", "content": "You are a helpful personal biographer assistant named Jeevani."}

        prompt = f"""You are 'Jeevani', a personal biographer. Use the context below to answer the user's question or continue the conversation.

Context:
{context}

User Input: {query}

**Your Goal:**
You are not just a chatbot; you are a biographer. Your mission is to document the user's life story.
1. **The Active Interviewer:** Don't just answer; explore. Chase the story. Ask about "sensory details" (smells, sounds, feelings).
2. **The Connector:** Use the provided 'Context' to find patterns. "This reminds me of [Other Event] you mentioned..."
3. **The Empath:** Be warm, patient, and deep. Avoid corporate speak.

**The Balance Rule (CRITICAL):**
- If the user's answer is brief -> **Dig Deeper** (ask for details).
- If the user seems finished, deflects, or the topic is dry -> **Pivot** (connect to a new topic).
- **NEVER FORCE:** Do not interrogate. Keep the flow natural.

**Formatting:**
- Use short, readable paragraphs.
- End with **ONE** quality follow-up question (if appropriate)."""

        messages = [system_msg]
        if chat_history:
            # 20-turn window (Phase A): covers ~30-40 min of typical session
            # without hitting token limits (Groq 128k context, messages are short)
            for msg in chat_history[-20:]:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": prompt})

        completion = self.groq_client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None,
        )
        return completion.choices[0].message.content


    def delete_document(self, user_id: str, doc_id: str):
        """Delete vectors for a specific document"""
        try:
            self.index.delete(
                filter={
                    "userId": user_id,
                    "docId": doc_id
                }
            )
            return True
        except Exception as e:
            print(f"Error deleting document vectors: {e}")
            return False

    def generate_greeting(self, context: Dict) -> str:
        user_name = context.get('user_name', 'Friend')
        uploads = context.get('recent_uploads', [])
        last_chat = context.get('last_chat', '')
        on_this_day = context.get('on_this_day', [])
        date_str = context.get('current_date', '')
        life_summary = context.get('life_summary', '')
        # Phase B: domain depth map from UserProfile
        covered_domains: dict = context.get('covered_domains', {}) or {}

        # Build the life portrait section
        life_summary_section = (
            f"\n- **Cumulative Life Portrait:** {life_summary}"
            if life_summary else ""
        )

        # Build domain gap section — what areas need more exploration
        domain_gap_section = ""
        if covered_domains:
            unexplored = [d.replace('_', ' ') for d, v in covered_domains.items()
                          if v in ('none', 'low')]
            explored   = [d.replace('_', ' ') for d, v in covered_domains.items()
                          if v in ('medium', 'high')]
            if unexplored:
                domain_gap_section = (
                    f"\n- **Unexplored Life Areas (priority targets):** {', '.join(unexplored)}"
                    + (f"\n- **Well-documented areas:** {', '.join(explored)}" if explored else "")
                )

        prompt = f"""
You are Jeevani, a personal biographer. Your goal is to open a conversation with {user_name} ({date_str}).
Your tone is warm, empathetic, and deeply curious — like an old friend who genuinely wants to understand.

**What you know:**
- **Recent Uploads (Last 48h):** {uploads if uploads else "None"}
- **Last Conversation Thread:** "{last_chat}"{life_summary_section}{domain_gap_section}
- **On This Day (archive):** {on_this_day if on_this_day else "None"}

**Decision Logic — pick exactly ONE opening (prioritize top down):**

1. **The Detective:** If 'Recent Uploads' exist, ask ONE specific, human question about one file.
   Example: "I noticed you shared [File] — what's the story behind it?"
   Be concrete and curious, never generic.

2. **The Empath:** If 'Last Conversation Thread' captures something emotional, unresolved, or mid-story,
   return to it warmly. Example: "Last time you started talking about [X] — I've been thinking about it."

3. **The Arc Builder:** If 'Unexplored Life Areas' are listed, pick the most human-feeling one and
   open there naturally. Do NOT say "I noticed you haven't discussed X."
   Instead, frame it as genuine curiosity:
   - relationships → "Who has been the most important person in your life, and why?"
   - failures → "Is there a decision you made that you've since learned the most from?"
   - childhood → "What is your earliest memory that still feels vivid to you today?"
   - values → "What principle did someone you admired live by that stayed with you?"
   - family → "Who in your family shaped who you are in a way that surprises you?"
   - education → "What's the most important thing you ever learned — inside or outside a classroom?"
   - current_life → "What does a typical day feel like for you right now?"

4. **The Storyteller:** If none of the above apply, pick ONE deep question:
   - "What is one moment that changed how you see the world?"
   - "Who shaped you quietly, without fanfare — and how?"
   - "Is there something you believed strongly as a young person that you've since reversed?"
   - "What is a smell, sound, or place that takes you back instantly?"

5. **The Time Capsule (last resort only):** Only if 'On This Day' has items AND none of the above apply.

**Hard constraints:**
- Output ONLY the greeting question. Nothing else.
- Maximum 2 sentences.
- Never say "I noticed you haven't discussed..." or "According to your profile..."
- Be specific, not abstract. Sound like a person, not a form.
"""
        if not self.groq_client:
            return f"Hello {user_name}, I'm ready to document your story. (AI Not Connected)"

        try:
            completion = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are Jeevani, a warm and deeply curious personal biographer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=150,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Greeting generation failed: {e}")
            return f"Hello {user_name}, I'm ready to document your story. What's on your mind today?"