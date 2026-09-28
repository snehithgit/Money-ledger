import { useEffect, useState } from "react";
import { api, Category, CommitmentStatus, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "./Icon";

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

function periodOf(dateStr: string) {
  return dateStr.slice(0, 7);
}

function addMonths(period: string, n: number) {
  const [year, month] = period.split("-").map(Number);
  const total = month - 1 + n;
  const targetYear = year + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}`;
}

export default function TransactionEditModal({ transaction, onClose, onSaved }: { transaction: Transaction; onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">(transaction.category_id ?? "");
  const [type, setType] = useState(transaction.transaction_type);
  const [notes, setNotes] = useState(transaction.notes || "");
  const [needsReview, setNeedsReview] = useState(transaction.needs_review);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<Split[]>([{ amount: transaction.amount, category_id: transaction.category_id }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    api.get<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
    api.get<CommitmentStatus[]>(`/commitments?period=${txnPeriod}`).then(setCommitments).catch(() => setCommitments([]));
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitTotal = splits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
  const commitmentRowsTotal = commitmentRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  async function attachToCommitments() {
    setCommitmentBusy(true);
    setCommitmentError(null);
    setCommitmentMsg(null);
    try {
      const rows = commitmentRows.filter((row) => row.commitment_id !== "" && Number(row.amount) > 0);
      if (rows.length === 0) throw new Error("Choose at least one commitment and amount.");
      if (commitmentRowsTotal > transaction.amount + 0.005) throw new Error(`Allocated amount cannot exceed ${formatINR(transaction.amount)}.`);
      for (const row of rows) {
        await api.post(`/commitments/${row.commitment_id}/payments`, {
          transaction_id: transaction.id,
          period: txnPeriod,
          allocated_amount: Number(row.amount),
          source_type: "phonepe",
        });
      }
      setCommitmentMsg(`Attached ${formatINR(commitmentRowsTotal)} across ${rows.length} commitment${rows.length === 1 ? "" : "s"}.`);
    } catch (e: any) {
      setCommitmentError(e.message || "Could not attach this payment.");
    } finally {
      setCommitmentBusy(false);
    }
  }

  async function attachBulkPayment() {
    setBulkBusy(true);
    setBulkError(null);
    setBulkMsg(null);
    try {
      if (!bulkCommitmentId) throw new Error("Choose a commitment.");
      if (bulkPeriods < 1) throw new Error("The payment must cover at least one month.");
      if (Number(bulkTotal) > transaction.amount + 0.005) throw new Error(`The allocated total cannot exceed ${formatINR(transaction.amount)}.`);
      await api.post(`/commitments/${bulkCommitmentId}/bulk-payment`, {
        transaction_id: transaction.id,
        start_period: txnPeriod,
        periods: bulkPeriods,
        total_amount: Number(bulkTotal),
        source_type: "phonepe",
      });
      setBulkMsg(`Attached across ${bulkPeriods} months starting ${periodLabel(txnPeriod)}.`);
    } catch (e: any) {
      setBulkError(e.message || "Could not attach the multi-month payment.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (splitMode) {
        if (splits.length < 2) throw new Error("A split needs at least two parts.");
        if (splits.some((split) => Number(split.amount) <= 0)) throw new Error("Every split amount must be greater than zero.");
        if (Math.abs(splitTotal - transaction.amount) > 0.01) throw new Error(`Splits must total ${formatINR(transaction.amount)}. Current total: ${formatINR(splitTotal)}.`);
      }

      await api.patch(`/transactions/${transaction.id}`, {
        category_id: splitMode ? transaction.category_id : categoryId || null,
        transaction_type: type,
        notes: notes.trim() || null,
        needs_review: needsReview,
      });

      if (splitMode) {
        await api.post(`/transactions/${transaction.id}/split`, {
          splits: splits.map((split) => ({ amount: Number(split.amount), category_id: split.category_id || null })),
        });
      }

      if (!splitMode && categoryId && transaction.counterparty_id) {
        const siblings = await api.get<Transaction[]>(`/transactions?counterparty_id=${transaction.counterparty_id}&needs_review=true&limit=500`);
        const others = siblings.filter((sibling) => sibling.id !== transaction.id);
        if (others.length > 0) {
          const payee = transaction.raw_counterparty || "this payee";
          const categoryName = categories.find((category) => category.id === categoryId)?.name ?? "this category";
          if (window.confirm(`Apply “${categoryName}” to ${others.length} other review item${others.length === 1 ? "" : "s"} from ${payee}?`)) {
            await Promise.all(others.map((sibling) => api.patch(`/transactions/${sibling.id}`, { category_id: categoryId, transaction_type: type, needs_review: false })));
          }
        }
      }

      onSaved();
    } catch (e: any) {
      setError(e.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-sheet-wide" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit transaction">
        <div className="modal-header">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Edit transaction</h2>
            <p className="text-xs text-muted mt-0.5 truncate max-w-xl">{transaction.raw_counterparty || transaction.raw_narration || "Transaction"}</p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <div className="modal-body space-y-5">
          <div className="rounded-2xl bg-gray-50 border border-line p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted">Original transaction</p>
              <p className="text-sm font-medium mt-1 line-clamp-2">{transaction.raw_narration}</p>
              <p className="text-xs text-muted mt-1">{friendlyDate(transaction.date)} · {transaction.direction === "credit" ? "Money in" : "Money out"}</p>
            </div>
            <p className={`text-xl font-semibold whitespace-nowrap ${transaction.direction === "credit" ? "text-income" : "text-ink"}`}>{transaction.direction === "credit" ? "+" : "−"}{formatINR(transaction.amount)}</p>
          </div>

          {transaction.match_explanation && (
            <div className="notice notice-info">
              <div>
                <p className="notice-title">Why it was classified this way</p>
                <p className="notice-body">{transaction.match_explanation}</p>
              </div>
            </div>
          )}

          <section>
            <div className="mb-3">
              <h3 className="font-semibold">Classification</h3>
              <p className="text-xs text-muted mt-0.5">Set what this transaction means in your ledger.</p>
            </div>
            <div className="form-grid">
              <div>
                <label className="label">Transaction type</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
                </select>
              </div>
              {!splitMode && (
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Uncategorized</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? "— " : ""}{category.name}</option>)}
                  </select>
                </div>
              )}
              <div className={splitMode ? "sm:col-span-2" : "sm:col-span-2"}>
                <label className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
                <textarea className="input min-h-[72px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context you may need later…" />
              </div>
            </div>

            <label className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-3 py-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Keep in Review Inbox</p>
                <p className="text-xs text-muted mt-0.5">Leave this on if you are not confident the classification is final.</p>
              </div>
              <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
            </label>
          </section>

          <details className="details-card" open={splitMode}>
            <summary>
              <div>
                <span>Split across categories</span>
                <p className="text-xs font-normal text-muted mt-0.5">Use when one transaction contains more than one type of spending.</p>
              </div>
              <span className={`pill ${splitMode ? "bg-accent/10 text-accent" : "bg-gray-100 text-muted"}`}>{splitMode ? "On" : "Optional"}</span>
            </summary>
            <div className="details-body">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={splitMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSplitMode(checked);
                    if (checked && splits.length < 2) {
                      setSplits([{ amount: transaction.amount, category_id: transaction.category_id }, { amount: 0, category_id: null }]);
                    }
                  }}
                />
                Split this transaction
              </label>

              {splitMode && (
                <div className="space-y-2">
                  {splits.map((split, index) => (
                    <div key={index} className="grid grid-cols-[110px_minmax(0,1fr)_36px] gap-2 items-center">
                      <input className="input" type="number" step="0.01" value={split.amount} onChange={(e) => updateSplit(index, { amount: Number(e.target.value) }, splits, setSplits)} />
                      <select className="input" value={split.category_id ?? ""} onChange={(e) => updateSplit(index, { category_id: e.target.value ? Number(e.target.value) : null }, splits, setSplits)}>
                        <option value="">Uncategorized</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <button className="btn-icon" onClick={() => setSplits(splits.filter((_, rowIndex) => rowIndex !== index))} disabled={splits.length <= 2}><Icon name="x" size={15} /></button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button className="btn-quiet !px-2" onClick={() => setSplits([...splits, { amount: 0, category_id: null }])}><Icon name="plus" size={15} /> Add split</button>
                    <span className={`text-xs font-medium ${Math.abs(splitTotal - transaction.amount) > 0.01 ? "text-expense" : "text-income"}`}>{formatINR(splitTotal)} / {formatINR(transaction.amount)}</span>
                  </div>
                </div>
              )}
            </div>
          </details>

          {commitments.length > 0 && (
            <details className="details-card">
              <summary>
                <div>
                  <span>Link to commitments</span>
                  <p className="text-xs font-normal text-muted mt-0.5">For EMIs, loan obligations, savings plans, or a payment covering several commitments.</p>
                </div>
                <span className="pill bg-gray-100 text-muted">Optional</span>
              </summary>
              <div className="details-body space-y-5">
                <div>
                  <h4 className="text-sm font-semibold">Allocate within {periodLabel(txnPeriod)}</h4>
                  <p className="text-xs text-muted mt-1 mb-3">One transaction can fund multiple commitments, but the total allocation cannot exceed the transaction amount.</p>
                  <div className="space-y-2">
                    {commitmentRows.map((row, index) => (
                      <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_36px] gap-2 items-center">
                        <select className="input" value={row.commitment_id} onChange={(e) => updateCommitmentRow(index, { commitment_id: e.target.value ? Number(e.target.value) : "" }, commitmentRows, setCommitmentRows)}>
                          <option value="">Choose commitment…</option>
                          {commitments.map((commitment) => <option key={commitment.commitment_id} value={commitment.commitment_id}>{commitment.name}</option>)}
                        </select>
                        <input className="input" type="number" step="0.01" value={row.amount} onChange={(e) => updateCommitmentRow(index, { amount: Number(e.target.value) }, commitmentRows, setCommitmentRows)} />
                        <button className="btn-icon" onClick={() => setCommitmentRows(commitmentRows.filter((_, rowIndex) => rowIndex !== index))} disabled={commitmentRows.length === 1}><Icon name="x" size={15} /></button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button className="btn-quiet !px-2" onClick={() => setCommitmentRows([...commitmentRows, { commitment_id: "", amount: 0 }])}><Icon name="plus" size={15} /> Add commitment</button>
                      <span className={`text-xs font-medium ${commitmentRowsTotal > transaction.amount + 0.005 ? "text-expense" : "text-muted"}`}>{formatINR(commitmentRowsTotal)} allocated of {formatINR(transaction.amount)}</span>
                    </div>
                    <button className="btn-secondary w-full" onClick={attachToCommitments} disabled={commitmentBusy}>{commitmentBusy ? "Attaching…" : "Attach allocations"}</button>
                    {commitmentMsg && <p className="text-xs text-income">{commitmentMsg}</p>}
                    {commitmentError && <p className="text-xs text-expense">{commitmentError}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-line">
                  <h4 className="text-sm font-semibold">One payment covering several months</h4>
                  <p className="text-xs text-muted mt-1 mb-3">Use this only when one real payment intentionally covers consecutive commitment periods.</p>
                  <div className="form-grid">
                    <div className="sm:col-span-2">
                      <label className="label">Commitment</label>
                      <select className="input" value={bulkCommitmentId} onChange={(e) => setBulkCommitmentId(e.target.value ? Number(e.target.value) : "")}>
                        <option value="">Choose commitment…</option>
                        {commitments.map((commitment) => <option key={commitment.commitment_id} value={commitment.commitment_id}>{commitment.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Months covered</label>
                      <input className="input" type="number" min={1} value={bulkPeriods} onChange={(e) => setBulkPeriods(Math.max(1, Number(e.target.value) || 1))} />
                    </div>
                    <div>
                      <label className="label">Allocated amount</label>
                      <input className="input" type="number" step="0.01" value={bulkTotal} onChange={(e) => setBulkTotal(Number(e.target.value))} />
                    </div>
                  </div>
                  <p className="field-help">Covers {periodLabel(txnPeriod)} through {periodLabel(addMonths(txnPeriod, bulkPeriods - 1))} · {formatINR(Number(bulkTotal) / bulkPeriods || 0)} per month.</p>
                  <button className="btn-secondary w-full mt-3" onClick={attachBulkPayment} disabled={bulkBusy}>{bulkBusy ? "Attaching…" : "Attach multi-month payment"}</button>
                  {bulkMsg && <p className="text-xs text-income mt-2">{bulkMsg}</p>}
                  {bulkError && <p className="text-xs text-expense mt-2">{bulkError}</p>}
                </div>
              </div>
            </details>
          )}

          {error && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary min-w-[140px]" onClick={save} disabled={saving}>{saving ? "Saving…" : <><Icon name="check" size={16} /> Save changes</>}</button>
        </div>
      </div>
    </div>
  );
}

function updateSplit(index: number, patch: Partial<Split>, rows: Split[], setter: (rows: Split[]) => void) {
  const next = [...rows];
  next[index] = { ...next[index], ...patch };
  setter(next);
}

function updateCommitmentRow(index: number, patch: Partial<CommitmentRow>, rows: CommitmentRow[], setter: (rows: CommitmentRow[]) => void) {
  const next = [...rows];
  next[index] = { ...next[index], ...patch };
  setter(next);
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function friendlyDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}
