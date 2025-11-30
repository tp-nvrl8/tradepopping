# backend/app/scripts/bootstrap_full_universe_bars.py

from __future__ import annotations

import asyncio
from datetime import date, timedelta
from typing import List, Optional

from app.datalake.bar_store import ingest_eodhd_window
from app.routes.datalake_eodhd import _select_universe_symbols


# -------------------------
# CONFIG: tweak as needed
# -------------------------

# How far back to go (change these for your real run)
START_DATE = date(2015, 1, 1)
END_DATE = date.today()

# Break history into windows so each EODHD call isn't insane.
# 365 = roughly yearly windows; you can use 180, 90, etc. if you want smaller chunks.
WINDOW_DAYS = 365

# Universe filters (mirrors EodhdIngestRequest / _select_universe_symbols)
MIN_MARKET_CAP: int = 50_000_000          # 50M default floor
MAX_MARKET_CAP: Optional[int] = None      # None = no upper cap

EXCHANGES: List[str] = ["NYSE", "NASDAQ"]
INCLUDE_ETFS: bool = False
ACTIVE_ONLY: bool = True

# Safety valve: hard ceiling on number of symbols
MAX_SYMBOLS: int = 500  # bump this carefully as you get comfy


def build_windows(start: date, end: date, window_days: int) -> List[tuple[date, date]]:
  """
  Split [start, end] into contiguous [win_start, win_end] windows.
  """
  windows: List[tuple[date, date]] = []
  cursor = start

  if start > end:
    return windows

  while cursor <= end:
    win_end = min(cursor + timedelta(days=window_days - 1), end)
    windows.append((cursor, win_end))
    cursor = win_end + timedelta(days=1)

  return windows


async def main() -> None:
  # 1) Pick symbols from existing FMP universe in DuckDB
  symbols = _select_universe_symbols(
    min_market_cap=MIN_MARKET_CAP,
    max_market_cap=MAX_MARKET_CAP,
    exchanges=EXCHANGES,
    include_etfs=INCLUDE_ETFS,
    active_only=ACTIVE_ONLY,
    max_symbols=MAX_SYMBOLS,
  )

  if not symbols:
    print(
      "[bootstrap_full_universe_bars] No symbols found in symbol_universe.\n"
      "  • Make sure you've run POST /api/datalake/fmp/universe/ingest\n"
      "  • And that your filters in this script (caps/exchanges/etc.) "
      "aren't too strict.",
      flush=True,
    )
    return

  print(
    f"[bootstrap_full_universe_bars] Selected {len(symbols)} symbols from universe "
    f"with min_cap={MIN_MARKET_CAP} max_cap={MAX_MARKET_CAP} "
    f"exchanges={EXCHANGES} include_etfs={INCLUDE_ETFS} active_only={ACTIVE_ONLY}",
    flush=True,
  )

  # 2) Build date windows
  windows = build_windows(START_DATE, END_DATE, WINDOW_DAYS)
  print(
    f"[bootstrap_full_universe_bars] Ingesting history from {START_DATE} → {END_DATE} "
    f"in {len(windows)} window(s) of ~{WINDOW_DAYS} days.",
    flush=True,
  )

  # 3) For each symbol and each window, call existing ingest_eodhd_window
  total_requests = 0
  total_failures = 0

  for idx, sym in enumerate(symbols, start=1):
    print(
      f"\n[bootstrap_full_universe_bars] === {idx}/{len(symbols)} {sym} ===",
      flush=True,
    )
    for (win_start, win_end) in windows:
      try:
        print(
          f"[bootstrap_full_universe_bars] Ingesting {sym} {win_start} → {win_end}",
          flush=True,
        )
        await ingest_eodhd_window(
          symbol=sym,
          start=win_start,
          end=win_end,
        )
        total_requests += 1
      except Exception as exc:
        total_failures += 1
        total_requests += 1
        print(
          f"[bootstrap_full_universe_bars] ERROR for {sym} "
          f"{win_start} → {win_end}: {exc}",
          flush=True,
        )

  print(
    f"\n[bootstrap_full_universe_bars] Done. Total ingest calls: {total_requests}, "
    f"failures: {total_failures}",
    flush=True,
  )


if __name__ == "__main__":
  asyncio.run(main())