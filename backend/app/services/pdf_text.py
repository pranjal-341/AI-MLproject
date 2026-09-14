"""Bounded PDF text worker. Receives PDF bytes on stdin; writes JSON only.

Separate process keeps malformed PDF parsing out of the API process. Linux
workers also have a memory cap; the parent enforces a wall-clock timeout.
"""
import io
import json
import sys

MAX_BYTES = 2 * 1024 * 1024
MAX_PAGES = 12
MAX_TEXT = 16000


def extract_pages(content: bytes) -> list[str]:
    from pypdf import PdfReader

    if not content.startswith(b"%PDF-"):
        raise ValueError("This file is not a PDF. Upload a text PDF or a one-row CSV.")
    reader = PdfReader(io.BytesIO(content), strict=False)
    if reader.is_encrypted:
        raise ValueError("Password-protected PDFs are not supported. Export an unlocked copy.")
    if not 1 <= len(reader.pages) <= MAX_PAGES:
        raise ValueError("Upload a PDF with 1 to 12 pages describing one sample.")
    pages = []
    total = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        total += len(text)
        if total > MAX_TEXT:
            raise ValueError("PDF text exceeds 16,000 characters. Upload only the descriptor pages.")
        pages.append(text)
    if not any(text.strip() for text in pages):
        raise ValueError("No selectable text found. Scanned PDFs need OCR first; a descriptor CSV also works.")
    return pages


def main():
    if sys.platform.startswith("linux"):
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024,) * 2)
    try:
        content = sys.stdin.buffer.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise ValueError("Upload must be 2 MB or smaller.")
        result = {"pages": extract_pages(content)}
    except ValueError as exc:
        result = {"error": str(exc)}
    except Exception:
        result = {"error": "PDF could not be read. Export a text PDF or upload a descriptor CSV."}
    sys.stdout.buffer.write(json.dumps(result).encode("utf-8"))


if __name__ == "__main__":
    main()
