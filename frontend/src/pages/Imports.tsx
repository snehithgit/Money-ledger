import { DragEvent, useEffect, useRef, useState } from "react";
import { api, ImportBatch } from "../api/client";
import Icon from "../components/Icon";
import { EmptyState, Notice, PageHeader, SkeletonRows } from "../components/UI";

export default function Imports() {
  const [imports, setImports] = useState<ImportBatch[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setImports(await api.get<ImportBatch[]>("/imports"));
    } catch {
      setImports([]);
    }
  }

  useEffect(() => { load(); }, []);

  function chooseFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV PhonePe statement.");
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function upload() {
    if (!selectedFile) {
      setError("Choose a statement first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      await api.postForm("/imports/phonepe", form);
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (e: any) {
      setError(e.message || "Import failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader icon="upload" title="Imports" description="Bring PhonePe statement history into the ledger. Importing the same statement twice is safe." />

      <section className="panel-pad">
        <div
          className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${dragging ? "border-accent bg-accent/5" : "border-line bg-gray-50/60"}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-white border border-line text-accent flex items-center justify-center shadow-sm"><Icon name="file" size={22} /></span>
          <h2 className="font-semibold">PhonePe CSV statement</h2>
          <p className="text-sm text-muted mt-1">Drop the CSV here or choose it from your device.</p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <button className="btn-secondary mt-4" onClick={() => fileInput.current?.click()}>Choose CSV</button>

          {selectedFile && (
            <div className="mt-4 mx-auto max-w-xl rounded-xl border border-line bg-white p-3 flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted">{formatBytes(selectedFile.size)}</p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedFile(null)} aria-label="Remove selected file"><Icon name="x" size={16} /></button>
            </div>
          )}
        </div>

        {error && <div className="notice notice-danger mt-4"><div className="notice-body">{error}</div></div>}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          <p className="text-xs text-muted">Raw statement files are archived; duplicate transactions are detected before insertion.</p>
          <button className="btn-primary sm:min-w-[130px]" onClick={upload} disabled={uploading || !selectedFile}>{uploading ? "Importing…" : <><Icon name="upload" size={16} /> Import</>}</button>
        </div>
      </section>

      {imports === null ? (
        <SkeletonRows count={4} />
      ) : imports.length === 0 ? (
        <EmptyState icon="upload" title="No imports yet" description="Your statement import history will appear here after the first CSV is processed." />
      ) : (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="section-title">Import history</h2>
              <p className="section-description">Newest imports first.</p>
            </div>
            <span className="text-xs text-muted">{imports.length} batch{imports.length === 1 ? "" : "es"}</span>
          </div>
          <div className="table-wrap table-responsive">
            <div className="table-scroll">
              <table className="data">
                <thead><tr><th>File</th><th>Imported</th><th>Found</th><th>New</th><th>Duplicates</th><th>Review</th><th>Status</th></tr></thead>
                <tbody>
                  {imports.map((batch) => (
                    <tr key={batch.id}>
                      <td data-label="Details"><div className="text-left"><p className="font-medium break-all">{batch.filename}</p>{batch.error_message && <p className="text-xs text-expense mt-1 line-clamp-2">{batch.error_message}</p>}</div></td>
                      <td data-label="Imported" className="text-muted whitespace-nowrap">{new Date(batch.imported_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td data-label="Found">{batch.transactions_found}</td>
                      <td data-label="New" className="font-medium">{batch.transactions_new}</td>
                      <td data-label="Duplicates">{batch.transactions_duplicate}</td>
                      <td data-label="Review">{batch.transactions_needs_review}</td>
                      <td data-label="Status"><span className={`pill ${batch.status === "success" ? "bg-green-100 text-green-800" : batch.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{batch.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <Notice tone="info" title="Safe to re-import">
        If you accidentally choose the same statement again, matching transaction fingerprints and references are skipped instead of creating duplicate money.
      </Notice>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
