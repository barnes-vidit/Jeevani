# Contributing to Jeevani

Thank you for your interest in contributing to **Jeevani**! This document outlines guidelines, conventions, and steps to make the contribution process clear and efficient.

---

## 🗺️ Codebase Structure

Jeevani consists of three cooperating components:
- [client/](file:///c:/Users/vidit%20shrama/Desktop/vidit/client): React 19 SPA powered by Vite and Tailwind CSS.
- [server/](file:///c:/Users/vidit%20shrama/Desktop/vidit/server): Express API server managing authentication (Clerk), media uploads (Cloudinary), and database entities (MongoDB/Mongoose).
- [ai-service/](file:///c:/Users/vidit%20shrama/Desktop/vidit/ai-service): FastAPI Python backend managing document parser/OCR/Whisper, vector ingestion, semantic querying, and the multi-agent memoir compiler.

---

## 🛠️ Getting Started & Setup

1. **Fork and Clone** the repository.
2. Ensure you have the system prerequisites:
   - **Node.js** (v20 or higher)
   - **Python** (3.10 or higher)
   - Setup external API access accounts (MongoDB Atlas, Clerk, Cloudinary, Gemini, Groq, Pinecone, Cerebras).
3. Setup the local development environments following the installation commands documented in the [README.md](file:///c:/Users/vidit%20shrama/Desktop/vidit/README.md).

---

## 🌿 Branch Naming & Flow

Please follow standard branch prefix conventions when submitting contributions:
- `feature/your-feature-name` for new user features.
- `bugfix/description-of-bug` for correcting errors.
- `docs/what-you-updated` for documentation edits.
- `refactor/what-was-cleaned` for internal non-functional code changes.

Always create your branch from `main` and keep commits clear and descriptive.

---

## 📝 Coding Conventions

To maintain consistency across our decoupled architecture, please adhere to these guidelines:

### Frontend (`client/`)
- **React Standards**: Use functional components with hooks.
- **Styling**: Rely on Tailwind utility classes and the theme CSS variables declared in `client/src/index.css`.
- **Icons & Feeds**: Use `lucide-react` for UI iconography. Employs `sonner` toasts to report process notifications.
- **Networking**: Coordinate all frontend API calls through the centralized Axios client instance in `client/src/lib/api.js`. Incorporate Clerk tokens using standard `Authorization: Bearer <token>` request headers.

### Backend Server (`server/`)
- **Format**: Rely strictly on CommonJS (`require` / `module.exports`).
- **Persistence**: Declare Mongoose database models inside `server/models/`. Mount API route routers under `server/routes/`.
- **Security**: Maintain authorization checks. Ensure any query, deletion, or compilation request validates user ownership (`userId`) prior to executing database operations.

### AI Engine (`ai-service/`)
- **Format**: Declare FastAPI request schemas using `Pydantic` models.
- **Embeddings**: Ensure vector embeddings retain a dimensionality of **768** (for Google Gemini model compatibility).
- **Rate Limits**: Comply with Cerebras rate limits (Llama completions are throttled to `4.5` requests per minute via the spacing rate limiter in `quality_gates.py`).
- **Clean Output**: Always execute `_clean_manuscript` (in `main.py`) before final manuscript storage to strip editing annotations (e.g. `[UNVERIFIED:...], [GAP:...]`) from the text database records.

---

## 📬 Pull Request Submission Checklist

Before submitting a Pull Request, please ensure the following checks pass:

1. **Client Quality Check**:
   ```bash
   cd client
   npm run lint
   npm run build
   ```
2. **Server Connectivity Diagnostics**:
   Boot up all services, run the endpoint health diagnostic check, and verify the connection reports healthy links across tiers:
   ```bash
   curl http://localhost:5000/health
   ```
3. **API Contracts**: If API routes were modified or updated, ensure matching parameter adjustments are updated in both client files (`client/src/lib/api.js`) and matching endpoint callers.
4. **Documentation**: Update the root [README.md](file:///c:/Users/vidit%20shrama/Desktop/vidit/README.md) if changes modify setup environments or endpoint signatures.
