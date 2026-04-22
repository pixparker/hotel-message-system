import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Upload, X } from "lucide-react";
import { api } from "../lib/api.js";
import { useToast } from "./toast.js";

interface PreviewResult {
  total: number;
  validCount: number;
  invalidCount: number;
  invalidRows: Array<{ rowNumber: number; name: string; phone: string; error: string }>;
  duplicatesInFile: string[];
  duplicatesExisting: Array<{ rowNumber: number; phone: string }>;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onImportDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportDone: () => void;
}) {
  const { push } = useToast();
  const [csv, setCsv] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCsv("");
    setPreview(null);
    setLoading(false);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setCsv(text);
    setPreview(null);
  }

  async function runPreview() {
    setLoading(true);
    try {
      const res = await api<PreviewResult>("/api/contacts/import/preview", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setPreview(res);
    } catch (err) {
      push({
        variant: "error",
        title: "Preview failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    setLoading(true);
    try {
      const res = await api<{ inserted: number; skippedExisting: number; skippedInvalid: number }>(
        "/api/contacts/import",
        { method: "POST", body: JSON.stringify({ csv }) },
      );
      push({
        variant: "success",
        title: "Import complete",
        description: `Inserted ${res.inserted}, skipped ${res.skippedExisting + res.skippedInvalid}.`,
      });
      reset();
      onOpenChange(false);
      onImportDone();
    } catch (err) {
      push({
        variant: "error",
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xl bg-white rounded-lg shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Import contacts from CSV</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500 mt-1">
                Columns: <code>name,phone,language,room_number</code>. Max 5000 rows.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {!preview ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                    className="block mt-2 w-full text-sm"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Or paste CSV
                  <textarea
                    className="input mt-2 font-mono text-xs h-40"
                    placeholder="name,phone,language,room_number&#10;Ayşe Yılmaz,+905321112233,tr,204"
                    value={csv}
                    onChange={(e) => setCsv(e.target.value)}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="btn-secondary">Cancel</button>
                </Dialog.Close>
                <button
                  className="btn-primary"
                  disabled={!csv.trim() || loading}
                  onClick={runPreview}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Preview
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="card p-3">
                  <div className="text-2xl font-semibold">{preview.validCount}</div>
                  <div className="text-slate-500">Valid rows</div>
                </div>
                <div className="card p-3">
                  <div className="text-2xl font-semibold text-amber-600">
                    {preview.duplicatesExisting.length}
                  </div>
                  <div className="text-slate-500">Already exist</div>
                </div>
                <div className="card p-3">
                  <div className="text-2xl font-semibold text-red-600">{preview.invalidCount}</div>
                  <div className="text-slate-500">Invalid</div>
                </div>
              </div>

              {preview.invalidRows.length > 0 && (
                <div className="card p-3 bg-red-50 text-red-900 text-xs max-h-40 overflow-y-auto">
                  <div className="font-medium mb-1">Invalid rows:</div>
                  <ul className="space-y-0.5">
                    {preview.invalidRows.slice(0, 20).map((r) => (
                      <li key={r.rowNumber}>
                        Row {r.rowNumber} ({r.name || "—"}, {r.phone || "—"}): {r.error}
                      </li>
                    ))}
                    {preview.invalidRows.length > 20 && (
                      <li>…and {preview.invalidRows.length - 20} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setPreview(null)}>
                  Back
                </button>
                <button
                  className="btn-primary"
                  disabled={loading || preview.validCount === 0}
                  onClick={runImport}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import {preview.validCount - preview.duplicatesExisting.length} contacts
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
