import { useMemo, useState } from "react";
import { UserPlus, Users, LogOut, Search, BedDouble } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";
import {
  useGuests,
  useCheckInGuest,
  type Guest,
} from "../hooks/useGuests.js";
import { useToast } from "../components/toast.js";
import { LANGUAGE_LABELS, formatPhoneDisplay, matchesSearch } from "@hms/shared";
import { ApiError } from "../lib/api.js";
import { PhoneInput } from "../components/PhoneInput.js";
import { LanguagePicker } from "../components/LanguagePicker.js";
import { CheckoutDialog } from "../components/CheckoutDialog.js";

export function GuestsPage() {
  const [filter, setFilter] = useState<"checked_in" | "checked_out">("checked_in");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [checkoutGuest, setCheckoutGuest] = useState<Guest | null>(null);
  const { data, isLoading } = useGuests(filter);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data;
    return data.filter((g) =>
      matchesSearch(
        `${g.name} ${g.phoneE164} ${g.roomNumber ?? ""} ${g.language}`,
        query,
      ),
    );
  }, [data, query]);

  return (
    <Page
      title="Guests"
      description="Check guests in, update details, and check out."
      actions={
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Check in guest
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or room…"
            className="input !pl-9"
            aria-label="Search guests"
          />
        </div>
        <div className="flex gap-2">
          {(["checked_in", "checked_out"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={
                filter === v
                  ? "badge bg-brand-100 text-brand-800"
                  : "badge bg-slate-100 text-slate-600 hover:bg-slate-200"
              }
            >
              {v === "checked_in" ? "Checked in" : "Checked out"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      ) : filtered.length === 0 ? (
        query ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing in ${filter === "checked_in" ? "checked-in" : "checked-out"} guests matches “${query}”.`}
          />
        ) : (
          <EmptyState
            icon={Users}
            title={filter === "checked_in" ? "No guests checked in" : "No past guests"}
            description={
              filter === "checked_in"
                ? "Check in your first guest to start sending messages."
                : "Check-outs will appear here."
            }
            action={
              filter === "checked_in" ? (
                <button className="btn-primary" onClick={() => setOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Check in guest
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Checked in</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((g) => (
                <GuestRow
                  key={g.id}
                  guest={g}
                  showCheckout={filter === "checked_in"}
                  onCheckoutRequest={() => setCheckoutGuest(g)}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
            {filtered.length} of {data?.length ?? 0} guests
          </div>
        </div>
      )}

      <CheckInDialog open={open} onOpenChange={setOpen} />
      <CheckoutDialog
        guest={checkoutGuest}
        open={!!checkoutGuest}
        onOpenChange={(o) => !o && setCheckoutGuest(null)}
      />
    </Page>
  );
}

function GuestRow({
  guest,
  showCheckout,
  onCheckoutRequest,
}: {
  guest: Guest;
  showCheckout: boolean;
  onCheckoutRequest: () => void;
}) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-3 font-medium">{guest.name}</td>
      <td className="px-4 py-3">
        {guest.roomNumber ? (
          <span className="badge bg-indigo-50 text-indigo-700">
            <BedDouble className="h-3 w-3" />
            {guest.roomNumber}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-slate-600">
        {formatPhoneDisplay(guest.phoneE164)}
      </td>
      <td className="px-4 py-3">
        <span className="badge bg-slate-100 text-slate-700">
          {LANGUAGE_LABELS[guest.language as keyof typeof LANGUAGE_LABELS] ?? guest.language}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500">
        {new Date(guest.checkedInAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right">
        {showCheckout && (
          <button
            className="btn-ghost text-rose-600 hover:bg-rose-50"
            onClick={onCheckoutRequest}
          >
            <LogOut className="h-4 w-4" />
            Check out
          </button>
        )}
      </td>
    </tr>
  );
}

function CheckInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [roomNumber, setRoomNumber] = useState("");
  const mutation = useCheckInGuest();
  const { push } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        name,
        phone,
        language,
        roomNumber: roomNumber.trim() || undefined,
      });
      push({ variant: "success", title: `${name} checked in` });
      setName("");
      setPhone("");
      setLanguage("en");
      setRoomNumber("");
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 400
          ? "Check the phone number format."
          : "Could not check guest in.";
      push({ variant: "error", title: "Check-in failed", description: msg });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">Check in guest</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Takes under 10 seconds.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input
                  id="name"
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="room">Room <span className="text-slate-400 font-normal">opt.</span></label>
                <input
                  id="room"
                  className="input mt-1 tabular-nums"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="204"
                  maxLength={20}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="phone">WhatsApp number</label>
              <PhoneInput id="phone" value={phone} onChange={setPhone} className="mt-1" />
            </div>
            <div>
              <div className="label mb-2">Preferred language</div>
              <LanguagePicker value={language} onChange={setLanguage} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                {mutation.isPending ? "Checking in…" : "Check in"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
