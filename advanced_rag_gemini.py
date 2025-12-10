"""
Advanced RAG System with Hybrid Search, Reranking, and Smart Chunking
Uses Gemini API for LLM and sentence-transformers for embeddings

Supported file types: TXT, PDF, DOCX, MD, CSV, JSON, HTML, AUDIO (MP3, WAV, FLAC, etc.)
"""

import os
import re
import json
import hashlib
from pathlib import Path
import numpy as np
from typing import List, Dict, Tuple, Optional, Union
from dataclasses import dataclass, field
from collections import defaultdict
from datetime import datetime
import google.generativeai as genai
from sentence_transformers import SentenceTransformer, CrossEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.tokenize import sent_tokenize

# File processing imports
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    import pandas as pd
except ImportError:
    pd = None

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

@dataclass
class Chunk:
    """Represents a document chunk with metadata"""
    text: str
    doc_id: str
    chunk_id: int
    embedding: Optional[np.ndarray] = None
    metadata: Optional[Dict] = None
    
    def to_dict(self) -> Dict:
        """Serialize chunk for caching"""
        return {
            'text': self.text,
            'doc_id': self.doc_id,
            'chunk_id': self.chunk_id,
            'embedding': self.embedding.tolist() if self.embedding is not None else None,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Chunk':
        """Deserialize chunk from cache"""
        chunk = cls(
            text=data['text'],
            doc_id=data['doc_id'],
            chunk_id=data['chunk_id'],
            metadata=data.get('metadata')
        )
        if data.get('embedding'):
            chunk.embedding = np.array(data['embedding'])
        return chunk


class AudioTranscriber:
    """Handles audio transcription using Gemini API"""
    
    SUPPORTED_FORMATS = {'.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac'}
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-pro')
    
    def transcribe_audio(
        self,
        file_path: str,
        include_timestamps: bool = True,
        include_speakers: bool = True,
        language: Optional[str] = None
    ) -> Dict:
        """Transcribe audio file with metadata
        
        Args:
            file_path: Path to audio file
            include_timestamps: Whether to include timestamps in transcript
            include_speakers: Whether to perform speaker diarization
            language: Target language (None for auto-detect)
        
        Returns:
            Dict with 'text', 'segments', and 'metadata'
        """
        path = Path(file_path)
        
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported audio format: {path.suffix}")
        
        # Upload audio file
        print(f"Uploading audio file: {path.name}")
        audio_file = genai.upload_file(path=str(path))
        print(f"Audio file uploaded successfully")
        
        # Prepare transcription prompt
        prompt_parts = ["Please transcribe this audio file."]
        
        if include_timestamps:
            prompt_parts.append("Include timestamps for each segment.")
        
        if include_speakers:
            prompt_parts.append("Identify different speakers and label them as Speaker 1, Speaker 2, etc.")
        
        if language:
            prompt_parts.append(f"Transcribe in {language}.")
        
        prompt_parts.append("\nFormat the output as follows:")
        prompt_parts.append("1. Full transcript at the top")
        prompt_parts.append("2. Then, provide timestamped segments in this format:")
        prompt_parts.append("[HH:MM:SS - HH:MM:SS] Speaker: Text")
        
        prompt = " ".join(prompt_parts)
        
        # Generate transcription
        print("Transcribing audio...")
        response = self.model.generate_content([audio_file, prompt])
        
        # Parse response
        transcript_text = response.text
        
        # Extract segments with timestamps and speakers
        segments = self._parse_segments(transcript_text)
        
        # Clean up uploaded file
        audio_file.delete()
        
        return {
            'text': transcript_text,
            'segments': segments,
            'metadata': {
                'filename': path.name,
                'format': path.suffix,
                'duration_estimate': len(segments) if segments else None,
                'speaker_count': len(set(s.get('speaker', '') for s in segments)) if segments else None,
                'transcribed_at': datetime.now().isoformat()
            }
        }
    
    def _parse_segments(self, transcript: str) -> List[Dict]:
        """Parse transcript into timestamped segments"""
        segments = []
        
        # Pattern: [HH:MM:SS - HH:MM:SS] Speaker: Text
        # Also handles: [MM:SS - MM:SS] Speaker: Text
        pattern = r'\[(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(?:(Speaker\s*\d+|[^:]+):)?\s*(.+?)(?=\[|$)'
        
        matches = re.finditer(pattern, transcript, re.DOTALL)
        
        for match in matches:
            start_time = match.group(1)
            end_time = match.group(2)
            speaker = match.group(3).strip() if match.group(3) else "Unknown"
            text = match.group(4).strip()
            
            segments.append({
                'start_time': start_time,
                'end_time': end_time,
                'speaker': speaker,
                'text': text
            })
        
        return segments
    
    def transcribe_with_summary(self, file_path: str) -> Dict:
        """Transcribe and generate summary"""
        # First transcribe
        transcription = self.transcribe_audio(file_path)
        
        # Generate summary
        summary_prompt = f"""Summarize the key points from this transcript:

{transcription['text'][:3000]}  # Limit for token efficiency

Provide:
1. Main topics discussed
2. Key takeaways (3-5 points)
3. Action items if any"""
        
        summary_response = self.model.generate_content(summary_prompt)
        transcription['summary'] = summary_response.text
        
        return transcription


class DocumentLoader:
    """Loads and processes multiple file types including audio"""
    
    def __init__(self, gemini_api_key: str):
        self.audio_transcriber = AudioTranscriber(gemini_api_key)
    
    @staticmethod
    def load_txt(file_path: str) -> str:
        """Load plain text file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    @staticmethod
    def load_pdf(file_path: str) -> str:
        """Load PDF file"""
        if PdfReader is None:
            raise ImportError("pypdf not installed. Run: pip install pypdf")
        
        reader = PdfReader(file_path)
        text = []
        for page in reader.pages:
            text.append(page.extract_text())
        return '\n\n'.join(text)
    
    @staticmethod
    def load_docx(file_path: str) -> str:
        """Load DOCX file"""
        if DocxDocument is None:
            raise ImportError("python-docx not installed. Run: pip install python-docx")
        
        doc = DocxDocument(file_path)
        text = [para.text for para in doc.paragraphs if para.text.strip()]
        return '\n\n'.join(text)
    
    @staticmethod
    def load_html(file_path: str) -> str:
        """Load HTML file"""
        if BeautifulSoup is None:
            raise ImportError("beautifulsoup4 not installed. Run: pip install beautifulsoup4")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        return '\n'.join(line for line in lines if line)
    
    @staticmethod
    def load_csv(file_path: str) -> str:
        """Load CSV file"""
        if pd is None:
            raise ImportError("pandas not installed. Run: pip install pandas")
        
        df = pd.read_csv(file_path)
        # Convert to text representation
        text_rows = []
        for _, row in df.iterrows():
            row_text = ', '.join([f"{col}: {val}" for col, val in row.items()])
            text_rows.append(row_text)
        return '\n\n'.join(text_rows)
    
    @staticmethod
    def load_json(file_path: str) -> str:
        """Load JSON file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        def flatten_json(obj, prefix=''):
            """Flatten nested JSON to text"""
            lines = []
            if isinstance(obj, dict):
                for k, v in obj.items():
                    new_prefix = f"{prefix}.{k}" if prefix else k
                    if isinstance(v, (dict, list)):
                        lines.extend(flatten_json(v, new_prefix))
                    else:
                        lines.append(f"{new_prefix}: {v}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    new_prefix = f"{prefix}[{i}]"
                    if isinstance(item, (dict, list)):
                        lines.extend(flatten_json(item, new_prefix))
                    else:
                        lines.append(f"{new_prefix}: {item}")
            return lines
        
        return '\n'.join(flatten_json(data))
    
    @staticmethod
    def load_markdown(file_path: str) -> str:
        """Load Markdown file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def load_audio(
        self,
        file_path: str,
        include_timestamps: bool = True,
        include_speakers: bool = True
    ) -> Dict:
        """Load and transcribe audio file"""
        transcription = self.audio_transcriber.transcribe_audio(
            file_path,
            include_timestamps=include_timestamps,
            include_speakers=include_speakers
        )
        return transcription
    
    def load_file(self, file_path: str) -> Dict[str, str]:
        """Load any supported file type"""
        path = Path(file_path)
        extension = path.suffix.lower()
        
        # Check if it's an audio file
        if extension in AudioTranscriber.SUPPORTED_FORMATS:
            transcription = self.load_audio(file_path)
            return {
                'text': transcription['text'],
                'doc_id': path.stem,
                'metadata': {
                    **transcription['metadata'],
                    'file_path': str(path.absolute()),
                    'type': 'audio',
                    'segments': transcription.get('segments', [])
                },
                'audio_segments': transcription.get('segments', [])
            }
        
        # Handle other file types
        loaders = {
            '.txt': self.load_txt,
            '.pdf': self.load_pdf,
            '.docx': self.load_docx,
            '.doc': self.load_docx,
            '.html': self.load_html,
            '.htm': self.load_html,
            '.csv': self.load_csv,
            '.json': self.load_json,
            '.md': self.load_markdown,
            '.markdown': self.load_markdown,
        }
        
        if extension not in loaders:
            raise ValueError(f"Unsupported file type: {extension}")
        
        text = loaders[extension](file_path)
        
        return {
            'text': text,
            'doc_id': path.stem,
            'metadata': {
                'filename': path.name,
                'extension': extension,
                'file_path': str(path.absolute()),
                'file_size': path.stat().st_size,
                'loaded_at': datetime.now().isoformat(),
                'type': 'document'
            }
        }


class SmartChunker:
    """Implements semantic and recursive chunking strategies"""
    
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 128):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk_by_sentences(self, text: str, doc_id: str) -> List[Chunk]:
        """Chunk text by sentences with overlap"""
        sentences = sent_tokenize(text)
        chunks = []
        current_chunk = []
        current_length = 0
        chunk_id = 0
        
        for sentence in sentences:
            sentence_length = len(sentence.split())
            
            if current_length + sentence_length > self.chunk_size and current_chunk:
                # Create chunk
                chunk_text = ' '.join(current_chunk)
                chunks.append(Chunk(
                    text=chunk_text,
                    doc_id=doc_id,
                    chunk_id=chunk_id,
                    metadata={'sentence_count': len(current_chunk)}
                ))
                chunk_id += 1
                
                # Calculate overlap
                overlap_length = 0
                overlap_sentences = []
                for s in reversed(current_chunk):
                    s_len = len(s.split())
                    if overlap_length + s_len <= self.chunk_overlap:
                        overlap_sentences.insert(0, s)
                        overlap_length += s_len
                    else:
                        break
                
                current_chunk = overlap_sentences
                current_length = overlap_length
            
            current_chunk.append(sentence)
            current_length += sentence_length
        
        # Add final chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append(Chunk(
                text=chunk_text,
                doc_id=doc_id,
                chunk_id=chunk_id,
                metadata={'sentence_count': len(current_chunk)}
            ))
        
        return chunks
    
    def chunk_by_paragraphs(self, text: str, doc_id: str) -> List[Chunk]:
        """Chunk text by paragraphs with size constraints"""
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        chunk_id = 0
        
        for para in paragraphs:
            para_length = len(para.split())
            
            if para_length > self.chunk_size:
                # Split large paragraphs into sentences
                para_chunks = self.chunk_by_sentences(para, doc_id)
                for pc in para_chunks:
                    pc.chunk_id = chunk_id
                    chunks.append(pc)
                    chunk_id += 1
            else:
                chunks.append(Chunk(
                    text=para,
                    doc_id=doc_id,
                    chunk_id=chunk_id,
                    metadata={'type': 'paragraph'}
                ))
                chunk_id += 1
        
        return chunks
    
    def chunk_audio_segments(
        self,
        segments: List[Dict],
        doc_id: str,
        max_segments_per_chunk: int = 5
    ) -> List[Chunk]:
        """Chunk audio segments intelligently by speaker and time"""
        chunks = []
        chunk_id = 0
        
        if not segments:
            return chunks
        
        # Group by speaker when possible
        current_speaker = None
        current_segments = []
        current_word_count = 0
        
        for segment in segments:
            speaker = segment.get('speaker', 'Unknown')
            text = segment.get('text', '')
            word_count = len(text.split())
            
            # Start new chunk if speaker changes or size limit reached
            if (current_speaker and current_speaker != speaker) or \
               current_word_count + word_count > self.chunk_size or \
               len(current_segments) >= max_segments_per_chunk:
                
                if current_segments:
                    chunk_text = ' '.join([s['text'] for s in current_segments])
                    chunks.append(Chunk(
                        text=chunk_text,
                        doc_id=doc_id,
                        chunk_id=chunk_id,
                        metadata={
                            'type': 'audio_segment',
                            'speaker': current_speaker,
                            'start_time': current_segments[0].get('start_time'),
                            'end_time': current_segments[-1].get('end_time'),
                            'segment_count': len(current_segments)
                        }
                    ))
                    chunk_id += 1
                    current_segments = []
                    current_word_count = 0
            
            current_speaker = speaker
            current_segments.append(segment)
            current_word_count += word_count
        
        # Add remaining segments
        if current_segments:
            chunk_text = ' '.join([s['text'] for s in current_segments])
            chunks.append(Chunk(
                text=chunk_text,
                doc_id=doc_id,
                chunk_id=chunk_id,
                metadata={
                    'type': 'audio_segment',
                    'speaker': current_speaker,
                    'start_time': current_segments[0].get('start_time'),
                    'end_time': current_segments[-1].get('end_time'),
                    'segment_count': len(current_segments)
                }
            ))
        
        return chunks


class HybridRetriever:
    """Combines dense (semantic) and sparse (keyword) retrieval with caching"""
    
    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        cache_dir: str = ".rag_cache"
    ):
        # Using all-MiniLM-L6-v2: excellent free model, fast, good performance
        self.embedding_model = SentenceTransformer(model_name)
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words='english'
        )
        self.chunks: List[Chunk] = []
        self.tfidf_matrix = None
        self.chunk_texts: List[str] = []
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.doc_hashes: Dict[str, str] = {}
    
    def _hash_document(self, text: str) -> str:
        """Generate hash for document caching"""
        return hashlib.md5(text.encode()).hexdigest()
    
    def _load_cache(self) -> bool:
        """Load cached chunks and embeddings"""
        cache_file = self.cache_dir / "chunks_cache.json"
        if not cache_file.exists():
            return False
        
        try:
            with open(cache_file, 'r') as f:
                cache_data = json.load(f)
            
            self.chunks = [Chunk.from_dict(c) for c in cache_data['chunks']]
            self.doc_hashes = cache_data['doc_hashes']
            self.chunk_texts = [c.text for c in self.chunks]
            
            if self.chunk_texts:
                self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.chunk_texts)
            
            print(f"Loaded {len(self.chunks)} chunks from cache")
            return True
        except Exception as e:
            print(f"Cache load failed: {e}")
            return False
    
    def _save_cache(self):
        """Save chunks and embeddings to cache"""
        cache_file = self.cache_dir / "chunks_cache.json"
        cache_data = {
            'chunks': [c.to_dict() for c in self.chunks],
            'doc_hashes': self.doc_hashes,
            'cached_at': datetime.now().isoformat()
        }
        
        with open(cache_file, 'w') as f:
            json.dump(cache_data, f)
        
        print(f"Cached {len(self.chunks)} chunks")
    
    def add_documents(self, chunks: List[Chunk], doc_text: str = "", use_cache: bool = True):
        """Add chunks to the retriever and compute embeddings"""
        doc_hash = self._hash_document(doc_text) if doc_text else None
        
        # Check if document already cached
        if use_cache and doc_hash and doc_hash in self.doc_hashes:
            print("Document already indexed (found in cache)")
            return
        
        self.chunks.extend(chunks)
        if doc_hash:
            self.doc_hashes[doc_hash] = doc_text[:100]
        
        chunk_texts = [c.text for c in chunks]
        
        # Compute dense embeddings
        embeddings = self.embedding_model.encode(
            chunk_texts,
            show_progress_bar=True,
            batch_size=32
        )
        
        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
        
        # Update TF-IDF matrix
        self.chunk_texts = [c.text for c in self.chunks]
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.chunk_texts)
        
        if use_cache:
            self._save_cache()
    
    def filter_by_metadata(self, filters: Dict) -> List[Chunk]:
        """Filter chunks by metadata"""
        filtered = []
        for chunk in self.chunks:
            if chunk.metadata:
                match = all(
                    chunk.metadata.get(k) == v
                    for k, v in filters.items()
                )
                if match:
                    filtered.append(chunk)
        return filtered
    
    def semantic_search(self, query: str, top_k: int = 10) -> List[Tuple[Chunk, float]]:
        """Dense retrieval using embeddings"""
        query_embedding = self.embedding_model.encode([query])[0]
        
        scores = []
        for chunk in self.chunks:
            score = cosine_similarity(
                query_embedding.reshape(1, -1),
                chunk.embedding.reshape(1, -1)
            )[0][0]
            scores.append((chunk, float(score)))
        
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]
    
    def keyword_search(self, query: str, top_k: int = 10) -> List[Tuple[Chunk, float]]:
        """Sparse retrieval using TF-IDF"""
        query_vec = self.tfidf_vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self.tfidf_matrix)[0]
        
        top_indices = np.argsort(scores)[-top_k:][::-1]
        results = [(self.chunks[i], float(scores[i])) for i in top_indices]
        return results
    
    def hybrid_search(
        self,
        query: str,
        top_k: int = 10,
        alpha: float = 0.5
    ) -> List[Tuple[Chunk, float]]:
        """Combine semantic and keyword search with weighted scoring"""
        semantic_results = self.semantic_search(query, top_k * 2)
        keyword_results = self.keyword_search(query, top_k * 2)
        
        # Normalize and combine scores
        chunk_scores = defaultdict(float)
        
        # Add semantic scores
        for chunk, score in semantic_results:
            chunk_scores[id(chunk)] = alpha * score
        
        # Add keyword scores
        max_keyword_score = max([s for _, s in keyword_results]) if keyword_results else 1.0
        for chunk, score in keyword_results:
            normalized_score = score / max_keyword_score if max_keyword_score > 0 else 0
            chunk_scores[id(chunk)] += (1 - alpha) * normalized_score
        
        # Get chunks and sort by combined score
        chunk_map = {id(c): c for c, _ in semantic_results + keyword_results}
        results = [(chunk_map[cid], score) for cid, score in chunk_scores.items()]
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:top_k]


class Reranker:
    """Cross-encoder based reranking for improved relevance"""
    
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)
    
    def rerank(
        self,
        query: str,
        results: List[Tuple[Chunk, float]],
        top_k: int = 5
    ) -> List[Tuple[Chunk, float]]:
        """Rerank results using cross-encoder"""
        if not results:
            return []
        
        chunks = [r[0] for r in results]
        pairs = [[query, chunk.text] for chunk in chunks]
        
        scores = self.model.predict(pairs)
        reranked = [(chunks[i], float(scores[i])) for i in range(len(chunks))]
        reranked.sort(key=lambda x: x[1], reverse=True)
        
        return reranked[:top_k]


class QueryConstructor:
    """Enhances queries through expansion and decomposition"""
    
    def __init__(self, gemini_api_key: str):
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-pro')
    
    def expand_query(self, query: str) -> List[str]:
        """Generate query variations for better retrieval"""
        prompt = f"""Given this query: "{query}"
        
Generate 3 alternative phrasings that capture the same information need.
Return only the queries, one per line, without numbering or explanation."""
        
        try:
            response = self.model.generate_content(prompt)
            variations = [q.strip() for q in response.text.strip().split('\n') if q.strip()]
            return [query] + variations[:3]
        except:
            return [query]
    
    def decompose_query(self, query: str) -> List[str]:
        """Break complex queries into sub-queries"""
        prompt = f"""Analyze this query: "{query}"

If it's a complex query requiring multiple pieces of information, break it down into 2-3 simpler sub-queries.
If it's already simple, return just the original query.
Return only the queries, one per line."""
        
        try:
            response = self.model.generate_content(prompt)
            sub_queries = [q.strip() for q in response.text.strip().split('\n') if q.strip()]
            return sub_queries if len(sub_queries) > 1 else [query]
        except:
            return [query]


class AdvancedRAG:
    """Main RAG system orchestrating all components"""
    
    def __init__(
        self,
        gemini_api_key: str,
        chunk_size: int = 512,
        chunk_overlap: int = 128,
        cache_dir: str = ".rag_cache"
    ):
        self.chunker = SmartChunker(chunk_size, chunk_overlap)
        self.retriever = HybridRetriever(cache_dir=cache_dir)
        self.reranker = Reranker()
        self.query_constructor = QueryConstructor(gemini_api_key)
        self.document_loader = DocumentLoader(gemini_api_key)
        
        genai.configure(api_key=gemini_api_key)
        self.llm = genai.GenerativeModel('gemini-pro')
        
        # Query cache for faster repeated queries
        self.query_cache: Dict[str, Dict] = {}
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Conversation memory for context-aware responses
        self.conversation_history: List[Dict] = []
    
    def ingest_documents(self, documents: List[Dict[str, str]], use_cache: bool = True):
        """Process and index documents
        
        Args:
            documents: List of dicts with 'text' and 'doc_id' keys
            use_cache: Whether to use caching
        """
        all_chunks = []
        for doc in documents:
            # Check if document has audio segments
            if 'audio_segments' in doc and doc['audio_segments']:
                # Use audio-specific chunking
                chunks = self.chunker.chunk_audio_segments(
                    doc['audio_segments'],
                    doc['doc_id']
                )
            else:
                # Use regular sentence-based chunking
                chunks = self.chunker.chunk_by_sentences(doc['text'], doc['doc_id'])
            
            # Add document metadata to chunks
            if 'metadata' in doc:
                for chunk in chunks:
                    chunk.metadata = {**(chunk.metadata or {}), **doc['metadata']}
            
            all_chunks.extend(chunks)
        
        print(f"Created {len(all_chunks)} chunks from {len(documents)} documents")
        
        # Combine all document texts for cache hashing
        combined_text = ''.join([d['text'] for d in documents])
        self.retriever.add_documents(all_chunks, combined_text, use_cache)
        print("Indexing complete!")
    
    def ingest_files(self, file_paths: List[str], use_cache: bool = True):
        """Load and index files directly
        
        Args:
            file_paths: List of file paths to load (supports audio files!)
            use_cache: Whether to use caching
        """
        documents = []
        for path in file_paths:
            try:
                doc = self.document_loader.load_file(path)
                documents.append(doc)
                print(f"✓ Loaded: {path}")
            except Exception as e:
                print(f"✗ Error loading {path}: {e}")
        
        if documents:
            self.ingest_documents(documents, use_cache)
    
    def retrieve(
        self,
        query: str,
        retrieval_k: int = 20,
        rerank_k: int = 5,
        use_query_expansion: bool = True,
        metadata_filters: Optional[Dict] = None
    ) -> List[Tuple[Chunk, float]]:
        """Retrieve relevant chunks with optional query enhancement"""
        
        # Check query cache
        cache_key = f"{query}_{retrieval_k}_{rerank_k}_{use_query_expansion}"
        if cache_key in self.query_cache:
            print("Retrieved from query cache")
            return self.query_cache[cache_key]
        
        # Apply metadata filters if provided
        if metadata_filters:
            filtered_chunks = self.retriever.filter_by_metadata(metadata_filters)
            print(f"Filtered to {len(filtered_chunks)} chunks by metadata")
        
        # Query expansion
        queries = [query]
        if use_query_expansion:
            queries = self.query_constructor.expand_query(query)
            print(f"Expanded to {len(queries)} query variations")
        
        # Retrieve for all query variations
        all_results = []
        for q in queries:
            results = self.retriever.hybrid_search(q, top_k=retrieval_k)
            all_results.extend(results)
        
        # Deduplicate and merge scores
        chunk_scores = defaultdict(float)
        chunk_map = {}
        for chunk, score in all_results:
            cid = id(chunk)
            chunk_scores[cid] = max(chunk_scores[cid], score)
            chunk_map[cid] = chunk
        
        merged_results = [(chunk_map[cid], score) for cid, score in chunk_scores.items()]
        merged_results.sort(key=lambda x: x[1], reverse=True)
        
        # Rerank top results
        top_results = merged_results[:retrieval_k]
        reranked = self.reranker.rerank(query, top_results, top_k=rerank_k)
        
        # Cache the results
        self.query_cache[cache_key] = reranked
        
        return reranked
    
    def generate_answer(
        self,
        query: str,
        context_chunks: List[Tuple[Chunk, float]],
        include_sources: bool = True,
        use_conversation_history: bool = False
    ) -> str:
        """Generate answer using retrieved context"""
        
        # Prepare context
        context_texts = []
        for i, (chunk, _) in enumerate(context_chunks):
            source_info = f"[Source {i+1}]"
            
            # Add timestamp info for audio chunks
            if chunk.metadata and chunk.metadata.get('type') == 'audio_segment':
                speaker = chunk.metadata.get('speaker', 'Unknown')
                start_time = chunk.metadata.get('start_time', '')
                source_info += f" Speaker: {speaker}, Time: {start_time}"
            
            context_texts.append(f"{source_info}\n{chunk.text}")
        
        context = "\n\n".join(context_texts)
        
        # Include conversation history if requested
        history_context = ""
        if use_conversation_history and self.conversation_history:
            recent_history = self.conversation_history[-3:]  # Last 3 exchanges
            history_context = "Previous conversation:\n"
            for h in recent_history:
                history_context += f"Q: {h['query']}\nA: {h['answer']}\n\n"
        
        # Generate answer
        prompt = f"""{history_context}Answer the question based on the provided context. Be specific and cite sources when applicable.

Context:
{context}

Question: {query}

Answer:"""
        
        response = self.llm.generate_content(prompt)
        answer = response.text
        
        if include_sources:
            sources = "\n\nSources:\n"
            for i, (chunk, score) in enumerate(context_chunks):
                metadata_str = ""
                if chunk.metadata:
                    if 'filename' in chunk.metadata:
                        metadata_str = f" ({chunk.metadata['filename']})"
                    if chunk.metadata.get('type') == 'audio_segment':
                        speaker = chunk.metadata.get('speaker', 'Unknown')
                        time = chunk.metadata.get('start_time', '')
                        metadata_str += f" - {speaker} at {time}"
                
                sources += f"{i+1}. Doc: {chunk.doc_id}{metadata_str}, Chunk: {chunk.chunk_id} (Relevance: {score:.3f})\n"
            answer += sources
        
        return answer
    
    def query(
        self,
        query: str,
        retrieval_k: int = 20,
        rerank_k: int = 5,
        use_query_expansion: bool = True,
        metadata_filters: Optional[Dict] = None,
        use_conversation_history: bool = False,
        save_to_history: bool = True
    ) -> Dict:
        """End-to-end RAG query"""
        
        print(f"\nProcessing query: {query}")
        
        # Retrieve relevant chunks
        chunks = self.retrieve(
            query,
            retrieval_k=retrieval_k,
            rerank_k=rerank_k,
            use_query_expansion=use_query_expansion,
            metadata_filters=metadata_filters
        )
        
        print(f"Retrieved {len(chunks)} relevant chunks")
        
        # Generate answer
        answer = self.generate_answer(
            query,
            chunks,
            use_conversation_history=use_conversation_history
        )
        
        result = {
            'query': query,
            'answer': answer,
            'chunks': chunks,
            'timestamp': datetime.now().isoformat()
        }
        
        # Save to conversation history
        if save_to_history:
            self.conversation_history.append({
                'query': query,
                'answer': answer,
                'timestamp': result['timestamp']
            })
        
        return result
    
    def clear_cache(self):
        """Clear all caches"""
        self.query_cache.clear()
        self.conversation_history.clear()
        cache_file = self.cache_dir / "chunks_cache.json"
        if cache_file.exists():
            cache_file.unlink()
        print("All caches cleared")
    
    def get_statistics(self) -> Dict:
        """Get RAG system statistics"""
        return {
            'total_chunks': len(self.retriever.chunks),
            'total_documents': len(set(c.doc_id for c in self.retriever.chunks)),
            'cached_queries': len(self.query_cache),
            'conversation_length': len(self.conversation_history),
            'cache_dir': str(self.cache_dir)
        }


# Example usage
if __name__ == "__main__":
    # Set your Gemini API key
    GEMINI_API_KEY = "your-gemini-api-key-here"
    
    # Initialize RAG
    rag = AdvancedRAG(
        gemini_api_key=GEMINI_API_KEY,
        chunk_size=512,
        chunk_overlap=128,
        cache_dir=".rag_cache"
    )
    
    # Example 1: Load from text
    documents = [
        {
            'doc_id': 'doc1',
            'text': """Artificial Intelligence has revolutionized various industries. 
            Machine learning, a subset of AI, enables systems to learn from data without 
            explicit programming. Deep learning, using neural networks with multiple layers, 
            has achieved remarkable results in image recognition, natural language processing, 
            and game playing. The transformer architecture, introduced in 2017, has become 
            the foundation for modern language models like GPT and BERT.""",
            'metadata': {'category': 'AI', 'year': 2024}
        },
        {
            'doc_id': 'doc2',
            'text': """Retrieval-Augmented Generation combines the power of large language 
            models with external knowledge retrieval. This approach allows models to access 
            up-to-date information beyond their training data. RAG systems typically involve 
            document chunking, embedding generation, vector search, and answer generation. 
            Advanced techniques include hybrid search, reranking, and query expansion.""",
            'metadata': {'category': 'RAG', 'year': 2024}
        }
    ]
    
    rag.ingest_documents(documents)
    
    # Example 2: Load from files (including audio!)
    # rag.ingest_files([
    #     'path/to/document.pdf',
    #     'path/to/notes.txt',
    #     'path/to/podcast.mp3',      # Audio file!
    #     'path/to/interview.wav',    # Audio file!
    #     'path/to/data.csv'
    # ])
    
    # Example 3: Load ONLY audio file with transcription
    # rag.ingest_files(['path/to/meeting_recording.mp3'])
    
    # Query the system
    result = rag.query(
        "What is deep learning and how does it relate to AI?",
        retrieval_k=20,
        rerank_k=3,
        use_conversation_history=True
    )
    
    print("\n" + "="*80)
    print("ANSWER:")
    print("="*80)
    print(result['answer'])
    
    # Example query for audio content (after loading audio file)
    # result_audio = rag.query(
    #     "What did the speakers discuss about AI in the meeting?",
    #     retrieval_k=20,
    #     rerank_k=5
    # )
    # print("\n" + "="*80)
    # print("AUDIO QUERY ANSWER:")
    # print("="*80)
    # print(result_audio['answer'])
    
    # Filter by metadata (e.g., get only content from specific speaker)
    # result_filtered = rag.query(
    #     "What was discussed?",
    #     metadata_filters={'speaker': 'Speaker 1'}
    # )
    
    # Get statistics
    print("\n" + "="*80)
    print("SYSTEM STATISTICS:")
    print("="*80)
    stats = rag.get_statistics()
    for key, value in stats.items():
        print(f"{key}: {value}")
    
    print("\n" + "="*80)
    print("AUDIO FEATURES:")
    print("="*80)
    print("✓ Supports: MP3, WAV, FLAC, AAC, OGG, AIFF")
    print("✓ Automatic transcription with Gemini API")
    print("✓ Speaker diarization (identifies different speakers)")
    print("✓ Timestamp extraction for precise references")
    print("✓ Chunks intelligently by speaker and time segments")
    print("✓ Up to 9.5 hours of audio per file")