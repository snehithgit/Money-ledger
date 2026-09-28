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
//
// Rendered as a smooth ("wave") curve rather than straight segments -
// purely a line-interpolation choice (Catmull-Rom -> cubic Bezier), so
// none of the color/legend/label rules above change. Deliberately NOT
// area-filled: two overlapping translucent fills for money-in/money-out
// would obscure whichever series sits underneath, so the wave stays a
// stroke-only line and keeps its markers and tooltip as the precise
// read.
export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 88, bottom: 30, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...data.flatMap((d) => [d.money_in, d.money_out]));
  const niceMax = niceCeiling(maxVal);

  const x = (i: number) => padding.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - (v / niceMax) * innerH;

  const smoothPath = (key: "money_in" | "money_out") => {
    const pts = data.map((d, i) => ({ x: x(i), y: y(d[key]) }));
    return catmullRomToBezier(pts);
  };

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
      <div className="flex items-center gap-4 mb-3 text-xs">
        <LegendDot color="#15803D" label="Money in" />
        <LegendDot color="#C2413A" label="Money out" />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Cash flow trend, last few months">
        {gridLines.map((v, i) => (
          <line key={i} x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
        ))}

        <path d={smoothPath("money_in")} fill="none" stroke="#15803D" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={smoothPath("money_out")} fill="none" stroke="#C2413A" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.money_in)} r={4} fill="#15803D" stroke="#fff" strokeWidth={2} />
            <circle cx={x(i)} cy={y(d.money_out)} r={4} fill="#C2413A" stroke="#fff" strokeWidth={2} />
          </g>
        ))}

        {/* endpoint labels - the story's headline points, not every point */}
        {data.length > 0 && (
          <>
            <text x={x(data.length - 1) + 6} y={y(data[data.length - 1].money_in)} fontSize={10} fill="#6B7280" dominantBaseline="middle">
              {formatINR(data[data.length - 1].money_in)}
            </text>
            <text x={x(data.length - 1) + 6} y={y(data[data.length - 1].money_out)} fontSize={10} fill="#6B7280" dominantBaseline="middle">
              {formatINR(data[data.length - 1].money_out)}
            </text>
          </>
        )}

        {data.map((d, i) => (
          <text key={i} x={x(i)} y={height - 8} fontSize={10} fill="#6B7280" textAnchor="middle">
            {d.label}
          </text>
        ))}

        {hoverIdx !== null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padding.top} y2={padding.top + innerH} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3 3" />
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
        <div className="text-xs bg-gray-50 border border-line rounded-xl p-2.5 mt-2 inline-block">
          <p className="font-medium mb-1">{hovered.label}</p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#15803D" }} />
            Money in: {formatINR(hovered.money_in)}
          </p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#C2413A" }} />
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

// Catmull-Rom spline through the given points, converted to a cubic
// Bezier SVG path - gives a smooth "wave" without overshooting past the
// data the way a naive spline can. Falls back to a straight segment
// when there are fewer than 2 points.
function catmullRomToBezier(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
