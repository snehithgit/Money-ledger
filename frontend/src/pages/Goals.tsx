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
