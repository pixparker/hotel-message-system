import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, FlaskConical, Loader2 } from "lucide-react";
import type { Language } from "@hms/shared";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, RTL_LANGUAGES } from "@hms/shared";
import { useWizard } from "../../state/wizard.js";
import { useAuth } from "../../state/auth.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";
import { PhoneInput } from "../../components/PhoneInput.js";
import { LANGUAGE_FLAGS } from "../../components/LanguagePicker.js";
import { cn } from "../../lib/cn.js";

export function Step4Test() {
  const {
    primaryLanguage,
    templateId,
    mode,
    customBodies,
    patch,
  } = useWizard();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const setTestPhone = useAuth((s) => s.setTestPhone);
  const [phone, setPhone] = useState(user?.testPhone ?? "");
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  const filledLangs = SUPPORTED_LANGUAGES.filter(
    (l) => customBodies[l] && customBodies[l]!.trim().length > 0,
  );

  // If the remembered primary language isn't filled, pick the first filled one.
  useEffect(() => {
    if (filledLangs.length === 0) return;
    if (!filledLangs.includes(primaryLanguage)) {
      patch({ primaryLanguage: filledLangs[0] as Language });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledLangs.join("|")]);

  const selected = filledLangs.includes(primaryLanguage)
    ? primaryLanguage
    : (filledLangs[0] as Language | undefined);
  const preview = selected ? customBodies[selected]! : "";
  const rtl = selected ? RTL_LANGUAGES.has(selected) : false;

  async function sendTest() {
    if (!selected) return;
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
          language: selected,
        }),
      });
      push({
        variant: "success",
        title: "Test sent",
        description: `Check ${phone} on WhatsApp.`,
      });
    } catch {
      push({
        variant: "error",
        title: "Test failed",
        description: "Check the phone format.",
      });
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

            {filledLangs.length > 1 && (
              <div className="mt-4">
                <div className="label mb-2">Send test in</div>
                <div role="radiogroup" className="flex flex-wrap gap-2">
                  {filledLangs.map((l) => {
                    const active = selected === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => patch({ primaryLanguage: l as Language })}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                          active
                            ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        <span className="text-base leading-none">
                          {LANGUAGE_FLAGS[l as Language]}
                        </span>
                        {LANGUAGE_LABELS[l as Language]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {preview && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-xs text-slate-500 mb-1">Preview</div>
                <div
                  dir={rtl ? "rtl" : "ltr"}
                  className="whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
                >
                  {preview}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <PhoneInput value={phone} onChange={setPhone} className="flex-1" />
              <button
                className="btn-primary"
                onClick={sendTest}
                disabled={sending || phone.length < 6 || !selected}
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
            navigate("/send/languages");
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
