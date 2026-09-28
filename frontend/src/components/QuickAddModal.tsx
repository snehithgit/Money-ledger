import { useEffect, useState } from "react";
import { api, Account, Category, Transaction } from "../api/client";

const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function QuickAddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [destinationAccountId, setDestinationAccountId] = useState<number | "">("");
  const [counterparty, setCounterparty] = useState("");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Account[]>("/accounts").then(setAccounts).catch(() => {});
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  async function submit() {
    if (!amount || !accountId) {
      setError("Amount and account are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === "transfer") {
        if (!destinationAccountId) throw new Error("Destination account is required for a transfer");
        const pair = await api.post<{source: Transaction; destination: Transaction}>("/transactions/transfer", {
          date, amount: parseFloat(amount), source_account_id: accountId, destination_account_id: destinationAccountId, notes: note || null,
        });
        onCreated(pair.source.id);
      } else {
        const direction = kind === "income" ? "credit" : "debit";
        const txn = await api.post<Transaction>("/transactions", {
          date, amount: parseFloat(amount), direction, account_id: accountId,
          raw_narration: counterparty || note || "Manual entry", raw_counterparty: counterparty,
          transaction_type: kind, category_id: categoryId || null, notes: note || null,
        });
        onCreated(txn.id);
      }
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full md:w-[420px] rounded-t-2xl md:rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Quick Add</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(["expense", "income", "transfer"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 btn ${kind === k ? "bg-ink text-white" : "bg-gray-100 text-ink"}`}
            >
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Amount (₹)</label>
            <input className="input text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className="label">Account</label>
            <select className="input" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          {kind === "transfer" && (
            <div>
              <label className="label">Destination account</label>
              <select className="input" value={destinationAccountId} onChange={(e) => setDestinationAccountId(Number(e.target.value))}>
                <option value="">Select destination…</option>
                {accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {kind !== "transfer" && (
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
            <label className="label">Payee / Person</label>
            <input className="input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Who was this with?" />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-expense mt-3">{error}</p>}

        <button className="btn-primary w-full mt-5" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
