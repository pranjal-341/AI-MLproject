from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core import config
from backend.app.api import auth as gateway


@pytest.fixture
def upstream(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_API_KEY", "server-only-test-secret")
    client = AsyncMock()
    client.request.return_value = httpx.Response(200, json={"user": {"id": "user-id"}, "access_token": "user-token", "refresh_token": "refresh"})
    context = AsyncMock()
    context.__aenter__.return_value = client
    monkeypatch.setattr(gateway.httpx, "AsyncClient", lambda **kwargs: context)
    return client


def test_password_login_uses_server_key(upstream):
    response = TestClient(app).post("/auth/v1/token?grant_type=password", json={"email": "test@example.invalid", "password": "test-password"}, headers={"apikey": "browser-placeholder"})
    assert response.status_code == 200
    call = upstream.request.call_args
    assert call.args == ("POST", "https://test.supabase.co/auth/v1/token")
    assert call.kwargs["headers"]["apikey"] == "server-only-test-secret"
    assert "Authorization" not in call.kwargs["headers"]
    assert "server-only-test-secret" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_signup_does_not_forward_admin_fields(upstream):
    response = TestClient(app).post("/auth/v1/signup?redirect_to=http://localhost:3000/auth", json={"email": "test@example.invalid", "password": "test-password", "role": "service_role", "email_confirm": True})
    assert response.status_code == 200
    assert upstream.request.call_args.kwargs["json"] == {"email": "test@example.invalid", "password": "test-password"}


def test_refresh_and_error_passthrough(upstream):
    upstream.request.return_value = httpx.Response(400, json={"error_code": "refresh_token_not_found", "msg": "Invalid refresh token"})
    response = TestClient(app).post("/auth/v1/token?grant_type=refresh_token", json={"refresh_token": "bad"})
    assert response.status_code == 400
    assert response.json()["error_code"] == "refresh_token_not_found"


def test_gateway_has_no_admin_or_arbitrary_proxy():
    client = TestClient(app)
    assert client.post("/auth/v1/admin/users", json={}).status_code == 404
    assert client.post("/auth/v1/token?grant_type=client_credentials", json={}).status_code == 422
    assert client.post("/auth/v1/signup?redirect_to=https://evil.example/", json={"email": "test@example.invalid", "password": "secret"}).status_code == 400
    assert client.get("/auth/v1/user").status_code == 401
    assert client.post("/auth/v1/logout").status_code == 401
    assert client.get("/api/models/linear_regression/model_A/sample").status_code == 401


def test_auth_preflight():
    response = TestClient(app).options("/auth/v1/token", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "apikey,x-client-info,x-supabase-api-version,authorization,content-type"})
    assert response.status_code == 200
