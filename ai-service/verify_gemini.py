
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env file.")
    exit(1)

if "INSERT_YOUR" in api_key:
     print("Error: GEMINI_API_KEY is still the placeholder text.")
     exit(1)

print(f"Testing API Key: {api_key[:5]}...{api_key[-5:]}")

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content("Hello, can you hear me?")
    print("Success! Gemini API responded:")
    print(response.text)
except Exception as e:
    print("\nAPI Key Verification FAILED!")
    print(f"Error: {e}")
