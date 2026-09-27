import { useEffect, useState } from "react";
import { api, Category, Transaction } from "../api/client";
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

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
  }, []);

  const splitTotal = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/transactions/${transaction.id}`, {
        category_id: categoryId || null,
        transaction_type: type,
        notes: notes || null,
        needs_review: needsReview,
      });
      if (splitMode) {
        if (Math.abs(splitTotal - transaction.amount) > 0.01) {
          throw new Error(`Splits must total ${formatINR(transaction.amount)} (currently ${formatINR(splitTotal)})`);
        }
        await api.post(`/transactions/${transaction.id}/split`, {
          splits: splits.map((s) => ({ amount: Number(s.amount), category_id: s.category_id || null })),
        });
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
        </div>

        {error && <p className="text-sm text-expense mt-3">{error}</p>}

        <button className="btn-primary w-full mt-5" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
