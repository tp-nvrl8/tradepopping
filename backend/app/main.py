from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel
import os
import secrets
from datetime import datetime, date
from typing import Optional, List

from .config import CONFIG
from .datahub.polygon_client import (
    fetch_polygon_daily_ohlcv,
    PriceBarDTO,
    PolygonClientError,  # currently not raised, but kept for future use
)

app = FastAPI(title="TradePopping Backend")

# bring in lab routes AFTER app is created
from .routes import lab  # noqa: E402

app.include_router(lab.router, prefix="/api/lab")

# --- Config from environment ---
ALLOWED_EMAIL = os.getenv("TP_ALLOWED_EMAIL")
ENTRY_CODE = os.getenv("TP_ENTRY_CODE")

# In-memory token store (simple for single-user lab)
ACTIVE_TOKENS: set[str] = set()


# --- Models ---


class LoginRequest(BaseModel):
    email: str
    code: str  # the "entry code" / password


class LoginResponse(BaseModel):
    token: str
    email: str


class UserSettings(BaseModel):
    theme: str = "dark"
    default_app: str = "lab"  # or "scanner", "dashboard", etc.
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
    state: str  # e.g. "idle", "running", "error"
    last_run: Optional[datetime] = None
    last_error: Optional[str] = None


class DataSourceTestRequest(BaseModel):
    source_id: str


class DataSourceTestResponse(BaseModel):
    id: str
    name: str
    status: str  # "ok" or "error"
    has_api_key: bool
    message: str


# In-memory settings store keyed by email
USER_SETTINGS_STORE: dict[str, UserSettings] = {}


# --- Basic routes ---


@app.get("/")
def root():
    return {"message": "TradePopping backend is alive"}


@app.get("/health")
def health():
    env = os.getenv("API_ENV", "unknown")
    return {
        "status": "ok",
        "service": "backend",
        "environment": env,
    }


@app.get("/api/health", include_in_schema=False)
def api_health():
    return health()


# --- Auth helpers ---


def get_current_user(request: Request):
    """
    Checks Authorization: Bearer <token> against our in-memory token set.
    Used as a dependency on protected endpoints.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ", 1)[1]
    if token not in ACTIVE_TOKENS:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # For now we only support a single user based on env config
    return {"email": ALLOWED_EMAIL}


def build_data_source_status() -> List[DataSourceStatus]:
    statuses: List[DataSourceStatus] = []

    for src in DATA_SOURCES:
        env_val = os.getenv(src["env_key"], "").strip()
        has_key = bool(env_val)

        statuses.append(
            DataSourceStatus(
                id=src["id"],
                name=src["name"],
                enabled=has_key,  # for now: enabled if key is present
                has_api_key=has_key,
                last_success=None,
                last_error=None,
            )
        )
    return statuses


def build_data_ingest_status() -> List[DataIngestStatus]:
    """
    For now, return stub ingest status for each data source.
    Later, this will read from a real ingest log / database.
    """
    statuses: List[DataIngestStatus] = []

    for src in DATA_SOURCES:
        statuses.append(
            DataIngestStatus(
                id=src["id"],
                state="idle",       # stub: nothing running yet
                last_run=None,      # stub: unknown
                last_error=None,    # stub: no error
            )
        )

    return statuses


# --- Auth endpoints ---


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """
    Single-user login:
    - email must match TP_ALLOWED_EMAIL (if set)
    - code must match TP_ENTRY_CODE (if set)
    Returns a random token to be used as Bearer token.
    """
    if ALLOWED_EMAIL and payload.email.lower() != ALLOWED_EMAIL.lower():
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if ENTRY_CODE and payload.code != ENTRY_CODE:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = secrets.token_urlsafe(32)
    ACTIVE_TOKENS.add(token)

    return LoginResponse(token=token, email=payload.email)


@app.post("/api/auth/logout")
def logout(request: Request):
    """
    Logs out the current token by removing it from ACTIVE_TOKENS.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"detail": "Already logged out"}

    token = auth_header.split(" ", 1)[1]
    ACTIVE_TOKENS.discard(token)
    return {"detail": "Logged out"}


@app.get("/api/config")
def get_config():
    """
    Public, non-sensitive config for the frontend.
    Safe to call without auth.
    """
    return CONFIG.public_dict()


