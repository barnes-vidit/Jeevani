
import requests
import json

url = "http://localhost:8000/chat"
payload = {
    "userId": "test_debug_user",
    "message": "Hello Jeevani, are you there?"
}
headers = {
    "Content-Type": "application/json"
}

try:
    print(f"Sending POST to {url}...")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print("Response Body:")
    print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
