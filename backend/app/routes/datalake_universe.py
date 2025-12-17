from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import duckdb
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import get_current_user

router = APIRouter(tags=["datalake-universe"])

TP_DUCKDB_PATH = os.getenv("TP_DUCKDB_PATH", "/data/tradepopping.duckdb")


def _conn():
    return duckdb.connect(TP_DUCKDB_PATH)


class SymbolRow(BaseModel):
    symbol: str
    name: Optional[str] = ""
    exchange: Optional[str] = ""
    market_cap: Optional[float] = None
    is_etf: Optional[bool] = None
    is_fund: Optional[bool] = None
    is_actively_trading: Optional[bool] = None


class UniverseBrowseResponse(BaseModel):
    total_count: int
    page: int
    page_size: int
    symbols: List[SymbolRow]


@router.get("/datalake/universe/browse", response_model=UniverseBrowseResponse)
async def browse_universe(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("symbol"),
    sort_dir: str = Query("asc"),
    q: Optional[str] = Query(None, description="Search symbol/name (ILIKE)"),
    user: Dict[str, Any] = Depends(get_current_user),
):
    allowed_sort = {"symbol", "market_cap", "exchange"}
    if sort_by not in allowed_sort:
        raise HTTPException(400, f"Invalid sort_by: {sort_by}")

    if sort_dir.lower() not in {"asc", "desc"}:
        raise HTTPException(400, "sort_dir must be 'asc' or 'desc'")

    offset = (page - 1) * page_size

    con = _conn()
    try:
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = 'symbol_universe';"
        ).fetchall()

        if not tables:
            return UniverseBrowseResponse(
                total_count=0,
                page=page,
                page_size=page_size,
                symbols=[],
            )

        where_sql = ""
        params: List[Any] = []

        if q and q.strip():
            qq = f"%{q.strip()}%"
            where_sql = "WHERE (symbol ILIKE ? OR name ILIKE ?)"
            params.extend([qq, qq])

        total_count = con.execute(
            f"SELECT COUNT(*) FROM symbol_universe {where_sql};",
            params,
        ).fetchone()[0]

        sql = f"""
            SELECT
                symbol,
                name,
                exchange,
                market_cap,
                is_etf,
                is_fund,
                is_actively_trading
            FROM symbol_universe
            {where_sql}
            ORDER BY {sort_by} {sort_dir.upper()}
            LIMIT ? OFFSET ?
        """
        rows = con.execute(sql, params + [page_size, offset]).fetchall()

        symbols = [
            SymbolRow(
                symbol=r[0],
                name=r[1],
                exchange=r[2],
                market_cap=float(r[3]) if r[3] is not None else None,
                is_etf=bool(r[4]) if r[4] is not None else None,
                is_fund=bool(r[5]) if r[5] is not None else None,
                is_actively_trading=bool(r[6]) if r[6] is not None else None,
            )
            for r in rows
        ]

        return UniverseBrowseResponse(
            total_count=int(total_count),
            page=page,
            page_size=page_size,
            symbols=symbols,
        )

    finally:
        con.close()