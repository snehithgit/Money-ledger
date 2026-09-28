import { useEffect, useMemo, useState } from "react";
import { api, Account } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";
import { EmptyState, MetricCard, PageHeader, SkeletonRows } from "../components/UI";

const ACCOUNT_TYPES = [
  "phonepe_wallet",
  "bank_savings",
  "bank_salary",
  "wife_account",
  "cash",
  "wallet",
  "credit_card",
  "rental",
  "loan",
  "other_bank",
];

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("other_bank");
  const [opening, setOpening] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setAccounts(await api.get<Account[]>("/accounts"));
    } catch {
      setAccounts([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) {
      setError("Give the account a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/accounts", { name: name.trim(), account_type: type, opening_balance: parseFloat(opening) || 0 });
      setName("");
      setOpening("0");
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message || "Could not create the account.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(account: Account) {
    if (!window.confirm(`Archive "${account.name}"? Existing transactions will stay in your history.`)) return;
    await api.del(`/accounts/${account.id}`);
    await load();
  }

  const total = useMemo(() => accounts?.reduce((sum, account) => sum + account.balance, 0) ?? 0, [accounts]);
  const positive = useMemo(() => accounts?.filter((a) => a.balance >= 0).reduce((sum, account) => sum + account.balance, 0) ?? 0, [accounts]);
  const negative = useMemo(() => accounts?.filter((a) => a.balance < 0).reduce((sum, account) => sum + Math.abs(account.balance), 0) ?? 0, [accounts]);

  return (
    <div className="page-stack">
      <PageHeader
        icon="wallet"
        title="Accounts"
        description="The places your money lives. Balances are calculated from opening balance plus transactions."
        actions={<button className={showForm ? "btn-secondary" : "btn-primary"} onClick={() => { setShowForm((value) => !value); setError(null); }}>{showForm ? "Cancel" : <><Icon name="plus" size={16} /> Add account</>}</button>}
      />

      {accounts !== null && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard label="Combined balance" value={formatINR(total)} helper={`${accounts.length} active account${accounts.length === 1 ? "" : "s"}`} icon="wallet" tone="accent" />
          <MetricCard label="Positive balances" value={formatINR(positive)} helper="Cash and available funds" icon="arrow-down-right" tone="income" />
          <MetricCard label="Negative balances" value={formatINR(negative)} helper="Debt / negative account balances" icon="arrow-up-right" tone="expense" />
        </div>
      )}

      {showForm && (
        <section className="panel-pad">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold">New account</h2>
              <p className="text-xs text-muted mt-0.5">Set the opening balance to what the account held before your imported history starts.</p>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <label className="label">Account name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Salary account" autoFocus />
            </div>
            <div>
              <label className="label">Account type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {ACCOUNT_TYPES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Opening balance</label>
              <input className="input" type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
              <p className="field-help">Use a negative value for a debt balance if appropriate.</p>
            </div>
          </div>
          {error && <p className="text-sm text-expense mt-3">{error}</p>}
          <div className="flex justify-end mt-4"><button className="btn-primary" onClick={create} disabled={saving}>{saving ? "Creating…" : "Create account"}</button></div>
        </section>
      )}

      {accounts === null ? (
        <SkeletonRows count={4} />
      ) : accounts.length === 0 ? (
        <EmptyState icon="wallet" title="No accounts yet" description="Add the bank, wallet, cash, or loan accounts that appear in your transactions." action={<button className="btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" size={16} /> Add account</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <article key={account.id} className="card group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-gray-100 text-muted flex items-center justify-center shrink-0"><Icon name="wallet" size={18} /></span>
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{account.name}</h2>
                    <p className="text-xs text-muted mt-0.5">{titleCase(account.account_type)}</p>
                  </div>
                </div>
                <button className="btn-quiet !py-1.5 !px-2 text-xs opacity-70 group-hover:opacity-100" onClick={() => archive(account)}>Archive</button>
              </div>
              <div className="mt-5">
                <p className="text-xs text-muted">Current balance</p>
                <p className={`text-2xl font-semibold tracking-tight mt-1 ${account.balance < 0 ? "text-expense" : "text-ink"}`}>{formatINR(account.balance)}</p>
              </div>
              {(account.institution || account.owner) && (
                <div className="mt-4 pt-3 border-t border-line text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
                  {account.institution && <span>{account.institution}</span>}
                  {account.owner && <span>{account.owner}</span>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
