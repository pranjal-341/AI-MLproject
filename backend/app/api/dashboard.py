"""Public artifact metadata; measured inputs and predictions remain authenticated."""
import csv
import hashlib
import math
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from fastapi import APIRouter
from ..core import config
from ..services.model_loader import list_models, model_directory, model_version
from ..utils.helpers import read_json

router = APIRouter()


def object_file(path):
    try:
        value = read_json(path)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


@lru_cache(maxsize=2)
def dataset_summary(path, signature):
    with open(path, encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        columns = next(reader)
        rows = sum(1 for row in reader if row)
    with open(path, "rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
    return dict(status="available", rows=rows, columns=len(columns), sha256=digest)


@router.get("/dashboard")
def dashboard():
    path = config.PROJECT_ROOT / "data/raw/MdrDB_Full_Scraped.csv"
    try:
        stat = path.stat()
        dataset = dataset_summary(str(path), (stat.st_mtime_ns, stat.st_size))
    except (OSError, ValueError, StopIteration, csv.Error):
        dataset = dict(status="unavailable", rows=None, columns=None, sha256=None)
    entries = list_models()
    for entry in entries:
        directory = model_directory(entry["algorithm"], entry["variant"])
        metadata = object_file(directory / "metadata.json")
        entry["version"] = model_version(entry["algorithm"], entry["variant"])
        entry["metrics"] = {key: value for key, value in object_file(directory / "metrics.json").items()
                            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)}
        text_keys = ("target", "training_profile", "dataset_sha256", "test_split_sha256")
        number_keys = ("development_rows", "test_rows", "seed")
        entry["metadata"] = {key: metadata[key] for key in text_keys if isinstance(metadata.get(key), str)}
        entry["metadata"].update({key: metadata[key] for key in number_keys
                                  if isinstance(metadata.get(key), int) and not isinstance(metadata[key], bool) and metadata[key] >= 0})
        entry["dataset_matches"] = metadata.get("dataset_sha256") == dataset["sha256"] if metadata.get("dataset_sha256") and dataset["sha256"] else None
        entry["families"] = dict(Counter(name.split(".")[0] if not name.startswith("vina") else "VINA" for name in entry["features"]))
    ready = [entry for entry in entries if entry["status"] == "uploaded"]
    return dict(dataset={**dataset, "filename": path.name}, models=entries,
                summary=dict(ready_models=len(ready), tiers=len({e["variant"] for e in ready}),
                             descriptors=len({f for e in ready for f in e["features"]})),
                updated_at=datetime.now(timezone.utc).isoformat())
