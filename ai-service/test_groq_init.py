
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("❌ GROQ_API_KEY is missing from environment/file.")
else:
    print(f"✅ GROQ_API_KEY found: {api_key[:5]}...")
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq Client initialized.")
        
        # Test call
        print("Testing API call...")
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=10
        )
        print(f"✅ API Response: {completion.choices[0].message.content}")
        
    except Exception as e:
        print(f"❌ Error connecting to Groq: {e}")
