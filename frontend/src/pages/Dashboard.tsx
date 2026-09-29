import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Account, CommitmentStatus, ReviewInbox } from "../api/client";
import { formatINR, statusColor } from "../lib/format";
import TrendChart, { TrendPoint } from "../components/TrendChart";
import CategoryBarChart, { CategorySpendPoint } from "../components/CategoryBarChart";
import Icon, { IconName } from "../components/Icon";
import { EmptyState, MetricCard, Notice, PageHeader, SectionHeader, SkeletonRows } from "../components/UI";

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
  const [commitments, setCommitments] = useState<CommitmentStatus[] | null>(null);
  const [inbox, setInbox] = useState<ReviewInbox | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [categorySpend, setCategorySpend] = useState<CategorySpendPoint[] | null>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    api.get<MonthSummary>(`/reports/month-summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then(setSummary).catch(() => setSummary(null));
    api.get<Account[]>("/accounts").then(setAccounts).catch(() => setAccounts([]));
    api.get<CommitmentStatus[]>("/commitments").then(setCommitments).catch(() => setCommitments([]));
    api.get<ReviewInbox>("/review/inbox").then(setInbox).catch(() => setInbox({ total: 0, groups: [] }));
    api.get<MonthSummary[]>("/reports/trend?months=6")
      .then((rows) => setTrend(rows.map((r) => ({ label: `${MONTH_ABBR[r.month - 1]} ${r.year}`, money_in: r.money_in, money_out: r.money_out }))))
      .catch(() => setTrend([]));

    const localDate = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const monthStart = localDate(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = localDate(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1);
    api.get<CategorySpendPoint[]>(`/reports/category-spend?start=${monthStart}&end=${monthEnd}`).then(setCategorySpend).catch(() => setCategorySpend([]));
  }, [now]);

  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const totalBalance = accounts?.filter((a) => !a.is_archived).reduce((sum, a) => sum + a.balance, 0) ?? null;
  const completedCommitments = commitments?.filter((c) => c.status === "completed" || c.status === "overpaid").length ?? 0;
  const activeCommitments = commitments?.length ?? 0;

  const quickLinks: { to: string; label: string; blurb: string; icon: IconName }[] = [
    { to: "/calendar", label: "Money calendar", blurb: "Daily money in and out", icon: "calendar" },
    { to: "/review", label: "Review inbox", blurb: inbox?.total ? `${inbox.total} item${inbox.total === 1 ? "" : "s"} waiting` : "Nothing waiting", icon: "flag" },
    { to: "/accounts", label: "Accounts", blurb: accounts ? `${accounts.length} active account${accounts.length === 1 ? "" : "s"}` : "Balances and sources", icon: "wallet" },
    { to: "/goals", label: "Goals", blurb: "Savings progress", icon: "target" },
    { to: "/imports", label: "Import statement", blurb: "Add PhonePe CSV", icon: "upload" },
  ];

  return (
    <div className="page-stack">
      <PageHeader icon="home" title="Overview" description={`A clear view of your money for ${monthLabel}.`} actions={<Link to="/calendar" className="btn-secondary"><Icon name="calendar" size={16} /> Money calendar</Link>} />

      <div className="metric-grid">
        <MetricCard label="Total balance" value={totalBalance === null ? "…" : formatINR(totalBalance)} helper={accounts ? `${accounts.length} active account${accounts.length === 1 ? "" : "s"}` : "Loading accounts"} icon="wallet" tone="accent" />
        <MetricCard label="Money in" value={summary ? formatINR(summary.money_in) : "…"} helper="This month" icon="arrow-down-right" tone="income" />
        <MetricCard label="Money out" value={summary ? formatINR(summary.money_out) : "…"} helper="This month" icon="arrow-up-right" tone="expense" />
        <MetricCard label="Net cash flow" value={summary ? formatINR(summary.net) : "…"} helper={summary ? (summary.net >= 0 ? "More came in than went out" : "Outflow is higher this month") : "This month"} icon="chart" />
      </div>

      {inbox && inbox.total > 0 && (
        <Notice
          tone="warning"
          title={`${inbox.total} transaction${inbox.total === 1 ? "" : "s"} need review`}
          action={<Link to="/review" className="btn-secondary bg-white">Review now <Icon name="chevron-right" size={15} /></Link>}
        >
          Clear unknown payees, rule conflicts, and unclassified transactions so your reports stay accurate.
        </Notice>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] gap-5">
        <section className="panel-pad min-w-0">
          <SectionHeader title="Cash flow" description="Income and outflow over the last six months." />
          {trend === null ? <SkeletonRows count={3} /> : trend.length > 0 ? <TrendChart data={trend} /> : <EmptyState icon="chart" title="No cash-flow history yet" description="Import or add transactions to build a trend." />}
        </section>

        <section className="panel-pad min-w-0">
          <SectionHeader title="Top spending" description="Largest expense categories this month." action={<Link to="/transactions" className="text-sm font-medium text-accent">Transactions</Link>} />
          {categorySpend === null ? <SkeletonRows count={4} /> : categorySpend.length > 0 ? <CategoryBarChart data={categorySpend} /> : <EmptyState icon="tag" title="No spending yet" description="Expense categories will appear here as transactions are classified." />}
        </section>
      </div>

      <section>
        <SectionHeader
          title="Commitments this month"
          description={`${completedCommitments} of ${activeCommitments} currently completed.`}
          action={<Link to="/commitments" className="btn-secondary !py-2">View calendar <Icon name="chevron-right" size={15} /></Link>}
        />
        {commitments === null ? (
          <SkeletonRows count={3} />
        ) : commitments.length === 0 ? (
          <EmptyState icon="repeat" title="No commitments yet" description="Recurring EMIs, loan payments, and savings contributions will appear here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {commitments.map((commitment) => {
              const pct = commitment.expected_amount > 0 ? Math.min(100, (commitment.paid_amount / commitment.expected_amount) * 100) : 0;
              return (
                <Link key={commitment.commitment_id} to="/commitments" className="card hover:border-accent/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{commitment.name}</p>
                      <p className="text-xs text-muted mt-0.5 truncate">{commitment.group_name || "Recurring commitment"}</p>
                    </div>
                    <span className={`pill shrink-0 ${statusColor(commitment.status)}`}>{commitment.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">Paid</p>
                      <p className="font-semibold mt-0.5">{formatINR(commitment.paid_amount)}</p>
                    </div>
                    <p className="text-xs text-muted">of {formatINR(commitment.expected_amount)}</p>
                  </div>
                  <div className="progress-track mt-2"><div className="progress-fill-gradient" style={{ width: `${pct}%` }} /></div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)] gap-5">
        <section>
          <SectionHeader title="Spending by type" description="Where this month's outflow is going." />
          <div className="panel-pad">
            {summary && Object.keys(summary.by_out_type).length > 0 ? (
              <div className="divide-y divide-line">
                {Object.entries(summary.by_out_type).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
                  <div key={type} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm capitalize text-muted">{type.replace(/_/g, " ")}</span>
                    <span className="text-sm font-semibold">{formatINR(amount)}</span>
                  </div>
                ))}
                {summary.unclassified_count > 0 && (
                  <div className="pt-3 text-xs text-amber-800">{summary.unclassified_count} unclassified transaction{summary.unclassified_count === 1 ? "" : "s"} are excluded from these totals.</div>
                )}
              </div>
            ) : (
              <EmptyState icon="chart" title="No outflow recorded" description="This section fills automatically from classified expenses and payments." />
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Shortcuts" description="Common places you may want next." />
          <div className="panel p-2">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <span className="icon-chip bg-gray-100 text-muted"><Icon name={item.icon} size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted truncate">{item.blurb}</p>
                </div>
                <Icon name="chevron-right" size={15} className="text-gray-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
