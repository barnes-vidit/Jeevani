# 🌸 Jeevani

> **Your life, told the way only you can tell it.**

Jeevani is a digital biographer and legacy preservation platform. Upload your photos, documents, journals, and voice notes. Talk to an AI biographer that listens. Walk away with a publication-quality literary memoir.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)

---

## What it does

| Phase | What happens |
|---|---|
| **Vault** | Upload PDFs, Word docs, images, audio clips. Jeevani transcribes, OCR-processes, and indexes everything. |
| **Dialogue** | An AI biographer chats with you daily, referencing your uploads to ask the right follow-up questions. |
| **Memoir** | A multi-agent pipeline harvests your entire corpus and writes a structured, chapter-by-chapter literary memoir. |
| **Export** | Download the finished manuscript as a print-ready PDF or editable DOCX. |

---

## Architecture

Three cooperating services, one coherent product.

```
Browser (React 19 + Vite)
        |
        | Clerk JWT
        v
Express API  ──────────────────────────┐
   |  MongoDB (metadata, jobs)          |
   |  Cloudinary (media storage)        |
   |                                   |
   └──> FastAPI AI Service             |
           Pinecone (vector search)    |
           Gemini (embeddings)         |
           Cerebras Llama-3.3 (LLM) ──┘
```

- **`client/`** -- React 19, Vite, Tailwind CSS, Clerk auth, Framer Motion
- **`server/`** -- Node.js, Express, Mongoose, Cloudinary, rate limiting
- **`ai-service/`** -- FastAPI, Pinecone RAG, Groq Whisper, Gemini embeddings, multi-agent memoir pipeline

---

## Getting started

You need all three services running locally. Open three terminals.

### Prerequisites

- Node.js 20+
- Python 3.10+
- Accounts for: [MongoDB Atlas](https://mongodb.com/atlas), [Clerk](https://clerk.dev), [Cloudinary](https://cloudinary.com), [Pinecone](https://pinecone.io), [Gemini](https://ai.google.dev), [Groq](https://groq.com), [Cerebras](https://cerebras.ai)

### 1. AI Service

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Confirm it is up: `http://localhost:8000/docs`

### 2. Express API

```bash
cd server
npm install
npm run dev
```

Confirm it is up: `http://localhost:5000/health`

### 3. React Client

```bash
cd client
npm install
npm run dev
```

Open: `http://localhost:5173`

---

## Environment variables

Copy each `.env.example` in the service directories and fill in your credentials.

### `server/.env`

```env
PORT=5000
MONGODB_URI=mongodb+srv://...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=dev-secret-key
ALLOWED_ORIGINS=http://localhost:5173
```

### `client/.env.development`

```env
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### `ai-service/.env`

```env
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=AIzaSy...
PINECONE_API_KEY=pcsk_...
GROQ_API_KEY=gsk_...
CEREBRAS_API_KEY=csk_...
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1
AI_SERVICE_API_KEY=dev-secret-key
ALLOWED_ORIGINS=http://localhost:5000
```

> All `CEREBRAS_*_MODEL` variables default to `llama-3.3-70b`. Override them individually if you want to route specific agents to different models.

---

## Docker deployment

Both backend services are packaged into a single container.

```bash
# Build
docker build -t jeevani-platform .

# Run (provide credentials via env file)
docker run -p 5000:5000 --env-file ./server/.env jeevani-platform
```

`start_services.sh` starts the FastAPI service in the background, waits up to 60 seconds for it to be healthy, then starts the Node API in the foreground.

---

## API reference

### Express API (`/api/*`)

All routes require a Clerk `Authorization: Bearer <token>` header. Rate limited to 100 req/min (chat routes: 20 req/min).

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service diagnostics including AI engine connectivity |
| `POST` | `/api/vault/upload` | Upload a memory file; triggers background AI ingestion |
| `GET` | `/api/vault/list` | List all uploaded memory documents |
| `DELETE` | `/api/vault/:id` | Delete file, metadata, and Pinecone vectors |
| `GET` | `/api/biographer/greeting` | Generate a personalized session greeting |
| `GET` | `/api/biographer/history` | List journal sessions (supports `?q=` search) |
| `POST` | `/api/biographer/chat` | Send a message to the AI biographer |
| `POST` | `/api/memoir/generate` | Start memoir generation (1 per hour limit) |
| `GET` | `/api/memoir/status/:jobId` | Poll generation progress |
| `GET` | `/api/memoir/result/:jobId` | Retrieve completed manuscript |
| `GET` | `/api/memoir/list` | List all completed memoirs |
| `GET` | `/api/memoir/export/pdf/:jobId` | Download print-ready PDF |
| `GET` | `/api/memoir/export/docx/:jobId` | Download editable DOCX |

### AI Service (`X-API-Key` header required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/ingest/text` | Embed and index raw text into Pinecone |
| `POST` | `/ingest/file-process` | Download, OCR/transcribe, and embed a file |
| `POST` | `/ingest/delete` | Remove all vectors for a document |
| `POST` | `/chat` | RAG-powered biographer chat |
| `POST` | `/chat/greeting` | Generate context-aware session greeting |
| `POST` | `/memoir/generate` | Launch async multi-agent memoir pipeline |

---

## Memoir generation pipeline

The memoir pipeline runs as a FastAPI background task powered by Cerebras Llama-3.3-70b for sub-second token throughput.

```
Harvest  -->  Orchestrator  -->  Voice Guide  -->  Theme Miner
                                                       |
                                               Era Agents (chapters)
                                                       |
                                            Narrative Assembler
                                                       |
                                    Quality Gates (fact check + coherence)
                                                       |
                                               Final Manuscript
```

Progress is streamed back to the client via polled status updates on the job record.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, coding conventions, and PR checklist.

For agent/developer guidelines and internal API contracts, see [AGENTS.md](AGENTS.md).

---

## License

MIT. See [LICENSE](LICENSE).
