
import os
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from rag_service import PineconeRAG
from document_loader import DocumentLoader
import tempfile
import requests
from pathlib import Path

load_dotenv(override=True)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = PineconeRAG()
loader = DocumentLoader(groq_api_key=os.getenv("GROQ_API_KEY"))

class IngestRequest(BaseModel):
    userId: str
    docId: str
    text: str
    originalName: str

class ChatRequest(BaseModel):
    userId: str
    message: str
    chat_history: list = []  # Optional recent messages for multi-turn context

class GreetingRequest(BaseModel):
    user_name: str
    recent_uploads: list
    last_chat: str
    on_this_day: list
    current_date: str

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
        answer = rag.query_answer(request.message, request.userId, request.chat_history)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/greeting")
async def generate_greeting(request: GreetingRequest):
    try:
        context = request.dict()
        greeting = rag.generate_greeting(context)
        return {"greeting": greeting}
    except Exception as e:
        print(f"Greeting error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/file-process")
async def ingest_file_process(
    userId: str = Form(...),
    docId: str = Form(...),
    fileUrl: str = Form(...),
    originalName: str = Form(...)
):
    """Process file: download, extract text, ingest to Pinecone, generate summary."""
    temp_file_path = None
    try:
        # 1. Download file
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(fileUrl, stream=True, headers=headers)
        response.raise_for_status()
        
        ext = Path(originalName).suffix or ".txt"
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
            temp_file_path = tmp.name
            
        # 2. Load and Extract text
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
        
        # 4. Generate summary (item 21)
        summary = rag.generate_summary(text, originalName)
        
        return {
            "status": "success",
            "chunks_processed": chunks,
            "summary": summary
        }
        
    except Exception as e:
        print(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)



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
