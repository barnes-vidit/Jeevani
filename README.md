
# Jeevani - MVP

Jeevani is a digital biographer that captures your life story using AI.

## Prerequisites
- Node.js & npm
- Python 3.10+
- MongoDB Atlas Account (Free)
- Clerk Account (Free)
- Cloudinary Account (Free)
- Pinecone Account (Free)
- Google Gemini API Key (Free)

## Setup

### 1. Environment Variables

Create `.env` files in `server`, `client`, and `ai-service` based on the examples provided.

**server/.env**
```
PORT=5000
MONGODB_URI=your_mongodb_uri
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
AI_SERVICE_URL=http://localhost:8000
```

**client/.env**
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:5000/api
```

**ai-service/.env**
```
GEMINI_API_KEY=your_gemini_key
PINECONE_API_KEY=your_pinecone_key
```

### 2. Install Dependencies

**Server**
```bash
cd server
npm install
```

**Client**
```bash
cd client
npm install
```

**AI Service**
```bash
cd ai-service
pip install -r requirements.txt
```

### 3. Run Locally

Open 3 terminal windows:

**Terminal 1 (AI Service)**
```bash
cd ai-service
uvicorn main:app --reload --port 8000
```

**Terminal 2 (Server)**
```bash
cd server
npm run start # (You might need to add "start": "node index.js" to package.json)
# Or: node index.js
```

**Terminal 3 (Client)**
```bash
cd client
npm run dev
```

Visit `http://localhost:5173` to start using Jeevani!
