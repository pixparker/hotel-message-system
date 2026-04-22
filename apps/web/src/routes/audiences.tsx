import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Users,
  Send,
  Pencil,
  Trash2,
  ChevronRight,
  Lock,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { AudienceChip } from "../components/AudienceChip.js";
import {
  useAudiences,
  useCreateAudience,
  type AudienceKind,
} from "../hooks/useAudiences.js";
import { useToast } from "../components/toast.js";
import { cn } from "../lib/cn.js";

export function AudiencesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: audiences = [], isLoading } = useAudiences();

  return (
    <Page
      title="Audiences"
      description="Groups of contacts you can target with campaigns. Mix multiple audiences in a single send."
      actions={
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New audience
        </button>
      }
    >
      {isLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((a) => (
            <div
              key={a.id}
              className="card p-5 flex flex-col gap-3 hover:shadow-lift transition"
            >
              <div className="flex items-start justify-between gap-3">
                <AudienceChip
                  name={a.name}
                  kind={a.kind}
                  isSystem={a.isSystem}
                  size="md"
                />
                {a.isSystem ? (
                  <span
                    className="flex items-center gap-1 text-xs text-slate-400"
                    title="System audience — cannot be renamed or deleted"
                  >
                    <Lock className="h-3 w-3" />
                    system
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">custom</span>
                )}
              </div>

              {a.description && (
                <p className="text-sm text-slate-600 line-clamp-2">
                  {a.description}
                </p>
              )}

              <div className="flex items-end justify-between pt-2">
                <div>
                  <div className="text-3xl font-bold tabular-nums text-slate-900">
                    {a.memberCount}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    members
                  </div>
                </div>
                <Link
                  to={`/audiences/${a.id}`}
                  className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
                >
                  View
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-3">
                <Link
                  to={`/send?audience=${a.id}`}
                  className="btn-ghost flex-1 justify-center text-brand-700 hover:bg-brand-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Link>
                <Link
                  to={`/audiences/${a.id}`}
                  className="btn-ghost flex-1 justify-center text-slate-600 hover:bg-slate-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Manage
                </Link>
                <button
                  className="btn-ghost flex-1 justify-center text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={a.isSystem}
                  title={a.isSystem ? "System audiences cannot be deleted" : "Delete"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setCreateOpen(true)}
            className="card p-5 flex flex-col items-center justify-center gap-2 border-dashed border-2 border-slate-200 bg-surface-50 text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 transition min-h-[220px]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Plus className="h-6 w-6" />
            </div>
            <div className="font-semibold">New audience</div>
            <div className="text-xs text-center">
              Create a custom list of contacts
            </div>
          </button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-surface-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">How audiences work</div>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              A contact can belong to many audiences at the same time. When you
              send a campaign, pick one or more audiences — recipients are
              deduped automatically.
            </p>
          </div>
        </div>
      </div>

      <CreateAudienceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Page>
  );
}

function CreateAudienceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateAudience();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<AudienceKind>("custom");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        name: name.trim(),
        kind,
        description: description.trim() || undefined,
      });
      push({ variant: "success", title: `Audience "${name}" created` });
      setName("");
      setDescription("");
      setKind("custom");
      onOpenChange(false);
    } catch (err) {
      push({
        variant: "error",
        title: "Create failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">
            New audience
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Create a group of contacts you can target together.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="aud-name">Name</label>
              <input
                id="aud-name"
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer 2026 guests"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="aud-desc">
                Description{" "}
                <span className="text-slate-400 font-normal">optional</span>
              </label>
              <textarea
                id="aud-desc"
                className="input mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <div className="label mb-2">Kind</div>
              <div className="flex flex-wrap gap-2">
                {(["custom", "vip", "friends", "hotel_guests"] as const).map(
                  (k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition capitalize",
                        kind === k
                          ? "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200",
                      )}
                    >
                      {k.replace("_", " ")}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={create.isPending}
              >
                {create.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
