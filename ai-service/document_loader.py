
import os
import re
import json
from pathlib import Path
from datetime import datetime
import google.generativeai as genai
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
    """Handles audio transcription using Gemini API"""
    
    SUPPORTED_FORMATS = {'.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac'}
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')
    
    def transcribe_audio(self, file_path: str) -> Dict:
        path = Path(file_path)
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported audio format: {path.suffix}")
        
        # Upload
        audio_file = genai.upload_file(path=str(path))
        
        # Transcribe
        prompt = "Transcribe this audio file. Include speaker labels (Speaker 1, Speaker 2) if multiple speakers are detected. Format: [MM:SS] Speaker: Text"
        response = self.model.generate_content([audio_file, prompt])
        
        transcript = response.text
        audio_file.delete()
        
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
    """Handles image description using Gemini API"""
    
    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        # Explicitly using flash-latest to avoid quota issues
        self.model = genai.GenerativeModel('gemini-flash-latest')
    
    def describe_image(self, file_path: str) -> Dict:
        path = Path(file_path)
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported image format: {path.suffix}")
            
        # Upload
        img_file = genai.upload_file(path=str(path))
        
        # Describe
        prompt = "Describe this image in detail. Capture the main subjects, setting, potential emotions, and any text present. This description will be used to retrieve this memory later."
        
        
        
        # Optimize: Resize image if large
        try:
            from PIL import Image
            import tempfile
            import os
            
            with Image.open(path) as img:
                # Calculate new size while maintaining aspect ratio
                max_size = 1024
                if max(img.size) > max_size:
                    ratio = max_size / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    
                    # Save to temp file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=path.suffix) as tmp_img:
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        img.save(tmp_img.name)
                        optimized_path = tmp_img.name
                        
                    # Upload optimized file
                    img_file = genai.upload_file(path=optimized_path)
                    
                    # Clean up temp file
                    os.unlink(optimized_path)
                else:
                    # Upload original
                    img_file = genai.upload_file(path=str(path))
        except ImportError:
            # Fallback if PIL not available (though we installed it)
            print("Warning: Pillow not found, uploading original image.")
            img_file = genai.upload_file(path=str(path))
        
        response = self.model.generate_content([img_file, prompt])
        
        description = response.text
        img_file.delete()
        
        return {
            'text': description,
            'metadata': {
                'filename': path.name,
                'format': path.suffix,
                'processed_at': datetime.now().isoformat()
            }
        }

