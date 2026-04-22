import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PhoneInput } from "./PhoneInput.js";
import { LanguagePicker } from "./LanguagePicker.js";
import {
  useUpdateContact,
  type Contact,
} from "../hooks/useContacts.js";
import { useAudiences } from "../hooks/useAudiences.js";
import { useTags } from "../hooks/useTags.js";
import { useToast } from "./toast.js";
import { ApiError } from "../lib/api.js";
import { cn } from "../lib/cn.js";

export function EditContactDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateContact();
  const { push } = useToast();
  const { data: audiences = [] } = useAudiences();
  const { data: tags = [] } = useTags();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [roomNumber, setRoomNumber] = useState("");
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const hotelAudienceId = audiences.find((a) => a.kind === "hotel_guests")?.id ?? null;
  const isHotelSelected =
    !!hotelAudienceId && audienceIds.includes(hotelAudienceId);

  // Seed the form every time a new contact is opened for editing.
  useEffect(() => {
    if (!contact) return;
    setName(contact.name);
    setPhone(contact.phoneE164);
    setLanguage(contact.language);
    setRoomNumber(contact.roomNumber ?? "");
    setAudienceIds(contact.audienceIds);
    setTagIds(contact.tagIds);
  }, [contact?.id]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    try {
      await update.mutateAsync({
        id: contact.id,
        name,
        phone,
        language,
        roomNumber: roomNumber.trim() || undefined,
        audienceIds,
        tagIds,
        // Keep source consistent with Hotel Guests membership.
        source: isHotelSelected ? "hotel" : contact.source,
      });
      push({ variant: "success", title: `${name} updated` });
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 400
          ? "Check the phone number format."
          : "Could not save changes.";
      push({ variant: "error", title: "Update failed", description: msg });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">Edit contact</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Update this contact's details, audiences, or tags.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="e-name">Full name</label>
              <input
                id="e-name"
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="e-phone">WhatsApp number</label>
              <PhoneInput
                id="e-phone"
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
                <label className="label" htmlFor="e-room">
                  Room number{" "}
                  <span className="text-slate-400 font-normal">
                    (hotel only)
                  </span>
                </label>
                <input
                  id="e-room"
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
                disabled={update.isPending}
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
