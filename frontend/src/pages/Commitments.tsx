import { useEffect, useMemo, useState } from "react";
import { api, CommitmentCalendarDay, CommitmentCalendarMonth, CommitmentStatus } from "../api/client";
import { currentPeriod, formatINR, statusColor } from "../lib/format";
import Icon from "../components/Icon";
import { EmptyState, MetricCard, PageHeader, SectionHeader, SkeletonRows } from "../components/UI";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Commitments() {
  const [period, setPeriod] = useState(currentPeriod());
  const [commitments, setCommitments] = useState<CommitmentStatus[] | null>(null);
  const [calendar, setCalendar] = useState<CommitmentCalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [commitmentRows, calendarData] = await Promise.all([
        api.get<CommitmentStatus[]>(`/commitments?period=${period}`),
        api.get<CommitmentCalendarMonth>(`/commitments/calendar?month=${period}`),
      ]);
      setCommitments(commitmentRows);
      setCalendar(calendarData);
      setSelectedDate((previous) => previous && calendarData.days.some((day) => day.date === previous) ? previous : null);
    } catch (e: any) {
      setError(e.message || "Could not load commitments.");
      setCommitments([]);
      setCalendar({ month: period, days: [], payments_count: 0, days_with_payments: 0, total_paid: 0 });
    }
  }

  useEffect(() => {
    setCommitments(null);
    setCalendar(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const groups = useMemo(() => groupBy(commitments || [], (commitment) => commitment.group_name || "Other"), [commitments]);
  const selectedDay = useMemo(() => calendar?.days.find((day) => day.date === selectedDate) ?? null, [calendar, selectedDate]);
  const cells = useMemo(() => buildCalendarCells(period, calendar?.days || []), [period, calendar]);
  const totals = useMemo(() => {
    const rows = commitments || [];
    return {
      expected: rows.reduce((sum, item) => sum + item.expected_amount, 0),
      paid: rows.reduce((sum, item) => sum + item.paid_amount, 0),
      completed: rows.filter((item) => ["completed", "overpaid", "skipped"].includes(item.status)).length,
      attention: rows.filter((item) => ["late", "partial", "needs_review"].includes(item.status)).length,
    };
  }, [commitments]);

  return (
    <div className="page-stack">
      <PageHeader
        icon="repeat"
        title="Commitments"
        description="Track recurring EMIs, loan payments, savings contributions, and the exact dates they were paid."
        actions={<input type="month" className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Commitment month" />}
      />

      {error && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}

      {commitments !== null && (
        <div className="metric-grid">
          <MetricCard label="Expected" value={formatINR(totals.expected)} helper={monthLabel(period)} icon="calendar" />
          <MetricCard label="Recorded paid" value={formatINR(totals.paid)} helper="For this commitment period" icon="check" tone="income" />
          <MetricCard label="Completed" value={`${totals.completed} / ${commitments.length}`} helper="Completed, overpaid, or skipped" icon="repeat" tone="accent" />
          <MetricCard label="Needs attention" value={String(totals.attention)} helper="Late, partial, or needs review" icon="flag" tone={totals.attention ? "expense" : "neutral"} />
        </div>
      )}

      <section className="panel-pad">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">Payment calendar</h2>
            <p className="section-description">Highlighted dates are when money was actually recorded as paid.</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <button className="btn-icon border border-line bg-white" onClick={() => setPeriod(addMonths(period, -1))} aria-label="Previous month"><Icon name="chevron-left" size={17} /></button>
            <div className="min-w-[150px] text-center text-sm font-semibold">{monthLabel(period)}</div>
            <button className="btn-icon border border-line bg-white" onClick={() => setPeriod(addMonths(period, 1))} aria-label="Next month"><Icon name="chevron-right" size={17} /></button>
          </div>
        </div>

        {calendar === null ? (
          <SkeletonRows count={4} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
            <div className="rounded-2xl border border-line overflow-hidden">
              <div className="calendar-grid">
                {WEEKDAYS.map((day) => <div key={day} className="calendar-head">{day}</div>)}
              </div>
              <div className="calendar-grid">
                {cells.map((cell) => {
                  const selected = selectedDate === cell.date;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={!cell.inMonth && !cell.hasPayments}
                      onClick={() => cell.hasPayments ? setSelectedDate(selected ? null : cell.date) : setSelectedDate(null)}
                      className={`calendar-cell ${!cell.inMonth ? "calendar-cell-muted" : ""} ${cell.hasPayments ? "calendar-cell-paid" : ""} ${selected ? "calendar-cell-selected" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="calendar-day">{cell.day}</span>
                        {cell.hasPayments && <span className="calendar-dot" title="Payment recorded" />}
                      </div>
                      {cell.hasPayments && (
                        <div className="mt-2">
                          <p className="hidden sm:block text-[11px] font-semibold truncate">{formatINR(cell.totalPaid)}</p>
                          <p className="text-[10px] text-muted mt-0.5">{cell.items.length} payment{cell.items.length === 1 ? "" : "s"}</p>
                          <div className="hidden lg:block mt-1 space-y-1">
                            {cell.items.slice(0, 1).map((item) => <p key={item.payment_id} className="text-[10px] text-accent truncate">{item.commitment_name}</p>)}
                            {cell.items.length > 1 && <p className="text-[10px] text-muted">+{cell.items.length - 1} more</p>}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="soft-card min-h-[180px]">
              {selectedDay ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected date</p>
                      <h3 className="font-semibold mt-1">{humanDate(selectedDay.date)}</h3>
                    </div>
                    <button className="btn-icon !w-8 !h-8" onClick={() => setSelectedDate(null)}><Icon name="x" size={14} /></button>
                  </div>
                  <p className="text-2xl font-semibold mt-3">{formatINR(selectedDay.total_paid)}</p>
                  <p className="text-xs text-muted mt-0.5">{selectedDay.items.length} commitment payment{selectedDay.items.length === 1 ? "" : "s"}</p>
                  <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedDay.items.map((item) => (
                      <div key={item.payment_id} className="rounded-xl border border-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.commitment_name}</p>
                            <p className="text-xs text-muted mt-0.5">For {periodLabel(item.period)} · {sourceLabel(item.source_type)}</p>
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">{formatINR(item.amount)}</p>
                        </div>
                        {item.manual_note && <p className="text-xs text-muted italic mt-2">{item.manual_note}</p>}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full min-h-[170px] flex flex-col items-center justify-center text-center px-3">
                  <span className="w-10 h-10 rounded-xl bg-white border border-line text-muted flex items-center justify-center mb-3"><Icon name="calendar" size={18} /></span>
                  <p className="text-sm font-medium">Choose a paid date</p>
                  <p className="text-xs text-muted mt-1">Tap a day with a green dot to see what was paid.</p>
                  <div className="mt-4 pt-3 border-t border-line w-full grid grid-cols-2 gap-2 text-center">
                    <div><p className="text-xs text-muted">Paid days</p><p className="font-semibold mt-0.5">{calendar.days_with_payments}</p></div>
                    <div><p className="text-xs text-muted">Recorded total</p><p className="font-semibold mt-0.5">{formatINR(calendar.total_paid)}</p></div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      {commitments === null ? (
        <SkeletonRows count={5} />
      ) : commitments.length === 0 ? (
        <EmptyState icon="repeat" title="No active commitments" description="Recurring obligations and contributions will appear here once configured." />
      ) : (
        Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <SectionHeader title={group} description={`${items.length} commitment${items.length === 1 ? "" : "s"}`} />
            <div className="space-y-3">
              {items.map((commitment) => {
                const pct = commitment.expected_amount > 0 ? Math.min(100, (commitment.paid_amount / commitment.expected_amount) * 100) : 0;
                const open = expanded === commitment.commitment_id;
                return (
                  <article key={commitment.commitment_id} className="card !p-0 overflow-hidden">
                    <button className="w-full text-left p-4 sm:p-5" onClick={() => setExpanded(open ? null : commitment.commitment_id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{commitment.name}</h3>
                            <span className={`pill ${statusColor(commitment.status)}`}>{commitment.status.replace(/_/g, " ")}</span>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-xs text-muted">Paid for {periodLabel(commitment.period)}</p>
                              <p className="text-lg font-semibold mt-0.5">{formatINR(commitment.paid_amount)} <span className="text-xs font-normal text-muted">of {formatINR(commitment.expected_amount)}</span></p>
                            </div>
                            <Icon name="chevron-right" size={17} className={`text-muted transition-transform ${open ? "rotate-90" : ""}`} />
                          </div>
                          <div className="progress-track mt-3"><div className="progress-fill-gradient" style={{ width: `${pct}%` }} /></div>
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-line bg-gray-50/50 p-4 sm:p-5 space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold">Recorded payments</h4>
                          {commitment.payments.length === 0 ? (
                            <p className="text-sm text-muted mt-2">No payment records are attached to this period.</p>
                          ) : (
                            <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-white px-3">
                              {commitment.payments.map((payment) => (
                                <div key={payment.id} className="py-3 flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-medium">{sourceLabel(payment.source_type)}{payment.is_manual ? " · Manual" : ""}</p>
                                    <p className="text-xs text-muted mt-0.5">{payment.paid_date ? `Paid ${humanDate(payment.paid_date)}` : "Payment date unavailable"}</p>
                                    {payment.manual_note && <p className="text-xs text-muted italic mt-1">{payment.manual_note}</p>}
                                  </div>
                                  <p className="text-sm font-semibold whitespace-nowrap">{formatINR(payment.allocated_amount)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <details className="details-card bg-white">
                          <summary><span>Add a manual payment</span><Icon name="plus" size={16} className="text-muted" /></summary>
                          <div className="details-body"><ManualContributionForm commitmentId={commitment.commitment_id} period={period} onAdded={load} /></div>
                        </details>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ManualContributionForm({ commitmentId, period, onAdded }: { commitmentId: number; period: string; onAdded: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [paidDate, setPaidDate] = useState(defaultPaidDateForPeriod(period));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPaidDate(defaultPaidDateForPeriod(period)); }, [period]);

  async function add() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/commitments/${commitmentId}/payments`, {
        period,
        allocated_amount: numericAmount,
        source_type: sourceType,
        manual_note: note.trim() || null,
        paid_date: paidDate || null,
      });
      setAmount("");
      setNote("");
      setPaidDate(defaultPaidDateForPeriod(period));
      onAdded();
    } catch (e: any) {
      setError(e.message || "Could not add the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="form-grid">
        <div>
          <label className="label">Amount</label>
          <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Paid date</label>
          <input className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            <option value="manual">Manual / other account</option>
            <option value="rent">Rent</option>
            <option value="phonepe">PhonePe</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Note <span className="font-normal text-muted">(optional)</span></label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was this paid?" />
        </div>
      </div>
      {error && <p className="text-sm text-expense">{error}</p>}
      <div className="flex justify-end"><button className="btn-primary" onClick={add} disabled={saving}>{saving ? "Adding…" : "Add payment"}</button></div>
    </div>
  );
}

type CalendarCell = { date: string; day: number; inMonth: boolean; hasPayments: boolean; totalPaid: number; items: CommitmentCalendarDay["items"] };

function buildCalendarCells(period: string, days: CommitmentCalendarDay[]): CalendarCell[] {
  const [year, month] = period.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const byDate = new Map(days.map((day) => [day.date, day]));
  const cells: CalendarCell[] = [];

  for (let offset = firstWeekday - 1; offset >= 0; offset--) {
    cells.push(makeCalendarCell(new Date(year, month - 2, previousMonthDays - offset), false, byDate));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(makeCalendarCell(new Date(year, month - 1, day), true, byDate));
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push(makeCalendarCell(new Date(year, month, day), false, byDate));
  }
  return cells;
}

function makeCalendarCell(date: Date, inMonth: boolean, byDate: Map<string, CommitmentCalendarDay>): CalendarCell {
  const key = isoFromDate(date);
  const row = byDate.get(key);
  return { date: key, day: date.getDate(), inMonth, hasPayments: !!row, totalPaid: row?.total_paid ?? 0, items: row?.items ?? [] };
}

function isoFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function periodLabel(period: string) {
  return monthLabel(period);
}

function addMonths(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function humanDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function sourceLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function defaultPaidDateForPeriod(period: string) {
  const today = new Date();
  const current = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  if (period === current) return isoFromDate(today);
  return `${period}-01`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const group = key(item);
    (acc[group] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
