import math
from fastapi import APIRouter
from ..core import config
from ..services.model_loader import model_directory
from ..utils.helpers import read_json
router = APIRouter()

@router.get("/analytics")
def analytics():
    entries = []
    for algorithm in config.ALGORITHMS:
        for variant in config.VARIANTS:
            path = model_directory(algorithm, variant) / "metrics.json"
            try:
                metrics = read_json(path)
                if not isinstance(metrics, dict):
                    raise ValueError("Expected an object")
                metrics = {key: value for key, value in metrics.items()
                           if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)}
                status = "available" if metrics else "missing"
            except FileNotFoundError:
                metrics, status = {}, "missing"
            except (OSError, ValueError):
                metrics, status = {}, "invalid"
            entries.append(dict(algorithm=algorithm, variant=variant, metrics=metrics, status=status))
    return {"models": entries}
