import { useEffect, useState } from "react";
import { api, CommitmentStatus } from "../api/client";
import { formatINR, currentPeriod, statusColor } from "../lib/format";

export default function Commitments() {
  const [period, setPeriod] = useState(currentPeriod());
  const [commitments, setCommitments] = useState<CommitmentStatus[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setCommitments(await api.get<CommitmentStatus[]>(`/commitments?period=${period}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const groups = groupBy(commitments, (c) => c.group_name || "Other");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Commitments</h1>
          <p className="text-sm text-muted">Recurring obligations and contributions, one period at a time.</p>
        </div>
        <input type="month" className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </div>

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
                        <li key={p.id} className="flex justify-between">
                          <span>
                            {formatINR(p.allocated_amount)} · <span className="text-muted">{p.source_type}</span>
                            {p.is_manual && <span className="pill bg-gray-100 text-muted ml-1">manual</span>}
                          </span>
                          {p.manual_note && <span className="text-xs text-muted italic">{p.manual_note}</span>}
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

function ManualContributionForm({ commitmentId, period, onAdded }: { commitmentId: number; period: string; onAdded: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
      setAmount("");
      setNote("");
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

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
