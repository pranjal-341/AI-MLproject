"""Restricted Supabase Auth gateway; service credentials never reach the browser.

Only normal email signup, password sign-in, token refresh, user lookup, and
logout are exposed. There is intentionally no generic path or admin proxy.
"""
from typing import Annotated, Literal
from urllib.parse import urlsplit
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from ..core import config
from ..core.auth import require_user, bearer

router = APIRouter(prefix="/auth/v1", tags=["authentication"])


async def forward(method, path, *, payload=None, token=None, params=None):
    if not config.SUPABASE_URL.startswith("https://") or not config.SUPABASE_API_KEY:
        raise HTTPException(503, "Authentication is not configured")
    headers = {"apikey": config.SUPABASE_API_KEY, "X-Supabase-Api-Version": "2024-01-01"}
    if token: headers["Authorization"] = "Bearer " + token
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.request(method, config.SUPABASE_URL + "/auth/v1/" + path, headers=headers, json=payload, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc
    if response.status_code >= 500 or 300 <= response.status_code < 400:
        raise HTTPException(503, "Authentication service unavailable")
    # Never forward server headers or cookies; Supabase's browser SDK owns its session.
    return Response(content=response.content, status_code=response.status_code, media_type="application/json", headers={"Cache-Control": "no-store"})


async def body(request):
    raw = await request.body()
    if len(raw) > 16384: raise HTTPException(413, "Authentication request is too large")
    try: value = await request.json()
    except ValueError as exc: raise HTTPException(400, "Invalid JSON") from exc
    if not isinstance(value, dict): raise HTTPException(400, "Expected a JSON object")
    return value


def required(values, names):
    for name in names:
        if not isinstance(values.get(name), str) or not values[name] or len(values[name]) > 8192:
            raise HTTPException(400, f"A valid {name} is required")
    return {name: values[name] for name in names}


@router.post("/token")
async def token(request: Request, grant_type: Literal["password", "refresh_token"]):
    values = await body(request)
    payload = required(values, ["email", "password"] if grant_type == "password" else ["refresh_token"])
    if "gotrue_meta_security" in values: payload["gotrue_meta_security"] = values["gotrue_meta_security"]
    return await forward("POST", "token", payload=payload, params={"grant_type": grant_type})


@router.post("/signup")
async def signup(request: Request, redirect_to: str | None = None):
    values = await body(request)
    payload = required(values, ["email", "password"])
    if "gotrue_meta_security" in values: payload["gotrue_meta_security"] = values["gotrue_meta_security"]
    # Roles and arbitrary user/admin fields are not forwarded.
    params = {}
    if redirect_to:
        parsed = urlsplit(redirect_to)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in config.CORS_ORIGINS or parsed.username or parsed.password:
            raise HTTPException(400, "Unsupported confirmation redirect origin")
        params["redirect_to"] = redirect_to
    return await forward("POST", "signup", payload=payload, params=params)


@router.get("/user")
async def user(current_user: Annotated[dict, Depends(require_user)]):
    return current_user


@router.post("/logout")
async def logout(credentials=Depends(bearer), current_user=Depends(require_user), scope: Literal["global", "local", "others"] = "global"):
    return await forward("POST", "logout", token=credentials.credentials, params={"scope": scope})
