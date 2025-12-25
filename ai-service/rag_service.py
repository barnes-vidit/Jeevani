
import os
import google.generativeai as genai
from pinecone import Pinecone
from typing import List, Dict, Optional
import time

class PineconeRAG:
    def __init__(self):
        self.pc = None
        self.index = None
        self.embed_model = "models/text-embedding-004"
        self.llm = None
        
        try:
            # Configure Gemini
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            self.llm = genai.GenerativeModel('gemma-3-27b-it')
            
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
            # We don't raise here to allow the app to start, but methods will fail
            pass

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text"""
        # Gemini embedding
        result = genai.embed_content(
            model=self.embed_model,
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']

    def ingest_text(self, text: str, meta: Dict, chunk_size: int = 1000) -> int:
        """Chunk text, embed, and upsert to Pinecone"""
        # Semantic chunking is better, but crude char/word splitting works for MVP
        chunks = self._chunk_text(text, chunk_size)
        vectors = []
        
        base_id = f"{meta.get('userId')}_{meta.get('docId')}"
        
        for i, chunk in enumerate(chunks):
            embedding = self.embed_text(chunk)
            vector_id = f"{base_id}_{i}"
            
            # Prepare metadata
            metadata = meta.copy()
            metadata['text'] = chunk # Store text in metadata for retrieval context
            metadata['chunk_index'] = i
            
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": metadata
            })
            
            # Batch upsert (max 100)
            if len(vectors) >= 50:
                self.index.upsert(vectors=vectors)
                vectors = []
        
        if vectors:
            self.index.upsert(vectors=vectors)
            
        return len(chunks)

    def _chunk_text(self, text: str, size: int) -> List[str]:
        # Simple overlap chunking
        words = text.split()
        chunks = []
        current_chunk = []
        current_len = 0
        
        for word in words:
            current_chunk.append(word)
            current_len += len(word) + 1
            if current_len >= size:
                chunks.append(" ".join(current_chunk))
                current_chunk = current_chunk[-100:] # Overlap 100 chars approx
                current_len = len(" ".join(current_chunk))
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        return chunks

    def query_answer(self, query: str, user_id: str) -> str:
        """RAG Query Flow"""
        # 1. Embed Query
        q_embedding = genai.embed_content(
            model=self.embed_model,
            content=query,
            task_type="retrieval_query"
        )['embedding']
        
        # 2. Search Pinecone (Filter by user_id!)
        results = self.index.query(
            vector=q_embedding,
            top_k=5,
            filter={"userId": user_id},
            include_metadata=True
        )
        
        # 3. Construct Context
        context_parts = []
        for match in results.matches:
            if match.metadata and 'text' in match.metadata:
                context_parts.append(f"Source ({match.score:.2f}): {match.metadata.get('originalName', 'Unknown')}\n{match.metadata['text']}")
        
        context = "\n\n".join(context_parts)
        
        if not context:
            return "I don't have enough information in your Memory Vault to answer that. Please upload more documents."

        # 4. Generate Answer with Gemini
        prompt = f"""You are 'Jeevani', a personal biographer. Use the context below to answer the user's question.
        
Context:
{context}

User Question: {query}

Answer as Jeevani (warm, empathetic, insightful):"""

        response = self.llm.generate_content(prompt)
        return response.text

    def delete_document(self, user_id: str, doc_id: str):
        """Delete vectors for a specific document"""
        # Delete by filter
        try:
            # Construct the filter. Note: We need to match the metadata structure used in ingest
            # In ingest: base_id = f"{userId}_{docId}"
            # Pinecone delete by filter is cleaner
            print(f"Attempting to delete vectors with filter: userId={user_id}, docId={doc_id}")
            self.index.delete(
                filter={
                    "userId": user_id,
                    "docId": doc_id
                }
            )
            print(f"Deletion command sent to Pinecone for docId: {doc_id}")
            return True
        except Exception as e:
            print(f"Deletion command sent to Pinecone for docId: {doc_id}")
            return True
        except Exception as e:
            print(f"Error deleting document vectors: {e}")
            return False

    def generate_greeting(self, context: Dict) -> str:
        """
        Generate a contextual greeting based on user life-state.
        Context keys: user_name, recent_uploads (list), last_chat (str), on_this_day (list), current_date (str)
        """
        import random
        
        user_name = context.get('user_name', 'Friend')
        uploads = context.get('recent_uploads', [])
        last_chat = context.get('last_chat', '')
        # Mood could be inferred from last chat or passed explicitly. For now, we let LLM infer from last_chat content.
        on_this_day = context.get('on_this_day', [])
        date_str = context.get('current_date', '')

        # Construct Prompt with Tiered Logic
        prompt = f"""
You are Jeevani, a personal biographer. Your goal is to start a conversation with {user_name} ({date_str}).
Your tone is warm, empathetic, and curious—like an old friend catching up over coffee.

**Context:**
- **Recent Uploads (Last 48h):** {uploads if uploads else "None"}
- **On This Day (Past Years):** {on_this_day if on_this_day else "None"}
- **Last Conversation Summary:** "{last_chat}"

**Decision Logic (Prioritize in order):**
1. **The Time Capsule:** If 'On This Day' has items, asking about that specific memory is PRIORITY #1. "I saw that X years ago today..."
2. **The Detective:** If 'Recent Uploads' exist, ask a specific question about one of them. "I saw you added [File]..."
3. **The Empath:** If 'Last Conversation' was sad, emotional, or unresolved, follow up on it gentle.
4. **The Storyteller (Default):** If none of the above apply, pick ONE of these random angles to ask a deep life question:
    - *Values*: A lesson they want to pass down.
    - *Unsung Heroes*: A person who supported them silently.
    - *Mischief*: A rule they broke in the past.
    - *Pattern Matcher*: A habit you've noticed (make one up based on general life themes if no data).

**Constraint:**
- Generate ONLY the greeting/question.
- Keep it under 2 sentences.
- Be specific to the available context.
"""
        try:
            response = self.llm.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Greeting generation failed: {e}")
            return f"Hello {user_name}, I'm ready to document your story. What's on your mind today?"
