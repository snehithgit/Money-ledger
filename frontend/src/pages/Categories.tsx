import { useEffect, useState } from "react";
import { api, Category } from "../api/client";
import Icon from "../components/Icon";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  async function load() {
    setCategories(await api.get<Category[]>("/categories"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name) return;
    await api.post("/categories", { name, parent_id: parentId || null });
    setName("");
    load();
  }

  const parents = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="icon-chip bg-accent/10 text-accent">
          <Icon name="tag" size={18} />
        </span>
        <h1 className="text-xl font-semibold">Categories</h1>
      </div>

      <div className="card flex gap-2 flex-wrap items-end">
        <div>
          <label className="label">New category name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Parent (optional)</label>
          <select className="input" value={parentId} onChange={(e) => setParentId(Number(e.target.value))}>
            <option value="">Top-level</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={create}>
          Add
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {parents.map((p) => (
          <div key={p.id} className="card">
            <p className="font-medium mb-2">{p.name}</p>
            <ul className="text-sm text-muted space-y-1">
              {categories
                .filter((c) => c.parent_id === p.id)
                .map((c) => (
                  <li key={c.id}>— {c.name}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
