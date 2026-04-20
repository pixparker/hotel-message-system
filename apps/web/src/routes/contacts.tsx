import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Search, BedDouble, Upload, Users, LogOut } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";
import { PhoneInput } from "../components/PhoneInput.js";
import { LanguagePicker } from "../components/LanguagePicker.js";
import { LANGUAGE_LABELS, formatPhoneDisplay, matchesSearch } from "@hms/shared";
import {
  useContacts,
  useCreateContact,
  type Contact,
  type ContactSource,
} from "../hooks/useContacts.js";
import { useAudiences } from "../hooks/useAudiences.js";
import { useTags } from "../hooks/useTags.js";
import { useToast } from "../components/toast.js";
import { ApiError } from "../lib/api.js";
import { SourceBadge } from "../components/SourceBadge.js";
import { AudienceChip } from "../components/AudienceChip.js";
import { TagChip } from "../components/TagChip.js";
import { CsvImportDialog } from "../components/CsvImportDialog.js";
import { CheckoutDialog } from "../components/CheckoutDialog.js";
import { cn } from "../lib/cn.js";

const SOURCE_OPTIONS: Array<{ value: ContactSource | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "hotel", label: "Hotel" },
  { value: "csv", label: "CSV" },
];

export function ContactsPage() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<ContactSource | "all">("all");
  const [audienceFilterIds, setAudienceFilterIds] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [checkoutContact, setCheckoutContact] = useState<Contact | null>(null);

  const qc = useQueryClient();
  const { data: contacts = [], isLoading } = useContacts();
  const { data: audiences = [] } = useAudiences();
  const { data: tags = [] } = useTags();

  const hotelAudienceId = useMemo(
    () => audiences.find((a) => a.kind === "hotel_guests")?.id ?? null,
    [audiences],
  );

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (!showInactive && !c.isActive) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (
        audienceFilterIds.length > 0 &&
        !c.audienceIds.some((id) => audienceFilterIds.includes(id))
      ) {
        return false;
      }
      if (query.trim()) {
        return matchesSearch(
          `${c.name} ${c.phoneE164} ${c.roomNumber ?? ""} ${c.language}`,
          query,
        );
      }
      return true;
    });
  }, [contacts, query, sourceFilter, audienceFilterIds, showInactive]);

  const showHotelColumns =
    !!hotelAudienceId &&
    audienceFilterIds.length === 1 &&
    audienceFilterIds[0] === hotelAudienceId;

  return (
    <Page
      title="Contacts"
      description="People who can receive your messages. Organize them into audiences to send targeted campaigns."
      actions={
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add contact
          </button>
        </div>
      }
    >
      <div className="mb-4 card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, or room…"
              className="input !pl-9"
              aria-label="Search contacts"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show inactive
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSourceFilter(s.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    sourceFilter === s.value
                      ? "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Audience
            </span>
            {audienceFilterIds.length === 0 && (
              <span className="text-xs text-slate-500">All</span>
            )}
            <div className="flex flex-wrap gap-1.5">
              {audiences.map((a) => {
                const active = audienceFilterIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() =>
                      setAudienceFilterIds((prev) =>
                        prev.includes(a.id)
                          ? prev.filter((x) => x !== a.id)
                          : [...prev, a.id],
                      )
                    }
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium transition",
                      active
                        ? "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200",
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
              {audienceFilterIds.length > 0 && (
                <button
                  onClick={() => setAudienceFilterIds([])}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={query ? Search : Users}
          title={query ? "No matches" : "No contacts yet"}
          description={
            query
              ? `Nothing matches "${query}" with current filters.`
              : "Add your first contact to start sending messages."
          }
          action={
            !query ? (
              <button className="btn-primary" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add contact
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  {showHotelColumns && <th className="px-4 py-3">Room</th>}
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Lang</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Audiences</th>
                  <th className="px-4 py-3">Tags</th>
                  {showHotelColumns && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    audiences={audiences}
                    tags={tags}
                    showHotelColumns={showHotelColumns}
                    onCheckoutRequest={() => setCheckoutContact(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
            {filtered.length} of {contacts.length} contacts
          </div>
        </div>
      )}

      <AddContactDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        audiences={audiences}
        tags={tags}
        hotelAudienceId={hotelAudienceId}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportDone={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
      />
      <CheckoutDialog
        guest={checkoutContact}
        open={!!checkoutContact}
        onOpenChange={(o) => !o && setCheckoutContact(null)}
      />
    </Page>
  );
}

function ContactRow({
  contact,
  audiences,
  tags,
  showHotelColumns,
  onCheckoutRequest,
}: {
  contact: Contact;
  audiences: ReturnType<typeof useAudiences>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  tags: ReturnType<typeof useTags>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  showHotelColumns: boolean;
  onCheckoutRequest: () => void;
}) {
  const audById = new Map(audiences.map((a) => [a.id, a]));
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const audienceRows = contact.audienceIds
    .map((id) => audById.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const visibleAud = audienceRows.slice(0, 2);
  const extraAud = audienceRows.length - visibleAud.length;

  const tagRows = contact.tagIds
    .map((id) => tagById.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const canCheckOut =
    showHotelColumns && contact.status === "checked_in";

  return (
    <tr
      className={cn(
        "hover:bg-slate-50/60",
        !contact.isActive && "opacity-60",
      )}
    >
      <td className="px-4 py-3 font-medium">
        <div className="flex items-center gap-2">
          <span className="text-slate-900">{contact.name}</span>
          {!contact.isActive && (
            <span className="badge bg-slate-100 text-slate-500">inactive</span>
          )}
        </div>
      </td>
      {showHotelColumns && (
        <td className="px-4 py-3">
          {contact.roomNumber ? (
            <span className="badge bg-indigo-50 text-indigo-700">
              <BedDouble className="h-3 w-3" />
              {contact.roomNumber}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
      )}
      <td className="px-4 py-3 tabular-nums text-slate-600">
        {formatPhoneDisplay(contact.phoneE164)}
      </td>
      <td className="px-4 py-3">
        <span className="badge bg-slate-100 text-slate-700">
          {LANGUAGE_LABELS[contact.language as keyof typeof LANGUAGE_LABELS] ??
            contact.language}
        </span>
      </td>
      <td className="px-4 py-3">
        <SourceBadge source={contact.source} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {visibleAud.map((a) => (
            <AudienceChip
              key={a.id}
              name={a.name}
              kind={a.kind}
              isSystem={a.isSystem}
            />
          ))}
          {extraAud > 0 && (
            <span className="badge bg-slate-100 text-slate-600">
              +{extraAud}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {tagRows.length === 0 ? (
            <span className="text-slate-300 text-xs">—</span>
          ) : (
            tagRows.map((t) => <TagChip key={t.id} tag={t} />)
          )}
        </div>
      </td>
      {showHotelColumns && (
        <td className="px-4 py-3 text-right">
          {canCheckOut && (
            <button
              className="btn-ghost text-rose-600 hover:bg-rose-50"
              onClick={onCheckoutRequest}
            >
              <LogOut className="h-4 w-4" />
              Check out
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
  audiences,
  tags,
  hotelAudienceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audiences: ReturnType<typeof useAudiences>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  tags: ReturnType<typeof useTags>["data"] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  hotelAudienceId: string | null;
}) {
  const create = useCreateContact();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [roomNumber, setRoomNumber] = useState("");
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const isHotelSelected =
    !!hotelAudienceId && audienceIds.includes(hotelAudienceId);

  function toggleAudience(id: string) {
    setAudienceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function reset() {
    setName("");
    setPhone("");
    setLanguage("en");
    setRoomNumber("");
    setAudienceIds([]);
    setTagIds([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        name,
        phone,
        language,
        roomNumber: roomNumber.trim() || undefined,
        audienceIds: audienceIds.length > 0 ? audienceIds : undefined,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        // Any Hotel Guests membership implies the hotel source + status.
        source: isHotelSelected ? "hotel" : "manual",
      });
      push({ variant: "success", title: `${name} added` });
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 400
          ? "Check the phone number format."
          : "Could not add contact.";
      push({ variant: "error", title: "Add contact failed", description: msg });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">Add contact</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            A contact can receive WhatsApp campaigns. Assign audiences to
            target them.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="c-name">Full name</label>
              <input
                id="c-name"
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="c-phone">WhatsApp number</label>
              <PhoneInput
                id="c-phone"
                value={phone}
                onChange={setPhone}
                className="mt-1"
              />
            </div>
            <div>
              <div className="label mb-2">Preferred language</div>
              <LanguagePicker value={language} onChange={setLanguage} />
            </div>

            <div>
              <div className="label mb-2">Audiences</div>
              <div className="flex flex-wrap gap-1.5">
                {audiences.map((a) => {
                  const on = audienceIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAudience(a.id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition",
                        on
                          ? "bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200",
                      )}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {isHotelSelected && (
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                <label className="label" htmlFor="c-room">
                  Room number{" "}
                  <span className="text-slate-400 font-normal">
                    (hotel only)
                  </span>
                </label>
                <input
                  id="c-room"
                  className="input mt-1 tabular-nums"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="204"
                  maxLength={20}
                />
              </div>
            )}

            {tags.length > 0 && (
              <div>
                <div className="label mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const on = tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition",
                          on
                            ? "bg-slate-800 text-white"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200",
                        )}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                {create.isPending ? "Adding…" : "Add contact"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
