import { useEffect, useMemo, useState } from "react";
import { api, Category } from "../api/client";
import Icon from "../components/Icon";
import { EmptyState, PageHeader, SkeletonRows } from "../components/UI";

export default function Categories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setCategories(await api.get<Category[]>("/categories"));
    } catch {
      setCategories([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) {
      setError("Enter a category name.");
      return;
    }
    setError(null);
    try {
      await api.post("/categories", { name: name.trim(), parent_id: parentId || null });
      setName("");
      setParentId("");
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message || "Could not add the category.");
    }
  }

  async function saveRename(id: number) {
    if (!editName.trim()) return;
    await api.patch(`/categories/${id}`, { name: editName.trim() });
    setEditingId(null);
    await load();
  }

  async function remove(category: Category) {
    if (category.is_system) return;
    if (!window.confirm(`Delete category “${category.name}”? This can fail if it is still referenced by transactions.`)) return;
    try {
      await api.del(`/categories/${category.id}`);
      await load();
    } catch (e: any) {
      setError(e.message || "Could not delete this category.");
    }
  }

  const parents = useMemo(() => (categories || []).filter((category) => !category.parent_id), [categories]);
  const childCount = useMemo(() => (categories || []).filter((category) => !!category.parent_id).length, [categories]);

  return (
    <div className="page-stack">
      <PageHeader
        icon="tag"
        title="Categories"
        description="Keep spending buckets simple. Use top-level categories for broad groups and subcategories only when they add value."
        actions={<button className={showForm ? "btn-secondary" : "btn-primary"} onClick={() => { setShowForm((value) => !value); setError(null); }}>{showForm ? "Cancel" : <><Icon name="plus" size={16} /> Add category</>}</button>}
      />

      {showForm && (
        <section className="panel-pad">
          <h2 className="font-semibold">New category</h2>
          <p className="text-xs text-muted mt-1 mb-4">Leave parent empty for a top-level category.</p>
          <div className="form-grid">
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Groceries" autoFocus />
            </div>
            <div>
              <label className="label">Parent</label>
              <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Top-level category</option>
                {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-expense mt-3">{error}</p>}
          <div className="flex justify-end mt-4"><button className="btn-primary" onClick={create}>Add category</button></div>
        </section>
      )}

      {categories === null ? (
        <SkeletonRows count={5} />
      ) : categories.length === 0 ? (
        <EmptyState icon="tag" title="No categories yet" description="Add a few broad buckets first. You can always add subcategories later." action={<button className="btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" size={16} /> Add category</button>} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span>{parents.length} top-level categor{parents.length === 1 ? "y" : "ies"}</span>
            <span>·</span>
            <span>{childCount} subcategor{childCount === 1 ? "y" : "ies"}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {parents.map((parent) => {
              const children = categories.filter((category) => category.parent_id === parent.id);
              return (
                <article key={parent.id} className="card">
                  <CategoryName category={parent} editingId={editingId} editName={editName} setEditingId={setEditingId} setEditName={setEditName} saveRename={saveRename} remove={remove} />
                  <div className="mt-4 pt-3 border-t border-line">
                    {children.length === 0 ? (
                      <p className="text-xs text-muted">No subcategories.</p>
                    ) : (
                      <div className="space-y-1">
                        {children.map((child) => (
                          <div key={child.id} className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-2 py-2 -mx-2 group">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              {editingId === child.id ? (
                                <div className="flex gap-2">
                                  <input className="input-compact" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRename(child.id)} autoFocus />
                                  <button className="btn-icon" onClick={() => saveRename(child.id)}><Icon name="check" size={15} /></button>
                                </div>
                              ) : <p className="text-sm truncate">{child.name}</p>}
                            </div>
                            {editingId !== child.id && (
                              <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                                <button className="btn-icon !w-8 !h-8 text-xs" onClick={() => { setEditingId(child.id); setEditName(child.name); }}>Edit</button>
                                {!child.is_system && <button className="btn-icon !w-8 !h-8 !text-expense" onClick={() => remove(child)}><Icon name="x" size={14} /></button>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {error && !showForm && <div className="notice notice-danger"><div className="notice-body">{error}</div></div>}
    </div>
  );
}

function CategoryName({ category, editingId, editName, setEditingId, setEditName, saveRename, remove }: {
  category: Category;
  editingId: number | null;
  editName: string;
  setEditingId: (id: number | null) => void;
  setEditName: (value: string) => void;
  saveRename: (id: number) => void;
  remove: (category: Category) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 group">
      <div className="min-w-0 flex-1">
        {editingId === category.id ? (
          <div className="flex gap-2">
            <input className="input-compact" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRename(category.id)} autoFocus />
            <button className="btn-icon" onClick={() => saveRename(category.id)}><Icon name="check" size={15} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="tag" size={15} /></span>
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{category.name}</h2>
              {category.is_system && <p className="text-[11px] text-muted mt-0.5">Default category</p>}
            </div>
          </div>
        )}
      </div>
      {editingId !== category.id && (
        <div className="flex gap-1 opacity-70 group-hover:opacity-100">
          <button className="btn-quiet !py-1.5 !px-2 text-xs" onClick={() => { setEditingId(category.id); setEditName(category.name); }}>Rename</button>
          {!category.is_system && <button className="btn-icon !w-8 !h-8 !text-expense" onClick={() => remove(category)} aria-label="Delete category"><Icon name="x" size={14} /></button>}
        </div>
      )}
    </div>
  );
}
