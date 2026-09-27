import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { api, Rule } from "../api/client";
import Icon from "../components/Icon";

const FIELDS = ["counterparty", "narration", "upi_id", "amount", "direction", "account", "day_of_month", "transaction_type", "bank", "reference"];
const OPERATORS = ["equals", "contains", "range", "greater_than", "less_than"];
const ACTION_TYPES = [
  "set_category",
  "set_subcategory",
  "set_person",
  "set_account",
  "set_transaction_type",
  "attach_commitment",
  "attach_goal",
  "mark_transfer",
  "mark_income",
  "mark_expense",
  "ignore",
  "needs_review",
];

type ConditionRow = { field: string; operator: string; value: string };
type ActionRow = { type: string; value: string };

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<ConditionRow[]>([{ field: "counterparty", operator: "contains", value: "" }]);
  const [actions, setActions] = useState<ActionRow[]>([{ type: "set_transaction_type", value: "expense" }]);
  const [testResult, setTestResult] = useState<{ matched_count: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRules(await api.get<Rule[]>("/rules"));
  }

  useEffect(() => {
    load();
  }, []);

  function parseValue(v: string): string | number | number[] {
    if (v.includes(",")) return v.split(",").map((x) => parseFloat(x.trim()));
    const asNum = Number(v);
    return v.trim() !== "" && !Number.isNaN(asNum) ? asNum : v;
  }

  async function testRule() {
    setTestResult(
      await api.post<{ matched_count: number }>("/rules/test", {
        conditions: conditions.map((c) => ({ ...c, value: parseValue(c.value) })),
        limit: 5,
      })
    );
  }

  async function createRule() {
    setError(null);
    try {
      await api.post("/rules", {
        name,
        conditions: conditions.map((c) => ({ ...c, value: parseValue(c.value) })),
        actions: actions.map((a) => ({ type: a.type, value: a.value ? parseValue(a.value) : null })),
      });
      setName("");
      setShowForm(false);
      setTestResult(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteRule(id: number) {
    await api.del(`/rules/${id}`);
    load();
  }

  async function applyAll() {
    setApplying(true);
    try {
      await api.post("/rules/apply-all");
      load();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-chip bg-accent/10 text-accent">
            <Icon name="sliders" size={18} />
          </span>
          <h1 className="text-xl font-semibold">Rules</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={applyAll} disabled={applying}>
            {applying ? "Applying…" : "Re-apply all rules"}
          </button>
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            + New rule
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div>
            <label className="label">Rule name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amazon purchases" />
          </div>

          <div>
            <p className="label">Conditions (all must match)</p>
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input" value={c.field} onChange={(e) => updateAt(setConditions, i, { field: e.target.value })}>
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select className="input" value={c.operator} onChange={(e) => updateAt(setConditions, i, { operator: e.target.value })}>
                  {OPERATORS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="value" value={c.value} onChange={(e) => updateAt(setConditions, i, { value: e.target.value })} />
                <button className="text-muted hover:text-expense" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="text-sm text-accent" onClick={() => setConditions([...conditions, { field: "counterparty", operator: "contains", value: "" }])}>
              + Add condition
            </button>
          </div>

          <div>
            <p className="label">Actions</p>
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input" value={a.type} onChange={(e) => updateAt(setActions, i, { type: e.target.value })}>
                  {ACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="value (id or text)" value={a.value} onChange={(e) => updateAt(setActions, i, { value: e.target.value })} />
                <button className="text-muted hover:text-expense" onClick={() => setActions(actions.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="text-sm text-accent" onClick={() => setActions([...actions, { type: "set_transaction_type", value: "" }])}>
              + Add action
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-secondary" onClick={testRule}>
              Test against existing transactions
            </button>
            {testResult && <span className="text-sm text-muted">{testResult.matched_count} transaction(s) would match</span>}
          </div>

          {error && <p className="text-sm text-expense">{error}</p>}
          <button className="btn-primary" onClick={createRule}>
            Save rule
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Name</th>
              <th>Matched</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.priority}</td>
                <td>
                  <div className="font-medium">{r.name}</div>
                  {r.description && <div className="text-xs text-muted">{r.description}</div>}
                </td>
                <td>{r.matched_count}</td>
                <td>{r.is_active ? "Yes" : "No"}</td>
                <td className="text-right">
                  <button className="text-expense text-sm" onClick={() => deleteRule(r.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function updateAt<T>(setter: Dispatch<SetStateAction<T[]>>, index: number, patch: Partial<T>) {
  setter((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}
