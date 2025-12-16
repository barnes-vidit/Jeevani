
import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from rag_service import PineconeRAG
from document_loader import DocumentLoader
import tempfile
import shutil
import requests
from pathlib import Path

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = PineconeRAG()
loader = DocumentLoader(gemini_api_key=os.getenv("GEMINI_API_KEY"))

class IngestRequest(BaseModel):
    userId: str
    docId: str
    text: str
    originalName: str

class ChatRequest(BaseModel):
    userId: str
    message: str

@app.get("/")
def read_root():
    return {"status": "Jeevani AI Service Running"}

@app.post("/ingest/text")
async def ingest_text(request: IngestRequest):
    try:
        meta = {
            "userId": request.userId,
            "docId": request.docId,
            "originalName": request.originalName,
            "type": "text"
        }
        chunks = rag.ingest_text(request.text, meta)
        return {"status": "success", "chunks_processed": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        print(f"Received chat request from {request.userId}: {request.message}")
        answer = rag.query_answer(request.message, request.userId)
        print(f"Generated answer: {answer[:100]}...") # Log first 100 chars
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/file-process")
from fastapi import BackgroundTasks

def process_file_background(userId: str, docId: str, fileUrl: str, originalName: str):
    print(f"Starting background processing for doc {docId}")
    temp_file_path = None
    try:
        # 1. Download file
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(fileUrl, stream=True, headers=headers)
        response.raise_for_status()
        
        # Determine extension from original name or url
        ext = Path(originalName).suffix
        if not ext:
            ext = ".txt" # Default
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
            temp_file_path = tmp.name
            
        # 2. Load and Transcribe/Extract
        doc = loader.load_file(temp_file_path)
        text = doc['text']
        
        # 3. Ingest to Pinecone
        meta = {
            "userId": userId,
            "docId": docId,
            "originalName": originalName,
            "type": doc['type']
        }
        
        chunks = rag.ingest_text(text, meta)
        print(f"Background processing complete for {docId}. Chunks: {chunks}")
        
    except Exception as e:
        print(f"Error processing file in background: {e}")
        # Ideally, update a DB status here, but we are keeping it simple.
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/ingest/file-process")
async def ingest_file_process(
    background_tasks: BackgroundTasks,
    userId: str = Form(...),
    docId: str = Form(...),
    fileUrl: str = Form(...),
    originalName: str = Form(...)
):
    # Offload to background to prevent timeout (502)
    background_tasks.add_task(process_file_background, userId, docId, fileUrl, originalName)
    return {"status": "processing_started", "message": "File is being processed in the background"}

@app.post("/ingest/delete")
async def delete_document(
    userId: str = Form(...),
    docId: str = Form(...)
):
    try:
        success = rag.delete_document(userId, docId)
        if success:
            return {"status": "success", "message": "Document vectors deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete vectors")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
