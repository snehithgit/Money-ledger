import { useEffect, useState } from "react";
import { api, Counterparty } from "../api/client";
import { formatINR } from "../lib/format";

const RELATIONSHIPS = ["family", "personal_lending", "business", "bank_lender", "friend", "rental", "merchant", "other"];

export default function People() {
  const [people, setPeople] = useState<Counterparty[]>([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    setPeople(await api.get<Counterparty[]>("/counterparties"));
  }

  useEffect(() => {
    load();
  }, []);

  async function setRelationship(id: number, relationship: string) {
    await api.patch(`/counterparties/${id}`, { relationship });
    load();
  }

  async function doMerge() {
    if (selected.length !== 2) return;
    const [keep, merge] = selected;
    await api.post("/counterparties/merge", { keep_id: keep, merge_id: merge });
    setSelected([]);
    setMergeMode(false);
    load();
  }

  const filtered = people
    .filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()) || p.aliases.some((a) => a.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.transaction_count - a.transaction_count);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">People</h1>
        <div className="flex gap-2">
          {mergeMode && selected.length === 2 && (
            <button className="btn-primary" onClick={doMerge}>
              Merge selected
            </button>
          )}
          <button className="btn-secondary" onClick={() => { setMergeMode((m) => !m); setSelected([]); }}>
            {mergeMode ? "Cancel merge" : "Merge duplicates"}
          </button>
        </div>
      </div>

      <input className="input max-w-xs" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {mergeMode && <p className="text-xs text-muted">Select exactly two people who are actually the same person, then click Merge selected. The second person's aliases and transactions move onto the first.</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {mergeMode && <th></th>}
              <th>Name</th>
              <th>Aliases</th>
              <th>Relationship</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Received</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                {mergeMode && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      disabled={!selected.includes(p.id) && selected.length >= 2}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))}
                    />
                  </td>
                )}
                <td className="font-medium">{p.display_name}</td>
                <td className="text-xs text-muted">{p.aliases.filter((a) => a !== p.display_name).join(", ") || "—"}</td>
                <td>
                  <select className="input py-1" value={p.relationship} onChange={(e) => setRelationship(p.id, e.target.value)}>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-right">{formatINR(p.total_paid)}</td>
                <td className="text-right text-income">{formatINR(p.total_received)}</td>
                <td className={`text-right font-medium ${p.net_balance >= 0 ? "text-income" : "text-expense"}`}>{formatINR(p.net_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
