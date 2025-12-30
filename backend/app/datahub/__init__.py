# backend/app/datahub/__init__.py

"""
DataHub package

This module owns connections to external market data providers
(Polygon, Finnhub, etc.) and normalizes them into internal shapes
used by the rest of the backend (and frontend).

Initial scope:
- Simple Polygon daily OHLCV fetch for a single symbol and date range.
- Returns normalized PriceBar objects.
"""

from .schemas import PriceBar  # re-export for convenience

__all__ = ["PriceBar"]
