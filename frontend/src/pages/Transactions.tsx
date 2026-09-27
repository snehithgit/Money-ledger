import { useEffect, useState } from "react";
import { api, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import TransactionEditModal from "../components/TransactionEditModal";
import Icon from "../components/Icon";

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (needsReviewOnly) params.set("needs_review", "true");
    try {
      const data = await api.get<Transaction[]>(`/transactions?${params.toString()}`);
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReviewOnly]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="list" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Transactions</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input max-w-xs"
          placeholder="Search narration or payee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button className="btn-secondary" onClick={load}>
          Search
        </button>
        <label className="flex items-center gap-2 text-sm text-muted ml-2">
          <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} />
          Needs review only
        </label>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Details</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={t.needs_review ? "bg-amber-50/50" : ""}>
                <td className="whitespace-nowrap text-muted">{t.date}</td>
                <td>
                  <div className="font-medium">{t.raw_counterparty || t.raw_narration}</div>
                  <div className="text-xs text-muted">{t.raw_narration}</div>
                  {t.labels.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {t.labels.map((l) => (
                        <span key={l} className="pill bg-gray-100 text-muted">
                          #{l}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span className="pill bg-gray-100 text-ink capitalize">{t.transaction_type.replace(/_/g, " ")}</span>
                  {t.needs_review && <span className="pill bg-amber-100 text-amber-800 ml-1">review</span>}
                </td>
                <td className={`text-right font-medium whitespace-nowrap ${t.direction === "credit" ? "text-income" : "text-ink"}`}>
                  {t.direction === "credit" ? "+" : "−"}
                  {formatINR(t.amount)}
                </td>
                <td className="text-right">
                  <button className="text-accent text-sm" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TransactionEditModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
