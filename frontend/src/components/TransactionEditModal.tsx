import { useEffect, useState } from "react";
import { api, Category, CommitmentStatus, Transaction } from "../api/client";
import { formatINR } from "../lib/format";

const TYPES = [
  "income",
  "expense",
  "transfer",
  "loan_payment",
  "emi",
  "savings",
  "investment",
  "family_contribution",
  "refund",
  "cash_withdrawal",
  "cash_deposit",
  "internal_transfer",
  "unknown_needs_review",
];

type Split = { amount: number; category_id: number | null };
type CommitmentRow = { commitment_id: number | ""; amount: number };

// "YYYY-MM-DD" -> "YYYY-MM"
function periodOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// Add `n` months to a "YYYY-MM" period string.
function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = (m - 1) + n;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return `${year.toString().padStart(4, "0")}-${(month + 1).toString().padStart(2, "0")}`;
}

export default function TransactionEditModal({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">(transaction.category_id ?? "");
  const [type, setType] = useState(transaction.transaction_type);
  const [notes, setNotes] = useState(transaction.notes || "");
  const [needsReview, setNeedsReview] = useState(transaction.needs_review);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<Split[]>([{ amount: transaction.amount, category_id: transaction.category_id }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Attaching this payment to a commitment (or several) ------------
  const txnPeriod = periodOf(transaction.date);
  const [commitments, setCommitments] = useState<CommitmentStatus[]>([]);
  const [commitmentRows, setCommitmentRows] = useState<CommitmentRow[]>([{ commitment_id: "", amount: transaction.amount }]);
  const [commitmentBusy, setCommitmentBusy] = useState(false);
  const [commitmentMsg, setCommitmentMsg] = useState<string | null>(null);
  const [commitmentError, setCommitmentError] = useState<string | null>(null);

  const [bulkCommitmentId, setBulkCommitmentId] = useState<number | "">("");
  const [bulkPeriods, setBulkPeriods] = useState(12);
  const [bulkTotal, setBulkTotal] = useState(transaction.amount);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
    api.get<CommitmentStatus[]>(`/commitments?period=${txnPeriod}`).then(setCommitments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitTotal = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const commitmentRowsTotal = commitmentRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Attach this transaction to one or more commitments for its own
  // month - e.g. a single ₹39,000 transfer that actually covers both
  // the ₹18,000 EMI and the ₹21,000 Top-Up EMI in one go.
  async function attachToCommitments() {
    setCommitmentBusy(true);
    setCommitmentError(null);
    setCommitmentMsg(null);
    try {
      const rows = commitmentRows.filter((r) => r.commitment_id !== "" && Number(r.amount) > 0);
      if (rows.length === 0) throw new Error("Pick at least one commitment and an amount");
      if (commitmentRowsTotal > transaction.amount + 0.005) throw new Error(`Allocations cannot exceed ${formatINR(transaction.amount)}`);
      for (const r of rows) {
        await api.post(`/commitments/${r.commitment_id}/payments`, {
          transaction_id: transaction.id,
          period: txnPeriod,
          allocated_amount: Number(r.amount),
          source_type: "phonepe",
        });
      }
      setCommitmentMsg(`Attached to ${rows.length} commitment${rows.length === 1 ? "" : "s"} for ${txnPeriod}.`);
    } catch (e: any) {
      setCommitmentError(e.message || "Failed to attach");
    } finally {
      setCommitmentBusy(false);
    }
  }

  // Attach this transaction to ONE commitment as a lump sum covering
  // several consecutive months starting at this transaction's month -
  // e.g. a whole financial year's Sukanya contribution paid in one go.
  async function attachBulkPayment() {
    setBulkBusy(true);
    setBulkError(null);
    setBulkMsg(null);
    try {
      if (!bulkCommitmentId) throw new Error("Pick a commitment");
      if (bulkPeriods < 1) throw new Error("Must cover at least 1 month");
      await api.post(`/commitments/${bulkCommitmentId}/bulk-payment`, {
        transaction_id: transaction.id,
        start_period: txnPeriod,
        periods: bulkPeriods,
        total_amount: Number(bulkTotal),
        source_type: "phonepe",
      });
      setBulkMsg(`Spread across ${bulkPeriods} months starting ${txnPeriod}.`);
    } catch (e: any) {
      setBulkError(e.message || "Failed to attach");
    } finally {
      setBulkBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (splitMode && Math.abs(splitTotal - transaction.amount) > 0.01) {
        throw new Error(`Splits must total ${formatINR(transaction.amount)} (currently ${formatINR(splitTotal)})`);
      }
      await api.patch(`/transactions/${transaction.id}`, {
        category_id: categoryId || null,
        transaction_type: type,
        notes: notes || null,
        needs_review: needsReview,
      });
      if (splitMode) {
        await api.post(`/transactions/${transaction.id}/split`, {
          splits: splits.map((s) => ({ amount: Number(s.amount), category_id: s.category_id || null })),
        });
      }

      // If this transaction has a counterparty and we just gave it a
      // category, offer to apply the same category to any OTHER
      // transactions from that same counterparty that are still sitting
      // in "needs review" - e.g. two payments to the same shop where one
      // was already reviewed and one wasn't. Already-categorized
      // transactions from this counterparty are never touched.
      if (categoryId && transaction.counterparty_id) {
        const siblings = await api.get<Transaction[]>(
          `/transactions?counterparty_id=${transaction.counterparty_id}&needs_review=true&limit=500`
        );
        const others = siblings.filter((s) => s.id !== transaction.id);
        if (others.length > 0) {
          const name = transaction.raw_counterparty || "this counterparty";
          const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "this category";
          const confirmed = window.confirm(
            `Apply "${categoryName}" to ${others.length} other transaction${others.length === 1 ? "" : "s"} from ${name} that also need review?`
          );
          if (confirmed) {
            await Promise.all(
              others.map((o) =>
                api.patch(`/transactions/${o.id}`, {
                  category_id: categoryId,
                  transaction_type: type,
                  needs_review: false,
                })
              )
            );
          }
        }
      }

      onSaved();
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full md:w-[480px] rounded-t-2xl md:rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-lg">Edit transaction</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          {transaction.raw_narration} · {formatINR(transaction.amount)} · {transaction.date}
        </p>

        {transaction.match_explanation && (
          <div className="text-xs bg-gray-50 border border-line rounded-lg p-2 mb-3 text-muted">
            <strong>Why this classification:</strong> {transaction.match_explanation}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">Transaction type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {!splitMode && (
            <div>
              <label className="label">Category</label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? "— " : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
            Needs review
          </label>

          <div className="pt-2 border-t border-line">
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={splitMode}
                onChange={(e) => {
                  setSplitMode(e.target.checked);
                  if (e.target.checked && splits.length < 2) {
                    setSplits([
                      { amount: transaction.amount, category_id: transaction.category_id },
                      { amount: 0, category_id: null },
                    ]);
                  }
                }}
              />
              Split this transaction across categories
            </label>
            {splitMode && (
              <div className="space-y-2">
                {splits.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input w-24"
                      type="number"
                      value={s.amount}
                      onChange={(e) => {
                        const next = [...splits];
                        next[i] = { ...next[i], amount: Number(e.target.value) };
                        setSplits(next);
                      }}
                    />
                    <select
                      className="input flex-1"
                      value={s.category_id ?? ""}
                      onChange={(e) => {
                        const next = [...splits];
                        next[i] = { ...next[i], category_id: Number(e.target.value) || null };
                        setSplits(next);
                      }}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button className="text-muted hover:text-expense px-1" onClick={() => setSplits(splits.filter((_, idx) => idx !== i))}>
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button className="text-sm text-accent" onClick={() => setSplits([...splits, { amount: 0, category_id: null }])}>
                    + Add split
                  </button>
                  <span className={`text-xs ${Math.abs(splitTotal - transaction.amount) > 0.01 ? "text-expense" : "text-income"}`}>
                    {formatINR(splitTotal)} / {formatINR(transaction.amount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {commitments.length > 0 && (
            <div className="pt-3 border-t border-line space-y-4">
              <div>
                <p className="text-sm font-medium">Split across commitments this month</p>
                <p className="text-xs text-muted mb-2">
                  Use this when one payment actually covers more than one commitment - e.g. a single ₹39,000
                  transfer that's really the ₹18,000 EMI plus the ₹21,000 Top-Up EMI.
                </p>
                <div className="space-y-2">
                  {commitmentRows.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <select
                        className="input flex-1"
                        value={r.commitment_id}
                        onChange={(e) => {
                          const next = [...commitmentRows];
                          next[i] = { ...next[i], commitment_id: Number(e.target.value) || "" };
                          setCommitmentRows(next);
                        }}
                      >
                        <option value="">Choose commitment…</option>
                        {commitments.map((c) => (
                          <option key={c.commitment_id} value={c.commitment_id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input w-24"
                        type="number"
                        value={r.amount}
                        onChange={(e) => {
                          const next = [...commitmentRows];
                          next[i] = { ...next[i], amount: Number(e.target.value) };
                          setCommitmentRows(next);
                        }}
                      />
                      <button
                        className="text-muted hover:text-expense px-1"
                        onClick={() => setCommitmentRows(commitmentRows.filter((_, idx) => idx !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <button
                      className="text-sm text-accent"
                      onClick={() => setCommitmentRows([...commitmentRows, { commitment_id: "", amount: 0 }])}
                    >
                      + Add commitment
                    </button>
                    <span
                      className={`text-xs ${Math.abs(commitmentRowsTotal - transaction.amount) > 0.01 ? "text-expense" : "text-income"}`}
                    >
                      {formatINR(commitmentRowsTotal)} / {formatINR(transaction.amount)}
                    </span>
                  </div>
                  <button className="btn-secondary w-full" onClick={attachToCommitments} disabled={commitmentBusy}>
                    {commitmentBusy ? "Attaching…" : "Attach"}
                  </button>
                  {commitmentMsg && <p className="text-xs text-income">{commitmentMsg}</p>}
                  {commitmentError && <p className="text-xs text-expense">{commitmentError}</p>}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">This payment covers multiple months</p>
                <p className="text-xs text-muted mb-2">
                  Use this for a lump sum paid once for several months at a time - e.g. a whole financial year's
                  Sukanya contribution in one transfer. Spreads it evenly starting from {txnPeriod}.
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[160px]">
                    <label className="label">Commitment</label>
                    <select
                      className="input"
                      value={bulkCommitmentId}
                      onChange={(e) => setBulkCommitmentId(Number(e.target.value) || "")}
                    >
                      <option value="">Choose commitment…</option>
                      {commitments.map((c) => (
                        <option key={c.commitment_id} value={c.commitment_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Months covered</label>
                    <input
                      className="input w-20"
                      type="number"
                      min={1}
                      value={bulkPeriods}
                      onChange={(e) => setBulkPeriods(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label className="label">Total amount</label>
                    <input className="input w-28" type="number" value={bulkTotal} onChange={(e) => setBulkTotal(Number(e.target.value))} />
                  </div>
                  <button className="btn-secondary" onClick={attachBulkPayment} disabled={bulkBusy}>
                    {bulkBusy ? "Attaching…" : "Attach"}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  Covers {txnPeriod} through {addMonths(txnPeriod, bulkPeriods - 1)} ({formatINR(Number(bulkTotal) / bulkPeriods || 0)}/month).
                </p>
                {bulkMsg && <p className="text-xs text-income">{bulkMsg}</p>}
                {bulkError && <p className="text-xs text-expense">{bulkError}</p>}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-expense mt-3">{error}</p>}

        <button className="btn-primary w-full mt-5" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
