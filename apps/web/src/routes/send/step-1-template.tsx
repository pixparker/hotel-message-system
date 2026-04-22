import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wand2, ArrowLeft, ArrowRight } from "lucide-react";
import { useWizard } from "../../state/wizard.js";
import { useTemplates } from "../../hooks/useTemplates.js";

export function Step1Template() {
  const { patch } = useWizard();
  const { data: templates, isLoading } = useTemplates();
  const navigate = useNavigate();

  useEffect(() => {
    patch({ step: 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    patch({ step: 3 });
    navigate("/send/languages");
  }

  function pickCustom() {
    patch({ mode: "custom", templateId: null, customBodies: {}, title: "" });
    goNext();
  }

  function pickTemplate(id: string, name: string) {
    patch({ mode: "template", templateId: id, title: name, customBodies: {} });
    goNext();
  }

  return (
    <div className="space-y-6">
      <button
        onClick={pickCustom}
        className="card p-5 text-left transition w-full group hover:ring-2 hover:ring-brand-500"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Wand2 className="h-5 w-5 text-brand-600 shrink-0" />
            <div>
              <div className="font-semibold">Write a custom message</div>
              <div className="text-sm text-slate-500">
                Draft a one-off message — no naming needed until you send.
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 shrink-0" />
        </div>
      </button>

      <div className="card p-5">
        <div className="mb-3 text-sm font-medium">Or pick a template</div>
        {isLoading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-sm text-slate-500">No templates yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => pickTemplate(t.id, t.name)}
                  className="w-full text-left px-3 py-3 rounded-lg transition hover:bg-brand-50 group flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t.description}
                      </div>
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
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-600 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-start">
        <button
          className="btn-secondary"
          onClick={() => {
            patch({ step: 1 });
            navigate("/send");
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
    </div>
  );
}
