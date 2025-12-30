# backend/app/datahub/schemas.py

from datetime import datetime

from pydantic import BaseModel, Field


class PriceBar(BaseModel):
    """
    Normalized OHLCV bar for DataHub.

    This is deliberately similar to the frontend's PriceBar type so
    we can easily pipe backend data into the Lab/Test Stand.
    """

    time: datetime = Field(
        ...,
        description="Bar timestamp in UTC (usually session close).",
    )
    open: float
    high: float
    low: float
    close: float
    volume: int

    # Optional fields you might want later (kept commented for now):
    # vwap: float | None = None
    # trades: int | None = None