# Example protected endpoint
@app.get("/api/secret")
def secret(current_user: dict = Depends(get_current_user)):
    """
    Example protected endpoint.
    Requires a valid Bearer token from /api/auth/login.
    """
    return {
        "message": "Top secret TradePopping lab data",
        "user": current_user,
    }


@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    """
    Return info about the currently authenticated user.
    Requires a valid Bearer token.
    """
    return {
        "email": current_user.get("email"),
        "auth_mode": "single-user",
        "environment": CONFIG.app_env,
        "version": CONFIG.app_version,
    }


@app.get("/api/user/settings", response_model=UserSettings)
def get_user_settings(current_user: dict = Depends(get_current_user)):
    """
    Return settings for the current user.
    If none stored yet, return defaults.
    """
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="User email not found")

    existing = USER_SETTINGS_STORE.get(email)
    if existing:
        return existing

    # If no settings yet, return default instance (not stored until updated)
    return UserSettings()


@app.put("/api/user/settings", response_model=UserSettings)
def update_user_settings(
    settings: UserSettings,
    current_user: dict = Depends(get_current_user),
):
    """
    Update settings for the current user.
    Stores them in an in-memory dict for now.
    """
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="User email not found")

    USER_SETTINGS_STORE[email] = settings
    return settings


# --- Data source status + testing ---


@app.get("/api/data/sources", response_model=List[DataSourceStatus])
def get_data_sources(current_user: dict = Depends(get_current_user)):
    """
    Return status for configured data sources (Polygon, FMP, Finnhub, Fintel).
    For now, this checks only whether an API key env var is set.
    """
    return build_data_source_status()


@app.get("/api/data/ingest/status", response_model=List[DataIngestStatus])
def get_data_ingest_status(current_user: dict = Depends(get_current_user)):
    """
    Return ingest status for each data source.
    Currently stubbed: all sources are 'idle' with no timestamps.
    """
    return build_data_ingest_status()


@app.post("/api/data/sources/test", response_model=DataSourceTestResponse)
def test_data_source(
    payload: DataSourceTestRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Simple test of a single data source.

    For now this only checks:
      - is the source known?
      - is an API key env var set?
    """
    # Find the source definition
    src = next((s for s in DATA_SOURCES if s["id"] == payload.source_id), None)
    if not src:
        raise HTTPException(status_code=404, detail=f"Unknown data source id: {payload.source_id}")

    env_val = os.getenv(src["env_key"], "").strip()
    has_key = bool(env_val)

    if not has_key:
        status = "error"
        message = f"No API key configured in env var {src['env_key']}."
    else:
        status = "ok"
        message = "API key is present. Connectivity test not yet implemented."

    return DataSourceTestResponse(
        id=src["id"],
        name=src["name"],
        status=status,
        has_api_key=has_key,
        message=message,
    )


# --- Polygon DataHub endpoint ---


@app.get("/api/datahub/polygon/daily-ohlcv")
async def api_polygon_daily_ohlcv(
    symbol: str,
    start: str,
    end: str,
    current_user: dict = Depends(get_current_user),
) -> List[PriceBarDTO]:
    """
    Fetch a window of daily OHLCV bars from Polygon and return them
    in a simple DTO shape for the Data Hub.

    `start` and `end` must be YYYY-MM-DD (inclusive).
    """

    # Parse the date strings
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD for start and end.",
        )

    try:
        bars = await fetch_polygon_daily_ohlcv(
            symbol=symbol,
            start=start_date,
            end=end_date,
        )
        # `bars` is already a list[PriceBarDTO] (TypedDicts)
        return bars
    except RuntimeError as exc:
        # Raised by polygon_client when API key missing or HTTP error
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        # Safety net so the frontend always gets a clear message
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while fetching data from Polygon.",
        ) from exc


# --- Data source registry ---


DATA_SOURCES = [
    {"id": "polygon", "name": "Polygon.io", "env_key": "POLYGON_API_KEY"},
    {"id": "fmp", "name": "Financial Modeling Prep", "env_key": "FMP_API_KEY"},
    {"id": "finnhub", "name": "Finnhub", "env_key": "FINNHUB_API_KEY"},
    {"id": "fintel", "name": "Fintel", "env_key": "FINTEL_API_KEY"},
]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("API_PORT", "8000")),
        reload=True,
    )