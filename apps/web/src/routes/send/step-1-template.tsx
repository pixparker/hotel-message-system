import { Link, useNavigate } from "react-router-dom";
import { FileText, Wand2, ArrowRight } from "lucide-react";
import { useWizard } from "../../state/wizard.js";
import { useTemplates } from "../../hooks/useTemplates.js";
import { cn } from "../../lib/cn.js";

export function Step1Template() {
  const { mode, templateId, title, patch } = useWizard();
  const { data: templates, isLoading } = useTemplates();
  const navigate = useNavigate();

  const canNext = (mode === "template" && templateId) || (mode === "custom" && title.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => patch({ mode: "template" })}
          className={cn(
            "card p-5 text-left transition",
            mode === "template" && "ring-2 ring-brand-500",
          )}
        >
          <FileText className="h-5 w-5 text-brand-600" />
          <div className="mt-3 font-semibold">Use a template</div>
          <div className="text-sm text-slate-500">
            Pick a pre-written message and send in seconds.
          </div>
        </button>
        <button
          onClick={() => patch({ mode: "custom", templateId: null })}
          className={cn(
            "card p-5 text-left transition",
            mode === "custom" && "ring-2 ring-brand-500",
          )}
        >
          <Wand2 className="h-5 w-5 text-brand-600" />
          <div className="mt-3 font-semibold">Write a custom message</div>
          <div className="text-sm text-slate-500">
            Draft a one-off message, still translatable.
          </div>
        </button>
      </div>

      {mode === "template" && (
        <div className="card p-5">
          <div className="mb-3 text-sm font-medium">Templates</div>
          {isLoading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : !templates || templates.length === 0 ? (
            <div className="text-sm text-slate-500">No templates yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => patch({ templateId: t.id, title: t.name })}
                    className={cn(
                      "w-full text-left px-3 py-3 rounded-lg transition",
                      templateId === t.id ? "bg-brand-50" : "hover:bg-slate-50",
                    )}
                  >
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                    )}
                    <div className="mt-1 flex gap-1">
                      {t.bodies.map((b) => (
                        <span
                          key={b.language}
                          className="badge bg-slate-100 text-slate-600 uppercase"
                        >
                          {b.language}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === "custom" && (
        <div className="card p-5 space-y-3">
          <div>
            <label className="label" htmlFor="title">
              Campaign title
            </label>
            <input
              id="title"
              className="input mt-1"
              placeholder="e.g. Late-night pool reminder"
              value={title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={!canNext}
          onClick={() => {
            patch({ step: 2 });
            navigate("/send/languages");
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
