import { useEffect, useState } from "react";
import { api, GoalProgress } from "../api/client";
import { formatINR } from "../lib/format";

export default function Goals() {
  const [goals, setGoals] = useState<GoalProgress[]>([]);

  useEffect(() => {
    api.get<GoalProgress[]>("/goals").then(setGoals);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Goals</h1>

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
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
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
