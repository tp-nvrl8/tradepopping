from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.datahub.fmp_client import FmpSymbolDTO, fetch_fmp_symbol_universe
from app.auth import get_current_user

router = APIRouter(
    tags=["datahub:fmp"],
)


class FmpSymbolOut(BaseModel):
    symbol: str
    name: str
    exchange: str
    asset_type: str
    is_active: bool
    market_cap: Optional[float]


@router.get(
    "/datahub/fmp/symbols",
    response_model=List[FmpSymbolOut],
)
async def get_fmp_symbols(
    limit: int = Query(500, ge=1, le=5000, description="Max symbols to return"),
    current_user: dict = Depends(get_current_user),
):
    try:
        symbols = await fetch_fmp_symbol_universe(limit=limit)
        return [FmpSymbolOut(**symbol) for symbol in symbols]
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:  # pragma: no cover - defensive catch
        raise HTTPException(status_code=500, detail=f"Unexpected error fetching FMP symbols: {e}")
