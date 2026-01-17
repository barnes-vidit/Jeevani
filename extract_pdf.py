
from pypdf import PdfReader

reader = PdfReader(r"c:\Users\vidit shrama\Desktop\vidit\update.pdf")
for i, page in enumerate(reader.pages):
    print(f"=== PAGE {i+1} ===")
    text = page.extract_text()
    if text:
        print(text)
    else:
        print("[No text extracted from this page]")
    print()
