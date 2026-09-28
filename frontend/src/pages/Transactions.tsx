import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import TransactionEditModal from "../components/TransactionEditModal";
import Icon from "../components/Icon";
import { EmptyState, PageHeader, SkeletonRows } from "../components/UI";

export default function Transactions() {
  const [params] = useSearchParams();
  const highlightedId = Number(params.get("highlight")) || null;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (needsReviewOnly) query.set("needs_review", "true");
    try {
      setTransactions(await api.get<Transaction[]>(`/transactions?${query.toString()}`));
    } catch (e: any) {
      setError(e.message || "Could not load transactions.");
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReviewOnly]);

  useEffect(() => {
    if (!highlightedId || transactions.length === 0) return;
    document.getElementById(`transaction-${highlightedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId, transactions]);

  const totals = useMemo(() => {
    const debit = transactions.filter((t) => t.direction === "debit").reduce((sum, t) => sum + t.amount, 0);
    const credit = transactions.filter((t) => t.direction === "credit").reduce((sum, t) => sum + t.amount, 0);
    return { debit, credit };
  }, [transactions]);

  return (
    <div className="page-stack">
      <PageHeader
        icon="list"
        title="Transactions"
        description="Search, review, and correct every movement of money in one place."
      />

      <div className="panel-pad">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 max-w-2xl">
            <label className="label">Search transactions</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={17} /></span>
              <input
                className="input pl-10 pr-10"
                placeholder="Payee, narration, reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon !w-7 !h-7" onClick={() => { setSearch(""); setTimeout(load, 0); }} aria-label="Clear search">
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={load} disabled={loading}><Icon name="search" size={15} /> {loading ? "Searching…" : "Search"}</button>
            <label className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} />
              Needs review only
            </label>
          </div>
        </div>
        {loadedOnce && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-line text-xs text-muted">
            <span>{transactions.length} result{transactions.length === 1 ? "" : "s"}</span>
            <span>Money out: <strong className="text-ink font-medium">{formatINR(totals.debit)}</strong></span>
            <span>Money in: <strong className="text-income font-medium">{formatINR(totals.credit)}</strong></span>
          </div>
        )}
      </div>

      {error && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}

      {loading && !loadedOnce ? (
        <SkeletonRows count={6} />
      ) : transactions.length === 0 ? (
        <EmptyState icon="search" title="No transactions found" description={search || needsReviewOnly ? "Try a broader search or clear the review-only filter." : "Import a statement or add your first transaction."} />
      ) : (
        <div className="table-wrap table-responsive">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr id={`transaction-${t.id}`} key={t.id} className={highlightedId === t.id ? "!bg-indigo-50" : t.needs_review ? "bg-amber-50/40" : ""}>
                    <td data-label="Date" className="whitespace-nowrap text-muted">{friendlyDate(t.date)}</td>
                    <td data-label="Details">
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[420px]">{t.raw_counterparty || t.raw_narration || "Transaction"}</div>
                        <div className="text-xs text-muted mt-0.5 line-clamp-2 max-w-[520px]">{t.raw_narration}</div>
                        {t.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {t.labels.map((label) => <span key={label} className="pill bg-gray-100 text-muted">#{label}</span>)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td data-label="Type">
                      <div className="flex flex-wrap justify-end md:justify-start gap-1">
                        <span className="pill bg-gray-100 text-ink capitalize">{t.transaction_type.replace(/_/g, " ")}</span>
                        {t.needs_review && <span className="pill bg-amber-100 text-amber-800">review</span>}
                      </div>
                    </td>
                    <td data-label="Amount" className={`text-right font-semibold whitespace-nowrap ${t.direction === "credit" ? "text-income" : "text-ink"}`}>
                      {t.direction === "credit" ? "+" : "−"}{formatINR(t.amount)}
                    </td>
                    <td data-label="Action" className="text-right"><button className="table-action" onClick={() => setEditing(t)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function friendlyDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}
