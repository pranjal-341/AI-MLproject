"""Authenticated bounded file import, separate from the prediction endpoint."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from ..core.auth import require_user
from ..schemas.documents import ImportResult
from ..services import descriptor_import as importer
from ..services.research_assistant import generation_lock
from ..services.model_loader import ModelUnavailable, load_model, model_version

router = APIRouter(dependencies=[Depends(require_user)])
_import_lock = generation_lock


@router.get("/documents/status")
def document_status():
    return importer.ollama_status()


def extract(content, filename, algorithm, variant, version):
    try:
        if model_version(algorithm, variant) != version:
            raise HTTPException(409, "Model changed. Refresh and select it again before importing.")
        _, names = load_model(algorithm, variant)
        result = importer.import_descriptors(content, filename, names)
        if model_version(algorithm, variant) != version:
            raise HTTPException(409, "Model changed during extraction. Refresh and import again.")
        return ImportResult(algorithm=algorithm, variant=variant, model_version=version, **result)
    except ModelUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except importer.ImportUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/documents/extract", response_model=ImportResult)
async def extract_document(request: Request, algorithm: str = Query(max_length=32),
                           variant: str = Query(max_length=16),
                           model_version: str = Query(min_length=1, max_length=64),
                           filename: str = Query(min_length=1, max_length=180)):
    if not filename.lower().endswith((".csv", ".pdf")):
        raise HTTPException(415, "Only PDF and CSV uploads are supported.")
    if not _import_lock.acquire(blocking=False):
        raise HTTPException(429, "Another document is being processed. Try again after it finishes.")
    try:
        content = bytearray()
        try:
            async with asyncio.timeout(15):
                async for chunk in request.stream():
                    if len(content) + len(chunk) > importer.MAX_BYTES:
                        raise HTTPException(413, "Upload must be 2 MB or smaller.")
                    content.extend(chunk)
        except TimeoutError as exc:
            raise HTTPException(408, "Upload timed out. Please retry with a smaller file.") from exc
        if not content:
            raise HTTPException(422, "The uploaded file is empty.")
        return await run_in_threadpool(extract, bytes(content), filename, algorithm, variant, model_version)
    finally:
        _import_lock.release()
