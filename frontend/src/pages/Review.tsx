import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ReviewInbox, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import TransactionEditModal from "../components/TransactionEditModal";
import Icon from "../components/Icon";
import { EmptyState, PageHeader, SectionHeader, SkeletonRows } from "../components/UI";

const REASON_LABELS: Record<string, string> = {
  no_rule_matched: "No rule matched",
  rule_conflict: "Conflicting rules",
  rule_flagged: "Flagged by a rule",
  unclassified: "Unclassified",
};

const REASON_HELP: Record<string, string> = {
  no_rule_matched: "These transactions did not match any automatic rule.",
  rule_conflict: "More than one rule tried to classify the same transaction.",
  rule_flagged: "A rule intentionally sent these here for a human decision.",
  unclassified: "These still need a transaction type or category.",
};

export default function Review() {
  const [inbox, setInbox] = useState<ReviewInbox | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setInbox(await api.get<ReviewInbox>("/review/inbox"));
    } catch (e: any) {
      setError(e.message || "Could not load the review inbox.");
    }
  }

  useEffect(() => { load(); }, []);

  async function openEdit(id: number) {
    setEditing(await api.get<Transaction>(`/transactions/${id}`));
  }

  async function quickAction(id: number, patch: Record<string, unknown>) {
    setBusyId(id);
    try {
      await api.patch(`/transactions/${id}`, patch);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        icon="flag"
        title="Review Inbox"
        description="Only the transactions that need a human decision. Clear this list to keep reports trustworthy."
        actions={inbox && inbox.total > 0 ? <span className="pill bg-amber-100 text-amber-800">{inbox.total} waiting</span> : undefined}
      />

      {error && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}

      {inbox === null ? (
        <SkeletonRows count={5} />
      ) : inbox.total === 0 ? (
        <EmptyState
          icon="check"
          title="Review inbox is clear"
          description="Nothing needs your attention right now. New uncertain transactions will appear here automatically."
          action={<Link to="/transactions" className="btn-secondary">Browse transactions</Link>}
        />
      ) : (
        inbox.groups.map((group) => (
          <section key={group.reason}>
            <SectionHeader
              title={`${REASON_LABELS[group.reason] || group.reason} · ${group.count}`}
              description={REASON_HELP[group.reason] || "Review these transactions before they are included in reports."}
            />
            <div className="space-y-3">
              {group.transactions.map((t: any) => (
                <article key={t.id} className="card">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3 lg:block">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.raw_counterparty || t.raw_narration || "Transaction"}</p>
                          <p className="text-xs text-muted mt-1">{friendlyDate(t.date)} · {t.direction === "credit" ? "Money in" : "Money out"}</p>
                        </div>
                        <p className={`font-semibold whitespace-nowrap lg:hidden ${t.direction === "credit" ? "text-income" : "text-ink"}`}>{t.direction === "credit" ? "+" : "−"}{formatINR(t.amount)}</p>
                      </div>
                      <p className="text-xs text-muted mt-2 line-clamp-2">{t.raw_narration}</p>
                      {t.match_explanation && (
                        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-900">{t.match_explanation}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 lg:pl-4 lg:border-l lg:border-line">
                      <p className={`hidden lg:block text-lg font-semibold whitespace-nowrap ${t.direction === "credit" ? "text-income" : "text-ink"}`}>{t.direction === "credit" ? "+" : "−"}{formatINR(t.amount)}</p>
                      <div className="flex flex-wrap gap-2 ml-auto">
                        <button className="btn-secondary !py-2" disabled={busyId === t.id} onClick={() => quickAction(t.id, { transaction_type: "transfer", needs_review: false })}>Transfer</button>
                        <button className="btn-secondary !py-2" disabled={busyId === t.id} onClick={() => quickAction(t.id, { is_ignored: true, needs_review: false })}>Ignore</button>
                        <button className="btn-primary !py-2" onClick={() => openEdit(t.id)}>Review</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
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
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}
