from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core import config

client = TestClient(app)

def test_health_and_missing_models(authenticated_user, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path)
    assert client.get("/api/health").json() == {"status": "ok"}
    entries = client.get("/api/models").json()["models"]
    assert len(entries) == 12
    assert all(row["status"] == "missing" for row in entries)
    assert len(client.get("/api/analytics").json()["models"]) == 12
    response = client.post("/api/predict", json={"algorithm": "linear_regression", "features": {"a": 1}})
    assert response.status_code == 503

def test_unknown_algorithm(authenticated_user):
    assert client.post("/api/predict", json={"algorithm": "../bad", "features": {"a": 1}}).status_code == 422
