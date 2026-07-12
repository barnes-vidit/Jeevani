
import os
import re
import json
from dotenv import load_dotenv
load_dotenv(override=True)
from fastapi import FastAPI, Form, HTTPException, BackgroundTasks, Security, Depends, status
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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
from groq import Groq


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

# Shared Groq client for session summarisation (Decision 4)
_groq_client = None

def get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client

# Async MongoDB client — shared across memoir, ingest, and chat endpoints
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


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    userId: str
    docId: str
    text: str
    originalName: str
    # 'type' lets callers tag chat messages distinctly from file documents
    type: Optional[str] = "text"

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
    life_summary: Optional[str] = ""   # Phase B: cumulative life portrait
    covered_domains: Optional[dict] = {}  # Phase B: domain depth map for gap targeting

class SummariseRequest(BaseModel):
    """Request to summarise today's chat session into a life profile snippet."""
    userId: str
    journalEntryId: str  # MongoDB _id of the JournalEntry for today

# ---------------------------------------------------------------------------
# Helper: write chunks to MongoDB Memory document (Decision 3)
# ---------------------------------------------------------------------------

async def _persist_chunks_to_mongo(doc_id: str, chunks: list):
    """
    Update the Memory document identified by doc_id with the ordered chunk list.
    This makes MongoDB the canonical store of all processed text content.
    """
    try:
        db = get_mongo_db()
        await db['memories'].update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"chunks": chunks}}
        )
        print(f"[ingest] Stored {len(chunks)} chunks in MongoDB for doc {doc_id}")
    except Exception as e:
        # Non-fatal: Pinecone already has the embeddings. Log and continue.
        print(f"[ingest] WARNING: failed to persist chunks to MongoDB for doc {doc_id}: {e}")


# ---------------------------------------------------------------------------
# Helper: fetch chunk texts from MongoDB for Pinecone search results (Decision 6)
# ---------------------------------------------------------------------------

async def _fetch_chunk_texts(matches: list) -> list:
    """
    Given a list of search_similar() result dicts (with doc_id + chunk_index),
    load the actual chunk text from MongoDB and return enriched context dicts.

    Falls back to '[text unavailable]' if a chunk cannot be found.
    Chat vectors (type='chat') have synthetic docIds that are not valid ObjectIds;
    they are handled gracefully with a fallback instead of crashing.
    """
    if not matches:
        return []

    db = get_mongo_db()

    # Group by doc_id to minimise MongoDB round-trips
    from collections import defaultdict
    by_doc: dict = defaultdict(list)
    for m in matches:
        by_doc[m['doc_id']].append(m)

    # Map vector_id -> context dict so we can restore relevance order at the end
    result_by_vector_id: dict = {}

    for doc_id, doc_matches in by_doc.items():
        chunk_map: dict = {}

        # Guard: chat vectors use synthetic IDs like 'chat_<journalId>_<ts>'
        # which are NOT valid BSON ObjectIds. Skip the MongoDB lookup for those.
        try:
            oid = ObjectId(doc_id)
            doc = await db['memories'].find_one({"_id": oid}, {"chunks": 1})
            if doc and doc.get('chunks'):
                for c in doc['chunks']:
                    chunk_map[c['index']] = c['text']
        except Exception:
            # doc_id is not a valid ObjectId (e.g. a chat vector whose text is stored
            # inline in Pinecone metadata).  chunk_map stays empty; the inline text
            # is read directly from the match dict below.
            pass

        for m in doc_matches:
            # For regular documents, text comes from MongoDB (chunk_map).
            # For chat vectors, MongoDB lookup always fails; fall back to the text
            # stored inline in Pinecone metadata (populated by ingest_text for type='chat').
            text = chunk_map.get(m['chunk_index']) or m.get('pinecone_text')
            result_by_vector_id[m['vector_id']] = {
                'vector_id': m['vector_id'],
                'original_name': m['original_name'],
                'score': m['score'],
                'text': text,
                'source_type': m['source_type'],
            }

    # Restore the relevance order returned by search_similar (highest score first)
    ordered = []
    for m in matches:
        entry = result_by_vector_id.get(m['vector_id'])
        if entry:
            ordered.append(entry)

    return ordered



# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "Jeevani AI Service Running"}


@app.post("/ingest/text", dependencies=[Depends(get_api_key)])
async def ingest_text(request: IngestRequest):
    """
    Ingest plain text (or a chat message batch) into Pinecone and store
    chunk text in MongoDB (Decision 3).

    When type='chat', docId should be a synthetic ID like 'chat_{journalId}_{index}'
    so harvest can distinguish chat vectors from file documents (Decision 2).
    """
    try:
        meta = {
            "userId": request.userId,
            "docId": request.docId,
            "originalName": request.originalName,
            "type": request.type or "text"
        }
        result = rag.ingest_text(request.text, meta)

        # Decision 3: persist chunk texts to MongoDB for non-chat documents
        # (chat chunks are stored in JournalEntry already; no separate Memory doc)
        if request.type != "chat":
            await _persist_chunks_to_mongo(request.docId, result["chunks"])

        return {"status": "success", "chunks_processed": result["chunks_processed"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", dependencies=[Depends(get_api_key)])
async def chat(request: ChatRequest):
    """
    RAG chat pipeline:
      1. search_similar() → Pinecone returns vector IDs (no text)
      2. _fetch_chunk_texts() → MongoDB returns actual chunk text
      3. generate_answer() → Groq LLM produces the response
    """
    try:
        # Step 1: contextual semantic search (Phase A fix).
        # Embed last 3 turns + current message so pronouns and implicit references
        # resolve correctly ("he", "she", "that time" → actual person/event in context).
        context_window = request.chat_history[-3:] if request.chat_history else []
        context_query = " ".join(
            [m["content"] for m in context_window] + [request.message]
        )
        context_query = context_query[-2000:]  # cap: well within Gemini embedding limits
        matches = rag.search_similar(context_query, request.userId)

        # Step 2: fetch text from MongoDB — Pinecone holds IDs only (Decision 6)
        context_parts = await _fetch_chunk_texts(matches)

        # Step 3: LLM call — pass the original user message (not the expanded query)
        answer = rag.generate_answer(context_parts, request.message, request.chat_history)
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


@app.post("/chat/summarise", dependencies=[Depends(get_api_key)])
async def summarise_session(request: SummariseRequest):
    """
    Phase B session close-out — two sequential Groq calls:

    1. Session summary (150-200 words) → JournalEntry.summary
       Captures what was discussed in this conversation.

    2. Cumulative profile update (JSON-mode) → userprofiles collection
       Merges the session summary into a rolling 400-600 word life portrait
       and updates the domain depth coverage map (childhood, career, etc.).
       This is what the greeting reads on next login to ask purposeful questions.

    Called by the Node server at end-of-session (fire-and-forget from client).
    """
    try:
        db = get_mongo_db()
        entry = await db['journalentries'].find_one({"_id": ObjectId(request.journalEntryId)})
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")

        messages = entry.get('messages', [])
        user_messages = [m['content'] for m in messages if m.get('role') == 'user']
        if not user_messages:
            return {"summary": "", "status": "no_user_messages"}

        # Include full dialogue (both user and assistant) so the summariser can judge
        # which life domains were genuinely explored in depth, not just what was said.
        conversation_text = "\n".join(
            f"{'User' if m.get('role') == 'user' else 'Jeevani'}: {m['content']}"
            for m in messages
        )
        groq_client = get_groq_client()

        # ── Call 1: session summary (plain text) ────────────────────────────
        session_completion = groq_client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a life archivist. Given a set of conversation excerpts, "
                        "write a concise life-profile paragraph (150–200 words) covering: "
                        "recurring themes, key people mentioned by name, emotional tone, "
                        "and any significant life events or periods discussed. "
                        "Write in present tense as a summary fact sheet, not as a narrative. "
                        "Output only the paragraph, no preamble."
                    )
                },
                {
                    "role": "user",
                    "content": f"Session messages:\n{conversation_text[:8000]}"
                }
            ],
            temperature=0.3,
            max_tokens=300,
        )
        summary = session_completion.choices[0].message.content.strip()

        # Persist session summary to JournalEntry
        await db['journalentries'].update_one(
            {"_id": ObjectId(request.journalEntryId)},
            {"$set": {"summary": summary}}
        )
        print(f"[summarise] Session summary stored for entry {request.journalEntryId}")

        # ── Call 2: cumulative UserProfile update (JSON-mode) ───────────────
        # Read existing profile if any
        existing_doc = await db['userprofiles'].find_one({"userId": request.userId})
        existing_profile = existing_doc.get('cumulativeProfile', '') if existing_doc else ''
        existing_domains = existing_doc.get('coveredDomains', {}) if existing_doc else {}

        profile_completion = groq_client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a life archivist maintaining an evolving portrait of a person. "
                        "Return a valid JSON object with exactly two keys:\n"
                        "1. 'profile': A 400-600 word cumulative life portrait written in present tense. "
                        "   Merge ALL previous information with new session insights. Be specific — "
                        "   include names, places, events, emotions. Never lose prior information.\n"
                        "2. 'domains': An object with these exact keys, each rated based on how "
                        "   thoroughly this aspect of their life has been discussed across ALL sessions:\n"
                        "   childhood, education, relationships, career, family, failures, values, current_life\n"
                        "   Use only these values: 'none' (never discussed), 'low' (briefly touched), "
                        "   'medium' (moderately explored), 'high' (richly documented)."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"EXISTING PORTRAIT:\n{existing_profile or 'No portrait yet — this is the first session.'}\n\n"
                        f"CURRENT DOMAIN COVERAGE:\n{json.dumps(existing_domains) if existing_domains else 'Unknown — first session.'}\n\n"
                        f"NEW SESSION SUMMARY:\n{summary}"
                    )
                }
            ],
            temperature=0.3,
            max_tokens=900,
        )

        try:
            profile_data = json.loads(profile_completion.choices[0].message.content)
            new_profile = profile_data.get('profile', existing_profile)
            new_domains = profile_data.get('domains', existing_domains)

            await db['userprofiles'].update_one(
                {"userId": request.userId},
                {"$set": {
                    "cumulativeProfile": new_profile,
                    "coveredDomains": new_domains,
                    "lastUpdated": datetime.now()
                }},
                upsert=True
            )
            print(f"[summarise] UserProfile updated for user {request.userId}")
        except (json.JSONDecodeError, Exception) as profile_err:
            # Non-fatal: session summary already saved; profile update failed
            print(f"[summarise] WARNING: UserProfile update failed (non-fatal): {profile_err}")

        return {"summary": summary, "status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[summarise] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/file-process", dependencies=[Depends(get_api_key)])
