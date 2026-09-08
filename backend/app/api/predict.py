import logging
from time import perf_counter
from fastapi import APIRouter, HTTPException, Depends
from ..schemas.prediction import PredictionRequest
from ..schemas.response import PredictionResponse
from ..services.model_loader import ModelUnavailable, model_version
from ..services.predictor import predict
from ..core.auth import require_user
router = APIRouter(dependencies=[Depends(require_user)])

@router.post("/predict", response_model=PredictionResponse)
def prediction(request: PredictionRequest):
    started = perf_counter()
    version = model_version(request.algorithm, request.variant)
    if request.model_version is not None and request.model_version != version:
        raise HTTPException(status_code=409, detail="Model changed. Refresh the catalog and select it again.")
    try:
        value = predict(request)
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logging.getLogger(__name__).exception("Prediction failed")
        raise HTTPException(status_code=500, detail="Prediction failed; check backend logs") from exc
    if model_version(request.algorithm, request.variant) != version:
        raise HTTPException(status_code=409, detail="Model changed during prediction. Refresh and retry.")
    return PredictionResponse(algorithm=request.algorithm, variant=request.variant, prediction=value,
                              model_version=version, elapsed_ms=round((perf_counter() - started) * 1000, 2))
