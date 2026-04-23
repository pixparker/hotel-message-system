import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LogOut, Loader2, BedDouble, Phone, Languages, Clock } from "lucide-react";
import { formatPhoneDisplay, LANGUAGE_LABELS } from "@hms/shared";
import {
  useCheckOutContact,
  useUndoCheckOutContact,
  type Contact,
} from "../hooks/useContacts.js";
import { LANGUAGE_FLAGS } from "./LanguagePicker.js";
import { useToast } from "./toast.js";
import { autoMessageToast } from "../lib/auto-message-toast.js";

export function CheckoutDialog({
  guest,
  open,
  onOpenChange,
}: {
  guest: Contact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const checkout = useCheckOutContact();
  const undo = useUndoCheckOutContact();
  const { push } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!guest) return;
    setSubmitting(true);
    try {
      const result = await checkout.mutateAsync(guest.id);
      onOpenChange(false);
      push({
        variant: "success",
        title: `${guest.name} checked out`,
        description: guest.roomNumber
          ? `Room ${guest.roomNumber} is now free.`
          : undefined,
        action: {
          label: "Undo",
          onClick: () => undo.mutate(guest.id),
        },
      });
      const followUp = autoMessageToast(result.autoMessage, guest.name);
      if (followUp) push(followUp);
    } catch {
      push({ variant: "error", title: "Check-out failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">Check out guest</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Please confirm the details before checking this guest out.
          </Dialog.Description>

          {guest && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-lg font-semibold text-slate-900">{guest.name}</div>
              <dl className="mt-3 space-y-2 text-sm">
                <Row icon={BedDouble} label="Room">
                  {guest.roomNumber ? (
                    <span className="font-medium text-indigo-700">
                      {guest.roomNumber}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not assigned</span>
                  )}
                </Row>
                <Row icon={Phone} label="WhatsApp">
                  <span className="tabular-nums">
                    {formatPhoneDisplay(guest.phoneE164)}
                  </span>
                </Row>
                <Row icon={Languages} label="Language">
                  <span className="flex items-center gap-1.5">
                    <span className="text-base leading-none">
                      {LANGUAGE_FLAGS[guest.language as keyof typeof LANGUAGE_FLAGS] ?? ""}
                    </span>
                    {LANGUAGE_LABELS[guest.language as keyof typeof LANGUAGE_LABELS] ??
                      guest.language}
                  </span>
                </Row>
                <Row icon={Clock} label="Checked in">
                  <span className="text-slate-600">
                    {guest.checkedInAt
                      ? new Date(guest.checkedInAt).toLocaleString()
                      : "—"}
                  </span>
                </Row>
              </dl>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn-primary bg-rose-600 hover:bg-rose-700"
              onClick={confirm}
              disabled={submitting || !guest}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking out…
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Confirm check-out
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <dt className="w-24 text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}
