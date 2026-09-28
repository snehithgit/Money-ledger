import { useEffect, useMemo, useState } from "react";
import { api, GoalProgress } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";
import { EmptyState, MetricCard, PageHeader, SkeletonRows } from "../components/UI";

export default function Goals() {
  const [goals, setGoals] = useState<GoalProgress[] | null>(null);

  useEffect(() => {
    api.get<GoalProgress[]>("/goals").then(setGoals).catch(() => setGoals([]));
  }, []);

  const totals = useMemo(() => {
    const rows = goals || [];
    return {
      contributed: rows.reduce((sum, goal) => sum + goal.total_contributed, 0),
      ytd: rows.reduce((sum, goal) => sum + (goal.ytd_contributed || 0), 0),
      target: rows.reduce((sum, goal) => sum + (goal.target_amount || 0), 0),
    };
  }, [goals]);

  return (
    <div className="page-stack">
      <PageHeader icon="target" title="Goals" description="See long-term savings progress without mixing it with everyday spending." />

      {goals === null ? (
        <SkeletonRows count={4} />
      ) : goals.length === 0 ? (
        <EmptyState icon="target" title="No goals yet" description="Goals linked to commitments will show progress here automatically." />
      ) : (
        <>
          <div className="metric-grid">
            <MetricCard label="Total contributed" value={formatINR(totals.contributed)} helper="Across all goals" icon="target" tone="accent" />
            <MetricCard label={`${goals[0]?.current_year || new Date().getFullYear()} YTD`} value={formatINR(totals.ytd)} helper="This calendar year" icon="calendar" tone="income" />
            <MetricCard label="Combined targets" value={totals.target ? formatINR(totals.target) : "Not set"} helper={`${goals.length} active goal${goals.length === 1 ? "" : "s"}`} icon="flag" />
            <MetricCard label="Remaining" value={totals.target ? formatINR(Math.max(0, totals.target - totals.contributed)) : "—"} helper="To reach current targets" icon="chart" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const pct = goal.target_amount ? Math.min(100, Math.max(0, (goal.total_contributed / goal.target_amount) * 100)) : null;
              return (
                <article key={goal.goal_id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-lg truncate">{goal.name}</h2>
                      <p className="text-xs text-muted mt-1">Lifetime progress</p>
                    </div>
                    {pct !== null && <span className="pill bg-accent/10 text-accent">{pct.toFixed(0)}%</span>}
                  </div>

                  <div className="mt-5">
                    <p className="text-2xl font-semibold tracking-tight">{formatINR(goal.total_contributed)}</p>
                    {goal.target_amount && <p className="text-sm text-muted mt-0.5">of {formatINR(goal.target_amount)} target</p>}
                  </div>

                  {pct !== null && <div className="progress-track mt-3"><div className="progress-fill-gradient" style={{ width: `${pct}%` }} /></div>}

                  {goal.ytd_contributed !== undefined && (
                    <div className="soft-card mt-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted">{goal.current_year} contribution</p>
                        <p className="font-semibold mt-0.5">{formatINR(goal.ytd_contributed)}</p>
                      </div>
                      {goal.annual_scheduled_target ? (
                        <div className="text-right">
                          <p className="text-xs text-muted">Scheduled this year</p>
                          <p className="font-medium mt-0.5">{formatINR(goal.annual_scheduled_target)}</p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {goal.by_commitment.length > 0 && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Contributors</p>
                      <div className="divide-y divide-line">
                        {goal.by_commitment.map((item) => (
                          <div key={item.commitment_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                            <span className="text-sm min-w-0 truncate">{item.commitment_name}</span>
                            <span className="text-sm font-medium whitespace-nowrap">{formatINR(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
