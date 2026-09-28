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
