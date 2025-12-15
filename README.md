
# Jeevani - Digital Biographer & Legacy Preservation

**Jeevani** is a project designed to capture and preserve personal life stories. It acts as a digital biographer, using AI to organize memories, photos, and documents into a cohesive narrative, ensuring that your legacy lives on.

 **Live Demo:** [https://jeevani-psi.vercel.app/](https://jeevani-psi.vercel.app/)

---

## Technical Stack
*   **Frontend:** React, Vite, Tailwind CSS
*   **Backend:** Node.js, Express, MongoDB
*   **AI Service:** Python, FastAPI, Google Gemini (LLM & Embeddings), Pinecone (Vector DB)
*   **Auth:** Clerk
*   **Storage:** Cloudinary

---

## Local Development Setup

### Prerequisites
*   Node.js & npm
*   Python 3.10+
*   MongoDB Atlas Account
*   Clerk Account
*   Cloudinary Account
*   Google Gemini API Key
*   Pinecone API Key



### 1. Installation

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

### 2. Running the Application

You need to run all three services simultaneously in separate terminals.

**Terminal 1: AI Service**
```bash
cd ai-service
uvicorn main:app --reload --port 8000
```

**Terminal 2: Server**
```bash
cd server
npm start
```

**Terminal 3: Client**
```bash
cd client
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## Team
**Major Project by:**
*   Yatharth Patankar
*   Ujjwal Seth
*   Veer Mediwala
*   Vidit Sharma