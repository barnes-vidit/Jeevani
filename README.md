# 🌸 Jeevani — Digital Biographer & Legacy Preservation

**Jeevani** is a digital biographer and legacy preservation platform designed to capture, organize, and compile personal life stories. By acting as a digital interviewer and document repository, Jeevani uses agentic AI systems to transform memories, personal journals, scanned photos, audio transcripts, and documents into a structured, publication-quality literary memoir.

---

## 🏛️ System Architecture

Jeevani is structured as a robust, three-tiered application featuring a React-based frontend, a Node.js orchestration backend, and a high-performance Python AI service managing vector search and multi-agent pipelines.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as React Client (Port 5173)
    participant Server as Express Server (Port 5000)
    participant AI as FastAPI Service (Port 8000)
    database DB as MongoDB Atlas
    database Cloud as Cloudinary Storage
    database Pine as Pinecone DB

    Note over User, Client: Collection Phase (Vault & Journaling)
    User->>Client: Upload memory (PDF, Audio, Image)
    Client->>Server: POST /api/vault/upload (Clerk Token)
    Server->>Cloud: Upload media asset
    Cloud-->>Server: Return Cloud URL & Public ID
    Server->>DB: Store metadata in Memory Schema
    Server->>AI: Trigger processing (Async POST /ingest/file-process)
    AI->>AI: Run OCR / Groq Whisper Audio transcription
    AI->>AI: Generate vector embeddings (Gemini-768)
    AI->>Pine: Store chunk embeddings
    AI->>DB: Update processingStatus & Summary
    AI-->>Server: Ingestion complete

    Note over User, Client: Dialogue Phase (Guided Chat)
    User->>Client: Send message to Biographer
    Client->>Server: POST /api/biographer/chat
    Server->>AI: POST /chat (Include history + user input)
    AI->>Pine: Query similar vectors (RAG Context)
    AI->>AI: Complete context prompt with Groq/Gemini
    AI-->>Server: Biographer response
    Server->>DB: Append messages to JournalEntry Schema
    Server-->>Client: Deliver reply

    Note over User, Client: Synthesis Phase (Memoir Generation)
    User->>Client: Trigger "Generate Memoir"
    Client->>Server: POST /api/memoir/generate
    Server->>DB: Initialize BiographyJob Schema (queued)
    Server->>AI: POST /memoir/generate (Background Task)
    Server-->>Client: Return jobId immediately
    Note over AI, DB: Multi-Agent Memoir Generation Pipeline
    AI->>Pine: Query all user vectors (Harvest)
    AI->>AI: Run Orchestrator (Chapter outlines)
    AI->>AI: Run Voice Guide Agent (Style profile)
    AI->>AI: Run Theme Miner (Life Leitmotifs)
    AI->>AI: Run Era Agents (Chapter drafts + photos)
    AI->>AI: Run Narrative Assembler (Introduction & epilogue)
    AI->>AI: Run Quality Gates (Fact verification & coherence check)
    AI->>DB: Update BiographyJob (status: complete, manuscript)
    Client->>Server: Poll GET /api/memoir/status/:jobId
    Server-->>Client: Update generation progress %
    User->>Client: Export / Download Memoir
    Client->>Server: GET /api/memoir/export/pdf/:jobId
    Server->>DB: Fetch manuscript content
    Server->>Server: Compile PDF/DOCX (strip AI tags)
    Server-->>User: File download
