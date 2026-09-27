import { useState } from "react";
import { formatINR } from "../lib/format";

export type TrendPoint = {
  label: string; // e.g. "Apr 2026"
  money_in: number;
  money_out: number;
};

// A small, dependency-free line chart for the cash-flow trend.
//
// Follows the data-viz house rules: one shared axis for both series
// (never dual-axis), thin 2px lines with round caps, a legend for the
// two series (green/red on their own aren't enough - CVD separation
// for this pair sits in the "needs a second cue" band, so the legend
// + end-of-line labels + tooltip are load-bearing, not decorative),
// hairline gridlines, and a hover crosshair with an exact-value
// tooltip instead of a number crammed onto every point.
export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...data.flatMap((d) => [d.money_in, d.money_out]));
  const niceMax = niceCeiling(maxVal);

  const x = (i: number) => padding.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - (v / niceMax) * innerH;

  const linePath = (key: "money_in" | "money_out") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);

  function handleMove(evt: React.MouseEvent<SVGRectElement>) {
    const rect = evt.currentTarget.getBoundingClientRect();
    const relX = evt.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, relX / rect.width));
    const idx = Math.round(ratio * (data.length - 1));
    setHoverIdx(idx);
  }

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs">
        <LegendDot color="#0f9d58" label="Money in" />
        <LegendDot color="#d93025" label="Money out" />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Cash flow trend, last few months">
        {gridLines.map((v, i) => (
          <line key={i} x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
        ))}

        <path d={linePath("money_in")} fill="none" stroke="#0f9d58" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={linePath("money_out")} fill="none" stroke="#d93025" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.money_in)} r={4} fill="#0f9d58" stroke="#fff" strokeWidth={2} />
            <circle cx={x(i)} cy={y(d.money_out)} r={4} fill="#d93025" stroke="#fff" strokeWidth={2} />
          </g>
        ))}

        {/* endpoint labels - the story's headline points, not every point */}
        {data.length > 0 && (
          <>
            <text x={x(data.length - 1) + 6} y={y(data[data.length - 1].money_in)} fontSize={10} fill="#52514e" dominantBaseline="middle">
              {formatINR(data[data.length - 1].money_in)}
            </text>
            <text x={x(data.length - 1) + 6} y={y(data[data.length - 1].money_out)} fontSize={10} fill="#52514e" dominantBaseline="middle">
              {formatINR(data[data.length - 1].money_out)}
            </text>
          </>
        )}

        {data.map((d, i) => (
          <text key={i} x={x(i)} y={height - 8} fontSize={10} fill="#898781" textAnchor="middle">
            {d.label}
          </text>
        ))}

        {hoverIdx !== null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padding.top} y2={padding.top + innerH} stroke="#c3c2b7" strokeWidth={1} strokeDasharray="3 3" />
        )}

        <rect
          x={padding.left}
          y={padding.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>

      {hovered && (
        <div className="text-xs bg-gray-50 border border-line rounded-lg p-2 mt-1 inline-block">
          <p className="font-medium mb-1">{hovered.label}</p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#0f9d58" }} />
            Money in: {formatINR(hovered.money_in)}
          </p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#d93025" }} />
            Money out: {formatINR(hovered.money_out)}
          </p>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
