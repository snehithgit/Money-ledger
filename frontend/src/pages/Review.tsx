import { useEffect, useState } from "react";
import { api, ReviewInbox, Transaction } from "../api/client";
import { formatINR } from "../lib/format";
import TransactionEditModal from "../components/TransactionEditModal";
import Icon from "../components/Icon";

const REASON_LABELS: Record<string, string> = {
  no_rule_matched: "No rule matched",
  rule_conflict: "Rule conflict — multiple rules matched",
  rule_flagged: "Flagged by a rule for manual review",
  unclassified: "Unclassified",
};

export default function Review() {
  const [inbox, setInbox] = useState<ReviewInbox | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setInbox(await api.get<ReviewInbox>("/review/inbox"));
  }

  useEffect(() => {
    load();
  }, []);

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
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="flag" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Review Inbox</h1>
        </div>
        <p className="text-sm text-muted">
          {inbox ? `${inbox.total} transaction${inbox.total === 1 ? "" : "s"} need a decision.` : "Loading…"}
        </p>
      </div>

      {inbox?.groups.map((group) => (
        <div key={group.reason}>
          <h2 className="font-semibold mb-2 text-sm text-muted uppercase tracking-wide">
            {REASON_LABELS[group.reason] || group.reason} ({group.count})
          </h2>
          <div className="space-y-2">
            {group.transactions.map((t: any) => (
              <div key={t.id} className="card flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{t.raw_counterparty || t.raw_narration}</p>
                  <p className="text-xs text-muted">
                    {t.date} · {formatINR(t.amount)} · {t.direction}
                  </p>
                  {t.match_explanation && <p className="text-xs text-amber-700 mt-1">{t.match_explanation}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-secondary text-xs" disabled={busyId === t.id} onClick={() => quickAction(t.id, { transaction_type: "transfer", needs_review: false })}>
                    Mark transfer
                  </button>
                  <button className="btn-secondary text-xs" disabled={busyId === t.id} onClick={() => quickAction(t.id, { is_ignored: true, needs_review: false })}>
                    Ignore
                  </button>
                  <button className="btn-primary text-xs" onClick={() => openEdit(t.id)}>
                    Categorize
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {inbox && inbox.total === 0 && (
        <div className="card text-center py-10 text-muted">Nothing needs review right now. 🎉</div>
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
