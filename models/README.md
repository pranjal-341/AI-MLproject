# Serving artifact registry

Each algorithm contains `model_A/`, `model_B/`, and `model_C/` slots. A complete export contains:

| File | Purpose |
| --- | --- |
| `model.joblib` | Trusted fitted estimator with preprocessing |
| `features.json` | Ordered raw input schema |
| `metadata.json` | Training profile, dataset/split hashes and preprocessing provenance |
| `metrics.json` | Measured evaluation scores used by the dashboard |
| `sample_input.json` | Exported input example |

LR/DT/RF artifacts are available; XGBoost slots are pending. Joblib files use Git LFS. Keep the entire export consistent and retain the Python class path used in serialization. Use [export.py](../backend/training/export.py) and `python -m backend.training.verify` to validate inference parity. Never load untrusted joblib files.