```

---

## 🌟 Key Features

### 1. Unified Memory Vault
- **Multi-Format Ingestion**: Supports PDF, Word documents (`.doc`, `.docx`), plain text files, audio clips (`.mp3`, `.wav`, `.webm`), and images (`.jpeg`, `.png`, `.webp`).
- **Transcription & OCR**: Processes voice notes using Groq Whisper and images using vision-based OCR.
- **RAG Preprocessing**: Chunks and indexes extracted text as 768-dimensional vectors in Pinecone for semantic search context.

### 2. Interactive AI Biographer & Guided Journaling
- **Dynamic Session Greetings**: Uses an aggregation pipeline to query recent uploads, previous conversations, and "On This Day" historical milestones to start chat sessions with context.
- **Guided Dialogue**: A conversational agent prompt that acts as a gentle interviewer, helping users expand on critical moments.
- **Daily Bucketing**: Saves user conversations into daily `JournalEntry` records to maintain clear chronological progression.

### 3. Agentic Memoir Generation Pipeline
An asynchronous multi-agent orchestration pipeline running on FastAPI and powered by **Cerebras Llama-3.3-70b** for ultra-fast completions:
*   **Orchestrator Agent**: Examines the harvested corpus to build a chronological roadmap and draft a chapter outline.
*   **Voice Guide Agent**: Builds a style guide based on the user's authentic vocabulary, sentence structure, and conversational tone.
*   **Theme Miner**: Mines the corpus to identify recurring life-wide values, relationships, and emotional threads ("Leitmotifs").
*   **Era Agents (Chapter Writers)**: Write literary chapters based on their respective briefs, incorporating relevant facts and embedding photo URLs.
*   **Narrative Assembler**: Weaves the chapters, writes a custom Prologue/Epilogue, applies the voice guide, and ensures seamless transitions.
*   **Quality Gates**: Runs two consecutive correction layers before completion:
    - *Fact Verification*: Checks claims against the source corpus, softening unverified items.
    - *Coherence Check*: Resolves timeline contradictions and name discrepancies.

### 4. Layout Preservation & Document Compiler
- Compiles the final Markdown manuscript into print-ready formats.
- **PDF Compilation**: Employs `pdfkit` to structure chapters with Times-Roman styling, running headers, and clean page layouts.
- **DOCX Compilation**: Leverages `docx` library to produce editable Microsoft Word files using professional typographic spacing.

---

## 📂 Repository Layout

```filepath
├── client/                      # React 19 Single Page Application
│   ├── src/
│   │   ├── components/          # Shared UI (Layout, Logo) & Landing widgets
│   │   ├── pages/               # Route-level screens (Dashboard, Memoir, Chat)
│   │   └── lib/api.js           # Central Axios client instance
│   ├── tailwind.config.js       # Tailwind configuration
│   └── package.json
│
├── server/                      # Node.js + Express API Backend
│   ├── models/                  # Mongoose Schemas (Memory, BiographyJob, JournalEntry)
│   ├── routes/                  # Express Router modules (vault, biographer, memoir)
│   ├── index.js                 # App configuration & Server bootstrapping
│   └── package.json
│
├── ai-service/                  # Python FastAPI AI & RAG Engine
│   ├── main.py                  # API endpoints and background runner tasks
│   ├── rag_service.py           # Pinecone & Gemini embedding helper
│   ├── document_loader.py       # OCR, transcription, and file reading logic
│   ├── harvest_service.py       # Memory corpus harvester
│   ├── memoir_service.py        # Multi-agent pipeline orchestrator
│   ├── quality_gates.py         # Fact and coherence verification agents
│   └── requirements.txt
│
├── Dockerfile                   # Unified Python + Node.js deployment container
├── start_services.sh            # Service controller / entrypoint script
└── AGENTS.md                    # Developer guidelines and API contracts
```

---

## ⚙️ Environment Variables Configuration

Create local `.env` files within `/server`, `/client`, and `/ai-service` using the following schemas as templates.

### 1. Server Configuration (`server/.env`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Local network port for the Node API server | `5000` |
| `MONGODB_URI` | Connection URI for the MongoDB database | `mongodb+srv://...` |
| `CLERK_PUBLISHABLE_KEY` | Public authentication token from Clerk | `pk_test_...` |
| `CLERK_SECRET_KEY` | Secret authentication token from Clerk | `sk_test_...` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary storage bucket account name | `...` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `...` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `...` |
| `AI_SERVICE_URL` | Endpoint of the Python AI service | `http://localhost:8000` |
| `AI_SERVICE_API_KEY` | Secret API token shared with AI Service | `dev-secret-key` |
| `ALLOWED_ORIGINS` | CORS allowed hosts (separated by commas) | `http://localhost:5173` |

### 2. Client Configuration (`client/.env.development`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base endpoint path to Express API gateway | `http://localhost:5000/api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public authentication token from Clerk | `pk_test_...` |

### 3. AI Service Configuration (`ai-service/.env`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `MONGODB_URI` | Connection URI for the MongoDB database | `mongodb+srv://...` |
| `GEMINI_API_KEY` | API key used for generating 768-dim embeddings | `AIzaSy...` |
| `PINECONE_API_KEY` | API key to access Pinecone Vector DB | `pcsk_...` |
| `GROQ_API_KEY` | API key used for completions and Whisper | `gsk_...` |
| `CEREBRAS_API_KEY` | API key for high-speed Llama-3.3 execution | `csk_...` |
| `CEREBRAS_BASE_URL` | Custom base endpoint URL for Cerebras | `https://api.cerebras.ai/v1` |
| `AI_SERVICE_API_KEY` | Secret token to authenticate incoming Server calls | `dev-secret-key` |
| `CEREBRAS_ORCHESTRATOR_MODEL` | LLM model used to plan the chapters | `llama-3.3-70b` |
| `CEREBRAS_CHAPTER_MODEL` | LLM model used to write chapter drafts | `llama-3.3-70b` |
| `CEREBRAS_THEMES_MODEL` | LLM model used to mine core life themes | `llama-3.3-70b` |
| `CEREBRAS_VOICE_MODEL` | LLM model used to create the voice guide | `llama-3.3-70b` |
| `CEREBRAS_EDITOR_MODEL` | LLM model used to run final assembly drafts | `llama-3.3-70b` |
| `CEREBRAS_COHERENCE_MODEL` | LLM model used to run coherence editors | `llama-3.3-70b` |
| `CEREBRAS_FACT_CHECKER_MODEL`| LLM model used to verify facts against corpus | `llama-3.3-70b` |
| `ALLOWED_ORIGINS` | CORS allowed hosts (separated by commas) | `http://localhost:5000` |

---

## 🚀 Local Development Setup

Follow these commands to boot up the complete environment. Run each command in separate terminal windows.

