
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print(f"Using Key: {key[:5]}...{key[-5:] if key else ''}")

if not key:
    print("❌ Key missing!")
    exit(1)

genai.configure(api_key=key)

try:
    print("Attempting to embed text 'Hello world'...")
    model = "models/text-embedding-004"
    result = genai.embed_content(
        model=model,
        content="Hello world",
        task_type="retrieval_document"
    )
    print("✅ Embedding success!")
    print(f"Vector length: {len(result['embedding'])}")
except Exception as e:
    print(f"❌ Embedding FAILED: {e}")
