import json
from pathlib import Path

def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)
