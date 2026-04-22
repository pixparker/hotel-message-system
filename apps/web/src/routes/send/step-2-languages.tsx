import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LanguageBodiesEditor } from "../../components/LanguageBodiesEditor.js";
import { useWizard } from "../../state/wizard.js";
import { useTemplates } from "../../hooks/useTemplates.js";
import type { Language } from "@hms/shared";

export function Step2Languages() {
  const { mode, templateId, customBodies, patch } = useWizard();
  const { data: templates } = useTemplates();
  const navigate = useNavigate();

  useEffect(() => {
    patch({ step: 3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateBodies = useMemo<Partial<Record<Language, string>> | null>(() => {
    if (mode !== "template" || !templateId || !templates) return null;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return null;
    const map: Partial<Record<Language, string>> = {};
    for (const b of t.bodies) map[b.language as Language] = b.body;
    return map;
  }, [mode, templateId, templates]);

  // When a template is selected (or re-selected), seed the wizard's custom bodies
  // with the template's content so users can tweak them inline. Only does this
  // once per template load — after that the user's edits win.
  useEffect(() => {
    if (!templateBodies) return;
    const empty = Object.values(customBodies).every(
      (v) => !v || v.trim().length === 0,
    );
    if (empty) patch({ customBodies: templateBodies });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, templateBodies]);

  const filledCount = Object.values(customBodies).filter(
    (v) => v && v.trim().length > 0,
  ).length;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">
            Message text
            <span className="ml-2 font-normal text-slate-400">
              {filledCount} language{filledCount === 1 ? "" : "s"} filled in
            </span>
          </div>
          {mode === "template" && templateBodies && (
            <button
              type="button"
              onClick={() => patch({ customBodies: templateBodies })}
              className="text-xs font-medium text-brand-700 hover:text-brand-900"
            >
              Reset to template
            </button>
          )}
        </div>
        <LanguageBodiesEditor
          bodies={customBodies}
          onChange={(l, body) =>
            patch({ customBodies: { ...customBodies, [l]: body } })
          }
        />
      </div>

      <div className="flex justify-between">
        <button
          className="btn-secondary"
          onClick={() => {
            patch({ step: 2 });
            navigate("/send/message");
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          className="btn-primary"
          disabled={filledCount === 0}
          onClick={() => {
            patch({ step: 4 });
            navigate("/send/test");
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
