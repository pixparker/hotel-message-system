import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LanguageTabs } from "../../components/LanguageTabs.js";
import { useWizard } from "../../state/wizard.js";
import { useTemplates } from "../../hooks/useTemplates.js";
import type { Language } from "@hms/shared";

export function Step2Languages() {
  const { mode, templateId, customBodies, primaryLanguage, patch } = useWizard();
  const { data: templates } = useTemplates();
  const navigate = useNavigate();

  const bodies = useMemo(() => {
    if (mode === "template" && templateId && templates) {
      const t = templates.find((x) => x.id === templateId);
      if (t) {
        const map: Partial<Record<Language, string>> = {};
        for (const b of t.bodies) map[b.language as Language] = b.body;
        return map;
      }
    }
    return customBodies;
  }, [mode, templateId, templates, customBodies]);

  useEffect(() => {
    if (mode === "template" && Object.keys(customBodies).length === 0 && bodies) {
      patch({ customBodies: bodies });
    }
  }, [mode, bodies]); // eslint-disable-line react-hooks/exhaustive-deps

  const filledCount = Object.values(bodies).filter((v) => v && v.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-3 text-sm font-medium">
          Message text
          <span className="ml-2 text-slate-400 font-normal">
            {filledCount} language{filledCount === 1 ? "" : "s"} filled in
          </span>
        </div>
        <LanguageTabs
          value={primaryLanguage}
          onChange={(l) => patch({ primaryLanguage: l })}
          bodies={bodies}
          onBodyChange={(l, body) =>
            patch({ customBodies: { ...bodies, [l]: body } })
          }
        />
      </div>

      <div className="flex justify-between">
        <button
          className="btn-secondary"
          onClick={() => {
            patch({ step: 1 });
            navigate("/send");
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          className="btn-primary"
          disabled={filledCount === 0}
          onClick={() => {
            patch({ step: 3 });
            navigate("/send/recipients");
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
