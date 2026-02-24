
import os
import re
import json
from pathlib import Path
from datetime import datetime
from google import genai
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

try:
    import pandas as pd
except ImportError:
    pd = None

class AudioTranscriber:
    """Handles audio transcription using Gemini API (new google-genai SDK)"""
    
    SUPPORTED_FORMATS = {'.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac'}
    
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model_name = 'gemini-2.0-flash'
    
    def transcribe_audio(self, file_path: str) -> Dict:
        path = Path(file_path)
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported audio format: {path.suffix}")
        
        # Upload
        audio_file = self.client.files.upload(file=str(path))
        
        # Transcribe
        prompt = "Transcribe this audio file. Include speaker labels (Speaker 1, Speaker 2) if multiple speakers are detected. Format: [MM:SS] Speaker: Text"
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[audio_file, prompt]
        )
        
        transcript = response.text
        self.client.files.delete(name=audio_file.name)
        
        return {
            'text': transcript,
            'metadata': {
                'filename': path.name,
                'format': path.suffix,
                'transcribed_at': datetime.now().isoformat()
            }
        }

class DocumentLoader:
    """Loads and processes multiple file types including audio"""
    
    def __init__(self, gemini_api_key: str):
        self.audio_transcriber = AudioTranscriber(gemini_api_key)
        self.image_describer = ImageDescriber(gemini_api_key)
    
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

class ImageDescriber:
    """Handles image description using Gemini API (new google-genai SDK)"""
    
    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
    
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model_name = 'gemini-2.0-flash'
    
    def describe_image(self, file_path: str) -> Dict:
        path = Path(file_path)
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported image format: {path.suffix}")
        
        # Describe prompt
        prompt = "Describe this image in detail. Capture the main subjects, setting, potential emotions, and any text present. This description will be used to retrieve this memory later."
        
        # Optimize: Resize image if large
        upload_path = str(path)
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
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=path.suffix) as tmp_img:
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        img.save(tmp_img.name)
                        optimized_path = tmp_img.name
                        upload_path = optimized_path
        except ImportError:
            print("Warning: Pillow not found, uploading original image.")
        
        # Upload file
        img_file = self.client.files.upload(file=upload_path)
        
        # Clean up temp file if created
        if optimized_path:
            os.unlink(optimized_path)
        
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[img_file, prompt]
        )
        
        description = response.text
        self.client.files.delete(name=img_file.name)
        
        return {
            'text': description,
            'metadata': {
                'filename': path.name,
                'format': path.suffix,
                'processed_at': datetime.now().isoformat()
            }
        }
