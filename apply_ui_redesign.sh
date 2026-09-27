#!/usr/bin/env bash
set -e
# Run this from the repo root (the folder that contains 'frontend/' and 'backend/').

mkdir -p "frontend"
cat > frontend/tailwind.config.js <<'DASHEOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12161c",
        surface: "#ffffff",
        muted: "#6b7280",
        line: "#e5e7eb",
        income: "#0f9d58",
        expense: "#d93025",
        accent: "#5b3df6",
        accent2: "#8b5cf6",
      },
      boxShadow: {
        hero: "0 12px 30px -12px rgba(91, 61, 246, 0.45)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
DASHEOF

mkdir -p "frontend/src"
cat > frontend/src/index.css <<'DASHEOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
}

body {
  @apply bg-gray-50 text-ink antialiased;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.card {
  @apply bg-white border border-line rounded-xl p-4 shadow-sm;
}

.btn {
  @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors;
}
.btn-primary {
  @apply btn bg-ink text-white hover:bg-black;
}
.btn-secondary {
  @apply btn bg-gray-100 text-ink hover:bg-gray-200;
}
.btn-danger {
  @apply btn bg-red-50 text-red-700 hover:bg-red-100;
}

.input {
  @apply w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent;
}

.label {
  @apply block text-xs font-medium text-muted mb-1;
}

.table-wrap {
  @apply overflow-x-auto rounded-xl border border-line bg-white;
}

table.data {
  @apply w-full text-sm;
}
table.data th {
  @apply text-left text-xs font-semibold text-muted uppercase tracking-wide px-3 py-2 border-b border-line bg-gray-50;
}
table.data td {
  @apply px-3 py-2 border-b border-line align-top;
}
table.data tr:last-child td {
  @apply border-b-0;
}

.pill {
  @apply inline-block rounded-full px-2 py-0.5 text-xs font-medium;
}

/* --- Redesign primitives: gradient hero card, quick-action tiles, ---
   --- pill nav. Reuses the existing accent/income/expense tokens so ---
   --- these stay one system with the rest of the app, not a bolted- ---
   --- on second style. --- */

.hero-card {
  @apply relative overflow-hidden rounded-3xl p-5 text-white shadow-hero;
  background: linear-gradient(135deg, #5b3df6 0%, #8b5cf6 55%, #a78bfa 100%);
}

.hero-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 85% -10%, rgba(255, 255, 255, 0.25), transparent 55%);
  pointer-events: none;
}

.tile {
  @apply relative flex flex-col gap-3 rounded-2xl bg-white border border-line p-4 shadow-sm transition-transform active:scale-[0.98] hover:border-accent/40 hover:shadow-md;
}

.icon-chip {
  @apply inline-flex items-center justify-center rounded-xl w-9 h-9 shrink-0;
}

.nav-pill-bar {
  @apply flex items-stretch gap-1 rounded-2xl bg-white border border-line shadow-lg px-2 py-2;
}

.progress-track {
  @apply w-full h-2.5 bg-gray-100 rounded-full overflow-hidden;
}

.progress-fill-gradient {
  @apply h-full rounded-full;
  background: linear-gradient(90deg, #5b3df6, #8b5cf6);
}
DASHEOF

mkdir -p "frontend/src/components"
cat > frontend/src/components/Icon.tsx <<'DASHEOF'
// Small dependency-free icon set (inline SVG, stroke = currentColor) so the
// new nav/quick-action visual language needs no icon library - one more
// npm package is one more thing that can fail the Docker build on a fresh
// clone. Add a new `case` here whenever a new icon is needed; keep them
// simple line icons (24x24 viewBox, ~1.8 stroke) so they all read as one
// family at 18-24px.
export type IconName =
  | "home"
  | "list"
  | "flag"
  | "repeat"
  | "target"
  | "wallet"
  | "users"
  | "sliders"
  | "upload"
  | "tag"
  | "plus"
  | "grid"
  | "chart"
  | "bell"
  | "chevron-right"
  | "arrow-up-right"
  | "arrow-down-right";

export default function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "flag":
      return (
        <svg {...common}>
          <path d="M5 3v18" />
          <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...common}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.8" fill="currentColor" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 7.5Z" />
          <path d="M3 7.5v9A2.5 2.5 0 0 0 5.5 19h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5.5" />
          <circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 8.2a3 3 0 1 1 3.6 2.94" />
          <path d="M15 14.3a5.4 5.4 0 0 1 5.5 5.5" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1" />
          <circle cx="13" cy="6" r="2" />
          <circle cx="7" cy="12" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4M8 8l4-4 4 4" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M20 12.5 12.5 20a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1L11.5 4H19a1 1 0 0 1 1 1v7.5Z" />
          <circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      );
    case "arrow-up-right":
      return (
        <svg {...common}>
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      );
    case "arrow-down-right":
      return (
        <svg {...common}>
          <path d="M7 7l10 10M17 8v9H8" />
        </svg>
      );
    default:
      return null;
  }
}
DASHEOF

