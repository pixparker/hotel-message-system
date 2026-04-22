import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useWizard } from "../../state/wizard.js";
import { useAudiences } from "../../hooks/useAudiences.js";
import { useRecipientPreview } from "../../hooks/useRecipientPreview.js";
import { AudienceMultiSelect } from "../../components/AudienceMultiSelect.js";
import { RecipientPreviewCard } from "../../components/RecipientPreviewCard.js";

export function Step3Recipients() {
  const { selectedAudienceIds, patch } = useWizard();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { data: audiences = [], isLoading } = useAudiences();

  // Deep-link support: ?audience=<id> pre-selects one audience (e.g. from
  // the dashboard "send" shortcut or /audiences/:id "Send" CTA).
  useEffect(() => {
    const wanted = search.get("audience");
    if (wanted && !selectedAudienceIds.includes(wanted)) {
      patch({ selectedAudienceIds: [...selectedAudienceIds, wanted] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Ensure the wizard step marker reflects this page (first step now).
  useEffect(() => {
    patch({ step: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = useRecipientPreview(selectedAudienceIds);
  const total = preview.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-3 text-sm font-semibold text-slate-900">
            Audiences
          </div>
          {isLoading ? (
            <div className="card p-5 text-sm text-slate-500">Loading audiences…</div>
          ) : (
            <AudienceMultiSelect
              selectedIds={selectedAudienceIds}
              onChange={(ids) => patch({ selectedAudienceIds: ids })}
              audiences={audiences}
            />
          )}
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold text-slate-900">Preview</div>
          <RecipientPreviewCard audienceIds={selectedAudienceIds} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={selectedAudienceIds.length === 0 || total === 0}
          onClick={() => {
            patch({ step: 2 });
            navigate("/send/message");
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
