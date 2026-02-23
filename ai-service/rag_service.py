import os
from pinecone import Pinecone
from groq import Groq
from typing import List, Dict, Optional
import time
from google import genai
from google.genai import types


class PineconeRAG:
    def __init__(self):
        self.pc = None
        self.index = None
        self.embed_model = "models/gemini-embedding-001"
        self.groq_client = None
        self.genai_client = None  
        
        try:
            gemini_key = os.getenv("GEMINI_API_KEY")
            print(f"DEBUG: Gemini Key Loaded? {bool(gemini_key)}")
            if gemini_key:
                print(f"DEBUG: Gemini Key Prefix: {gemini_key[:4]}...")
            
            # Use the new google.genai Client (replaces genaii.configure)
            self.genai_client = genai.Client(api_key=gemini_key)
            
            # Configure Groq
            groq_key = os.getenv("GROQ_API_KEY")
            print(f"DEBUG: Groq Key Loaded? {bool(groq_key)}")
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

    def ingest_text(self, text: str, meta: Dict, chunk_size: int = 1000) -> int:
        """Chunk text, embed, and upsert to Pinecone"""
        chunks = self._chunk_text(text, chunk_size)
        vectors = []
        
        base_id = f"{meta.get('userId')}_{meta.get('docId')}"
        
        for i, chunk in enumerate(chunks):
            embedding = self.embed_text(chunk)
            vector_id = f"{base_id}_{i}"
            
            metadata = meta.copy()
            metadata['text'] = chunk
            metadata['chunk_index'] = i
            
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": metadata
            })
            
            if len(vectors) >= 50:
                self.index.upsert(vectors=vectors)
                vectors = []
        
        if vectors:
            self.index.upsert(vectors=vectors)
            
        return len(chunks)

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

    def query_answer(self, query: str, user_id: str, chat_history: List[Dict] = None) -> str:
        """RAG Query Flow with optional conversation history."""
        # 1. Embed Query
        try:
            q_embedding = self.embed_text(query)
        except Exception as embed_error:
            raise embed_error
        
        # 2. Hybrid Search: semantic + keyword re-ranking (item 19)
        results = self.index.query(
            vector=q_embedding,
            top_k=10,  # Over-fetch for re-ranking
            filter={"userId": user_id},
            include_metadata=True
        )
        
        # Keyword re-ranking: boost results that share keywords with the query
        query_keywords = set(query.lower().split())
        ranked = []
        for match in results.matches:
            text = match.metadata.get('text', '') if match.metadata else ''
            chunk_words = set(text.lower().split())
            overlap = len(query_keywords & chunk_words)
            keyword_score = overlap / max(len(query_keywords), 1)
            # Weighted combination: 70% semantic, 30% keyword
            hybrid_score = 0.7 * match.score + 0.3 * keyword_score
            ranked.append((hybrid_score, match))
        
        ranked.sort(key=lambda x: x[0], reverse=True)
        top_matches = [m for _, m in ranked[:5]]
        
        # 3. Construct Context
        context_parts = []
        for match in top_matches:
            if match.metadata and 'text' in match.metadata:
                context_parts.append(f"Source ({match.score:.2f}): {match.metadata.get('originalName', 'Unknown')}\n{match.metadata['text']}")
        
        context = "\n\n".join(context_parts)
        
        if not context:
            context = "[No relevant archived memories found. Rely on the user's input.]"

        if not self.groq_client:
            return "Error: AI Service not fully initialized (Missing Groq Client). Please check GROQ_API_KEY."

        # 4. Build conversation messages for multi-turn context
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

        # Build messages array with conversation history for multi-turn
        messages = [system_msg]
        
        if chat_history:
            # Include up to 10 recent messages for context
            for msg in chat_history[-10:]:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        
        messages.append({"role": "user", "content": prompt})

        # 5. Generate Answer with Groq
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

        prompt = f"""
You are Jeevani, a personal biographer. Your goal is to start a conversation with {user_name} ({date_str}).
Your tone is warm, empathetic, and curious—like an old friend catching up over coffee.

**Context:**
- **Recent Uploads (Last 48h):** {uploads if uploads else "None"}
- **On This Day (Past Years):** {on_this_day if on_this_day else "None"}
- **Last Conversation Summary:** "{last_chat}"

**Decision Logic (Prioritize in order):**
1. **The Time Capsule:** If 'On This Day' has items, asking about that specific memory is PRIORITY #1. "I saw that X years ago today..." or "This day seems special in your history..."
2. **The Detective:** If 'Recent Uploads' exist, ask a specific question about one of them. "I noticed you shared [File]. It looks like a precious memory. What's the story behind it?"
3. **The Empath:** If 'Last Conversation' was sad, emotional, or unresolved, follow up on it gently.
4. **The Storyteller (Default):** If none of the above apply, pick ONE of these random angles to ask a deep life question:
    - *Values*: "What is a lesson from your childhood that you still carry today?"
    - *Unsung Heroes*: "Who is someone who supported you silently?"
    - *Mischief*: "What is a rule you broke in the past?"
    - *Pattern Matcher*: Ask about a habit or recurring theme you've noticed.

**Constraint:**
- Generate ONLY the greeting/question.
- Keep it under 2 sentences.
- Be specific to the available context.
"""
        if not self.groq_client:
            return f"Hello {user_name}, I'm ready to document your story. (AI Not Connected)"

        try:
            completion = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful personal biographer assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=150,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Greeting generation failed: {e}")
            return f"Hello {user_name}, I'm ready to document your story. What's on your mind today?"