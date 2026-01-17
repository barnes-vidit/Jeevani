
import os
from dotenv import load_dotenv

# Try loading from current directory
load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print(f"Current Directory: {os.getcwd()}")
print(f"GEMINI_API_KEY found? {bool(key)}")
if key:
    print(f"Key Prefix: {key[:5]}...")
else:
    print("KEY NOT FOUND")
    # Try looking for .env file explicitly
    if os.path.exists(".env"):
        print(".env file EXISTS in current directory.")
        with open(".env", "r") as f:
            print("First 2 lines of .env:")
            print(f.readline())
            print(f.readline())
    else:
        print(".env file NOT FOUND in current directory.")
