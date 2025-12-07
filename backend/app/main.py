from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel
import os
import secrets
from datetime import datetime
from typing import Optional, List
from .config import CONFIG

app = FastAPI(title="TradePopping Backend")

# Register routers
from .routes import lab  # noqa: E402
from .routes import datahub_bars  # noqa: E402
from .routes import datalake_fmp
from .routes import datalake_bars
from .routes import datalake_eodhd  # noqa: E402
from app.routes import datalake_universe


from app.auth import get_current_user, ACTIVE_TOKENS

app.include_router(lab.router, prefix="/api/lab")
app.include_router(datahub_bars.router, prefix="/api")
app.include_router(datalake_fmp.router, prefix="/api")
app.include_router(datalake_bars.router, prefix="/api")
app.include_router(datalake_eodhd.router, prefix="/api")
app.include_router(datalake_universe.router, prefix="/api")

# --- AUTH CONFIG ---
ALLOWED_EMAIL = os.getenv("TP_ALLOWED_EMAIL")
ENTRY_CODE = os.getenv("TP_ENTRY_CODE")

print(
    f"[AUTH CONFIG] TP_ALLOWED_EMAIL={ALLOWED_EMAIL!r}, "
    f"TP_ENTRY_CODE set={bool(ENTRY_CODE)}",
    flush=True,
)

# --- MODELS ---
class LoginRequest(BaseModel):
    email: str
    code: str

class LoginResponse(BaseModel):
    token: str
    email: str

class UserSettings(BaseModel):
    theme: str = "dark"
    default_app: str = "lab"
    show_experimental_features: bool = False

class DataSourceStatus(BaseModel):
    id: str
    name: str
    enabled: bool
    has_api_key: bool
    last_success: Optional[datetime] = None
    last_error: Optional[str] = None

class DataIngestStatus(BaseModel):
    id: str
    state: str
    last_run: Optional[datetime] = None
    last_error: Optional[str] = None

class DataSourceTestRequest(BaseModel):
    source_id: str

class DataSourceTestResponse(BaseModel):
    id: str
    name: str
    status: str
    has_api_key: bool
    message: str

USER_SETTINGS_STORE: dict[str, UserSettings] = {}

# --- BASIC ROUTES ---
@app.get("/")
def root():
    return {"message": "TradePopping backend is alive"}

@app.get("/health")
def health():
    env = os.getenv("API_ENV", "unknown")
    return {"status": "ok", "environment": env}

@app.get("/api/health", include_in_schema=False)
def api_health():
    return health()
class AppConfig(BaseModel):
    environment: str
    version: str


@app.get("/api/config", response_model=AppConfig)
def get_config():
    """
    Simple config endpoint the frontend can call on boot.
    """
    return AppConfig(
        environment=CONFIG.app_env,
        version=CONFIG.app_version,
    )

DATA_SOURCES = [
    {"id": "polygon", "name": "Polygon.io", "env_key": "POLYGON_API_KEY"},
    {"id": "fmp", "name": "Financial Modeling Prep", "env_key": "FMP_API_KEY"},
    {"id": "finnhub", "name": "Finnhub", "env_key": "FINNHUB_API_KEY"},
    {"id": "fintel", "name": "Fintel", "env_key": "FINTEL_API_KEY"},
    {
        "id": "eodhd",
        "name": "EODHD (End-of-Day Historical Data)",
        "env_key": "EODHD_API_TOKEN",
    },
]

# --- DATA SOURCE HELPERS ---
def build_data_source_status() -> List[DataSourceStatus]:
    statuses = []
    for src in DATA_SOURCES:
        has_key = bool(os.getenv(src["env_key"], "").strip())
        statuses.append(
            DataSourceStatus(
                id=src["id"],
                name=src["name"],
                enabled=has_key,
                has_api_key=has_key,
            )
        )
    return statuses

def build_data_ingest_status() -> List[DataIngestStatus]:
    statuses = []
    for src in DATA_SOURCES:
        statuses.append(
            DataIngestStatus(id=src["id"], state="idle", last_run=None, last_error=None)
        )
    return statuses

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    if ALLOWED_EMAIL and payload.email.lower() != ALLOWED_EMAIL.lower():
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if ENTRY_CODE and payload.code != ENTRY_CODE:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = secrets.token_urlsafe(32)
    ACTIVE_TOKENS.add(token)
    return LoginResponse(token=token, email=payload.email)

@app.post("/api/auth/logout")
def logout(request: Request):
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return {"detail": "Already logged out"}
    token = auth.split(" ", 1)[1]
    ACTIVE_TOKENS.discard(token)
    return {"detail": "Logged out"}

@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return {
        "email": current_user["email"],
        "auth_mode": "single-user",
        "environment": CONFIG.app_env,
        "version": CONFIG.app_version,
    }

# --- USER SETTINGS ---
@app.get("/api/user/settings", response_model=UserSettings)
def get_user_settings(current_user: dict = Depends(get_current_user)):
    return USER_SETTINGS_STORE.get(current_user["email"], UserSettings())

@app.put("/api/user/settings", response_model=UserSettings)
def update_user_settings(settings: UserSettings, current_user: dict = Depends(get_current_user)):
    USER_SETTINGS_STORE[current_user["email"]] = settings
    return settings

# --- DATA SOURCE ROUTES ---
@app.get("/api/data/sources", response_model=List[DataSourceStatus])
def get_data_sources(current_user: dict = Depends(get_current_user)):
    return build_data_source_status()

@app.get("/api/data/ingest/status", response_model=List[DataIngestStatus])
def ingest_status(current_user: dict = Depends(get_current_user)):
    return build_data_ingest_status()

@app.post("/api/data/sources/test", response_model=DataSourceTestResponse)
def test_api_source(payload: DataSourceTestRequest, current_user: dict = Depends(get_current_user)):
    src = next((s for s in DATA_SOURCES if s["id"] == payload.source_id), None)
    if not src:
        raise HTTPException(status_code=404, detail="Unknown data source id")
    has_key = bool(os.getenv(src["env_key"], "").strip())
    if not has_key:
        return DataSourceTestResponse(
            id=src["id"],
            name=src["name"],
            status="error",
            has_api_key=False,
            message=f"No API key configured in {src['env_key']}",
        )
    return DataSourceTestResponse(
        id=src["id"],
        name=src["name"],
        status="ok",
        has_api_key=True,
        message="API key is present.",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("API_PORT", "8000")),
        reload=True,
    )