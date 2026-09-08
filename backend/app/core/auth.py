"""Validate bearer tokens with the configured Supabase Auth project."""
from typing import Annotated
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from . import config

bearer = HTTPBearer(auto_error=False)

async def require_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Sign in to access predictions", headers={"WWW-Authenticate": "Bearer"})
    if not config.SUPABASE_URL.startswith("https://") or not config.SUPABASE_API_KEY:
        raise HTTPException(503, "Authentication is not configured")
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.get(
                config.SUPABASE_URL + "/auth/v1/user",
                headers={"apikey": config.SUPABASE_API_KEY, "Authorization": "Bearer " + credentials.credentials},
            )
        if response.status_code in (401, 403):
            raise HTTPException(401, "Session expired or invalid; sign in again", headers={"WWW-Authenticate": "Bearer"})
        if response.status_code != 200:
            raise HTTPException(503, "Authentication service unavailable")
        user = response.json()
        if not user.get("id") or user.get("is_anonymous") or user.get("role") != "authenticated":
            raise HTTPException(401, "A registered account is required", headers={"WWW-Authenticate": "Bearer"})
        return user
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc
