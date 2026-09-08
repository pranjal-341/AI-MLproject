import math
import pandas as pd

def prepare_features(values, names):
    missing = sorted(set(names) - set(values))
    extra = sorted(set(values) - set(names))
    if missing or extra:
        raise ValueError(f"Feature mismatch: missing={missing}, extra={extra}")
    if not all(value is None or math.isfinite(float(value)) for value in values.values()):
        raise ValueError("Features must be finite numbers or null for missing measurements")
    if not any(value is not None for value in values.values()):
        raise ValueError("All descriptors are missing. Supply measured descriptors or resolve a protein, mutation and drug combination.")
    return pd.DataFrame([[float("nan") if values[name] is None else float(values[name]) for name in names]], columns=names)
