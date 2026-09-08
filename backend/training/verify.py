"""Verify exported real-model samples through the API with mocked user validation."""
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
import httpx
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core import config
from backend.training.export import write_json


def main():
    root = Path(__file__).resolve().parents[2]
    client = TestClient(app)
    tracks = {"linear_regression": "LR", "decision_tree": "DT", "random_forest": "RF"}
    checked = []
    for algorithm, track in tracks.items():
        for letter in "ABC":
            directory = root / "models" / algorithm / ("model_" + letter)
            request = json.loads((directory / "sample_input.json").read_text())
            assert client.post("/api/predict", json=request).status_code == 401
            assert client.get(f"/api/models/{algorithm}/model_{letter}/sample").status_code == 401
            upstream = AsyncMock()
            upstream.get.return_value = httpx.Response(200, json={"id": "verification-user", "role": "authenticated", "is_anonymous": False})
            context = AsyncMock()
            context.__aenter__.return_value = upstream
            with patch("backend.app.core.auth.httpx.AsyncClient", return_value=context):
                headers = {"Authorization": "Bearer verification-token"}
                sample = client.get(f"/api/models/{algorithm}/model_{letter}/sample", headers=headers)
                assert sample.status_code == 200, sample.text
                response = client.post("/api/predict", json=sample.json(), headers=headers)
                assert response.status_code == 200, response.text
                assert upstream.get.await_count == 2
            expected = float(pd.read_csv(root / "results/predictions" / f"{track}_Model_{letter}_predictions.csv", nrows=1).Predicted.iloc[0])
            actual = response.json()["prediction"]
            np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-8)
            checked.append({"algorithm": algorithm, "variant": "model_" + letter, "prediction_parity": True})
    write_json(root / "results/final/api_verification.json", {"anonymous_requests_rejected": True, "auth_validation": "mocked Supabase authenticated user; real model artifacts and predictions", "models": checked})
    print(f"Verified {len(checked)} trained model predictions and protected samples through the API.")


if __name__ == "__main__": main()
