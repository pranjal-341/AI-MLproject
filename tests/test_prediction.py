import json
import joblib
import pandas as pd
import pytest
from sklearn.linear_model import LinearRegression
from fastapi.testclient import TestClient
from backend.app.core import config
from backend.app.main import app

def test_prediction_with_real_estimator(authenticated_user, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path)
    directory = tmp_path / "linear_regression" / "model_A"
    directory.mkdir(parents=True)
    model = LinearRegression().fit(pd.DataFrame({"a": [0., 1., 2.]}), [1., 3., 5.])
    joblib.dump(model, directory / "model.joblib")
    (directory / "features.json").write_text(json.dumps(["a"]))
    client = TestClient(app)
    response = client.post("/api/predict", json={"algorithm": "linear_regression", "features": {"a": 3}})
    assert response.status_code == 200
    assert response.json()["prediction"] == pytest.approx(7)
    assert client.post("/api/predict", json={"algorithm": "linear_regression", "features": {"wrong": 3}}).status_code == 422
    (directory / "model.joblib").write_bytes(b"invalid")
    assert client.post("/api/predict", json={"algorithm": "linear_regression", "features": {"a": 3}}).status_code == 503
