// src/indicators/mockPriceData.ts

import type { PriceBar } from './indicatorRuntime';

/**
 * Simple mock daily bars so the Indicator Builder can show previews
 * before we have real data wired in.
 *
 * You can replace this later with real OHLCV from the backend.
 */
export const MOCK_DAILY_BARS: PriceBar[] = (() => {
  const bars: PriceBar[] = [];
  const start = new Date('2024-01-02T00:00:00Z');
  let price = 50;

  for (let i = 0; i < 60; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    // small random walk
    const drift = (Math.random() - 0.5) * 2; // -1 to +1
    price = Math.max(5, price + drift);

    const high = price + Math.random() * 1.5;
    const low = price - Math.random() * 1.5;
    const close = price + (Math.random() - 0.5) * 0.8;
    const volume = 500_000 + Math.floor(Math.random() * 300_000);

    const shortVolume = volume * (0.3 + Math.random() * 0.3); // 30–60%
    const darkPoolVolume = volume * (0.1 + Math.random() * 0.2); // 10–30%

    bars.push({
      time: d.toISOString(),
      open: price,
      high,
      low,
      close,
      volume,
      shortVolume,
      darkPoolVolume,
    });
  }

  return bars;
})();