mkdir -p "frontend/src/components"
cat > frontend/src/components/Layout.tsx <<'DASHEOF'
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import QuickAddModal from "./QuickAddModal";
import Icon, { IconName } from "./Icon";

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "home", end: true },
  { to: "/transactions", label: "Transactions", icon: "list" },
  { to: "/review", label: "Review Inbox", icon: "flag" },
  { to: "/commitments", label: "Commitments", icon: "repeat" },
  { to: "/goals", label: "Goals", icon: "target" },
  { to: "/accounts", label: "Accounts", icon: "wallet" },
  { to: "/people", label: "People", icon: "users" },
  { to: "/rules", label: "Rules", icon: "sliders" },
  { to: "/imports", label: "Imports", icon: "upload" },
  { to: "/categories", label: "Categories", icon: "tag" },
];

const MOBILE_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/transactions", label: "Spend", icon: "list" },
  { to: "/commitments", label: "Commit", icon: "repeat" },
  { to: "/more", label: "More", icon: "grid" },
];

export default function Layout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-line bg-white transition-all ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-line">
          {!collapsed && (
            <span className="flex items-center gap-2 font-semibold text-sm">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white">
                <Icon name="wallet" size={15} />
              </span>
              Finance Tracker
            </span>
          )}
          <button className="text-muted hover:text-ink text-xs" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-ink text-white" : "text-ink/75 hover:bg-gray-100"
                }`
              }
              title={item.label}
            >
              <Icon name={item.icon} size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <button className="btn-primary w-full gap-2" onClick={() => setQuickAddOpen(true)}>
            <Icon name="plus" size={16} />
            {!collapsed && "Quick Add"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-line bg-white sticky top-0 z-10">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white">
              <Icon name="wallet" size={15} />
            </span>
            Finance Tracker
          </span>
          <button
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-ink/70"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Quick add transaction"
          >
            <Icon name="plus" size={18} />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav - floating pill bar with a raised gradient FAB,
            matching the app's new visual language while staying a plain
            4-item + center action layout (no new nav semantics). */}
        <nav className="md:hidden fixed bottom-3 inset-x-3 z-20">
          <div className="nav-pill-bar">
            {MOBILE_ITEMS.slice(0, 2).map((item) => (
              <MobileNavLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
            <button
              className="flex-1 flex flex-col items-center justify-center text-white bg-gradient-to-br from-accent to-accent2 rounded-xl mx-0.5 shadow-hero"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Quick add transaction"
            >
              <Icon name="plus" size={20} />
            </button>
            {MOBILE_ITEMS.slice(2).map((item) => (
              <MobileNavLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
          </div>
        </nav>
      </div>

      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onCreated={(id) => {
            setQuickAddOpen(false);
            navigate(`/transactions?highlight=${id}`);
          }}
        />
      )}
    </div>
  );
}

function MobileNavLink({ to, label, icon }: { to: string; label: string; icon: IconName }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
          isActive ? "text-accent bg-accent/10" : "text-muted"
        }`
      }
    >
      <Icon name={icon} size={19} />
      {label}
    </NavLink>
  );
}
DASHEOF

