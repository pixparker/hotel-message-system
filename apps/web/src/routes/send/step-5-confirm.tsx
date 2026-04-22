import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Send,
  Loader2,
  Bookmark,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { LANGUAGE_LABELS, RTL_LANGUAGES, type Language } from "@hms/shared";
import { useWizard } from "../../state/wizard.js";
import { useAudiences } from "../../hooks/useAudiences.js";
import { useRecipientPreview } from "../../hooks/useRecipientPreview.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";
import { LANGUAGE_FLAGS } from "../../components/LanguagePicker.js";
import { AudienceChip } from "../../components/AudienceChip.js";

interface BaileysStatus {
  status: "none" | "pending" | "connected" | "logged_out" | "failed";
  coldPolicy?: "warn" | "block" | "allow";
}

interface PreflightResult {
  total: number;
  safe: number;
  cold: number;
  invalid: number;
  riskyContactIds: string[];
}

interface Settings {
  waProvider: "mock" | "cloud" | "baileys";
}

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
    selectedAudienceIds,
    saveAsTemplate,
    templateName,
    reset,
    patch,
  } = useWizard();
  const { data: audiences = [] } = useAudiences();
  const preview = useRecipientPreview(selectedAudienceIds);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const { push } = useToast();

  // Baileys-only: pre-flight check for ban risk. Skipped when the tenant
  // runs on Cloud/Mock — the counts would be noise without the sender-reputation risk.
  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });
  const baileysQ = useQuery({
    queryKey: ["baileys-status"],
    queryFn: () => api<BaileysStatus>("/api/settings/whatsapp/baileys/status"),
  });
  const isBaileys = settingsQ.data?.waProvider === "baileys";
  const coldPolicy = baileysQ.data?.coldPolicy ?? "warn";
  const preflightQ = useQuery({
    queryKey: ["preflight", selectedAudienceIds.join(",")],
    queryFn: () =>
      api<PreflightResult>("/api/campaigns/preflight", {
        method: "POST",
        body: JSON.stringify({ audienceIds: selectedAudienceIds }),
      }),
    enabled: isBaileys && selectedAudienceIds.length > 0,
    staleTime: 30_000,
  });
  const preflight = preflightQ.data;
  const coldBlocked = isBaileys && coldPolicy === "block" && (preflight?.cold ?? 0) > 0;

  const recipientCount = preview.data?.total ?? 0;
  const perLanguageCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const row of preview.data?.byLanguage ?? []) {
      m[row.language] = row.count;
    }
    return m;
  }, [preview.data]);

  const filledLanguages = useMemo(
    () =>
      (Object.keys(customBodies) as Language[]).filter(
        (l) => customBodies[l] && customBodies[l]!.trim().length > 0,
      ),
    [customBodies],
  );

  const selectedAudiences = useMemo(
    () =>
      selectedAudienceIds
        .map((id) => audiences.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [selectedAudienceIds, audiences],
  );

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
          audienceIds: selectedAudienceIds,
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
        <Summary
          label="Recipients"
          value={`${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
        />
        <Summary
          label="Languages"
          value={filledLanguages.map((l) => l.toUpperCase()).join(" · ") || "—"}
        />
      </div>

      {selectedAudiences.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold text-slate-900">
            Sending to
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedAudiences.map((a) => (
              <AudienceChip
                key={a.id}
                name={a.name}
                kind={a.kind}
                isSystem={a.isSystem}
                size="md"
              />
            ))}
          </div>
        </div>
      )}

      {isBaileys && selectedAudienceIds.length > 0 && (
        <PreflightCard
          loading={preflightQ.isLoading}
          result={preflight}
          coldPolicy={coldPolicy}
        />
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Message preview</div>
          <div className="text-xs text-slate-400">
            Exactly what recipients will receive on WhatsApp.
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
                    {count} recipient{count === 1 ? "" : "s"} · {customBodies[l]!.length} chars
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
            Some recipients speak a language you haven't filled in — they'll receive the{" "}
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
        <button
          className="btn-primary"
          disabled={recipientCount === 0 || coldBlocked}
          onClick={() => setConfirm(true)}
          title={
            coldBlocked
              ? "Your safety policy blocks sending to cold recipients. Change it in Settings."
              : undefined
          }
        >
          <Send className="h-4 w-4" />
          Send to {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
        </button>
      </div>

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 card p-6">
            <Dialog.Title className="text-lg font-semibold">
              Send to {recipientCount} recipient{recipientCount === 1 ? "" : "s"}?
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

function PreflightCard({
  loading,
  result,
  coldPolicy,
}: {
  loading: boolean;
  result: PreflightResult | undefined;
  coldPolicy: "warn" | "block" | "allow";
}) {
  if (loading) {
    return (
      <div className="card p-5 flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking recipients for ban risk…
      </div>
    );
  }
  if (!result) return null;

  const hasCold = result.cold > 0;
  const isBlocking = hasCold && coldPolicy === "block";

  return (
    <div
      className={
        "card p-5 space-y-3 " +
        (isBlocking
          ? "border-rose-200 bg-rose-50"
          : hasCold
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50")
      }
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {isBlocking ? (
          <ShieldAlert className="h-4 w-4 text-rose-600" />
        ) : hasCold ? (
          <ShieldAlert className="h-4 w-4 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}
        Ban-risk pre-flight
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <PreflightStat label="Safe" value={result.safe} tone="emerald" />
        <PreflightStat label="Cold" value={result.cold} tone="amber" />
        <PreflightStat label="Invalid" value={result.invalid} tone="slate" />
      </div>

      {hasCold ? (
        <p className="text-xs text-slate-700">
          <strong>{result.cold}</strong> recipient{result.cold === 1 ? "" : "s"}{" "}
          haven't messaged you first. These are the highest ban-risk sends. A
          two-way conversation with each recipient dramatically reduces the
          chance of your number being banned — consider asking recipients to
          message you first.
          {isBlocking && (
            <span className="block mt-2 font-medium text-rose-700">
              Your safety policy is set to <em>Block</em>. Remove cold
              recipients or change the policy in Settings.
            </span>
          )}
        </p>
      ) : (
        <p className="text-xs text-slate-700">
          Every recipient has a prior conversation with you. This is the safest
          scenario for an unofficial WhatsApp connection.
        </p>
      )}
    </div>
  );
}

function PreflightStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "slate";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-600";
  return (
    <div className="rounded-md bg-white px-3 py-2 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={"mt-0.5 text-lg font-semibold tabular-nums " + toneCls}>
        {value}
      </div>
    </div>
  );
}
