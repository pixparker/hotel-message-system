import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Send, Loader2, Bookmark } from "lucide-react";
import { LANGUAGE_LABELS, RTL_LANGUAGES, type Language } from "@hms/shared";
import { useWizard } from "../../state/wizard.js";
import { useGuests } from "../../hooks/useGuests.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";
import { LANGUAGE_FLAGS } from "../../components/LanguagePicker.js";

function suggestTitle(
  bodies: Partial<Record<Language, string>>,
  filled: Language[],
): string {
  const first = filled[0] ? bodies[filled[0]] : undefined;
  if (!first) return "";
  const oneLine = first.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? oneLine.slice(0, 57) + "…" : oneLine;
}

export function Step5Confirm() {
  const {
    mode,
    templateId,
    customBodies,
    title,
    recipientStatus,
    saveAsTemplate,
    templateName,
    reset,
    patch,
  } = useWizard();
  const { data: recipients = [] } = useGuests(recipientStatus);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  const filledLanguages = useMemo(
    () =>
      (Object.keys(customBodies) as Language[]).filter(
        (l) => customBodies[l] && customBodies[l]!.trim().length > 0,
      ),
    [customBodies],
  );

  const perLanguageCount = recipients.reduce<Record<string, number>>((acc, g) => {
    acc[g.language] = (acc[g.language] ?? 0) + 1;
    return acc;
  }, {});

  const suggested = useMemo(
    () => suggestTitle(customBodies, filledLanguages),
    [customBodies, filledLanguages],
  );
  const effectiveTitle = (title.trim() || suggested).trim();

  async function send() {
    setSending(true);
    try {
      let finalTemplateId = mode === "template" ? templateId : undefined;

      // Custom + "save as template" → create the template first, then use it.
      if (mode === "custom" && saveAsTemplate) {
        const name = templateName.trim() || effectiveTitle || "Untitled template";
        const bodies = filledLanguages.map((l) => ({
          language: l,
          body: customBodies[l]!.trim(),
        }));
        const tpl = await api<{ id: string }>("/api/templates", {
          method: "POST",
          body: JSON.stringify({ name, bodies }),
        });
        finalTemplateId = tpl.id;
      }

      const campaign = await api<{ id: string }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          title: effectiveTitle || "Untitled campaign",
          templateId: finalTemplateId,
          customBodies:
            mode === "custom" && !saveAsTemplate ? customBodies : undefined,
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

  const missingCoverage = Object.keys(perLanguageCount).some(
    (l) => !filledLanguages.includes(l as Language),
  );

  return (
    <div className="space-y-6">
      {mode === "custom" && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="label" htmlFor="title">
              Name this campaign{" "}
              <span className="text-slate-400 font-normal">— optional</span>
            </label>
            <input
              id="title"
              className="input mt-1"
              value={title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={suggested || "e.g. Pool closes at 10pm"}
            />
            {!title.trim() && suggested && (
              <div className="mt-1 text-xs text-slate-500">
                Will be saved as{" "}
                <span className="font-medium text-slate-700">"{suggested}"</span> so
                you can find it in reports later.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={saveAsTemplate}
                onChange={(e) => patch({ saveAsTemplate: e.target.checked })}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Bookmark className="h-4 w-4 text-brand-600" />
                  Also save as a template
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Great if you'll send something similar again. Reusable from
                  the Templates page.
                </div>
              </div>
            </label>
            {saveAsTemplate && (
              <div className="mt-3 pl-7">
                <input
                  className="input"
                  placeholder={effectiveTitle || "Template name"}
                  value={templateName}
                  onChange={(e) => patch({ templateName: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card p-5 grid gap-4 md:grid-cols-3">
        <Summary label="Campaign" value={effectiveTitle || "Untitled campaign"} />
        <Summary label="Recipients" value={`${recipients.length} guests`} />
        <Summary
          label="Languages"
          value={filledLanguages.map((l) => l.toUpperCase()).join(" · ") || "—"}
        />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Message preview</div>
          <div className="text-xs text-slate-400">
            Exactly what guests will receive on WhatsApp.
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filledLanguages.map((l) => {
            const count = perLanguageCount[l] ?? 0;
            const isRtl = RTL_LANGUAGES.has(l);
            return (
              <div key={l} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="text-base leading-none">{LANGUAGE_FLAGS[l]}</span>
                    {LANGUAGE_LABELS[l]}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {count} guest{count === 1 ? "" : "s"} · {customBodies[l]!.length} chars
                  </span>
                </div>
                <div
                  dir={isRtl ? "rtl" : "ltr"}
                  className="whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
                >
                  {customBodies[l]}
                </div>
              </div>
            );
          })}
        </div>
        {missingCoverage && filledLanguages[0] && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Some guests speak a language you haven't filled in — they'll receive the{" "}
            {filledLanguages[0].toUpperCase()} version as fallback.
          </div>
        )}
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
              {mode === "custom" && saveAsTemplate && (
                <span> A template will also be saved for next time.</span>
              )}
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-base font-medium truncate">{value}</div>
    </div>
  );
}
