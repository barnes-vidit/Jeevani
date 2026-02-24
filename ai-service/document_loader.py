
import os
import re
import json
import base64
from pathlib import Path
from datetime import datetime
from groq import Groq
from typing import List, Dict, Optional

# Optional imports with safe fallbacks
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


class AudioTranscriber:
    """Handles audio transcription using Groq Whisper API"""
    
    SUPPORTED_FORMATS = {'.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac'}
    
    def __init__(self, groq_client: Groq):
        self.client = groq_client
    
    def transcribe_audio(self, file_path: str) -> Dict:
        path = Path(file_path)
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported audio format: {path.suffix}")
        
        with open(path, "rb") as audio_file:
            transcription = self.client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file,
                response_format="text"
            )
        
        return {
            'text': transcription,
            'metadata': {
                'filename': path.name,
                'format': path.suffix,
                'transcribed_at': datetime.now().isoformat()
            }
        }


class ImageDescriber:
    """Handles image description using Groq Vision model"""
    
    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
    
    def __init__(self, groq_client: Groq):
        self.client = groq_client
        self.model = "meta-llama/llama-4-scout-17b-16e-instruct"
    
    def describe_image(self, file_path: str) -> Dict:
        path = Path(file_path)
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported image format: {path.suffix}")
        
        # Optimize: Resize image if large
        process_path = path
        optimized_path = None
        try:
            from PIL import Image
            import tempfile
            
            with Image.open(path) as img:
                max_size = 1024
                if max(img.size) > max_size:
                    ratio = max_size / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_img:
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        img.save(tmp_img.name, 'JPEG', quality=85)
                        optimized_path = tmp_img.name
                        process_path = Path(optimized_path)
        except ImportError:
            pass
        
        # Read and encode image as base64
        with open(process_path, "rb") as img_file:
            img_base64 = base64.b64encode(img_file.read()).decode("utf-8")
        
        # Clean up temp file
        if optimized_path:
            os.unlink(optimized_path)
        
        # Determine MIME type
        ext = path.suffix.lower()
        mime_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}
        mime_type = mime_map.get(ext, 'image/jpeg')
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe this image in detail. Capture the main subjects, setting, potential emotions, and any text present. This description will be used to retrieve this memory later."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{img_base64}"
                        }
                    }
                ]
            }],
            max_tokens=500
        )
        
        description = response.choices[0].message.content
        
        return {
            'text': description,
            'metadata': {
                'filename': path.name,
                'format': path.suffix,
                'processed_at': datetime.now().isoformat()
            }
        }


class DocumentLoader:
    """Loads and processes multiple file types including audio and images"""
    
    def __init__(self, groq_api_key: str = None, **kwargs):
        groq_client = Groq(api_key=groq_api_key or os.getenv("GROQ_API_KEY"))
        self.audio_transcriber = AudioTranscriber(groq_client)
        self.image_describer = ImageDescriber(groq_client)
    
    @staticmethod
    def load_txt(file_path: str) -> str:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    @staticmethod
    def load_pdf(file_path: str) -> str:
        if PdfReader is None: raise ImportError("pypdf not installed")
        reader = PdfReader(file_path)
        text = []
        for page in reader.pages:
            text.append(page.extract_text())
        return '\n\n'.join(text)
    
    @staticmethod
    def load_docx(file_path: str) -> str:
        if DocxDocument is None: raise ImportError("python-docx not installed")
        doc = DocxDocument(file_path)
        return '\n\n'.join([para.text for para in doc.paragraphs if para.text.strip()])
    
    @staticmethod
    def load_html(file_path: str) -> str:
        if BeautifulSoup is None: raise ImportError("beautifulsoup4 not installed")
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        return soup.get_text(separator='\n')

    def load_file(self, file_path: str) -> Dict[str, str]:
        path = Path(file_path)
        extension = path.suffix.lower()
        
        if extension in AudioTranscriber.SUPPORTED_FORMATS:
            transcription = self.audio_transcriber.transcribe_audio(file_path)
            return {
                'text': transcription['text'],
                'type': 'audio',
                'metadata': transcription['metadata']
            }
        
        if extension in ImageDescriber.SUPPORTED_FORMATS:
            description = self.image_describer.describe_image(file_path)
            return {
                'text': description['text'],
                'type': 'image',
                'metadata': description['metadata']
            }
        
        loaders = {
            '.txt': self.load_txt,
            '.pdf': self.load_pdf,
            '.docx': self.load_docx,
            '.html': self.load_html,
        }
        
        if extension not in loaders:
            raise ValueError(f"Unsupported file type: {extension}")
            
        text = loaders[extension](file_path)
        return {
            'text': text,
            'type': 'document',
            'metadata': {'filename': path.name}
        }
