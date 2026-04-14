import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import { useWizard } from "../../state/wizard.js";
import { useGuests } from "../../hooks/useGuests.js";
import { LANGUAGE_LABELS, formatPhoneDisplay } from "@hms/shared";

export function Step3Recipients() {
  const { recipientStatus, patch } = useWizard();
  const navigate = useNavigate();
  const { data: recipients = [], isLoading } = useGuests(recipientStatus);

  const groups = recipients.reduce<Record<string, number>>((acc, g) => {
    acc[g.language] = (acc[g.language] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Recipients</div>
            <div className="text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : `${recipients.length} guests selected`}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(groups).map(([lang, count]) => (
            <span key={lang} className="badge bg-slate-100 text-slate-700">
              {LANGUAGE_LABELS[lang as keyof typeof LANGUAGE_LABELS] ?? lang} · {count}
            </span>
          ))}
        </div>
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-medium">
          View full list
        </summary>
        <ul className="mt-4 divide-y divide-slate-100">
          {recipients.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2 text-sm">
              <span>{g.name}</span>
              <span className="text-slate-500 tabular-nums">
                {formatPhoneDisplay(g.phoneE164)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex justify-between">
        <button
          className="btn-secondary"
          onClick={() => {
            patch({ step: 2 });
            navigate("/send/languages");
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          className="btn-primary"
          disabled={recipients.length === 0}
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
