from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core import auth, config

payload = {"algorithm": "linear_regression", "features": {"a": 1}}


def test_prediction_rejects_missing_and_wrong_scheme():
    client = TestClient(app)
    for headers in ({}, {"Authorization": "Basic abc"}):
        response = client.post("/api/predict", json=payload, headers=headers)
        assert response.status_code == 401
        assert response.headers["Cache-Control"] == "no-store"
        assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("upstream_status,user,status", [(401, {}, 401), (403, {}, 401), (500, {}, 503), (200, {"id": "anon", "role": "authenticated", "is_anonymous": True}, 401), (200, {"id": "user", "role": "service_role"}, 401), (200, {"id": "user", "role": "authenticated", "is_anonymous": False}, 503)])
def test_tokens_are_checked_with_supabase(monkeypatch, tmp_path, upstream_status, user, status):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_API_KEY", "public-test-key")
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path)
    upstream = AsyncMock()
    upstream.get.return_value = httpx.Response(upstream_status, json=user)
    context = AsyncMock()
    context.__aenter__.return_value = upstream
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: context)
    response = TestClient(app).post("/api/predict", json=payload, headers={"Authorization": "Bearer signed-user-token"})
    assert response.status_code == status
    upstream.get.assert_awaited_once_with("https://test.supabase.co/auth/v1/user", headers={"apikey": "public-test-key", "Authorization": "Bearer signed-user-token"})
    if upstream_status == 200 and user.get("id") == "user" and user.get("role") == "authenticated":
        assert "features.json" in response.json()["detail"]  # Auth passed; model absent.


def test_auth_network_failure_is_not_an_auth_bypass(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_API_KEY", "key")
    upstream = AsyncMock()
    upstream.get.side_effect = httpx.ConnectError("offline")
    context = AsyncMock()
    context.__aenter__.return_value = upstream
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: context)
    assert TestClient(app).post("/api/predict", json=payload, headers={"Authorization": "Bearer token"}).status_code == 503


def test_cors_accepts_authorization():
    response = TestClient(app).options("/api/predict", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
