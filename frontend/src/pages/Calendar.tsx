import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, MoneyCalendarDay, MoneyCalendarMonth } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";
import { EmptyState, MetricCard, Notice, PageHeader, SkeletonRows } from "../components/UI";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const [period, setPeriod] = useState(currentMonth());
  const [data, setData] = useState<MoneyCalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const [year, month] = period.split("-").map(Number);
    setLoading(true);
    setError(null);
    api.get<MoneyCalendarMonth>(`/reports/calendar?year=${year}&month=${month}`)
      .then((result) => {
        setData(result);
        setSelectedDate((previous) => {
          if (previous && result.days.some((day) => day.date === previous)) return previous;
          const today = localIso(new Date());
          if (result.days.some((day) => day.date === today)) return today;
          return result.days[result.days.length - 1]?.date ?? null;
        });
      })
      .catch((e: any) => setError(e.message || "Could not load calendar."))
      .finally(() => setLoading(false));
  }, [period]);

  const byDate = useMemo(() => new Map((data?.days || []).map((day) => [day.date, day])), [data]);
  const cells = useMemo(() => buildMonthCells(period, byDate), [period, byDate]);
  const selectedDay = selectedDate ? byDate.get(selectedDate) || null : null;

  return (
    <div className="page-stack">
      <PageHeader
        icon="calendar"
        title="Money calendar"
        description="See every day money went out or came in, then open the exact transactions behind it."
        actions={
          <input className="input !w-auto" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}

      {data && (
        <div className="metric-grid">
          <MetricCard label="Money out" value={formatINR(data.debit_total)} helper={`${data.transaction_count} movements this month`} icon="arrow-up-right" tone="expense" />
          <MetricCard label="Money in" value={formatINR(data.credit_total)} helper="All statement credits" icon="arrow-down-right" tone="income" />
          <MetricCard label="Net movement" value={formatINR(data.net_movement)} helper="Credits minus debits" icon="chart" tone={data.net_movement >= 0 ? "income" : "expense"} />
          <MetricCard label="Needs review" value={String(data.unclassified_count)} helper={`${formatINR(data.unclassified_total)} not yet classified`} icon="flag" tone={data.unclassified_count ? "accent" : "neutral"} />
        </div>
      )}

      {data && data.unclassified_count > 0 && (
        <Notice
          tone="warning"
          title="Calendar totals include unclassified money movement"
          action={<Link to="/review" className="btn-secondary bg-white">Review transactions</Link>}
        >
          The calendar always shows real debits and credits. “Classified spending” below excludes transfers and unknown items until their meaning is confirmed.
        </Notice>
      )}

      {loading && !data ? (
        <SkeletonRows count={6} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
          <section className="panel overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
              <button className="btn-icon" onClick={() => setPeriod(addMonths(period, -1))} aria-label="Previous month"><Icon name="chevron-left" size={17} /></button>
              <div className="text-center">
                <h2 className="font-semibold">{monthLabel(period)}</h2>
                <p className="text-xs text-muted mt-0.5">Out is shown in red · In is shown in green</p>
              </div>
              <button className="btn-icon" onClick={() => setPeriod(addMonths(period, 1))} aria-label="Next month"><Icon name="chevron-right" size={17} /></button>
            </div>

            <div className="grid grid-cols-7 bg-gray-50 border-b border-line">
              {WEEKDAYS.map((day) => <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{day}</div>)}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const day = cell.dayData;
                const selected = selectedDate === cell.date;
                return (
                  <button
                    type="button"
                    key={cell.date}
                    onClick={() => cell.inMonth && setSelectedDate(cell.date)}
                    className={[
                      "relative min-h-[104px] sm:min-h-[124px] p-2 border-r border-b border-line text-left transition-colors overflow-hidden",
                      cell.inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/70 text-gray-400",
                      selected ? "ring-2 ring-inset ring-accent bg-indigo-50/40" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-sm font-semibold ${cell.inMonth ? "text-ink" : "text-gray-400"}`}>{cell.day}</span>
                      {day && day.unclassified_count > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1" title="Needs review" />}
                    </div>
                    {cell.inMonth && day && (
                      <div className="mt-2 space-y-1 min-w-0">
                        {day.debit_total > 0 && <div className="text-[10px] sm:text-xs font-semibold text-expense truncate">Out {compactINR(day.debit_total)}</div>}
                        {day.credit_total > 0 && <div className="text-[10px] sm:text-xs font-semibold text-income truncate">In {compactINR(day.credit_total)}</div>}
                        <div className="text-[10px] text-muted truncate">{day.transactions.length} tx{day.transactions.length === 1 ? "" : "s"}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <DayDetails day={selectedDay} />
        </div>
      )}
    </div>
  );
}

function DayDetails({ day }: { day: MoneyCalendarDay | null }) {
  if (!day) {
    return (
      <section className="panel-pad xl:sticky xl:top-6">
        <EmptyState icon="calendar" title="Choose a day" description="Select a date to see exactly what was paid, received, transferred, or still needs review." />
      </section>
    );
  }

  return (
    <section className="panel-pad xl:sticky xl:top-6 max-h-[calc(100vh-3rem)] overflow-auto">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected day</p>
          <h2 className="text-lg font-semibold mt-1">{friendlyDate(day.date)}</h2>
          <p className="text-xs text-muted mt-0.5">{day.transactions.length} transaction{day.transactions.length === 1 ? "" : "s"}</p>
        </div>
        {day.unclassified_count > 0 && <span className="pill bg-amber-100 text-amber-800">{day.unclassified_count} review</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <MiniTotal label="Money out" value={day.debit_total} tone="expense" />
        <MiniTotal label="Money in" value={day.credit_total} tone="income" />
        <MiniTotal label="Classified outflow" value={day.spend_total} />
        <MiniTotal label="Transfers" value={day.transfer_total} />
      </div>

      {(dayCategoryTotals(day).length > 0 || dayCreditTotals(day).length > 0) && (
        <div className="mb-4 pb-4 border-b border-line grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          {dayCategoryTotals(day).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">What money went out for</p>
              <div className="space-y-1.5">
                {dayCategoryTotals(day).slice(0, 6).map(([category, amount]) => (
                  <div key={category} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted truncate">{category}</span>
                    <span className="font-medium whitespace-nowrap">{formatINR(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dayCreditTotals(day).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Where money came from</p>
              <div className="space-y-1.5">
                {dayCreditTotals(day).slice(0, 6).map(([source, amount]) => (
                  <div key={source} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted truncate">{source}</span>
                    <span className="font-medium text-income whitespace-nowrap">{formatINR(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {day.transactions.map((txn) => (
          <Link key={txn.id} to={`/transactions?highlight=${txn.id}`} className="block rounded-xl border border-line bg-white p-3 hover:border-accent/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{txn.counterparty || txn.narration || "Transaction"}</p>
                <p className="text-xs text-muted mt-0.5">{txn.time || "Time unavailable"}{txn.account_name ? ` · ${txn.account_name}` : ""}</p>
              </div>
              <p className={`text-sm font-semibold whitespace-nowrap ${txn.direction === "credit" ? "text-income" : "text-expense"}`}>
                {txn.direction === "credit" ? "+" : "−"}{formatINR(txn.amount)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="pill bg-gray-100 text-ink">{titleCase(txn.transaction_type)}</span>
              {txn.category_name && <span className="pill bg-indigo-50 text-accent">{txn.parent_category_name && txn.parent_category_name !== txn.category_name ? `${txn.parent_category_name} / ` : ""}{txn.category_name}</span>}
              {txn.splits.length > 0 && <span className="pill bg-indigo-50 text-accent">{txn.splits.length} splits</span>}
              {txn.needs_review && <span className="pill bg-amber-100 text-amber-800">Needs review</span>}
              {txn.commitments.map((commitment) => <span key={commitment.payment_id} className="pill bg-emerald-50 text-emerald-700">{commitment.commitment_name}</span>)}
            </div>
            {txn.splits.length > 0 && (
              <div className="mt-2 space-y-1 rounded-lg bg-gray-50 px-2.5 py-2">
                {txn.splits.map((split) => (
                  <div key={split.id} className="flex justify-between gap-2 text-[11px]">
                    <span className="text-muted truncate">{split.category_name ? `${split.parent_category_name && split.parent_category_name !== split.category_name ? `${split.parent_category_name} / ` : ""}${split.category_name}` : "Uncategorized split"}</span>
                    <span className="font-medium whitespace-nowrap">{formatINR(split.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted mt-2 line-clamp-2">{txn.narration}</p>
          </Link>
        ))}
      </div>

      {day.manual_commitments.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Commitment-only entries</p>
          <div className="space-y-2">
            {day.manual_commitments.map((item) => (
              <div key={item.payment_id} className="rounded-xl bg-gray-50 border border-line p-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.commitment_name}</p>
                    <p className="text-xs text-muted mt-0.5">For {item.period} · {item.source_type}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatINR(item.amount)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">Manual commitment entries are shown for context and are not added again to statement debit/credit totals.</p>
        </div>
      )}
    </section>
  );
}

function dayCategoryTotals(day: MoneyCalendarDay): [string, number][] {
  const totals = new Map<string, number>();
  for (const txn of day.transactions) {
    if (txn.direction !== "debit") continue;
    if (txn.splits.length > 0) {
      for (const split of txn.splits) {
        const category = split.category_name
          ? `${split.parent_category_name && split.parent_category_name !== split.category_name ? `${split.parent_category_name} / ` : ""}${split.category_name}`
          : "Uncategorized split";
        totals.set(category, (totals.get(category) || 0) + split.amount);
      }
      continue;
    }
    const category = txn.category_name
      ? `${txn.parent_category_name && txn.parent_category_name !== txn.category_name ? `${txn.parent_category_name} / ` : ""}${txn.category_name}`
      : txn.needs_review ? "Needs review" : titleCase(txn.transaction_type);
    totals.set(category, (totals.get(category) || 0) + txn.amount);
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
}


function dayCreditTotals(day: MoneyCalendarDay): [string, number][] {
  const totals = new Map<string, number>();
  for (const txn of day.transactions) {
    if (txn.direction !== "credit") continue;
    const source = txn.counterparty || txn.category_name || titleCase(txn.transaction_type) || "Money received";
    totals.set(source, (totals.get(source) || 0) + txn.amount);
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
}

function MiniTotal({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "income" | "expense" }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-line p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-ink"}`}>{formatINR(value)}</p>
    </div>
  );
}

type CalendarCell = { date: string; day: number; inMonth: boolean; dayData?: MoneyCalendarDay };

function buildMonthCells(period: string, byDate: Map<string, MoneyCalendarDay>): CalendarCell[] {
  const [year, month] = period.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(year, month - 2, prevMonthDays - i);
    const key = localIso(date);
    cells.push({ date: key, day: date.getDate(), inMonth: false, dayData: byDate.get(key) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const key = localIso(date);
    cells.push({ date: key, day, inMonth: true, dayData: byDate.get(key) });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - startOffset - daysInMonth + 1;
    const date = new Date(year, month, day);
    const key = localIso(date);
    cells.push({ date: key, day: date.getDate(), inMonth: false, dayData: byDate.get(key) });
  }
  return cells;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function addMonths(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function friendlyDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
}

function compactINR(value: number) {
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(value >= 1000000 ? 1 : 2)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(value)}`;
}

function localIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
