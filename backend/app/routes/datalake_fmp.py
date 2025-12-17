# backend/app/routes/datalake_fmp.py

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import duckdb
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user

router = APIRouter(tags=["datalake-fmp"])

TP_DUCKDB_PATH: str = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")
FMP_API_KEY: Optional[str] = os.getenv("FMP_API_KEY")


def _get_conn() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(TP_DUCKDB_PATH)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class FmpUniverseSummary(BaseModel):
    total_symbols: int
    exchanges: List[str]
    last_ingested_at: Optional[str]
    min_market_cap: Optional[float]
    max_market_cap: Optional[float]


class FmpUniverseIngestRequest(BaseModel):
    """
    IMPORTANT: This is a *symbol universe* ingest, not a strategy filter.

    We intentionally ingest/store a wide universe (NYSE/NASDAQ) and keep flags
    (is_etf, is_fund, is_actively_trading, market_cap) so later we can filter
    locally when ingesting bars or building scanners.

    NEW: We now expose these knobs explicitly (so it's not "out of sight"):
      - include_etfs -> if false, we send isEtf=false to FMP
      - include_funds -> if false, we send isFund=false to FMP
      - active_only -> if true, we send isActivelyTrading=true to FMP
      - include_all_share_classes -> sent to FMP as includeAllShareClasses "true"/"false"

    NOTE: FMP playground expects literal "true"/"false" for includeAllShareClasses,
    so we model it as a string.
    """
    min_market_cap: int = Field(0, ge=0)
    max_market_cap: Optional[int] = Field(None, ge=0)

    exchanges: List[str] = Field(default_factory=lambda: ["NYSE", "NASDAQ"])

    include_etfs: bool = False
    include_funds: bool = False
    active_only: bool = True

    # FMP expects "true"/"false" string
    include_all_share_classes: str = Field("false", pattern="^(true|false)$")

    max_symbols: int = Field(0, ge=0)  # 0 => backend chooses a safe large limit


class FmpUniverseIngestResponse(BaseModel):
    symbols_ingested: int
    symbols_updated: int
    symbols_skipped: int
    total_symbols_after: int
    started_at: str
    finished_at: str


# ---------------------------------------------------------------------------
# Summary endpoint (used by FmpUniverseSection)
# ---------------------------------------------------------------------------

@router.get("/datalake/fmp/universe/summary", response_model=FmpUniverseSummary)
async def get_fmp_universe_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    con = _get_conn()
    try:
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'symbol_universe';"
        ).fetchall()

        if not tables:
            return FmpUniverseSummary(
                total_symbols=0,
                exchanges=[],
                last_ingested_at=None,
                min_market_cap=None,
                max_market_cap=None,
            )

        total_symbols = con.execute("SELECT COUNT(*) FROM symbol_universe;").fetchone()[0]

        exchange_rows = con.execute(
            "SELECT DISTINCT exchange FROM symbol_universe ORDER BY exchange;"
        ).fetchall()
        exchanges = [r[0] for r in exchange_rows if r[0] is not None]

        min_cap = None
        max_cap = None
        try:
            min_cap, max_cap = con.execute(
                "SELECT MIN(market_cap), MAX(market_cap) FROM symbol_universe;"
            ).fetchone()
        except Exception:
            min_cap = None
            max_cap = None

        last_ingested_at: Optional[str] = None
        try:
            row = con.execute("SELECT MAX(updated_at) FROM symbol_universe;").fetchone()
            if row and row[0] is not None:
                last_ingested_at = str(row[0])
        except Exception:
            last_ingested_at = None

        return FmpUniverseSummary(
            total_symbols=int(total_symbols),
            exchanges=exchanges,
            last_ingested_at=last_ingested_at,
            min_market_cap=float(min_cap) if min_cap is not None else None,
            max_market_cap=float(max_cap) if max_cap is not None else None,
        )
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Schema + ingest
# ---------------------------------------------------------------------------

