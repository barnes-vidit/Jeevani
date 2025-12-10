
import os
import google.generativeai as genai
from pinecone import Pinecone
from typing import List, Dict, Optional
import time

class PineconeRAG:
    def __init__(self):
        # Configure Gemini
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.embed_model = "models/text-embedding-004"
        self.llm = genai.GenerativeModel('gemini-flash-latest')
        
        # Configure Pinecone
        self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.index_name = "jeevani-index"
        
        # Create index if not exists (Basic check, usually done manually or via IaC)
        # Note: In production you'd want to handle this more robustly
        existing_indexes = [i.name for i in self.pc.list_indexes()]
        if self.index_name not in existing_indexes:
            # We assume user will create it or we can try to create (serverless starter)
            from pinecone import ServerlessSpec
            try:
                self.pc.create_index(
                    name=self.index_name,
                    dimension=768, # Dimension for text-embedding-004
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1")
                )
            except Exception as e:
                print(f"Index creation warning: {e}")

        self.index = self.pc.Index(self.index_name)

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
