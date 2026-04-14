import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  RTL_LANGUAGES,
  type Language,
} from "@hms/shared";
import { LANGUAGE_FLAGS } from "./LanguagePicker.js";
import { cn } from "../lib/cn.js";

const closedExceptEn = (): Record<Language, boolean> => ({
  en: true,
  tr: false,
  fa: false,
  ar: false,
});

export function LanguageBodiesEditor({
  bodies,
  onChange,
}: {
  bodies: Partial<Record<Language, string>>;
  onChange: (l: Language, body: string) => void;
}) {
  const [open, setOpen] = useState<Record<Language, boolean>>(closedExceptEn);
  const hasSeededRef = useRef(false);

  // Seed the open state once, the first time bodies arrive non-empty (e.g.
  // loading an existing template, or picking a template in the send wizard).
  // After that the user's clicks win — no overriding their explicit toggles.
  useEffect(() => {
    if (hasSeededRef.current) return;
    const anyFilled = SUPPORTED_LANGUAGES.some(
      (l) => (bodies[l]?.trim().length ?? 0) > 0,
    );
    if (!anyFilled) return;
    const next = closedExceptEn();
    for (const l of SUPPORTED_LANGUAGES) {
      if ((bodies[l]?.trim().length ?? 0) > 0) next[l] = true;
    }
    setOpen(next);
    hasSeededRef.current = true;
  }, [bodies]);

  return (
    <div className="space-y-3">
      {SUPPORTED_LANGUAGES.map((l) => {
        const value = bodies[l] ?? "";
        const filled = value.trim().length > 0;
        const rtl = RTL_LANGUAGES.has(l);
        const isOpen = open[l];
        return (
          <div
            key={l}
            className={cn(
              "rounded-xl border bg-white transition",
              filled ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50/40",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [l]: !p[l] }))}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50/60 rounded-t-xl"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{LANGUAGE_FLAGS[l]}</span>
                <span className="text-sm font-medium text-slate-800">
                  {LANGUAGE_LABELS[l]}
                </span>
                {filled ? (
                  <span className="badge bg-emerald-50 text-emerald-700">Filled</span>
                ) : (
                  <span className="badge bg-slate-100 text-slate-500">Optional</span>
                )}
                {filled && !isOpen && (
                  <span
                    dir={rtl ? "rtl" : "ltr"}
                    className="ml-2 text-xs text-slate-500 truncate max-w-[36ch]"
                  >
                    {value.replace(/\s+/g, " ").slice(0, 60)}
                    {value.length > 60 && "…"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {filled && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {value.length} chars
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100">
                <textarea
                  dir={rtl ? "rtl" : "ltr"}
                  value={value}
                  onChange={(e) => onChange(l, e.target.value)}
                  placeholder={`Leave blank if you don't want to send in ${LANGUAGE_LABELS[l]}…`}
                  rows={4}
                  className="w-full resize-y rounded-b-xl border-0 bg-transparent px-4 py-3 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-200 font-mono"
                />
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-slate-500">
        Tip: leave a language blank and guests preferring it will receive the
        fallback version instead. Use{" "}
        <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">
          {`{{name}}`}
        </code>{" "}
        for the guest's name.
      </p>
    </div>
  );
}
