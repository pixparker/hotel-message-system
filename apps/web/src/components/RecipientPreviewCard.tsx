import { Users, Languages, Loader2 } from "lucide-react";
import { LANGUAGE_LABELS, formatPhoneDisplay } from "@hms/shared";
import { useRecipientPreview } from "../hooks/useRecipientPreview.js";

export function RecipientPreviewCard({
  audienceIds,
}: {
  audienceIds: string[];
}) {
  const { data, isFetching } = useRecipientPreview(audienceIds);

  if (audienceIds.length === 0) {
    return (
      <div className="card p-5 border-dashed border border-slate-200 bg-surface-50">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Recipients</div>
            <div className="text-lg font-medium text-slate-400">
              Select at least one audience
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const languages = data?.byLanguage ?? [];
  const sample = data?.sample ?? [];

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {isFetching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Users className="h-5 w-5" />
          )}
        </div>
        <div>
          <div className="text-sm text-slate-500">Recipients</div>
          <div className="text-2xl font-semibold tabular-nums">
            {total}
            <span className="ml-2 text-sm font-normal text-slate-500">
              across {audienceIds.length} audience
              {audienceIds.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {languages.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Languages className="h-3.5 w-3.5" />
            By language
          </div>
          <div className="flex flex-wrap gap-2">
            {languages.map((l) => (
              <span
                key={l.language}
                className="badge bg-slate-100 text-slate-700"
              >
                {LANGUAGE_LABELS[l.language as keyof typeof LANGUAGE_LABELS] ??
                  l.language}{" "}
                · {l.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {sample.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sample recipients
          </div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
            {sample.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-slate-500 tabular-nums">
                  {formatPhoneDisplay(c.phoneE164)}
                </span>
              </li>
            ))}
            {total > sample.length && (
              <li className="px-4 py-2 text-xs text-slate-400">
                +{total - sample.length} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
