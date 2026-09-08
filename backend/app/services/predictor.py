import numpy as np
from .model_loader import load_model
from .preprocessing import prepare_features

def predict(request):
    model, names = load_model(request.algorithm, request.variant)
    frame = prepare_features(request.features, names)
    result = np.asarray(model.predict(frame), dtype=float)
    if result.size != 1 or not np.isfinite(result).all():
        raise RuntimeError("Model must return one finite regression prediction")
    return float(result.reshape(-1)[0])
