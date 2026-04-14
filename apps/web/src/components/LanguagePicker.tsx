import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type Language } from "@hms/shared";
import { cn } from "../lib/cn.js";

export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: "🇬🇧",
  tr: "🇹🇷",
  fa: "🇮🇷",
  ar: "🇸🇦",
};

export function LanguagePicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (l: Language) => void;
  id?: string;
}) {
  return (
    <div id={id} role="radiogroup" className="flex flex-wrap gap-2">
      {SUPPORTED_LANGUAGES.map((l) => {
        const selected = value === l;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(l)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
              selected
                ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <span className="text-base leading-none">{LANGUAGE_FLAGS[l]}</span>
            {LANGUAGE_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