def _ensure_symbol_universe_schema(con: duckdb.DuckDBPyConnection) -> None:
    """
    Fresh DB safe schema. Since you will delete tradepopping.duckdb,
    we include updated_at so summary can show Last ingested at.
    """
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS symbol_universe (
            symbol TEXT PRIMARY KEY,
            name TEXT,
            exchange TEXT,
            sector TEXT,
            industry TEXT,
            market_cap DOUBLE,
            price DOUBLE,
            is_etf BOOLEAN,
            is_fund BOOLEAN,
            is_actively_trading BOOLEAN,
            updated_at TIMESTAMP
        );
        """
    )


def _fetch_from_fmp_for_exchange(
    exchange: str,
    limit: int,
    *,
    include_etfs: bool,
    include_funds: bool,
    active_only: bool,
    include_all_share_classes: str,
    min_market_cap: int,
    max_market_cap: Optional[int],
) -> List[Dict[str, Any]]:
    """
    Fetch symbol set for a single exchange, passing UI-visible toggles to FMP.

    IMPORTANT SEMANTICS (avoid accidental over-filtering):
      - If include_etfs is False -> send isEtf=false (exclude ETFs)
        If include_etfs is True  -> omit isEtf (do not constrain)
      - If include_funds is False -> send isFund=false (exclude funds)
        If include_funds is True  -> omit isFund (do not constrain)
      - If active_only is True -> send isActivelyTrading=true (active only)
        If active_only is False -> omit isActivelyTrading (do not constrain)

      - includeAllShareClasses is always sent as "true"/"false" string.
    """
    if not FMP_API_KEY:
        raise RuntimeError("FMP_API_KEY is not set. Configure it in the backend environment.")

    url = "https://financialmodelingprep.com/stable/company-screener"

    iasc = (include_all_share_classes or "false").strip().lower()
    if iasc not in {"true", "false"}:
        iasc = "false"

    params: Dict[str, Any] = {
        "apikey": FMP_API_KEY,
        "exchange": exchange,
        "country": "US",
        "includeAllShareClasses": iasc,
        "limit": int(limit),
    }

    # Only constrain if user wants to EXCLUDE a class
    if not include_etfs:
        params["isEtf"] = "false"
    if not include_funds:
        params["isFund"] = "false"
    if active_only:
        params["isActivelyTrading"] = "true"

    # Optional cap filters: send upstream if provided
    if min_market_cap and min_market_cap > 0:
        params["marketCapMoreThan"] = int(min_market_cap)
    if max_market_cap is not None:
        params["marketCapLowerThan"] = int(max_market_cap)

    resp = requests.get(url, params=params, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"FMP screener error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError(
            f"Unexpected FMP response format (expected list, got {type(data).__name__})"
        )
    return data


def _shape_row(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Convert FMP row -> our symbol_universe schema.

    NOTE: We do NOT filter out funds/ETFs here; we store them and mark flags.
    Filtering happens downstream (EODHD ingest, scanners, etc.).
    """
    symbol = row.get("symbol")
    if not symbol:
        return None

    name = row.get("companyName") or row.get("name")
    exchange = row.get("exchange")
    sector = row.get("sector")
    industry = row.get("industry")

    market_cap = row.get("marketCap")
    price = row.get("price")

    # Defensive flag extraction (FMP fields may vary)
    is_etf = bool(row.get("isEtf") or row.get("ETF", False))

    row_type = str(row.get("type") or "").lower().strip()
    is_fund = bool(
        row.get("isFund")
        or row.get("fund", False)
        or row_type in {
            "fund",
            "mutual fund",
            "open-end fund",
            "closed-end fund",
            "etf fund",
        }
    )

    is_active = bool(row.get("isActivelyTrading", True))

    market_cap_val = float(market_cap) if market_cap is not None else None
    price_val = float(price) if price is not None else None

    return {
        "symbol": str(symbol).upper(),
        "name": name,
        "exchange": exchange,
        "sector": sector,
        "industry": industry,
        "market_cap": market_cap_val,
        "price": price_val,
        "is_etf": bool(is_etf),
        "is_fund": bool(is_fund),
        "is_actively_trading": bool(is_active),
    }