async def ingest_file_process(
    userId: str = Form(...),
    docId: str = Form(...),
    fileUrl: str = Form(...),
    originalName: str = Form(...),
):
    """Process file: download, extract text, ingest to Pinecone, persist chunks to MongoDB, generate summary."""
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

        # 2. Load and extract text
        doc = loader.load_file(temp_file_path)
        text = doc['text']

        # 3. Ingest to Pinecone (no chunk text in metadata — Decision 6)
        meta = {
            "userId": userId,
            "docId": docId,
            "originalName": originalName,
            "type": doc['type']
        }
        # Preserve the Cloudinary URL for images so the biography can reference photos
        if doc['type'] == 'image':
            meta['cloudUrl'] = fileUrl

        result = rag.ingest_text(text, meta)

        # 4. Decision 3: persist ordered chunk texts to MongoDB
        await _persist_chunks_to_mongo(docId, result["chunks"])

        # 5. Generate summary
        summary = rag.generate_summary(text, originalName)

        return {
            "status": "success",
            "chunks_processed": result["chunks_processed"],
            "summary": summary
        }

    except Exception as e:
        print(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


# ---------------------------------------------------------------------------
# Memoir pipeline
# ---------------------------------------------------------------------------

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

        # Decision 5: HarvestService now uses MongoDB, not a Pinecone scan
        harvest = HarvestService(db)
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
    docId: str = Form(...),
):
    """Delete Pinecone vectors for a document. MongoDB Memory doc is deleted by the server route."""
    try:
        success = rag.delete_document(userId, docId)
        if success:
            return {"status": "success", "message": "Document vectors deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete vectors")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
