
import os
import google.generativeai as genai
from pinecone import Pinecone
from dotenv import load_dotenv
import time

load_dotenv()

print("1. Testing Gemini Configuration...")
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
print("Done.")

print("2. Testing Embedding (text-embedding-004)...")
try:
    start = time.time()
    embed = genai.embed_content(
        model="models/text-embedding-004",
        content="Hello world",
        task_type="retrieval_query"
    )
    print(f"Embedding success. Vector length: {len(embed['embedding'])}")
    print(f"Time: {time.time() - start:.2f}s")
except Exception as e:
    print(f"Embedding FAILED: {e}")

print("\n3. Testing Pinecone Connection...")
try:
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    indexes = pc.list_indexes()
    print(f"Indexes found: {[i.name for i in indexes]}")
    
    index_name = "jeevani-index"
    if index_name not in [i.name for i in indexes]:
        print(f"WARNING: Index '{index_name}' NOT found!")
    else:
        print(f"Connecting to index '{index_name}'...")
        index = pc.Index(index_name)
        print("Running dummy query...")
        # Dummy vector of zeros
        dummy_vec = [0.0] * 768
        res = index.query(vector=dummy_vec, top_k=1, filter={"userId": "test"})
        print("Query success.")
except Exception as e:
    print(f"Pinecone FAILED: {e}")

print("\n4. Testing LLM Generation (gemini-1.5-flash-latest)...")
try:
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    response = model.generate_content("Say 'Test Passed'")
    print(f"LLM Response: {response.text}")
except Exception as e:
    print(f"LLM FAILED: {e}")
