import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Plus, Pencil, Trash2, Search } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";
import { matchesSearch } from "@hms/shared";
import { useTemplates, useDeleteTemplate } from "../hooks/useTemplates.js";
import { useToast } from "../components/toast.js";

export function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const del = useDeleteTemplate();
  const { push } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data;
    return data.filter((t) => {
      const bodies = t.bodies.map((b) => b.body).join(" ");
      return matchesSearch(
        `${t.name} ${t.description ?? ""} ${bodies}`,
        query,
      );
    });
  }, [data, query]);

  return (
    <Page
      title="Templates"
      description="Reusable message bodies in every language."
      actions={
        <Link to="/templates/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          New template
        </Link>
      }
    >
      {data && data.length > 0 && (
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="input !pl-9"
            aria-label="Search templates"
          />
        </div>
      )}

      {isLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create your first template to reuse common messages across languages."
          action={
            <Link to="/templates/new" className="btn-primary">
              <Plus className="h-4 w-4" /> New template
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={`Nothing matches "${query}".`}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => (
            <div key={t.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  {t.description && (
                    <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                      {t.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Link
                    to={`/templates/${t.id}`}
                    className="btn-ghost !p-2"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    className="btn-ghost !p-2 text-rose-600 hover:bg-rose-50"
                    aria-label="Delete"
                    onClick={() => setConfirmId(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.bodies.map((b) => (
                  <span
                    key={b.language}
                    className="badge bg-slate-100 text-slate-700 uppercase"
                  >
                    {b.language}
                  </span>
                ))}
              </div>
              {t.bodies[0] && (
                <p className="mt-3 text-sm text-slate-600 line-clamp-3">
                  {t.bodies[0].body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 card p-6">
            <Dialog.Title className="text-lg font-semibold">Delete template?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              This can't be undone. Existing campaigns keep their copies.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmId(null)}>
                Cancel
              </button>
              <button
                className="btn-primary bg-rose-600 hover:bg-rose-700"
                onClick={async () => {
                  const id = confirmId!;
                  setConfirmId(null);
                  try {
                    await del.mutateAsync(id);
                    push({ variant: "success", title: "Template deleted" });
                  } catch {
                    push({ variant: "error", title: "Could not delete" });
                  }
                }}
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Page>
  );
}