def _upsert_symbol_universe(
    con: duckdb.DuckDBPyConnection,
    records: List[Dict[str, Any]],
) -> FmpUniverseIngestResponse:
    """
    Simple refresh strategy:
      - DELETE all rows
      - INSERT the new universe

    We stamp ALL inserted rows with the same updated_at = now_utc,
    so MAX(updated_at) becomes the ingest time.
    """
    started_at = datetime.utcnow()

    if not records:
        existing_total = con.execute("SELECT COUNT(*) FROM symbol_universe;").fetchone()[0]
        finished_at = datetime.utcnow()
        return FmpUniverseIngestResponse(
            symbols_ingested=0,
            symbols_updated=0,
            symbols_skipped=int(existing_total),
            total_symbols_after=int(existing_total),
            started_at=started_at.isoformat() + "Z",
            finished_at=finished_at.isoformat() + "Z",
        )

    con.execute("DELETE FROM symbol_universe;")

    now_utc = datetime.utcnow()

    insert_sql = """
        INSERT INTO symbol_universe
            (symbol, name, exchange, sector, industry,
             market_cap, price, is_etf, is_fund, is_actively_trading, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    for rec in records:
        con.execute(
            insert_sql,
            [
                rec["symbol"],
                rec.get("name"),
                rec.get("exchange"),
                rec.get("sector"),
                rec.get("industry"),
                rec.get("market_cap"),
                rec.get("price"),
                rec.get("is_etf"),
                rec.get("is_fund"),
                rec.get("is_actively_trading"),
                now_utc,
            ],
        )

    total_after = con.execute("SELECT COUNT(*) FROM symbol_universe;").fetchone()[0]
    finished_at = datetime.utcnow()

    return FmpUniverseIngestResponse(
        symbols_ingested=len(records),
        symbols_updated=0,
        symbols_skipped=0,
        total_symbols_after=int(total_after),
        started_at=started_at.isoformat() + "Z",
        finished_at=finished_at.isoformat() + "Z",
    )


@router.post("/datalake/fmp/universe/ingest", response_model=FmpUniverseIngestResponse)
async def ingest_fmp_universe(
    body: FmpUniverseIngestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Ingest symbol universe and store flags.

    We pass the UI-visible toggles through to FMP so you can see/confirm
    exactly what you are requesting (especially includeAllShareClasses).
    """
    if not FMP_API_KEY:
        raise HTTPException(status_code=500, detail="FMP_API_KEY is not configured on the backend.")

    try:
        limit = int(body.max_symbols) if body.max_symbols and body.max_symbols > 0 else 20000

        exchanges: List[str] = [ex.strip().upper() for ex in (body.exchanges or []) if ex.strip()]
        if not exchanges:
            exchanges = ["NYSE", "NASDAQ"]

        include_all_share_classes = (body.include_all_share_classes or "false").strip().lower()
        if include_all_share_classes not in {"true", "false"}:
            include_all_share_classes = "false"

        merged: Dict[str, Dict[str, Any]] = {}
        seen: Set[str] = set()

        for ex in exchanges:
            raw = _fetch_from_fmp_for_exchange(
                ex,
                limit=limit,
                include_etfs=body.include_etfs,
                include_funds=body.include_funds,
                active_only=body.active_only,
                include_all_share_classes=include_all_share_classes,
                min_market_cap=body.min_market_cap,
                max_market_cap=body.max_market_cap,
            )
            for row in raw:
                shaped = _shape_row(row)
                if not shaped:
                    continue
                sym = shaped["symbol"]
                if sym in seen:
                    continue
                seen.add(sym)
                merged[sym] = shaped

        records = list(merged.values())

        # Deterministic-ish order: exchange then symbol
        records.sort(key=lambda r: (str(r.get("exchange") or ""), r["symbol"]))

        con = _get_conn()
        try:
            _ensure_symbol_universe_schema(con)
            return _upsert_symbol_universe(con, records)
        finally:
            con.close()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"UNIVERSE_INGEST_ERROR: {type(exc).__name__}: {exc}",
        )