import { Check } from "lucide-react";
import { cn } from "../lib/cn.js";

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "upcoming";
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
  );
}
