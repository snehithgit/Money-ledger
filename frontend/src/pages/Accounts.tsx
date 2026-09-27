import { useEffect, useState } from "react";
import { api, Account } from "../api/client";
import { formatINR } from "../lib/format";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("other_bank");
  const [opening, setOpening] = useState("0");

  async function load() {
    setAccounts(await api.get<Account[]>("/accounts"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name) return;
    await api.post("/accounts", { name, account_type: type, opening_balance: parseFloat(opening) || 0 });
    setName("");
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Accounts</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          + Add account
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary Account" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Opening balance</label>
            <input className="input" type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={create}>
            Create
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {accounts.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted capitalize">{a.account_type.replace(/_/g, " ")}</p>
              </div>
              <p className="text-lg font-semibold">{formatINR(a.balance)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
