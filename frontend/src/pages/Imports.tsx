import { useEffect, useRef, useState } from "react";
import { api, ImportBatch } from "../api/client";
import Icon from "../components/Icon";

export default function Imports() {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setImports(await api.get<ImportBatch[]>("/imports"));
  }

  useEffect(() => {
    load();
  }, []);

  async function upload() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.postForm("/imports/phonepe", form);
      if (fileInput.current) fileInput.current.value = "";
      load();
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="icon-chip bg-accent/10 text-accent">
          <Icon name="upload" size={18} />
        </span>
        <h1 className="text-xl font-semibold">Imports</h1>
      </div>

      <div className="card">
        <p className="label">Import a PhonePe statement (CSV)</p>
        <div className="flex gap-2 flex-wrap items-center">
          <input ref={fileInput} type="file" accept=".csv" className="text-sm" />
          <button className="btn-primary" onClick={upload} disabled={uploading}>
            {uploading ? "Importing…" : "Import"}
          </button>
        </div>
        {error && <p className="text-sm text-expense mt-2">{error}</p>}
        <p className="text-xs text-muted mt-2">
          Importing the same statement twice is always safe — duplicate transactions are detected automatically and skipped.
        </p>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>File</th>
              <th>Imported</th>
              <th>Found</th>
              <th>New</th>
              <th>Duplicate</th>
              <th>Needs review</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((b) => (
              <tr key={b.id}>
                <td>{b.filename}</td>
                <td className="text-muted whitespace-nowrap">{new Date(b.imported_at).toLocaleString()}</td>
                <td>{b.transactions_found}</td>
                <td>{b.transactions_new}</td>
                <td>{b.transactions_duplicate}</td>
                <td>{b.transactions_needs_review}</td>
                <td>
                  <span className={`pill ${b.status === "success" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{b.status}</span>
                </td>
              </tr>
            ))}
            {imports.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-8">
                  No imports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
