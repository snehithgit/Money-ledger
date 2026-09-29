import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Account, api, Category, CommitmentStatus, Counterparty, GoalProgress, Label, Rule } from "../api/client";
import Icon from "../components/Icon";
import { EmptyState, Notice, PageHeader, SectionHeader, SkeletonRows } from "../components/UI";

const FIELDS = ["counterparty", "narration", "upi_id", "amount", "direction", "account", "day_of_month", "transaction_type", "bank", "reference"];
const ACTION_TYPES = [
  "set_category",
  "set_subcategory",
  "set_label",
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
const TRANSACTION_TYPES = ["income", "expense", "transfer", "loan_payment", "emi", "savings", "investment", "family_contribution", "refund", "cash_withdrawal", "cash_deposit", "internal_transfer", "unknown_needs_review"];
const NO_VALUE_ACTIONS = new Set(["mark_transfer", "mark_income", "mark_expense", "ignore", "needs_review"]);

type ConditionRow = { field: string; operator: string; value: string };
type ActionRow = { type: string; value: string };
type RuleResources = { accounts: Account[]; categories: Category[]; people: Counterparty[]; commitments: CommitmentStatus[]; goals: GoalProgress[]; labels: Label[] };

const EMPTY_RESOURCES: RuleResources = { accounts: [], categories: [], people: [], commitments: [], goals: [], labels: [] };

export default function Rules() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [resources, setResources] = useState<RuleResources>(EMPTY_RESOURCES);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(30);
  const [conditions, setConditions] = useState<ConditionRow[]>([{ field: "counterparty", operator: "contains", value: "" }]);
  const [actions, setActions] = useState<ActionRow[]>([{ type: "set_transaction_type", value: "expense" }]);
  const [testResult, setTestResult] = useState<{ matched_count: number; explanation?: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ruleSearch, setRuleSearch] = useState("");

  async function load() {
    const [ruleRows, accounts, categories, people, commitments, goals, labels] = await Promise.all([
      api.get<Rule[]>("/rules"),
      api.get<Account[]>("/accounts").catch(() => []),
      api.get<Category[]>("/categories").catch(() => []),
      api.get<Counterparty[]>("/counterparties").catch(() => []),
      api.get<CommitmentStatus[]>("/commitments").catch(() => []),
      api.get<GoalProgress[]>("/goals").catch(() => []),
      api.get<Label[]>("/labels").catch(() => []),
    ]);
    setRules(ruleRows);
    setResources({ accounts, categories, people, commitments, goals, labels });
  }

  useEffect(() => { load().catch(() => setRules([])); }, []);

  function parseConditionValue(condition: ConditionRow): string | number | number[] {
    if (condition.operator === "range") return condition.value.split(",").map((part) => Number(part.trim()));
    if (["amount", "day_of_month", "account"].includes(condition.field)) return Number(condition.value);
    return condition.value;
  }

  function parseActionValue(action: ActionRow): string | number | null {
    if (NO_VALUE_ACTIONS.has(action.type)) return null;
    if (["set_category", "set_subcategory", "set_label", "set_person", "set_account", "attach_commitment", "attach_goal"].includes(action.type)) {
      return Number(action.value);
    }
    return action.value;
  }

  function validateRows(): string | null {
    for (const condition of conditions) {
      if (!condition.value.trim()) return `Enter a value for ${titleCase(condition.field)}.`;
      if (condition.operator === "range") {
        const parts = condition.value.split(",").map((part) => part.trim());
        if (parts.length !== 2 || parts.some((part) => part === "" || Number.isNaN(Number(part)))) return "Range conditions need two numbers, for example: 1000, 5000.";
      }
      if (["amount", "day_of_month", "account"].includes(condition.field) && condition.operator !== "range" && Number.isNaN(Number(condition.value))) return `${titleCase(condition.field)} needs a numeric value.`;
    }
    for (const action of actions) {
      if (!NO_VALUE_ACTIONS.has(action.type) && !action.value.trim()) return `Choose a value for ${actionLabel(action.type)}.`;
    }
    return null;
  }

  async function testRule() {
    setError(null);
    const validationError = validateRows();
    if (validationError) { setError(validationError); return; }
    try {
      setTestResult(await api.post<{ matched_count: number; explanation?: string }>("/rules/test", {
        conditions: conditions.map((condition) => ({ ...condition, value: parseConditionValue(condition) })),
        limit: 5,
      }));
    } catch (e: any) {
      setError(e.message || "Could not test this rule.");
    }
  }

  async function createRule() {
    if (!name.trim()) {
      setError("Give the rule a clear name.");
      return;
    }
    const validationError = validateRows();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post("/rules", {
        name: name.trim(),
        description: description.trim() || null,
        priority,
        conditions: conditions.map((condition) => ({ ...condition, value: parseConditionValue(condition) })),
        actions: actions.map((action) => ({ type: action.type, value: parseActionValue(action) })),
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message || "Could not save the rule.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: Rule) {
    await api.patch(`/rules/${rule.id}`, { is_active: !rule.is_active });
    await load();
  }

  async function deleteRule(rule: Rule) {
    if (!window.confirm(`Delete rule “${rule.name}”? Existing transaction records are preserved.`)) return;
    await api.del(`/rules/${rule.id}`);
    await load();
  }

  async function applyAll() {
    if (!window.confirm("Re-run active rules against existing non-ignored transactions? Manual classifications are preserved.")) return;
    setApplying(true);
    try {
      await api.post("/rules/apply-all");
      await load();
    } finally {
      setApplying(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setPriority(30);
    setConditions([{ field: "counterparty", operator: "contains", value: "" }]);
    setActions([{ type: "set_transaction_type", value: "expense" }]);
    setTestResult(null);
    setError(null);
  }

  const activeCount = useMemo(() => rules?.filter((rule) => rule.is_active).length || 0, [rules]);
  const filteredRules = useMemo(() => {
    const q = ruleSearch.trim().toLowerCase();
    if (!rules || !q) return rules || [];
    return rules.filter((rule) => `${rule.name} ${rule.description || ""}`.toLowerCase().includes(q));
  }, [rules, ruleSearch]);

  return (
    <div className="page-stack">
      <PageHeader
        icon="sliders"
        title="Rules"
        description="Automate repetitive classifications. Keep rules narrow, readable, and easy to test."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={applyAll} disabled={applying}>{applying ? "Applying…" : "Re-apply rules"}</button>
            <button className={showForm ? "btn-secondary" : "btn-primary"} onClick={() => { setShowForm((value) => !value); setError(null); }}>{showForm ? "Close builder" : <><Icon name="plus" size={16} /> New rule</>}</button>
          </div>
        }
      />

      {rules && rules.length > 0 && (
        <Notice tone="info" title={`${activeCount} active rule${activeCount === 1 ? "" : "s"}`}>
          The lowest matching priority number wins. Same-priority matches are combined only when their actions agree; competing actions go to Review. Manual classifications are never overwritten when rules are re-applied.
        </Notice>
      )}

      {showForm && (
        <section className="panel-pad space-y-5">
          <div>
            <h2 className="font-semibold text-lg">Build a rule</h2>
            <p className="text-sm text-muted mt-1">All conditions must match. Then every listed action is applied.</p>
          </div>

          <div className="form-grid">
            <div>
              <label className="label">Rule name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amazon purchases" autoFocus />
            </div>
            <div>
              <label className="label">Priority</label>
              <input className="input" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 30)} />
              <p className="field-help">Smaller numbers win. Use a lower number for specific exceptions and a higher number for broad merchant rules.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description <span className="font-normal text-muted">(optional)</span></label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Classify Amazon merchant payments as shopping expenses." />
            </div>
          </div>

          <div>
            <SectionHeader title="When all of these match" description="Keep the conditions specific enough to avoid false matches." />
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="soft-card">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-end">
                    <div>
                      <label className="label">Field</label>
                      <select className="input" value={condition.field} onChange={(e) => changeConditionField(index, e.target.value, setConditions)}>
                        {FIELDS.map((field) => <option key={field} value={field}>{titleCase(field)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Match</label>
                      <select className="input" value={condition.operator} onChange={(e) => updateAt(setConditions, index, { operator: e.target.value })}>
                        {operatorsFor(condition.field).map((operator) => <option key={operator} value={operator}>{operatorLabel(operator)}</option>)}
                      </select>
                    </div>
                    <ConditionValue condition={condition} onChange={(value) => updateAt(setConditions, index, { value })} resources={resources} />
                    <button className="btn-icon md:mb-0.5" onClick={() => setConditions(conditions.filter((_, rowIndex) => rowIndex !== index))} disabled={conditions.length === 1} aria-label="Remove condition"><Icon name="x" size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-quiet mt-2 !px-2" onClick={() => setConditions([...conditions, { field: "counterparty", operator: "contains", value: "" }])}><Icon name="plus" size={15} /> Add condition</button>
          </div>

          <div>
            <SectionHeader title="Then do these actions" description="Use the selectors below instead of memorizing database IDs." />
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div key={index} className="soft-card">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto] gap-2 items-end">
                    <div>
                      <label className="label">Action</label>
                      <select className="input" value={action.type} onChange={(e) => updateAt(setActions, index, { type: e.target.value, value: defaultActionValue(e.target.value) })}>
                        {ACTION_TYPES.map((type) => <option key={type} value={type}>{actionLabel(type)}</option>)}
                      </select>
                    </div>
                    <ActionValue action={action} onChange={(value) => updateAt(setActions, index, { value })} resources={resources} />
                    <button className="btn-icon md:mb-0.5" onClick={() => setActions(actions.filter((_, rowIndex) => rowIndex !== index))} disabled={actions.length === 1} aria-label="Remove action"><Icon name="x" size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-quiet mt-2 !px-2" onClick={() => setActions([...actions, { type: "set_transaction_type", value: "expense" }])}><Icon name="plus" size={15} /> Add action</button>
          </div>

          {testResult && (
            <Notice tone={testResult.matched_count > 0 ? "success" : "warning"} title={`${testResult.matched_count} existing transaction${testResult.matched_count === 1 ? "" : "s"} match`}>
              {testResult.explanation || "The test completed successfully."}
            </Notice>
          )}
          {error && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-line">
            <button className="btn-secondary" onClick={testRule}>Test rule</button>
            <button className="btn-primary" onClick={createRule} disabled={saving}>{saving ? "Saving…" : "Save rule"}</button>
          </div>
        </section>
      )}

      {rules && rules.length > 0 && (
        <div className="panel-pad">
          <label className="label">Find a rule</label>
          <div className="relative max-w-xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
            <input className="input pl-9" value={ruleSearch} onChange={(e) => setRuleSearch(e.target.value)} placeholder="Search merchant, category, or description…" />
          </div>
          <p className="field-help mt-1">Showing {filteredRules.length} of {rules.length} rules.</p>
        </div>
      )}

      {rules === null ? (
        <SkeletonRows count={5} />
      ) : rules.length === 0 ? (
        <EmptyState icon="sliders" title="No rules yet" description="Create a rule for recurring merchants, transfers, EMIs, or known people to reduce manual review." action={<button className="btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" size={16} /> New rule</button>} />
      ) : (
        <div className="table-wrap table-responsive">
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Priority</th><th>Rule</th><th>Matched</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td data-label="Priority" className="font-medium">{rule.priority}</td>
                    <td data-label="Details">
                      <div className="text-left">
                        <p className="font-medium">{rule.name}</p>
                        {rule.description && <p className="text-xs text-muted mt-1 line-clamp-2">{rule.description}</p>}
                        <p className="text-xs text-muted mt-1">{rule.conditions.length} condition{rule.conditions.length === 1 ? "" : "s"} · {rule.actions.length} action{rule.actions.length === 1 ? "" : "s"}</p>
                      </div>
                    </td>
                    <td data-label="Matched">{rule.matched_count}</td>
                    <td data-label="Status"><span className={`pill ${rule.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-muted"}`}>{rule.is_active ? "Active" : "Paused"}</span></td>
                    <td data-label="Actions" className="text-right">
                      <div className="flex justify-end gap-2">
                        <button className="table-action" onClick={() => toggleRule(rule)}>{rule.is_active ? "Pause" : "Enable"}</button>
                        <button className="text-sm font-medium text-expense" onClick={() => deleteRule(rule)}>Delete</button>
                      </div>
                    </td>
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

function ConditionValue({ condition, onChange, resources }: { condition: ConditionRow; onChange: (value: string) => void; resources: RuleResources }) {
  if (condition.field === "account") {
    return <SelectField label="Value" value={condition.value} onChange={onChange} options={resources.accounts.map((item) => [String(item.id), item.name])} placeholder="Choose account…" />;
  }
  if (condition.field === "direction") {
    return <SelectField label="Value" value={condition.value} onChange={onChange} options={[["debit", "Money out (debit)"], ["credit", "Money in (credit)"]]} placeholder="Choose direction…" />;
  }
  if (condition.field === "transaction_type") {
    return <SelectField label="Value" value={condition.value} onChange={onChange} options={TRANSACTION_TYPES.map((item) => [item, titleCase(item)])} placeholder="Choose type…" />;
  }
  return (
    <div>
      <label className="label">Value</label>
      <input className="input" value={condition.value} onChange={(e) => onChange(e.target.value)} placeholder={condition.operator === "range" ? "e.g. 1000, 5000" : condition.field === "amount" ? "e.g. 18000" : "Match value"} />
      {condition.operator === "range" && <p className="field-help">Enter minimum and maximum separated by a comma.</p>}
    </div>
  );
}

function ActionValue({ action, onChange, resources }: { action: ActionRow; onChange: (value: string) => void; resources: RuleResources }) {
  if (NO_VALUE_ACTIONS.has(action.type)) return <div><label className="label">Value</label><div className="input bg-gray-50 text-muted">No value needed</div></div>;
  if (action.type === "set_category" || action.type === "set_subcategory") return <SelectField label="Value" value={action.value} onChange={onChange} options={resources.categories.map((item) => [String(item.id), item.name])} placeholder="Choose category…" />;
  if (action.type === "set_label") return <SelectField label="Value" value={action.value} onChange={onChange} options={resources.labels.map((item) => [String(item.id), item.name])} placeholder="Choose label…" />;
  if (action.type === "set_person") return <SelectField label="Value" value={action.value} onChange={onChange} options={resources.people.map((item) => [String(item.id), item.display_name])} placeholder="Choose person/payee…" />;
  if (action.type === "set_account") return <SelectField label="Value" value={action.value} onChange={onChange} options={resources.accounts.map((item) => [String(item.id), item.name])} placeholder="Choose account…" />;
  if (action.type === "set_transaction_type") return <SelectField label="Value" value={action.value} onChange={onChange} options={TRANSACTION_TYPES.map((item) => [item, titleCase(item)])} placeholder="Choose type…" />;
  if (action.type === "attach_commitment") return <SelectField label="Value" value={action.value} onChange={onChange} options={resources.commitments.map((item) => [String(item.commitment_id), item.name])} placeholder="Choose commitment…" />;
  if (action.type === "attach_goal") return <SelectField label="Value" value={action.value} onChange={onChange} options={resources.goals.map((item) => [String(item.goal_id), item.name])} placeholder="Choose goal…" />;
  return <div><label className="label">Value</label><input className="input" value={action.value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; placeholder: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  );
}

function operatorsFor(field: string) {
  if (["amount", "day_of_month"].includes(field)) return ["equals", "range", "greater_than", "less_than"];
  if (["direction", "account", "transaction_type"].includes(field)) return ["equals"];
  return ["contains", "word_contains", "equals"];
}

function changeConditionField(index: number, field: string, setter: Dispatch<SetStateAction<ConditionRow[]>>) {
  const operator = operatorsFor(field)[0];
  setter((prev) => prev.map((item, rowIndex) => rowIndex === index ? { field, operator, value: "" } : item));
}

function updateAt<T>(setter: Dispatch<SetStateAction<T[]>>, index: number, patch: Partial<T>) {
  setter((prev) => prev.map((item, rowIndex) => rowIndex === index ? { ...item, ...patch } : item));
}

function defaultActionValue(type: string) {
  if (type === "set_transaction_type") return "expense";
  return "";
}

function operatorLabel(value: string) {
  const labels: Record<string, string> = { equals: "Equals", contains: "Contains text", word_contains: "Contains whole word", range: "Between", greater_than: "Greater than", less_than: "Less than" };
  return labels[value] || titleCase(value);
}

function actionLabel(value: string) {
  const labels: Record<string, string> = {
    set_category: "Set category",
    set_subcategory: "Set subcategory",
    set_label: "Add label",
    set_person: "Set person / payee",
    set_account: "Set account",
    set_transaction_type: "Set transaction type",
    attach_commitment: "Attach to commitment",
    attach_goal: "Attach to goal",
    mark_transfer: "Mark as transfer",
    mark_income: "Mark as income",
    mark_expense: "Mark as expense",
    ignore: "Ignore transaction",
    needs_review: "Send to review inbox",
  };
  return labels[value] || titleCase(value);
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
