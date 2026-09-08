import joblib
import hashlib
from functools import lru_cache
from sklearn.utils.validation import check_is_fitted
from ..core import config
from ..utils.helpers import read_json

class ModelUnavailable(Exception):
    pass

def model_directory(algorithm: str, variant: str):
    if algorithm not in config.ALGORITHMS or variant not in config.VARIANTS:
        raise ValueError("Unknown algorithm or model variant")
    return config.MODELS_DIR / algorithm / variant

def feature_names(directory):
    try:
        names = read_json(directory / "features.json")
        if not isinstance(names, list) or not names or not all(isinstance(n, str) and n for n in names) or len(set(names)) != len(names):
            raise ValueError("Invalid feature list")
        return names
    except (OSError, ValueError) as exc:
        raise ModelUnavailable("Upload features.json as a nonempty ordered list of unique feature names") from exc

def model_version(algorithm, variant):
    directory = model_directory(algorithm, variant)
    signatures = []
    for name in ("model.joblib", "features.json", "metadata.json", "metrics.json"):
        path = directory / name
        stat = path.stat() if path.is_file() else None
        signatures.append((name, stat.st_mtime_ns, stat.st_size) if stat else (name, None))
    return hashlib.sha256(repr((str(directory), signatures)).encode()).hexdigest()[:20]


def load_model(algorithm, variant):
    directory = model_directory(algorithm, variant)
    return _load_model(str(directory), model_version(algorithm, variant))


@lru_cache(maxsize=12)
def _load_model(path, version):
    from pathlib import Path
    directory = Path(path)
    names = feature_names(directory)
    artifact = directory / "model.joblib"
    if not artifact.is_file() or artifact.stat().st_size == 0:
        raise ModelUnavailable("Trained model.joblib has not been uploaded")
    try:
        model = joblib.load(artifact)
        if not callable(getattr(model, "predict", None)):
            raise ValueError("Missing predict method")
        check_is_fitted(getattr(model, "model", model))
        expected = getattr(model, "raw_features", getattr(model, "feature_names_in_", None))
        if expected is not None and list(expected) != names:
            raise ValueError("Feature order does not match artifact")
        if expected is None and getattr(model, "n_features_in_", len(names)) != len(names):
            raise ValueError("Feature count does not match artifact")
    except Exception as exc:
        raise ModelUnavailable("Model could not be loaded; check artifact and training dependency versions") from exc
    return model, names

def list_models():
    entries = []
    for algorithm in config.ALGORITHMS:
        for variant in config.VARIANTS:
            directory = model_directory(algorithm, variant)
            artifact = directory / "model.joblib"
            names, status = [], "missing"
            try:
                names = feature_names(directory)
                if artifact.is_file() and artifact.stat().st_size > 0:
                    load_model(algorithm, variant)
                    status = "uploaded"
            except ModelUnavailable:
                status = "invalid" if artifact.is_file() and artifact.stat().st_size else "missing"
            entries.append(dict(algorithm=algorithm, variant=variant, status=status, features=names))
    return entries