mkdir -p "frontend/src/components"
cat > frontend/src/components/TrendChart.tsx <<'DASHEOF'
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
  const padding = { top: 16, right: 16, bottom: 28, left: 8 };
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
      <div className="flex items-center gap-4 mb-2 text-xs">
        <LegendDot color="#0f9d58" label="Money in" />
        <LegendDot color="#d93025" label="Money out" />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Cash flow trend, last few months">
        {gridLines.map((v, i) => (
          <line key={i} x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
        ))}

        <path d={smoothPath("money_in")} fill="none" stroke="#0f9d58" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={smoothPath("money_out")} fill="none" stroke="#d93025" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

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
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Dashboard.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Account, CommitmentStatus, ReviewInbox } from "../api/client";
import { formatINR, statusColor } from "../lib/format";
import TrendChart, { TrendPoint } from "../components/TrendChart";
import CategoryBarChart, { CategorySpendPoint } from "../components/CategoryBarChart";
import Icon, { IconName } from "../components/Icon";

type MonthSummary = {
  year: number;
  month: number;
  money_in: number;
  money_out: number;
  net: number;
  by_out_type: Record<string, number>;
  unclassified_count: number;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Dashboard() {
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [commitments, setCommitments] = useState<CommitmentStatus[]>([]);
  const [inbox, setInbox] = useState<ReviewInbox | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [categorySpend, setCategorySpend] = useState<CategorySpendPoint[] | null>(null);
  const now = new Date();

  useEffect(() => {
    api.get<MonthSummary>(`/reports/month-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then(setSummary);
    api.get<Account[]>("/accounts").then(setAccounts);
    api.get<CommitmentStatus[]>("/commitments").then(setCommitments);
    api.get<ReviewInbox>("/review/inbox").then(setInbox);
    api.get<MonthSummary[]>("/reports/trend?months=6").then((rows) =>
      setTrend(rows.map((r) => ({ label: `${MONTH_ABBR[r.month - 1]} ${r.year}`, money_in: r.money_in, money_out: r.money_out })))
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    api.get<CategorySpendPoint[]>(`/reports/category-spend?start=${monthStart}&end=${monthEnd}`).then(setCategorySpend);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const totalBalance = accounts ? accounts.filter((a) => !a.is_archived).reduce((sum, a) => sum + a.balance, 0) : null;

  const quickActions: { to: string; label: string; blurb: string; icon: IconName }[] = [
    {
      to: "/review",
      label: "Review Inbox",
      icon: "flag",
      blurb: inbox && inbox.total > 0 ? `${inbox.total} to review` : "All caught up",
    },
    { to: "/commitments", label: "Commitments", icon: "repeat", blurb: "This month's status" },
    { to: "/goals", label: "Goals", icon: "target", blurb: "Track your savings" },
    { to: "/accounts", label: "Accounts", icon: "wallet", blurb: "Balances & sources" },
  ];

  return (
    <div className="space-y-6">
      <div className="hero-card">
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wide mb-1">Total balance · {monthLabel}</p>
            <p className="text-3xl font-semibold">{totalBalance !== null ? formatINR(totalBalance) : "…"}</p>
          </div>
          <span className="icon-chip bg-white/20 text-white">
            <Icon name="wallet" size={18} />
          </span>
        </div>
        <div className="relative grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3">
            <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
              <Icon name="arrow-down-right" size={13} className="rotate-90" />
              Money in
            </div>
            <p className="font-semibold">{summary ? formatINR(summary.money_in) : "…"}</p>
          </div>
          <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3">
            <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
              <Icon name="arrow-up-right" size={13} />
              Money out
            </div>
            <p className="font-semibold">{summary ? formatINR(summary.money_out) : "…"}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((qa) => (
            <Link key={qa.to} to={qa.to} className="tile">
              <span className="icon-chip bg-accent/10 text-accent">
                <Icon name={qa.icon} size={18} />
              </span>
              <div>
                <p className="font-medium text-sm">{qa.label}</p>
                <p className="text-xs text-muted mt-0.5">{qa.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Cash flow, last 6 months</h2>
        <div className="card">{trend ? <TrendChart data={trend} /> : <p className="text-sm text-muted">Loading…</p>}</div>
      </div>

      {inbox && inbox.total > 0 && (
        <Link to="/review" className="card flex items-center justify-between hover:border-accent block">
          <div>
            <p className="font-medium">{inbox.total} transaction{inbox.total === 1 ? "" : "s"} need review</p>
            <p className="text-sm text-muted">Unknown counterparties, rule conflicts, or unclassified payments.</p>
          </div>
          <Icon name="chevron-right" size={18} className="text-accent" />
        </Link>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">This month's commitments</h2>
          <Link to="/commitments" className="text-sm text-accent flex items-center gap-0.5">
            View all <Icon name="chevron-right" size={14} />
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Commitment</th>
                <th>Expected</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {commitments.map((c) => (
                <tr key={c.commitment_id}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    {c.group_name && <div className="text-xs text-muted">{c.group_name}</div>}
                  </td>
                  <td>{formatINR(c.expected_amount)}</td>
                  <td>{formatINR(c.paid_amount)}</td>
                  <td>
                    <span className={`pill ${statusColor(c.status)}`}>{c.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
              {commitments.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-6">
                    No active commitments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-semibold mb-2">Top spending categories this month</h2>
          <div className="card">
            {categorySpend ? <CategoryBarChart data={categorySpend} /> : <p className="text-sm text-muted">Loading…</p>}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Spending by type this month</h2>
          <div className="card space-y-2">
            {summary && Object.keys(summary.by_out_type).length > 0 ? (
              Object.entries(summary.by_out_type).map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted">{type.replace("_", " ")}</span>
                  <span className="font-medium">{formatINR(amount)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Nothing recorded yet this month.</p>
            )}
            {summary && summary.unclassified_count > 0 && (
              <p className="text-xs text-amber-700 pt-2 border-t border-line">
                {summary.unclassified_count} transaction(s) this month are still unclassified and excluded from these totals.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/More.tsx <<'DASHEOF'
import { Link } from "react-router-dom";
import Icon, { IconName } from "../components/Icon";

const ITEMS: { to: string; label: string; blurb: string; icon: IconName }[] = [
  { to: "/review", label: "Review Inbox", blurb: "Clear flagged transactions", icon: "flag" },
  { to: "/goals", label: "Goals", blurb: "Track your savings targets", icon: "target" },
  { to: "/accounts", label: "Accounts", blurb: "Balances & sources", icon: "wallet" },
  { to: "/people", label: "People", blurb: "Counterparties & relationships", icon: "users" },
  { to: "/rules", label: "Rules", blurb: "Auto-categorization rules", icon: "sliders" },
  { to: "/imports", label: "Imports", blurb: "Upload PhonePe statements", icon: "upload" },
  { to: "/categories", label: "Categories", blurb: "Organize spending buckets", icon: "tag" },
];

export default function More() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">More</h1>
        <p className="text-sm text-muted">Everything else, in one place.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className="tile">
            <span className="icon-chip bg-accent/10 text-accent">
              <Icon name={item.icon} size={18} />
            </span>
            <div>
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-muted mt-0.5">{item.blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Goals.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, GoalProgress } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";

export default function Goals() {
  const [goals, setGoals] = useState<GoalProgress[]>([]);

  useEffect(() => {
    api.get<GoalProgress[]>("/goals").then(setGoals);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="icon-chip bg-accent/10 text-accent">
          <Icon name="target" size={18} />
        </span>
        <h1 className="text-xl font-semibold">Goals</h1>
      </div>

      {goals.map((g) => {
        const pct = g.target_amount ? Math.min(100, (g.total_contributed / g.target_amount) * 100) : null;
        return (
          <div key={g.goal_id} className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">{g.name}</p>
              <p className="text-sm text-muted">
                {formatINR(g.total_contributed)}
                {g.target_amount ? ` / ${formatINR(g.target_amount)}` : ""}
              </p>
            </div>
            {pct !== null && (
              <div className="progress-track mb-3">
                <div className="progress-fill-gradient" style={{ width: `${pct}%` }} />
              </div>
            )}
            <div className="text-xs text-muted space-y-1">
              {g.by_commitment.map((b) => (
                <div key={b.commitment_id} className="flex justify-between">
                  <span>{b.commitment_name}</span>
                  <span>{formatINR(b.total)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {goals.length === 0 && <div className="card text-center py-10 text-muted">No goals yet.</div>}
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Commitments.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, CommitmentStatus } from "../api/client";
import { formatINR, currentPeriod, statusColor } from "../lib/format";
import Icon from "../components/Icon";

export default function Commitments() {
  const [period, setPeriod] = useState(currentPeriod());
  const [commitments, setCommitments] = useState<CommitmentStatus[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setCommitments(await api.get<CommitmentStatus[]>(`/commitments?period=${period}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const groups = groupBy(commitments, (c) => c.group_name || "Other");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="repeat" size={18} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Commitments</h1>
            <p className="text-sm text-muted">Recurring obligations and contributions, one period at a time.</p>
          </div>
        </div>
        <input type="month" className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </div>

      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <h2 className="font-semibold text-sm text-muted uppercase tracking-wide mb-2">{group}</h2>
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.commitment_id} className="card">
                <div className="flex items-center justify-between flex-wrap gap-2 cursor-pointer" onClick={() => setExpanded(expanded === c.commitment_id ? null : c.commitment_id)}>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted">
                      {formatINR(c.paid_amount)} of {formatINR(c.expected_amount)}
                    </p>
                  </div>
                  <span className={`pill ${statusColor(c.status)}`}>{c.status.replace("_", " ")}</span>
                </div>

                {expanded === c.commitment_id && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <p className="text-xs font-semibold text-muted mb-1">Payments this period</p>
                    {c.payments.length === 0 && <p className="text-sm text-muted mb-2">No payments recorded yet.</p>}
                    <ul className="text-sm space-y-1 mb-3">
                      {c.payments.map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span>
                            {formatINR(p.allocated_amount)} · <span className="text-muted">{p.source_type}</span>
                            {p.is_manual && <span className="pill bg-gray-100 text-muted ml-1">manual</span>}
                          </span>
                          {p.manual_note && <span className="text-xs text-muted italic">{p.manual_note}</span>}
                        </li>
                      ))}
                    </ul>
                    <ManualContributionForm commitmentId={c.commitment_id} period={period} onAdded={load} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {commitments.length === 0 && <div className="card text-center py-10 text-muted">No active commitments.</div>}
    </div>
  );
}

function ManualContributionForm({ commitmentId, period, onAdded }: { commitmentId: number; period: string; onAdded: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!amount) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/commitments/${commitmentId}/payments`, {
        period,
        allocated_amount: parseFloat(amount),
        source_type: sourceType,
        manual_note: note || null,
      });
      setAmount("");
      setNote("");
      onAdded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="label">Amount</label>
        <input className="input w-28" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label">Source</label>
        <select className="input" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
          <option value="manual">Manual</option>
          <option value="rent">Rent</option>
          <option value="phonepe">PhonePe</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="flex-1 min-w-[140px]">
        <label className="label">Note</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Confirmed with wife…" />
      </div>
      <button className="btn-primary" onClick={add} disabled={saving}>
        Add
      </button>
      {error && <p className="text-xs text-expense w-full">{error}</p>}
    </div>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Transactions.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import TransactionEditModal from "../components/TransactionEditModal";
import Icon from "../components/Icon";

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (needsReviewOnly) params.set("needs_review", "true");
    try {
      const data = await api.get<Transaction[]>(`/transactions?${params.toString()}`);
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReviewOnly]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="list" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Transactions</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input max-w-xs"
          placeholder="Search narration or payee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button className="btn-secondary" onClick={load}>
          Search
        </button>
        <label className="flex items-center gap-2 text-sm text-muted ml-2">
          <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} />
          Needs review only
        </label>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Details</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={t.needs_review ? "bg-amber-50/50" : ""}>
                <td className="whitespace-nowrap text-muted">{t.date}</td>
                <td>
                  <div className="font-medium">{t.raw_counterparty || t.raw_narration}</div>
                  <div className="text-xs text-muted">{t.raw_narration}</div>
                  {t.labels.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {t.labels.map((l) => (
                        <span key={l} className="pill bg-gray-100 text-muted">
                          #{l}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span className="pill bg-gray-100 text-ink capitalize">{t.transaction_type.replace(/_/g, " ")}</span>
                  {t.needs_review && <span className="pill bg-amber-100 text-amber-800 ml-1">review</span>}
                </td>
                <td className={`text-right font-medium whitespace-nowrap ${t.direction === "credit" ? "text-income" : "text-ink"}`}>
                  {t.direction === "credit" ? "+" : "−"}
                  {formatINR(t.amount)}
                </td>
                <td className="text-right">
                  <button className="text-accent text-sm" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TransactionEditModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Review.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, ReviewInbox, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import TransactionEditModal from "../components/TransactionEditModal";
import Icon from "../components/Icon";

const REASON_LABELS: Record<string, string> = {
  no_rule_matched: "No rule matched",
  rule_conflict: "Rule conflict — multiple rules matched",
  rule_flagged: "Flagged by a rule for manual review",
  unclassified: "Unclassified",
};

export default function Review() {
  const [inbox, setInbox] = useState<ReviewInbox | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setInbox(await api.get<ReviewInbox>("/review/inbox"));
  }

  useEffect(() => {
    load();
  }, []);

  async function openEdit(id: number) {
    setEditing(await api.get<Transaction>(`/transactions/${id}`));
  }

  async function quickAction(id: number, patch: Record<string, unknown>) {
    setBusyId(id);
    try {
      await api.patch(`/transactions/${id}`, patch);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="flag" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Review Inbox</h1>
        </div>
        <p className="text-sm text-muted">
          {inbox ? `${inbox.total} transaction${inbox.total === 1 ? "" : "s"} need a decision.` : "Loading…"}
        </p>
      </div>

      {inbox?.groups.map((group) => (
        <div key={group.reason}>
          <h2 className="font-semibold mb-2 text-sm text-muted uppercase tracking-wide">
            {REASON_LABELS[group.reason] || group.reason} ({group.count})
          </h2>
          <div className="space-y-2">
            {group.transactions.map((t: any) => (
              <div key={t.id} className="card flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{t.raw_counterparty || t.raw_narration}</p>
                  <p className="text-xs text-muted">
                    {t.date} · {formatINR(t.amount)} · {t.direction}
                  </p>
                  {t.match_explanation && <p className="text-xs text-amber-700 mt-1">{t.match_explanation}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-secondary text-xs" disabled={busyId === t.id} onClick={() => quickAction(t.id, { transaction_type: "transfer", needs_review: false })}>
                    Mark transfer
                  </button>
                  <button className="btn-secondary text-xs" disabled={busyId === t.id} onClick={() => quickAction(t.id, { is_ignored: true, needs_review: false })}>
                    Ignore
                  </button>
                  <button className="btn-primary text-xs" onClick={() => openEdit(t.id)}>
                    Categorize
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {inbox && inbox.total === 0 && (
        <div className="card text-center py-10 text-muted">Nothing needs review right now. 🎉</div>
      )}

      {editing && (
        <TransactionEditModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Accounts.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, Account } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";

const ACCOUNT_TYPES = [
  "phonepe_wallet",
  "bank_savings",
  "bank_salary",
  "wife_account",
  "cash",
  "wallet",
  "credit_card",
  "rental",
  "loan",
  "other_bank",
];

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("other_bank");
  const [opening, setOpening] = useState("0");

  async function load() {
    setAccounts(await api.get<Account[]>("/accounts"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name) return;
    await api.post("/accounts", { name, account_type: type, opening_balance: parseFloat(opening) || 0 });
    setName("");
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="wallet" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Accounts</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          + Add account
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary Account" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Opening balance</label>
            <input className="input" type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={create}>
            Create
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {accounts.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted capitalize">{a.account_type.replace(/_/g, " ")}</p>
              </div>
              <p className="text-lg font-semibold">{formatINR(a.balance)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/People.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, Counterparty } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";

const RELATIONSHIPS = ["family", "personal_lending", "business", "bank_lender", "friend", "rental", "merchant", "other"];

export default function People() {
  const [people, setPeople] = useState<Counterparty[]>([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    setPeople(await api.get<Counterparty[]>("/counterparties"));
  }

  useEffect(() => {
    load();
  }, []);

  async function setRelationship(id: number, relationship: string) {
    await api.patch(`/counterparties/${id}`, { relationship });
    load();
  }

  async function doMerge() {
    if (selected.length !== 2) return;
    const [keep, merge] = selected;
    await api.post("/counterparties/merge", { keep_id: keep, merge_id: merge });
    setSelected([]);
    setMergeMode(false);
    load();
  }

  const filtered = people
    .filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()) || p.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.transaction_count - a.transaction_count);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="users" size={18} />
          </span>
          <h1 className="text-xl font-semibold">People</h1>
        </div>
        <div className="flex gap-2">
          {mergeMode && selected.length === 2 && (
            <button className="btn-primary" onClick={doMerge}>
              Merge selected
            </button>
          )}
          <button className="btn-secondary" onClick={() => { setMergeMode((m) => !m); setSelected([]); }}>
            {mergeMode ? "Cancel merge" : "Merge duplicates"}
          </button>
        </div>
      </div>

      <input className="input max-w-xs" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {mergeMode && <p className="text-xs text-muted">Select exactly two people who are actually the same person, then click Merge selected. The second person's aliases and transactions move onto the first.</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {mergeMode && <th></th>}
              <th>Name</th>
              <th>Aliases</th>
              <th>Relationship</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Received</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                {mergeMode && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      disabled={!selected.includes(p.id) && selected.length >= 2}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))}
                    />
                  </td>
                )}
                <td className="font-medium">{p.display_name}</td>
                <td className="text-xs text-muted">{p.aliases.filter((a) => a !== p.display_name).join(", ") || "—"}</td>
                <td>
                  <select className="input py-1" value={p.relationship} onChange={(e) => setRelationship(p.id, e.target.value)}>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-right">{formatINR(p.total_paid)}</td>
                <td className="text-right text-income">{formatINR(p.total_received)}</td>
                <td className={`text-right font-medium ${p.net_balance >= 0 ? "text-income" : "text-expense"}`}>{formatINR(p.net_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Rules.tsx <<'DASHEOF'
import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { api, Rule } from "../api/client";
import Icon from "../components/Icon";

const FIELDS = ["counterparty", "narration", "upi_id", "amount", "direction", "account", "day_of_month", "transaction_type", "bank", "reference"];
const OPERATORS = ["equals", "contains", "range", "greater_than", "less_than"];
const ACTION_TYPES = [
  "set_category",
  "set_subcategory",
  "set_person",
  "set_account",
  "set_transaction_type",
  "attach_commitment",
  "attach_goal",
  "mark_transfer",
  "mark_income",
  "mark_expense",
  "ignore",
  "needs_review",
];

type ConditionRow = { field: string; operator: string; value: string };
type ActionRow = { type: string; value: string };

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<ConditionRow[]>([{ field: "counterparty", operator: "contains", value: "" }]);
  const [actions, setActions] = useState<ActionRow[]>([{ type: "set_transaction_type", value: "expense" }]);
  const [testResult, setTestResult] = useState<{ matched_count: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRules(await api.get<Rule[]>("/rules"));
  }

  useEffect(() => {
    load();
  }, []);

  function parseValue(v: string): string | number | number[] {
    if (v.includes(",")) return v.split(",").map((x) => parseFloat(x.trim()));
    const asNum = Number(v);
    return v.trim() !== "" && !Number.isNaN(asNum) ? asNum : v;
  }

  async function testRule() {
    setTestResult(
      await api.post<{ matched_count: number }>("/rules/test", {
        conditions: conditions.map((c) => ({ ...c, value: parseValue(c.value) })),
        limit: 5,
      })
    );
  }

  async function createRule() {
    setError(null);
    try {
      await api.post("/rules", {
        name,
        conditions: conditions.map((c) => ({ ...c, value: parseValue(c.value) })),
        actions: actions.map((a) => ({ type: a.type, value: a.value ? parseValue(a.value) : null })),
      });
      setName("");
      setShowForm(false);
      setTestResult(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteRule(id: number) {
    await api.del(`/rules/${id}`);
    load();
  }

  async function applyAll() {
    setApplying(true);
    try {
      await api.post("/rules/apply-all");
      load();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="sliders" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Rules</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={applyAll} disabled={applying}>
            {applying ? "Applying…" : "Re-apply all rules"}
          </button>
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            + New rule
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div>
            <label className="label">Rule name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amazon purchases" />
          </div>

          <div>
            <p className="label">Conditions (all must match)</p>
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input" value={c.field} onChange={(e) => updateAt(setConditions, i, { field: e.target.value })}>
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select className="input" value={c.operator} onChange={(e) => updateAt(setConditions, i, { operator: e.target.value })}>
                  {OPERATORS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="value" value={c.value} onChange={(e) => updateAt(setConditions, i, { value: e.target.value })} />
                <button className="text-muted hover:text-expense" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="text-sm text-accent" onClick={() => setConditions([...conditions, { field: "counterparty", operator: "contains", value: "" }])}>
              + Add condition
            </button>
          </div>

          <div>
            <p className="label">Actions</p>
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input" value={a.type} onChange={(e) => updateAt(setActions, i, { type: e.target.value })}>
                  {ACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="value (id or text)" value={a.value} onChange={(e) => updateAt(setActions, i, { value: e.target.value })} />
                <button className="text-muted hover:text-expense" onClick={() => setActions(actions.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="text-sm text-accent" onClick={() => setActions([...actions, { type: "set_transaction_type", value: "" }])}>
              + Add action
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-secondary" onClick={testRule}>
              Test against existing transactions
            </button>
            {testResult && <span className="text-sm text-muted">{testResult.matched_count} transaction(s) would match</span>}
          </div>

          {error && <p className="text-sm text-expense">{error}</p>}
          <button className="btn-primary" onClick={createRule}>
            Save rule
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Name</th>
              <th>Matched</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.priority}</td>
                <td>
                  <div className="font-medium">{r.name}</div>
                  {r.description && <div className="text-xs text-muted">{r.description}</div>}
                </td>
                <td>{r.matched_count}</td>
                <td>{r.is_active ? "Yes" : "No"}</td>
                <td className="text-right">
                  <button className="text-expense text-sm" onClick={() => deleteRule(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function updateAt<T>(setter: Dispatch<SetStateAction<T[]>>, index: number, patch: Partial<T>) {
  setter((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Imports.tsx <<'DASHEOF'
import { useEffect, useRef, useState } from "react";
import { api, ImportBatch } from "../api/client";
import Icon from "../components/Icon";

export default function Imports() {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setImports(await api.get<ImportBatch[]>("/imports"));
  }

  useEffect(() => {
    load();
  }, []);

  async function upload() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.postForm("/imports/phonepe", form);
      if (fileInput.current) fileInput.current.value = "";
      load();
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="icon-chip bg-accent/10 text-accent">
          <Icon name="upload" size={18} />
        </span>
        <h1 className="text-xl font-semibold">Imports</h1>
      </div>

      <div className="card">
        <p className="label">Import a PhonePe statement (CSV)</p>
        <div className="flex gap-2 flex-wrap items-center">
          <input ref={fileInput} type="file" accept=".csv" className="text-sm" />
          <button className="btn-primary" onClick={upload} disabled={uploading}>
            {uploading ? "Importing…" : "Import"}
          </button>
        </div>
        {error && <p className="text-sm text-expense mt-2">{error}</p>}
        <p className="text-xs text-muted mt-2">
          Importing the same statement twice is always safe — duplicate transactions are detected automatically and skipped.
        </p>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>File</th>
              <th>Imported</th>
              <th>Found</th>
              <th>New</th>
              <th>Duplicate</th>
              <th>Needs review</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((b) => (
              <tr key={b.id}>
                <td>{b.filename}</td>
                <td className="text-muted whitespace-nowrap">{new Date(b.imported_at).toLocaleString()}</td>
                <td>{b.transactions_found}</td>
                <td>{b.transactions_new}</td>
                <td>{b.transactions_duplicate}</td>
                <td>{b.transactions_needs_review}</td>
                <td>
                  <span className={`pill ${b.status === "success" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{b.status}</span>
                </td>
              </tr>
            ))}
            {imports.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-8">
                  No imports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
DASHEOF

mkdir -p "frontend/src/pages"
cat > frontend/src/pages/Categories.tsx <<'DASHEOF'
import { useEffect, useState } from "react";
import { api, Category } from "../api/client";
import Icon from "../components/Icon";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  async function load() {
    setCategories(await api.get<Category[]>("/categories"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name) return;
    await api.post("/categories", { name, parent_id: parentId || null });
    setName("");
    load();
  }

  const parents = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="icon-chip bg-accent/10 text-accent">
          <Icon name="tag" size={18} />
        </span>
        <h1 className="text-xl font-semibold">Categories</h1>
      </div>

      <div className="card flex gap-2 flex-wrap items-end">
        <div>
          <label className="label">New category name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Parent (optional)</label>
          <select className="input" value={parentId} onChange={(e) => setParentId(Number(e.target.value))}>
            <option value="">Top-level</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={create}>
          Add
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {parents.map((p) => (
          <div key={p.id} className="card">
            <p className="font-medium mb-2">{p.name}</p>
            <ul className="text-sm text-muted space-y-1">
              {categories
                .filter((c) => c.parent_id === p.id)
                .map((c) => (
                  <li key={c.id}>— {c.name}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
DASHEOF

echo "Redesign files written."
