import React from "react";
import type { IndicatorOutputType } from "../lab/indicatorCatalog";
import type { IdeaIndicatorMatrix } from "../indicators/ideaIndicatorMatrix";

// Helper type for sparkline previews in Test Stand
type IndicatorPreviewSnapshot = {
  outputType: "numeric" | "score" | "regime" | "binary" | "custom";
  values: (number | null)[];
  last: number | null;
  min: number | null;
  max: number | null;
};

// Build a preview snapshot from an indicator series result
function makeIndicatorPreviewSnapshot(result: {
  outputType: IndicatorOutputType;
  values: (number | null)[];
}): IndicatorPreviewSnapshot {
  const numericValues = result.values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );

  const last = numericValues.length
    ? numericValues[numericValues.length - 1]
    : null;
  const min = numericValues.length ? Math.min(...numericValues) : null;
  const max = numericValues.length ? Math.max(...numericValues) : null;

  return {
    outputType: result.outputType,
    values: result.values,
    last,
    min,
    max,
  };
}

function renderTestStandSparkline(preview: IndicatorPreviewSnapshot) {
  // Style B: bigger & thicker for Test Stand
  const width = 420;
  const height = 120;
  const padding = 6;

  const rawValues = preview.values;
  const numericValues = rawValues
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => Number.isFinite(v));

  if (numericValues.length < 2) {
    return (
      <div className="text-[11px] text-slate-500">
        Not enough data to preview yet.
      </div>
    );
  }

  let min = preview.min ?? Math.min(...numericValues);
  let max = preview.max ?? Math.max(...numericValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const scaleX = (index: number, length: number) =>
    length <= 1
      ? padding + usableWidth / 2
      : padding + (index / (length - 1)) * usableWidth;

  const scaleY = (value: number) => {
    const t = (value - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, t));
    return padding + (1 - clamped) * usableHeight;
  };

  const valuesForPath = rawValues.map((v) =>
    v == null ? null : Number(v)
  );

  const buildLinePath = () => {
    let d = "";
    for (let i = 0; i < valuesForPath.length; i++) {
      const v = valuesForPath[i];
      if (v == null || !Number.isFinite(v)) continue;
      const x = scaleX(i, valuesForPath.length);
      const y = scaleY(v);
      d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
    return d || "M 0 0";
  };

  const outputType = preview.outputType;

  // Regime: color-coded bands (quiet/normal/expanding/crisis)
  if (outputType === "regime") {
    const regimeColors: Record<number, string> = {
      0: "#38bdf8", // quiet
      1: "#22c55e", // normal
      2: "#eab308", // expanding
      3: "#f97316", // crisis / strong move
    };

    const segmentWidth =
      usableWidth / Math.max(1, valuesForPath.length);

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#020617"
          rx={6}
        />
        {valuesForPath.map((v, i) => {
          if (v == null || !Number.isFinite(v)) return null;
          const code = Math.round(v);
          const color = regimeColors[code] ?? "#64748b";
          const x = padding + i * segmentWidth;
          return (
            <rect
              key={i}
              x={x}
              y={padding}
              width={segmentWidth + 0.6}
              height={usableHeight}
              fill={color}
              opacity={0.75}
            />
          );
        })}
        <rect
          x={padding}
          y={padding}
          width={usableWidth}
          height={usableHeight}
          fill="none"
          stroke="#0f172a"
          strokeWidth={1}
          rx={4}
        />
      </svg>
    );
  }

  // Binary: thicker line + dots
  if (outputType === "binary") {
    const path = buildLinePath();

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#020617"
          rx={6}
        />
        <path
          d={path}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
        />
        {valuesForPath.map((v, i) => {
          if (v == null || !Number.isFinite(v)) return null;
          const x = scaleX(i, valuesForPath.length);
          const y = scaleY(v);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.7}
              fill="#e5e7eb"
              stroke="#0f172a"
              strokeWidth={0.9}
            />
          );
        })}
        <rect
          x={padding}
          y={padding}
          width={usableWidth}
          height={usableHeight}
          fill="none"
          stroke="#0f172a"
          strokeWidth={1}
          rx={4}
        />
      </svg>
    );
  }

  // Score: thick line + mid band
  if (outputType === "score") {
    const path = buildLinePath();

    const midValue = (min + max) / 2;
    const midY = scaleY(midValue);
    const bandHeight = usableHeight * 0.18;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#020617"
          rx={6}
        />
        <rect
          x={padding}
          width={usableWidth}
          y={midY - bandHeight / 2}
          height={bandHeight}
          fill="#22c55e"
          opacity={0.14}
        />
        <line
          x1={padding}
          x2={padding + usableWidth}
          y1={midY}
          y2={midY}
          stroke="#22c55e"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
        <path
          d={path}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
        />
        <rect
          x={padding}
          y={padding}
          width={usableWidth}
          height={usableHeight}
          fill="none"
          stroke="#0f172a"
          strokeWidth={1}
          rx={4}
        />
      </svg>
    );
  }

  // Default numeric/custom: thick blue line
  const path = buildLinePath();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#020617"
        rx={6}
      />
      <path
        d={path}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2}
      />
      <rect
        x={padding}
        y={padding}
        width={usableWidth}
        height={usableHeight}
        fill="none"
        stroke="#0f172a"
        strokeWidth={1}
        rx={4}
      />
    </svg>
  );
}

interface TestStandPanelProps {
  matrix: IdeaIndicatorMatrix | null;
}

const TestStandPanel: React.FC<TestStandPanelProps> = ({ matrix }) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Indicator previews
          </h2>
          <p className="text-sm text-slate-400">
            Quick glance at this idea&apos;s indicator stack played through the mock
            daily series.
          </p>
        </div>
        <div className="text-[11px] text-slate-500 text-right">
          Values computed from mock daily bars (symbol: MOCK, timeframe: 1D).
        </div>
      </div>

      <div className="mt-3">
        {!matrix ? (
          <div className="text-[11px] text-slate-500">
            Click &quot;Run Test&quot; to compute this idea&apos;s indicator stack on the mock price
            series.
          </div>
        ) : matrix.rows.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            This idea has no indicators attached yet. Add indicators in the Strategy Lab
            Indicator Builder.
          </div>
        ) : (
          <div className="space-y-3">
            {matrix.rows.map((row) => {
              const { instance, definition, result } = row;
              const def = definition;
              const preview = makeIndicatorPreviewSnapshot({
                outputType: result.outputType,
                values: result.values,
              });

              return (
                <div
                  key={row.index}
                  className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                >
                  {/* Header: name + stats */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
                        <span>{def?.name ?? instance.id}</span>
                        {def?.outputType && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-700 text-slate-300 uppercase tracking-wide">
                            {def.outputType}
                          </span>
                        )}
                        {!instance.enabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            disabled
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {def?.category ?? "Uncategorized"}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 text-right">
                      <div>
                        Last:{" "}
                        {preview.last != null
                          ? preview.last.toFixed(3)
                          : "—"}
                      </div>
                      <div>
                        Min:{" "}
                        {preview.min != null
                          ? preview.min.toFixed(3)
                          : "—"}{" "}
                        · Max:{" "}
                        {preview.max != null
                          ? preview.max.toFixed(3)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Full-width sparkline */}
                  <div className="mt-1">
                    {renderTestStandSparkline(preview)}
                  </div>

                  {/* Optional description below chart */}
                  {def && (def.summary || def.description) && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      {def.summary ?? def.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestStandPanel;