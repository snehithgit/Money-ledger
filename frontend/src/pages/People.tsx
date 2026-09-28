import { useEffect, useMemo, useState } from "react";
import { api, Counterparty } from "../api/client";
import { formatINR } from "../lib/format";
import Icon from "../components/Icon";
import { EmptyState, Notice, PageHeader, SkeletonRows } from "../components/UI";

const RELATIONSHIPS = ["family", "personal_lending", "business", "bank_lender", "friend", "rental", "merchant", "other"];

export default function People() {
  const [people, setPeople] = useState<Counterparty[] | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    try {
      setPeople(await api.get<Counterparty[]>("/counterparties"));
    } catch {
      setPeople([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function setRelationship(id: number, relationship: string) {
    setSavingId(id);
    try {
      await api.patch(`/counterparties/${id}`, { relationship });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function doMerge() {
    if (selected.length !== 2 || !people) return;
    const keep = people.find((person) => person.id === selected[0]);
    const merge = people.find((person) => person.id === selected[1]);
    if (!keep || !merge) return;
    if (!window.confirm(`Merge “${merge.display_name}” into “${keep.display_name}”? The first selected person will be kept.`)) return;
    await api.post("/counterparties/merge", { keep_id: keep.id, merge_id: merge.id });
    setSelected([]);
    setMergeMode(false);
    await load();
  }

  const filtered = useMemo(() => {
    if (!people) return [];
    const q = search.trim().toLowerCase();
    return people
      .filter((person) => !q || person.display_name.toLowerCase().includes(q) || person.aliases.some((alias) => alias.toLowerCase().includes(q)))
      .sort((a, b) => b.transaction_count - a.transaction_count);
  }, [people, search]);

  return (
    <div className="page-stack">
      <PageHeader
        icon="users"
        title="People & payees"
        description="Clean up payee names, set relationships, and merge duplicate identities from statements."
        actions={
          <div className="flex gap-2">
            {mergeMode && selected.length === 2 && <button className="btn-primary" onClick={doMerge}><Icon name="check" size={15} /> Merge selected</button>}
            <button className="btn-secondary" onClick={() => { setMergeMode((value) => !value); setSelected([]); }}>{mergeMode ? "Cancel merge" : "Merge duplicates"}</button>
          </div>
        }
      />

      {mergeMode && (
        <Notice tone="warning" title="Merge mode">
          Select exactly two entries. The <strong>first one you select is kept</strong>; the second is merged into it with aliases and transactions moved across.
        </Notice>
      )}

      <div className="panel-pad">
        <div className="max-w-xl">
          <label className="label">Search people and payees</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={17} /></span>
            <input className="input pl-10" placeholder="Name or spelling variant…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {people && <p className="text-xs text-muted mt-3">Showing {filtered.length} of {people.length} people/payees</p>}
      </div>

      {people === null ? (
        <SkeletonRows count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="users" title={search ? "No matching people" : "No people yet"} description={search ? "Try another spelling or clear the search." : "Payees and people will appear as transactions are imported or added."} />
      ) : (
        <div className="table-wrap table-responsive">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  {mergeMode && <th>Select</th>}
                  <th>Name</th>
                  <th>Aliases</th>
                  <th>Relationship</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => (
                  <tr key={person.id} className={selected.includes(person.id) ? "!bg-indigo-50" : ""}>
                    {mergeMode && (
                      <td data-label="Select">
                        <input
                          type="checkbox"
                          checked={selected.includes(person.id)}
                          disabled={!selected.includes(person.id) && selected.length >= 2}
                          onChange={(e) => setSelected(e.target.checked ? [...selected, person.id] : selected.filter((id) => id !== person.id))}
                        />
                      </td>
                    )}
                    <td data-label="Name">
                      <div className="text-left md:text-left">
                        <p className="font-medium">{person.display_name}</p>
                        <p className="text-xs text-muted mt-0.5">{person.transaction_count} transaction{person.transaction_count === 1 ? "" : "s"}</p>
                      </div>
                    </td>
                    <td data-label="Aliases" className="text-xs text-muted max-w-[280px]">{person.aliases.filter((alias) => alias !== person.display_name).join(", ") || "—"}</td>
                    <td data-label="Relationship">
                      <select className="input-compact min-w-[150px]" value={person.relationship} disabled={savingId === person.id} onChange={(e) => setRelationship(person.id, e.target.value)}>
                        {RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{titleCase(relationship)}</option>)}
                      </select>
                    </td>
                    <td data-label="Paid" className="text-right whitespace-nowrap">{formatINR(person.total_paid)}</td>
                    <td data-label="Received" className="text-right text-income whitespace-nowrap">{formatINR(person.total_received)}</td>
                    <td data-label="Net" className={`text-right font-semibold whitespace-nowrap ${person.net_balance >= 0 ? "text-income" : "text-expense"}`}>{formatINR(person.net_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
