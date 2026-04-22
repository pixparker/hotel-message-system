import { Check } from "lucide-react";
import { AudienceChip } from "./AudienceChip.js";
import { cn } from "../lib/cn.js";
import type { Audience } from "../hooks/useAudiences.js";

export function AudienceMultiSelect({
  selectedIds,
  onChange,
  audiences,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  audiences: Audience[];
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="space-y-2">
      {audiences.map((a) => {
        const isSelected = selectedIds.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
              isSelected
                ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-200"
                : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                isSelected
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-300 bg-white",
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </span>
            <div className="flex-1 min-w-0">
              <AudienceChip
                name={a.name}
                kind={a.kind}
                isSystem={a.isSystem}
              />
              {a.description && (
                <div className="mt-0.5 text-xs text-slate-500">
                  {a.description}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-semibold tabular-nums text-slate-900">
                {a.memberCount}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                members
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
