
import google.generativeai as genai

# Test the EXACT key from .env
test_key = "AIzaSyBRaPCoyVcVoJZZqnXmofEh15F1x_mJcuY"

print(f"Testing key: {test_key[:8]}...{test_key[-4:]}")

genai.configure(api_key=test_key)

try:
    print("Attempting embedding...")
    result = genai.embed_content(
        model="models/text-embedding-004",
        content="Test message",
        task_type="retrieval_query"
    )
    print(f"✅ SUCCESS! Vector length: {len(result['embedding'])}")
except Exception as e:
    print(f"❌ FAILED: {e}")
