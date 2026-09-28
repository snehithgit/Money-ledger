import { useEffect, useState } from "react";
import { api, Account, Category, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "./Icon";

const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Kind = "expense" | "income" | "transfer";

export default function QuickAddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<Kind>("expense");
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
    api.get<Account[]>("/accounts").then(setAccounts).catch(() => setAccounts([]));
    api.get<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function changeKind(next: Kind) {
    setKind(next);
    setError(null);
    if (next !== "transfer") setDestinationAccountId("");
  }

  async function submit() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!accountId) {
      setError("Choose the account this money came from or went to.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (kind === "transfer") {
        if (!destinationAccountId) throw new Error("Choose a destination account.");
        if (destinationAccountId === accountId) throw new Error("Source and destination accounts must be different.");
        const pair = await api.post<{ source: Transaction; destination: Transaction }>("/transactions/transfer", {
          date,
          amount: numericAmount,
          source_account_id: accountId,
          destination_account_id: destinationAccountId,
          notes: note || null,
        });
        onCreated(pair.source.id);
      } else {
        const transaction = await api.post<Transaction>("/transactions", {
          date,
          amount: numericAmount,
          direction: kind === "income" ? "credit" : "debit",
          account_id: accountId,
          raw_narration: counterparty || note || "Manual entry",
          raw_counterparty: counterparty,
          transaction_type: kind,
          category_id: categoryId || null,
          notes: note || null,
        });
        onCreated(transaction.id);
      }
    } catch (e: any) {
      setError(e.message || "Could not save this transaction.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add transaction">
        <div className="modal-header">
          <div>
            <h2 className="text-lg font-semibold">Add transaction</h2>
            <p className="text-xs text-muted mt-0.5">Record something that is not coming from an import.</p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <div className="modal-body space-y-5">
          <div className="segmented" role="group" aria-label="Transaction type">
            {(["expense", "income", "transfer"] as Kind[]).map((item) => (
              <button key={item} type="button" aria-pressed={kind === item} onClick={() => changeKind(item)} className="capitalize">
                {item}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-gray-50 border border-line p-4">
            <label className="label">Amount</label>
            <div className="flex items-baseline gap-2">
              <span className="text-xl text-muted">₹</span>
              <input
                className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-gray-300"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            {Number(amount) > 0 && <p className="text-xs text-muted mt-1">{formatINR(Number(amount))}</p>}
          </div>

          <div className="form-grid">
            <div className={kind === "transfer" ? "" : "sm:col-span-1"}>
              <label className="label">{kind === "transfer" ? "From account" : "Account"}</label>
              <select className="input" value={accountId} onChange={(e) => setAccountId(Number(e.target.value) || "")}>
                <option value="">Select account…</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>

            {kind === "transfer" ? (
              <div>
                <label className="label">To account</label>
                <select className="input" value={destinationAccountId} onChange={(e) => setDestinationAccountId(Number(e.target.value) || "")}>
                  <option value="">Select destination…</option>
                  {accounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Category</label>
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value) || "")}>
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.parent_id ? "— " : ""}{category.name}</option>
                  ))}
                </select>
              </div>
            )}

            {kind !== "transfer" && (
              <div>
                <label className="label">{kind === "income" ? "From whom?" : "Paid to"}</label>
                <input className="input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={kind === "income" ? "Employer, person, business…" : "Shop, person, service…"} />
              </div>
            )}

            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Note <span className="font-normal text-muted">(optional)</span></label>
            <textarea className="input min-h-[82px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything useful to remember later…" />
          </div>

          {error && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary min-w-[120px]" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : <><Icon name="check" size={16} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}
