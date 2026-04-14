import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, FlaskConical, Loader2 } from "lucide-react";
import { useWizard } from "../../state/wizard.js";
import { useAuth } from "../../state/auth.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";

export function Step4Test() {
  const { primaryLanguage, templateId, mode, customBodies, patch } = useWizard();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const setTestPhone = useAuth((s) => s.setTestPhone);
  const [phone, setPhone] = useState(user?.testPhone ?? "");
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  async function sendTest() {
    setSending(true);
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ testPhone: phone }),
      });
      setTestPhone(phone);

      await api("/api/campaigns/test", {
        method: "POST",
        body: JSON.stringify({
          phone,
          templateId: mode === "template" ? templateId : undefined,
          customBodies: mode === "custom" ? customBodies : undefined,
          language: primaryLanguage,
        }),
      });
      push({
        variant: "success",
        title: "Test sent",
        description: `Check ${phone} on WhatsApp.`,
      });
    } catch {
      push({ variant: "error", title: "Test failed", description: "Check the phone format." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Send yourself a test first</div>
            <p className="text-sm text-slate-500">
              Preview the exact message on your own phone before it reaches guests.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                className="input tabular-nums flex-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+90 555 123 45 67"
              />
              <button
                className="btn-primary"
                onClick={sendTest}
                disabled={sending || phone.length < 6}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending
                  </>
                ) : (
                  "Send test"
                )}
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              We remember this number so you don't have to retype it.
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          className="btn-secondary"
          onClick={() => {
            patch({ step: 3 });
            navigate("/send/recipients");
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            patch({ step: 5 });
            navigate("/send/confirm");
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
