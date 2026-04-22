import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, Loader2 } from "lucide-react";
import {
  useDeleteContact,
  useRestoreContact,
  type Contact,
} from "../hooks/useContacts.js";
import { useToast } from "./toast.js";

export function DeleteContactDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const del = useDeleteContact();
  const restore = useRestoreContact();
  const { push } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!contact) return;
    setSubmitting(true);
    try {
      await del.mutateAsync(contact.id);
      onOpenChange(false);
      push({
        variant: "success",
        title: `${contact.name} removed`,
        description: "Past messages stay in reports.",
        action: {
          label: "Undo",
          onClick: () => restore.mutate(contact.id),
        },
      });
    } catch {
      push({ variant: "error", title: "Remove failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
          <Dialog.Title className="text-lg font-semibold">
            Remove contact?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            {contact ? (
              <>
                Remove <span className="font-medium text-slate-800">{contact.name}</span>{" "}
                from your contacts? They won't receive any future campaigns.
                Messages you've already sent stay visible in reports.
              </>
            ) : null}
          </Dialog.Description>

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
              disabled={submitting || !contact}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Remove contact
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
