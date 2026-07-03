
import os
import re
from dotenv import load_dotenv
load_dotenv(override=True)
from fastapi import FastAPI, Form, HTTPException, BackgroundTasks, Security, Depends, status
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_service import PineconeRAG
from document_loader import DocumentLoader
from memoir_service import generate_biography
from harvest_service import HarvestService
import tempfile
import requests
from pathlib import Path
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId


def _clean_manuscript(text: str) -> str:
    """
    Defensive cleanup before storing the manuscript.
    Quality gates are now fixers (not flaggers) so annotation tags should not
    appear in the final text. This function is kept as a safety net only.
    """
    # Safety net: remove any residual annotation tags in case of LLM non-compliance
    text = re.sub(r'\s*\[UNVERIFIED:[^\]]*\]', '', text)
    text = re.sub(r'\s*\[COHERENCE_ISSUE:[^\]]*\]', '', text)
    text = re.sub(r'\[GAP:[^\]]*\]', '', text)
    # Collapse triple+ newlines left by any removed lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(api_key: str = Security(api_key_header)):
    expected_key = os.getenv("AI_SERVICE_API_KEY")
    if not expected_key:
        print("WARNING: AI_SERVICE_API_KEY is not set in environment. Defaulting to 'dev-secret-key'")
        expected_key = "dev-secret-key"
    if api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key"
        )
    return api_key

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

# Async MongoDB client for memoir generation
_mongo_client = None
_mongo_db = None

def get_mongo_db():
    global _mongo_client, _mongo_db
    if _mongo_db is None:
        _mongo_client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
        try:
            _mongo_db = _mongo_client.get_default_database()
        except Exception:
            _mongo_db = _mongo_client['test']
    return _mongo_db

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

@app.post("/ingest/text", dependencies=[Depends(get_api_key)])
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

@app.post("/chat", dependencies=[Depends(get_api_key)])
async def chat(request: ChatRequest):
    try:
        answer = rag.query_answer(request.message, request.userId, request.chat_history)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/greeting", dependencies=[Depends(get_api_key)])
async def generate_greeting(request: GreetingRequest):
    try:
        context = request.dict()
        greeting = rag.generate_greeting(context)
        return {"greeting": greeting}
    except Exception as e:
        print(f"Greeting error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/file-process", dependencies=[Depends(get_api_key)])
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
        # Preserve the Cloudinary URL for images so the biography can reference photos
        if doc['type'] == 'image':
            meta['cloudUrl'] = fileUrl
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



class MemoirGenerateRequest(BaseModel):
    userId: str
    jobId: str

async def _run_memoir_pipeline(user_id: str, job_id: str):
    """
    Background task: runs the full biography generation pipeline.
    Updates BiographyJob status in MongoDB as it progresses.
    """
    object_id = ObjectId(job_id)
    db = None

    async def update_progress(phase: str, pct: int):
        if db is not None:
            await db['biographyjobs'].update_one(
                {"_id": object_id},
                {"$set": {"status": phase, "progress": pct, "currentPhase": phase}}
            )

    try:
        db = get_mongo_db()
        await update_progress('harvesting', 5)

        harvest = HarvestService(rag.index, db)
        corpus = await harvest.harvest_all(user_id)

        print(f"[memoir] Harvested {len(corpus)} memory entries for user {user_id}")

        manuscript, plan = await generate_biography(user_id, corpus, update_progress)

        # Strip all annotation tags before storing
        manuscript = _clean_manuscript(manuscript)

        word_count = len(manuscript.split())

        # Extract title from first # heading
        title = "My Life Story"
        for line in manuscript.split('\n'):
            stripped = line.strip()
            if stripped.startswith('# '):
                title = stripped[2:].strip()
                break

        # Count chapters (## headings)
        chapter_count = sum(1 for line in manuscript.split('\n') if line.strip().startswith('## '))

        await db['biographyjobs'].update_one(
            {"_id": object_id},
            {"$set": {
                "status": "complete",
                "progress": 100,
                "currentPhase": "complete",
                "manuscript": manuscript,
                "title": title,
                "wordCount": word_count,
                "chapterCount": chapter_count,
                "plan": plan,
                "completedAt": datetime.now()
            }}
        )
        print(f"[memoir] Biography complete for user {user_id}: {word_count} words, {chapter_count} chapters")

    except Exception as e:
        print(f"[memoir] Pipeline failed for user {user_id}: {e}")
        try:
            non_local_db = db if db is not None else get_mongo_db()
            await non_local_db['biographyjobs'].update_one(
                {"_id": object_id},
                {"$set": {"status": "failed", "errorMessage": str(e)}}
            )
        except Exception as db_err:
            print(f"[memoir] Could not write failure status to DB: {db_err}")

@app.post("/memoir/generate", dependencies=[Depends(get_api_key)])
async def memoir_generate(request: MemoirGenerateRequest, background_tasks: BackgroundTasks):
    """
    Starts biography generation as a background task.
    Called by the Node.js server as fire-and-forget.
    Returns immediately with a confirmation.
    """
    background_tasks.add_task(_run_memoir_pipeline, request.userId, request.jobId)
    return {"status": "started", "jobId": request.jobId}

@app.post("/ingest/delete", dependencies=[Depends(get_api_key)])
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
