# AGENTS.md

Guidance for agents working in this repository.

## Project Overview

Jeevani is a digital biographer and legacy preservation app. It has three cooperating services:

- `client/`: React 19 + Vite frontend using Tailwind CSS, Clerk auth, React Router, Framer Motion, GSAP/Lenis on the landing experience, `lucide-react` icons, `sonner` toasts, and an Axios API helper.
- `server/`: Node.js + Express API using CommonJS, MongoDB/Mongoose, Clerk middleware, Cloudinary uploads, rate limiting, and Axios calls into the AI service.
- `ai-service/`: Python FastAPI service using Google Gemini embeddings, Groq chat completions, Pinecone vector search, document loading, and MongoDB access for memoir generation jobs.

The main data flow is:

1. Authenticated users interact with the React app.
2. The frontend sends API requests to `server` with Clerk bearer tokens.
3. The Express API stores metadata/jobs in MongoDB and files in Cloudinary.
4. The Express API calls `ai-service` for ingestion, chat, greetings, vector deletion, and memoir generation.
5. `ai-service` stores/searches vectors in Pinecone and updates MongoDB biography jobs.

## Repository Layout

- `README.md`: human setup guide.
- `CONTRIBUTING.md`: guide for contributing, coding conventions, and PR checklist.
- `LICENSE`: MIT license definitions.
- `Dockerfile` and `start_services.sh`: production-style container that runs the AI service and Node API together.
- `client/src/App.jsx`: route definitions and Clerk provider wiring.
- `client/src/lib/api.js`: shared Axios instance. Prefer this for frontend API calls.
- `client/src/pages/`: route-level screens.
- `client/src/components/`: shared UI and landing components.
- `client/src/styles/landing.css`: landing-specific styling.
- `server/index.js`: Express app bootstrap, middleware, route mounting, health check.
- `server/routes/`: API route modules for vault, biographer chat/history, and memoir generation/export.
- `server/models/`: Mongoose schemas.
- `ai-service/main.py`: FastAPI app and endpoint definitions.
- `ai-service/rag_service.py`: Pinecone/Gemini/Groq RAG logic.
- `ai-service/document_loader.py`: file extraction/OCR/transcription support.
- `ai-service/harvest_service.py`, `memoir_service.py`, `quality_gates.py`: memoir generation pipeline.

## Local Commands

Run commands from the appropriate service directory unless noted.

Frontend:

```bash
cd client
npm install
npm run dev
npm run build
npm run lint
```

Backend:

```bash
cd server
npm install
npm start
npm run dev
```

AI service:

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Full local app requires all three services:

- AI service: `http://localhost:8000`
- Server API: `http://localhost:5000`
- Client: `http://localhost:5173`

There is no project-wide test suite configured at the time of writing. Use targeted verification:

- `npm run lint` in `client` after frontend edits.
- `npm run build` in `client` for frontend integration checks.
- Start `server` and call `/health` after backend/AI integration changes when environment variables are available.
- Start `ai-service` and call `/` after Python service changes when API keys are available.

## Environment Variables

Do not commit secrets. Use local `.env` files and `.env.example` as a shape reference.

Server variables include:

- `PORT`
- `MONGODB_URI`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `AI_SERVICE_URL`
- `ALLOWED_ORIGINS`

Client variables include:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`

AI service variables include:

- `MONGODB_URI`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `PINECONE_API_KEY`
- `ALLOWED_ORIGINS`

If commands fail due to missing external credentials, report that clearly instead of replacing integrations with mocks unless the user asks for mocking.

## Coding Conventions

General:

- Keep changes scoped. This repository often has uncommitted work; do not revert unrelated edits.
- Prefer existing patterns over new abstractions.
- Avoid committing generated artifacts such as `node_modules`, `dist`, `__pycache__`, `.pyc`, or local tool state.
- Use ASCII unless the touched file already intentionally uses non-ASCII text.

Frontend:

- Use ES modules and function components.
- Keep API calls centralized through `client/src/lib/api.js`.
- Use Clerk hooks such as `useAuth()` to fetch tokens and pass `Authorization: Bearer <token>` headers for protected calls.
- Use Tailwind utility classes and the CSS variables defined in `client/src/index.css` for theme colors.
- Use `lucide-react` icons for icon buttons and common UI affordances.
- Use `sonner` for user-facing success/error feedback.
- Keep route-level screens in `client/src/pages` and reusable pieces in `client/src/components`.
- The landing page uses custom animation helpers/styles. Be careful when changing GSAP, Lenis, or `client/src/styles/landing.css`.

Backend:

- The Express server uses CommonJS (`require`, `module.exports`).
- Mount route modules from `server/routes` in `server/index.js`.
- Use Mongoose models from `server/models` for persistence.
- Keep auth checks explicit and consistent with the route. Existing routes use both `req.auth()` and `requireAuth()` patterns.
- Preserve per-user authorization checks before returning, mutating, or exporting user data.
- Calls to the AI service should respect `process.env.AI_SERVICE_URL || 'http://localhost:8000'`.
- For upload changes, keep client-side validation, server-side MIME validation, Cloudinary resource type handling, MongoDB memory metadata, and AI ingestion behavior in sync.

AI Service:

- Keep FastAPI request/response models in `main.py` unless a larger refactor is clearly needed.
- The RAG service expects Pinecone vectors filtered by `userId` and document metadata including `docId`, `originalName`, and chunk `text`.
- Preserve the Gemini embedding dimensionality of `768` unless also migrating the Pinecone index.
- Memoir generation updates `BiographyJob` documents through the phase/progress fields expected by the frontend and server routes.
- `_clean_manuscript` removes quality-gate annotations before storage. Keep export cleanup behavior in sync with server export routes.

## API Contracts To Preserve

Frontend routes:

- `/`
- `/auth/*`
- `/dashboard`
- `/chat`
- `/memoir`

Server API routes:

- `GET /health`
- `POST /api/vault/upload`
- `GET /api/vault/list`
- `DELETE /api/vault/:id`
- `GET /api/biographer/greeting`
- `GET /api/biographer/history`
- `GET /api/biographer/history/:id`
- `DELETE /api/biographer/history/:id`
- `POST /api/biographer/chat`
- `POST /api/memoir/generate`
- `GET /api/memoir/status/:jobId`
- `GET /api/memoir/result/:jobId`
- `GET /api/memoir/list`
- `GET /api/memoir/export/docx/:jobId`
- `GET /api/memoir/export/pdf/:jobId`

AI service routes:

- `GET /`
- `POST /ingest/text`
- `POST /ingest/file-process`
- `POST /ingest/delete`
- `POST /chat`
- `POST /chat/greeting`
- `POST /memoir/generate`

When changing a contract, update all callers across `client`, `server`, and `ai-service`.

## Verification Checklist

Before handing work back:

- Run the narrowest relevant command that can validate the change.
- For frontend UI changes, run `npm run lint` and preferably `npm run build`.
- For backend route/model changes, start the server if credentials are available and check for startup errors.
- For AI service changes, at least run Python import/startup checks if credentials are unavailable.
- Document any verification that could not run because of missing keys, network access, or services.

