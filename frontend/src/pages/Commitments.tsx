import { useEffect, useMemo, useState } from "react";
import { api, CommitmentCalendarDay, CommitmentCalendarMonth, CommitmentStatus } from "../api/client";
import { currentPeriod, formatINR, statusColor } from "../lib/format";
import Icon from "../components/Icon";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Commitments() {
  const [period, setPeriod] = useState(currentPeriod());
  const [commitments, setCommitments] = useState<CommitmentStatus[]>([]);
  const [calendar, setCalendar] = useState<CommitmentCalendarMonth | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    const [commitmentRows, calendarData] = await Promise.all([
      api.get<CommitmentStatus[]>(`/commitments?period=${period}`),
      api.get<CommitmentCalendarMonth>(`/commitments/calendar?month=${period}`),
    ]);
    setCommitments(commitmentRows);
    setCalendar(calendarData);
    setSelectedDate((prev) => {
      if (prev && calendarData.days.some((d) => d.date === prev)) return prev;
      return calendarData.days[0]?.date ?? null;
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const groups = groupBy(commitments, (c) => c.group_name || "Other");
  const selectedDay = useMemo(() => calendar?.days.find((d) => d.date === selectedDate) ?? null, [calendar, selectedDate]);
  const calendarCells = useMemo(() => buildCalendarCells(period, calendar?.days || []), [period, calendar]);

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

      <CommitmentCalendarCard
        period={period}
        setPeriod={setPeriod}
        calendar={calendar}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedDay={selectedDay}
        cells={calendarCells}
      />

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
                        <li key={p.id} className="flex justify-between gap-3">
                          <span>
                            {formatINR(p.allocated_amount)} · <span className="text-muted">{p.source_type}</span>
                            {p.is_manual && <span className="pill bg-gray-100 text-muted ml-1">manual</span>}
                            {p.paid_date && <span className="text-muted"> · paid {humanDate(p.paid_date)}</span>}
                          </span>
                          {p.manual_note && <span className="text-xs text-muted italic text-right">{p.manual_note}</span>}
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

function CommitmentCalendarCard({
  period,
  setPeriod,
  calendar,
  selectedDate,
  setSelectedDate,
  selectedDay,
  cells,
}: {
  period: string;
  setPeriod: (value: string) => void;
  calendar: CommitmentCalendarMonth | null;
  selectedDate: string | null;
  setSelectedDate: (value: string | null) => void;
  selectedDay: CommitmentCalendarDay | null;
  cells: CalendarCell[];
}) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Payment calendar</h2>
          <p className="text-sm text-muted">See which commitment payments landed on which day in this month.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary px-3" onClick={() => setPeriod(addMonths(period, -1))} aria-label="Previous month">‹</button>
          <div className="min-w-[150px] text-center font-medium">{monthLabel(period)}</div>
          <button className="btn-secondary px-3" onClick={() => setPeriod(addMonths(period, 1))} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-line overflow-hidden bg-white">
          <div className="grid grid-cols-7 border-b border-line bg-gray-50 text-xs font-semibold uppercase tracking-wide text-muted">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const isSelected = selectedDate === cell.date;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.hasPayments ? cell.date : null)}
                  className={[
                    "min-h-[110px] border-r border-b border-line px-2 py-2 text-left align-top transition-colors",
                    cell.inMonth ? "bg-white" : "bg-gray-50 text-gray-400",
                    cell.hasPayments ? "hover:bg-accent/5" : "",
                    isSelected ? "ring-2 ring-inset ring-accent bg-accent/5" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className={`text-sm font-medium ${cell.inMonth ? "text-ink" : "text-gray-400"}`}>{cell.day}</span>
                    {cell.hasPayments && <span className="pill bg-green-50 text-green-700">{formatINR(cell.totalPaid)}</span>}
                  </div>
                  <div className="space-y-1">
                    {cell.items.slice(0, 2).map((item) => (
                      <div key={item.payment_id} className="rounded-lg bg-accent/10 px-2 py-1 text-[11px] leading-4 text-accent truncate">
                        {item.commitment_name}
                      </div>
                    ))}
                    {cell.items.length > 2 && <div className="text-[11px] text-muted">+{cell.items.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-gray-50 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Month summary</p>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Days with payments</span><span className="font-medium">{calendar?.days_with_payments ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted">Payment entries</span><span className="font-medium">{calendar?.payments_count ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-muted">Total recorded</span><span className="font-medium">{formatINR(calendar?.total_paid ?? 0)}</span></div>
            </div>
          </div>

          <div className="pt-3 border-t border-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Selected day</p>
            {!selectedDay && <p className="text-sm text-muted">Pick a highlighted date to see which commitments were paid on that day.</p>}
            {selectedDay && (
              <div className="space-y-2">
                <div>
                  <p className="font-medium">{humanDate(selectedDay.date)}</p>
                  <p className="text-sm text-muted">{formatINR(selectedDay.total_paid)} across {selectedDay.items.length} payment{selectedDay.items.length === 1 ? "" : "s"}</p>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                  {selectedDay.items.map((item) => (
                    <div key={item.payment_id} className="rounded-xl border border-line bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.commitment_name}</p>
                          <p className="text-xs text-muted">For period {item.period}</p>
                        </div>
                        <span className="font-medium">{formatINR(item.amount)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                        <span className="pill bg-gray-100 text-muted">{item.source_type}</span>
                        {item.is_manual && <span className="pill bg-gray-100 text-muted">manual</span>}
                        {item.group_name && <span>{item.group_name}</span>}
                      </div>
                      {item.manual_note && <p className="mt-2 text-xs italic text-muted">{item.manual_note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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

  useEffect(() => {
    setPaidDate(defaultPaidDateForPeriod(period));
  }, [period]);

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
        paid_date: paidDate || null,
      });
      setAmount("");
      setNote("");
      setPaidDate(defaultPaidDateForPeriod(period));
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
      <div>
        <label className="label">Paid date</label>
        <input className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
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

type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  hasPayments: boolean;
  totalPaid: number;
  items: CommitmentCalendarDay["items"];
};

function buildCalendarCells(period: string, days: CommitmentCalendarDay[]): CalendarCell[] {
  const [year, month] = period.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: CalendarCell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const dt = new Date(year, month - 2, day);
    cells.push(makeCalendarCell(dt, false, byDate));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month - 1, day);
    cells.push(makeCalendarCell(dt, true, byDate));
  }
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstWeekday + daysInMonth) + 1;
    const dt = new Date(year, month, nextDay);
    cells.push(makeCalendarCell(dt, false, byDate));
  }
  return cells;
}

function makeCalendarCell(date: Date, inMonth: boolean, byDate: Map<string, CommitmentCalendarDay>): CalendarCell {
  const key = isoFromDate(date);
  const row = byDate.get(key);
  return {
    date: key,
    day: date.getDate(),
    inMonth,
    hasPayments: !!row,
    totalPaid: row?.total_paid ?? 0,
    items: row?.items ?? [],
  };
}

function isoFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function addMonths(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function humanDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function defaultPaidDateForPeriod(period: string) {
  const today = new Date();
  const current = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  if (period === current) return isoFromDate(today);
  return `${period}-01`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
