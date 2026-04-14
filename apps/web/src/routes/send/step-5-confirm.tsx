import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { useWizard } from "../../state/wizard.js";
import { useGuests } from "../../hooks/useGuests.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";

export function Step5Confirm() {
  const {
    mode,
    templateId,
    customBodies,
    title,
    recipientStatus,
    reset,
    patch,
  } = useWizard();
  const { data: recipients = [] } = useGuests(recipientStatus);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  async function send() {
    setSending(true);
    try {
      const campaign = await api<{ id: string }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          title: title || "Untitled campaign",
          templateId: mode === "template" ? templateId : undefined,
          customBodies: mode === "custom" ? customBodies : undefined,
          recipientFilter: { status: recipientStatus },
        }),
      });
      reset();
      navigate(`/campaigns/${campaign.id}/live`);
    } catch {
      push({ variant: "error", title: "Could not start campaign" });
    } finally {
      setSending(false);
      setConfirm(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Title</div>
          <div className="mt-1 text-base font-medium">{title || "Untitled campaign"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Recipients</div>
          <div className="mt-1 text-base font-medium">{recipients.length} guests</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Languages</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.keys(customBodies)
              .filter((k) => customBodies[k as keyof typeof customBodies])
              .map((k) => (
                <span key={k} className="badge bg-slate-100 text-slate-700 uppercase">
                  {k}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          className="btn-secondary"
          onClick={() => {
            patch({ step: 4 });
            navigate("/send/test");
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button className="btn-primary" onClick={() => setConfirm(true)}>
          <Send className="h-4 w-4" />
          Send to guests
        </button>
      </div>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
            <Dialog.Title className="text-lg font-semibold">
              Send to {recipients.length} guests?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              This will deliver the message on WhatsApp. You can close the next
              screen and the system will keep sending in the background.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={sending} onClick={send}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  "Send now"
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