### Standalone Service Installation

#### 1. Setup the AI Engine
Ensure you have Python 3.10+ installed.
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- **Service Endpoint**: `http://localhost:8000`
- **Interactive docs**: `http://localhost:8000/docs`

#### 2. Setup the Express Server
Ensure you have Node.js 20+ installed.
```bash
cd server
npm install
npm run dev
```
- **Service Endpoint**: `http://localhost:5000`
- **Health diagnostics**: `http://localhost:5000/health`

#### 3. Setup the React Frontend
```bash
cd client
npm install
npm run dev
```
- **Local Application Link**: `http://localhost:5173`

---

## 🐳 Production Container Deployment

Jeevani contains a unified `Dockerfile` and a shell supervisor `start_services.sh` designed to package and run both backend services (FastAPI and Express) in a single lightweight container.

### Dockerized Build Instructions

1. **Build the image**:
   ```bash
   docker build -t jeevani-platform .
   ```

2. **Run the container**:
   Provide the environment credentials via an env file.
   ```bash
   docker run -p 5000:5000 --env-file ./server/.env jeevani-platform
   ```

3. **Multi-Service Entrypoint Details (`start_services.sh`)**:
   - Spawns the python AI Service in the background on port `8001`.
   - Polls `http://localhost:8001/` for up to 60 seconds to ensure the engine is active.
   - Bootstraps the Node.js API server in the foreground, binding to the primary port (default `5000`).

---

## 🔌 API Endpoints Reference

### Express Server endpoints (`/api/*`)

All `/api/` endpoints are rate-limited to 100 requests per minute. Special restrictions are placed on chat routes (20 requests per minute) to safeguard external API quotas.

| Method | Path | Authentication | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Runs system diagnostics and checks AI engine connectivity. |
| `POST` | `/api/vault/upload` | Clerk Header | Multi-part upload to Cloudinary. Launches background ingestion job on AI service. |
| `GET` | `/api/vault/list` | Clerk Header | Fetches lists of all uploaded memory documents. |
| `DELETE`| `/api/vault/:id` | Clerk Header | Deletes file metadata from DB, media from Cloudinary, and vectors from Pinecone. |
| `GET` | `/api/biographer/greeting`| Clerk Header | Generates context-aware, personalized greeting messages. |
| `GET` | `/api/biographer/history` | Clerk Header | Fetches list of journal conversations. Supports query parameter search (`?q=`). |
| `GET` | `/api/biographer/history/:id`| Clerk Header| Retrieves message logs for a single day's journal entry. |
| `DELETE`| `/api/biographer/history/:id`| Clerk Header| Deletes a target journal entry from the DB. |
| `POST` | `/api/biographer/chat` | Clerk Header | Submits chat messages to the biographer (uses daily message buckets). |
| `POST` | `/api/memoir/generate` | Clerk Header | Initiates memoir compilation. Limited to 1 generation per hour. |
| `GET` | `/api/memoir/status/:jobId` | Clerk Header | Polls the progress percentage and pipeline stage of the compilation. |
| `GET` | `/api/memoir/result/:jobId` | Clerk Header | Fetches the completed manuscript text and structural plan. |
| `GET` | `/api/memoir/list` | Clerk Header | Lists completed memoirs for the user. |
| `GET` | `/api/memoir/export/docx/:jobId`| Clerk Header| Compiles and downloads a clean, print-ready DOCX file. |
| `GET` | `/api/memoir/export/pdf/:jobId`| Clerk Header | Compiles and downloads a clean, print-ready PDF file. |

### AI Engine Endpoints

Requests must supply the API key in the `X-API-Key` header (default `dev-secret-key`).

| Method | Path | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | None | Service ping/health check. |
| `POST` | `/ingest/text` | `{ userId, docId, text, originalName }` | Generates text embeddings and inserts chunks into Pinecone. |
| `POST` | `/ingest/file-process` | Form-Data: `userId, docId, fileUrl, originalName` | Downloads file, extracts text, transcribes/OCR's, embeds and indexes. |
| `POST` | `/ingest/delete` | Form-Data: `userId, docId` | Removes all vectors belonging to a document from Pinecone. |
| `POST` | `/chat` | `{ userId, message, chat_history }` | RAG search against Pinecone and replies using LLM context. |
| `POST` | `/chat/greeting` | `{ user_name, recent_uploads, last_chat, on_this_day, current_date }` | Generates a custom styled welcome greeting. |
| `POST` | `/memoir/generate` | `{ userId, jobId }` | Starts the multi-agent asynchronous memoir pipeline in a background task. |

---

## 🛠️ Verification Checklist

### Quality Assurance

Always run lint and build verification on the client code to ensure zero compilation regressions before updates:

```bash
# Frontend Code Linters & Integration Checks
cd client
npm run lint
npm run build
```

Verify service connectivity dynamically using the Express diagnostics path:
```bash
curl http://localhost:5000/health
```

Expected Response:
```json
{
  "server": "ok",
  "mongodb": "connected",
  "ai_service_url": "http://localhost:8000",
  "ai_service": "Jeevani AI Service Running"
}
```
