// frontend/src/components/datahub/PriceSparkline.tsx
import React from 'react';
import { PriceBarDTO } from './types';

interface PriceSparklineProps {
  bars: PriceBarDTO[];
}

const PriceSparkline: React.FC<PriceSparklineProps> = ({ bars }) => {
  if (!bars.length) {
    return <div className="text-[10px] text-slate-500">No data to preview.</div>;
  }

  const width = 220;
  const height = 60;
  const padding = 6;

  const closes = bars.map((b) => b.close);
  let min = Math.min(...closes);
  let max = Math.max(...closes);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const scaleX = (index: number, length: number) =>
    length <= 1 ? padding + usableWidth / 2 : padding + (index / (length - 1)) * usableWidth;

  const scaleY = (value: number) => {
    const t = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, t));
    return padding + (1 - clamped) * usableHeight;
  };

  let d = '';
  for (let i = 0; i < closes.length; i++) {
    const x = scaleX(i, closes.length);
    const y = scaleY(closes[i]);
    d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0} y={0} width={width} height={height} rx={6} fill="#020617" />
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth={1.6} />
      <rect
        x={padding}
        y={padding}
        width={usableWidth}
        height={usableHeight}
        fill="none"
        stroke="#0f172a"
        strokeWidth={0.9}
        rx={4}
      />
    </svg>
  );
};

export default PriceSparkline;
