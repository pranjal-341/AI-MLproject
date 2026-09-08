from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import analytics, health, models, predict, auth, dashboard, biological
from .core.config import CORS_ORIGINS

app = FastAPI(title="OncoBind-ML API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization", "apikey", "x-client-info", "x-supabase-api-version"])
for route in (health.router, models.router, predict.router, analytics.router, dashboard.router, biological.router):
    app.include_router(route, prefix="/api")

app.include_router(auth.router)

@app.middleware("http")
async def protect_prediction_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(("/api/", "/auth/")):
        response.headers["Cache-Control"] = "no-store"
    return response
