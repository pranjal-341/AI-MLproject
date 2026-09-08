import hashlib
import json
import joblib
import pandas as pd
from fastapi.testclient import TestClient
from sklearn.linear_model import LinearRegression
from backend.app.main import app
from backend.app.core import config


def setup_export(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path / "models")
    dataset = tmp_path / "data/raw/MdrDB_Full_Scraped.csv"
    dataset.parent.mkdir(parents=True)
    dataset.write_text("a,DDG.EXP\n1,3\n2,5\n", encoding="utf-8")
    directory = config.MODELS_DIR / "linear_regression/model_A"
    directory.mkdir(parents=True)
    (directory / "features.json").write_text('["a"]')
    estimator = LinearRegression().fit(pd.DataFrame({"a": [0., 1., 2.]}), [1., 3., 5.])
    joblib.dump(estimator, directory / "model.joblib")
    (directory / "metrics.json").write_text('{"R2": 0.8, "RMSE": NaN, "invalid": true}')
    (directory / "metadata.json").write_text(json.dumps({"dataset_sha256": hashlib.sha256(dataset.read_bytes()).hexdigest(), "test_split_sha256": "split-one", "training_profile": "test"}))
    return directory, dataset


def test_dashboard_refresh_and_stale_prediction(tmp_path, monkeypatch, authenticated_user):
    directory, dataset = setup_export(tmp_path, monkeypatch)
    client = TestClient(app)
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    snapshot = response.json()
    assert snapshot["dataset"]["rows"] == 2
    assert snapshot["summary"] == {"ready_models": 1, "tiers": 1, "descriptors": 1}
    model = snapshot["models"][0]
    assert model["metrics"] == {"R2": .8}
    assert model["dataset_matches"] is True
    request = {"algorithm": "linear_regression", "features": {"a": 3}, "model_version": model["version"]}
    assert client.post("/api/predict", json=request).status_code == 200
    replacement = LinearRegression().fit(pd.DataFrame({"a": [0., 1., 2.]}), [2., 4., 6.])
    joblib.dump(replacement, directory / "model.joblib")
    assert client.post("/api/predict", json=request).status_code == 409
    dataset.write_text("a,DDG.EXP\n1,3\n2,5\n3,7\n")
    refreshed = client.get("/api/dashboard").json()
    assert refreshed["dataset"]["rows"] == 3
    assert refreshed["models"][0]["dataset_matches"] is False
    request["model_version"] = refreshed["models"][0]["version"]
    assert abs(client.post("/api/predict", json=request).json()["prediction"] - 8) < 1e-8


def test_invalid_models_cannot_be_selected(tmp_path, monkeypatch):
    directory, _ = setup_export(tmp_path, monkeypatch)
    client = TestClient(app)
    for bad in (LinearRegression(), b"corrupted"):
        if isinstance(bad, bytes):
            (directory / "model.joblib").write_bytes(bad)
        else:
            joblib.dump(bad, directory / "model.joblib")
        snapshot = client.get("/api/dashboard").json()
        assert snapshot["models"][0]["status"] == "invalid"
        assert snapshot["summary"]["ready_models"] == 0
    joblib.dump(LinearRegression().fit(pd.DataFrame({"wrong": [0., 1.]}), [0., 1.]), directory / "model.joblib")
    assert client.get("/api/dashboard").json()["models"][0]["status"] == "invalid"
