import os
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("SUPERBASE_URL", "")).rstrip("/")
SUPABASE_API_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPERBASE_SECRET_KEY", "")
MODELS_DIR = Path(os.getenv("MODELS_DIR", str(PROJECT_ROOT / "models"))).resolve()
CORS_ORIGINS = [s.strip() for s in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080").split(",") if s.strip()]
ALGORITHMS = ("linear_regression", "decision_tree", "random_forest", "xgboost")
VARIANTS = ("model_A", "model_B", "model_C")

# Ollama runs on the backend computer, not in the browser.
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
OLLAMA_TIMEOUT_SECONDS = 180
