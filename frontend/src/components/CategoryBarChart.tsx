import { useState } from "react";
import { formatINR } from "../lib/format";

export type CategorySpendPoint = {
  category_id: number | null;
  category_name: string;
  amount: number;
};

// Horizontal ranked bar chart for "spend by category". One series (the
// measure is the same "amount" for every bar), so per the house rules
// this uses ONE hue - identity here comes from the row label, not from
// color - and needs no legend box. Bars cap at 24px, 4px rounded tip,
// value at the tip rather than crammed inside (labels never clip).
export default function CategoryBarChart({ data }: { data: CategorySpendPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const top = data.slice(0, 8); // small multiples of one: cap the list, rest is in the table view elsewhere
  const maxVal = Math.max(1, ...top.map((d) => d.amount));

  if (top.length === 0) {
    return <p className="text-sm text-muted">Nothing recorded yet this month.</p>;
  }

  return (
    <div className="space-y-2">
      {top.map((d, i) => {
        const pct = Math.max(2, (d.amount / maxVal) * 100);
        return (
          <div key={d.category_id ?? "uncategorized"} className="group" onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-ink font-medium truncate">{d.category_name}</span>
              <span className="text-muted tabular-nums">{formatINR(d.amount)}</span>
            </div>
            <div className="h-[10px] bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: "#4F46E5",
                  opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.55,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
