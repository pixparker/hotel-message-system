import * as Tabs from "@radix-ui/react-tabs";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, RTL_LANGUAGES, type Language } from "@hms/shared";
import { cn } from "../lib/cn.js";

export function LanguageTabs({
  value,
  onChange,
  bodies,
  onBodyChange,
}: {
  value: Language;
  onChange: (l: Language) => void;
  bodies: Partial<Record<Language, string>>;
  onBodyChange: (l: Language, body: string) => void;
}) {
  return (
    <Tabs.Root value={value} onValueChange={(v) => onChange(v as Language)}>
      <Tabs.List className="flex gap-1 border-b border-slate-200">
        {SUPPORTED_LANGUAGES.map((l) => (
          <Tabs.Trigger
            key={l}
            value={l}
            className={cn(
              "px-3 py-2 text-sm font-medium text-slate-500 border-b-2 border-transparent",
              "data-[state=active]:border-brand-500 data-[state=active]:text-brand-700",
            )}
          >
            {LANGUAGE_LABELS[l]}
            {bodies[l] && bodies[l]!.length > 0 && (
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {SUPPORTED_LANGUAGES.map((l) => (
        <Tabs.Content key={l} value={l} className="pt-4">
          <textarea
            dir={RTL_LANGUAGES.has(l) ? "rtl" : "ltr"}
            value={bodies[l] ?? ""}
            onChange={(e) => onBodyChange(l, e.target.value)}
            placeholder={`Message in ${LANGUAGE_LABELS[l]}…`}
            rows={6}
            className="input min-h-[140px] font-mono text-[13px]"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>Use {"{{name}}"} for the guest name.</span>
            <span>{bodies[l]?.length ?? 0} chars</span>
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
