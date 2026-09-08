from fastapi import APIRouter, Depends, HTTPException
from ..services.model_loader import list_models
router = APIRouter()

@router.get("/models")
def models():
    return {"models": list_models()}

from ..core.auth import require_user
from ..services.model_loader import model_directory
from ..utils.helpers import read_json

@router.get("/models/{algorithm}/{variant}/sample", dependencies=[Depends(require_user)])
def sample(algorithm: str, variant: str):
    try:
        directory = model_directory(algorithm, variant)
    except ValueError as exc:
        raise HTTPException(404, "Unknown model") from exc
    try:
        return read_json(directory / "sample_input.json")
    except FileNotFoundError as exc:
        raise HTTPException(404, "No sample is available; train and export this model first") from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(503, "Sample input is unavailable") from exc
