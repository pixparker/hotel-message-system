import { Check } from "lucide-react";
import { cn } from "../lib/cn.js";

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  const pct = Math.round((current / steps.length) * 100);
  return (
    <>
      {/* Mobile: compact progress indicator */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-medium text-slate-500">
            Step {current} of {steps.length}
          </div>
          <div className="text-xs font-semibold text-brand-700 tabular-nums">
            {pct}%
          </div>
        </div>
        <div className="mt-1 text-base font-semibold text-slate-900">
          {steps[current - 1]}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop: full stepper */}
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((label, i) => {
          const n = i + 1;
          const state =
            n < current ? "done" : n === current ? "current" : "upcoming";
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
                  state === "done" && "bg-brand-600 text-white",
                  state === "current" && "bg-brand-100 text-brand-700 ring-2 ring-brand-500",
                  state === "upcoming" && "bg-slate-100 text-slate-500",
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : n}
              </div>
              <div
                className={cn(
                  "truncate text-sm font-medium",
                  state === "upcoming" ? "text-slate-400" : "text-slate-700",
                )}
              >
                {label}
              </div>
              {i < steps.length - 1 && (
                <div className="mx-2 h-px flex-1 bg-slate-200" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
