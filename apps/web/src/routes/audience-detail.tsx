import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  UserPlus,
  X,
  Search,
  Lock,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { LANGUAGE_LABELS, formatPhoneDisplay, matchesSearch } from "@hms/shared";
import {
  useAudience,
  useAudienceMembers,
  useAddToAudience,
  useRemoveFromAudience,
  useDeleteAudience,
  useUpdateAudience,
} from "../hooks/useAudiences.js";
import { useContacts, type Contact } from "../hooks/useContacts.js";
import { AudienceChip } from "../components/AudienceChip.js";
import { SourceBadge } from "../components/SourceBadge.js";
import { EditContactDialog } from "../components/EditContactDialog.js";
import { useToast } from "../components/toast.js";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/cn.js";

export function AudienceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const navigate = useNavigate();
  const { push } = useToast();

  const { data: audience, isLoading } = useAudience(id);
  const { data: members = [], isLoading: membersLoading } = useAudienceMembers(id);
  const { data: allContacts = [] } = useContacts();
  const remove = useRemoveFromAudience();
  const deleteMut = useDeleteAudience();

  // Map of full Contact records (with audience/tag memberships) keyed by id so
  // the edit dialog can be pre-seeded without a second fetch.
  const contactById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of allContacts) m.set(c.id, c);
    return m;
  }, [allContacts]);

  const visibleMembers = useMemo(() => {
    if (!query.trim()) return members;
    return members.filter((m) =>
      matchesSearch(`${m.name} ${m.phoneE164} ${m.language}`, query),
    );
  }, [members, query]);

  if (!id) return <Navigate to="/audiences" replace />;
  if (isLoading)
    return (
      <Page title="Loading…" description="">
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      </Page>
    );
  if (!audience) return <Navigate to="/audiences" replace />;

  async function handleDelete() {
    if (!audience || !id) return;
    if (!confirm(`Delete audience "${audience.name}"? Members stay as contacts.`))
      return;
    try {
      await deleteMut.mutateAsync(id);
      push({ variant: "success", title: "Audience deleted" });
      navigate("/audiences");
    } catch (err) {
      push({
        variant: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleRemove(contactId: string) {
    if (!id) return;
    try {
      await remove.mutateAsync({ audienceId: id, contactIds: [contactId] });
    } catch (err) {
      push({
        variant: "error",
        title: "Remove failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Page
      eyebrow="Audiences"
      title={audience.name}
      description={audience.description ?? undefined}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/audiences" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <button className="btn-secondary" onClick={() => setPickerOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add contacts
          </button>
          <Link to={`/send?audience=${audience.id}`} className="btn-primary">
            <Send className="h-4 w-4" />
            Send to this audience
          </Link>
        </div>
      }
    >
      <div className="mb-6 card p-5 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <AudienceChip
            name={audience.name}
            kind={audience.kind}
            isSystem={audience.isSystem}
            size="md"
          />
          {audience.isSystem && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Lock className="h-3 w-3" />
              System audience
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <div className="text-3xl font-bold tabular-nums text-slate-900">
              {audience.memberCount}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              members
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-600">
              Created{" "}
              {new Date(audience.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn-ghost text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={audience.isSystem}
            title={audience.isSystem ? "System audiences cannot be renamed" : "Rename"}
            onClick={() => setRenameOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Rename
          </button>
          <button
            className="btn-ghost text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={audience.isSystem || deleteMut.isPending}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {membersLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <div className="text-base font-semibold text-slate-900">
            No members yet
          </div>
          <p className="max-w-md text-sm text-slate-500">
            Add contacts to this audience so you can target them with campaigns.
          </p>
          <button
            className="btn-primary mt-2"
            onClick={() => setPickerOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add contacts
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members by name, phone, or language…"
                className="input !pl-9"
                aria-label="Search audience members"
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Language</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No members match "{query}".
                      </td>
                    </tr>
                  ) : (
                    visibleMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {m.name}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {formatPhoneDisplay(m.phoneE164)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge bg-slate-100 text-slate-700">
                            {LANGUAGE_LABELS[
                              m.language as keyof typeof LANGUAGE_LABELS
                            ] ?? m.language}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <SourceBadge source={m.source} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="btn-ghost text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                              onClick={() => {
                                const full = contactById.get(m.id);
                                if (full) setEditContact(full);
                              }}
                              disabled={!contactById.has(m.id)}
                              title="Edit contact"
                              aria-label="Edit contact"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              className="btn-ghost text-rose-600 hover:bg-rose-50"
                              disabled={remove.isPending}
                              onClick={() => handleRemove(m.id)}
                              title="Remove from audience"
                            >
                              <X className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
              {query.trim()
                ? `${visibleMembers.length} of ${members.length} member${members.length === 1 ? "" : "s"}`
                : `${members.length} member${members.length === 1 ? "" : "s"}`}
            </div>
          </div>
        </>
      )}

      <AddMembersDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        audienceId={audience.id}
        audienceName={audience.name}
      />
      <RenameAudienceDialog
        open={renameOpen && !audience.isSystem}
        onOpenChange={setRenameOpen}
        audienceId={audience.id}
        initialName={audience.name}
        initialDescription={audience.description ?? ""}
      />
      <EditContactDialog
        contact={editContact}
        open={!!editContact}
        onOpenChange={(o) => !o && setEditContact(null)}
      />
    </Page>
  );
}

function AddMembersDialog({
  open,
  onOpenChange,
  audienceId,
  audienceName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audienceId: string;
  audienceName: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: allContacts = [] } = useContacts();
  const add = useAddToAudience();
  const { push } = useToast();

  const candidates = useMemo(() => {
    return allContacts
      .filter(
        (c) => c.isActive && !c.audienceIds.includes(audienceId),
      )
      .filter((c) =>
        query.trim()
          ? matchesSearch(`${c.name} ${c.phoneE164} ${c.language}`, query)
          : true,
      );
  }, [query, audienceId, allContacts]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (selectedIds.length === 0) return;
    try {
      await add.mutateAsync({ audienceId, contactIds: selectedIds });
      push({
        variant: "success",
        title: `Added ${selectedIds.length} contact${
          selectedIds.length === 1 ? "" : "s"
        }`,
      });
      setSelectedIds([]);
      setQuery("");
      onOpenChange(false);
    } catch (err) {
      push({
        variant: "error",
        title: "Add failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-2xl max-h-[85vh] flex flex-col -translate-x-1/2 -translate-y-1/2 card p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <Dialog.Title className="text-lg font-semibold">
              Add contacts to {audienceName}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              Pick one or more contacts to add to this audience.
            </Dialog.Description>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts…"
                className="input !pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {candidates.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No contacts available to add.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {candidates.map((c) => {
                  const on = selectedIds.includes(c.id);
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 cursor-pointer",
                        on ? "bg-brand-50/60" : "hover:bg-slate-50",
                      )}
                      onClick={() => toggle(c.id)}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        readOnly
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {formatPhoneDisplay(c.phoneE164)} ·{" "}
                          {LANGUAGE_LABELS[
                            c.language as keyof typeof LANGUAGE_LABELS
                          ] ?? c.language}
                        </div>
                      </div>
                      <SourceBadge source={c.source} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4">
            <div className="text-sm text-slate-600">
              {selectedIds.length} selected
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submit}
                disabled={selectedIds.length === 0 || add.isPending}
              >
                {add.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    Add {selectedIds.length > 0 ? selectedIds.length : ""}{" "}
                    contact
                    {selectedIds.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RenameAudienceDialog({
  open,
  onOpenChange,
  audienceId,
  initialName,
  initialDescription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audienceId: string;
  initialName: string;
  initialDescription: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const update = useUpdateAudience();
  const { push } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: audienceId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      push({ variant: "success", title: "Audience updated" });
      onOpenChange(false);
    } catch (err) {
      push({
        variant: "error",
        title: "Update failed",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">
            Rename audience
          </Dialog.Title>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="aud-rn-name">Name</label>
              <input
                id="aud-rn-name"
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="aud-rn-desc">
                Description
              </label>
              <textarea
                id="aud-rn-desc"
                className="input mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
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
                disabled={update.isPending}
              >
                {update.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
