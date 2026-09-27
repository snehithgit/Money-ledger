import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CommitmentStatus, ReviewInbox } from "../api/client";
import { formatINR, statusColor } from "../lib/format";

type MonthSummary = {
  money_in: number;
  money_out: number;
  net: number;
  by_out_type: Record<string, number>;
  unclassified_count: number;
};

export default function Dashboard() {
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [commitments, setCommitments] = useState<CommitmentStatus[]>([]);
  const [inbox, setInbox] = useState<ReviewInbox | null>(null);
  const now = new Date();

  useEffect(() => {
    api.get<MonthSummary>(`/reports/month-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then(setSummary);
    api.get<CommitmentStatus[]>("/commitments").then(setCommitments);
    api.get<ReviewInbox>("/review/inbox").then(setInbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{monthLabel}</h1>
        <p className="text-sm text-muted">Your money, at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Money in" value={summary ? formatINR(summary.money_in) : "…"} tone="income" />
        <StatCard label="Money out" value={summary ? formatINR(summary.money_out) : "…"} tone="expense" />
        <StatCard label="Net" value={summary ? formatINR(summary.net) : "…"} tone={summary && summary.net >= 0 ? "income" : "expense"} />
      </div>

      {inbox && inbox.total > 0 && (
        <Link to="/review" className="card flex items-center justify-between hover:border-accent block">
          <div>
            <p className="font-medium">{inbox.total} transaction{inbox.total === 1 ? "" : "s"} need review</p>
            <p className="text-sm text-muted">Unknown counterparties, rule conflicts, or unclassified payments.</p>
          </div>
          <span className="text-accent text-sm font-medium">Review →</span>
        </Link>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">This month's commitments</h2>
          <Link to="/commitments" className="text-sm text-accent">
            View all →
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
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" }) {
  return (
    <div className="card">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${tone === "income" ? "text-income" : "text-expense"}`}>{value}</p>
    </div>
  );
}
