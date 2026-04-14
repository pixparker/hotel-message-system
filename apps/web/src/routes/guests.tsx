import { useState } from "react";
import { UserPlus, Users, LogOut } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";
import {
  useGuests,
  useCheckInGuest,
  useCheckOutGuest,
  type Guest,
} from "../hooks/useGuests.js";
import { useToast } from "../components/toast.js";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, formatPhoneDisplay } from "@hms/shared";
import { ApiError } from "../lib/api.js";

export function GuestsPage() {
  const [filter, setFilter] = useState<"checked_in" | "checked_out">("checked_in");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGuests(filter);

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
      <div className="mb-4 flex gap-2">
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

      {isLoading ? (
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      ) : !data || data.length === 0 ? (
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
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Checked in</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((g) => (
                <GuestRow key={g.id} guest={g} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CheckInDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

function GuestRow({ guest }: { guest: Guest }) {
  const checkout = useCheckOutGuest();
  const { push } = useToast();
  return (
    <tr>
      <td className="px-4 py-3 font-medium">{guest.name}</td>
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
        {guest.status === "checked_in" && (
          <button
            className="btn-ghost"
            onClick={async () => {
              try {
                await checkout.mutateAsync(guest.id);
                push({ variant: "success", title: "Guest checked out" });
              } catch {
                push({ variant: "error", title: "Check-out failed" });
              }
            }}
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
  const mutation = useCheckInGuest();
  const { push } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ name, phone, language });
      push({ variant: "success", title: `${name} checked in` });
      setName("");
      setPhone("");
      setLanguage("en");
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
            <div>
              <label className="label" htmlFor="name">
                Full name
              </label>
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
              <label className="label" htmlFor="phone">
                WhatsApp number
              </label>
              <input
                id="phone"
                className="input mt-1 tabular-nums"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+90 555 123 45 67"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="language">
                Preferred language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input mt-1"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </select>
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
