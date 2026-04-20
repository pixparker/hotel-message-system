import { Edit3, Hotel, FileUp, Sparkles } from "lucide-react";
import type { ContactSource } from "../hooks/useContacts.js";

const SOURCE_META: Record<
  ContactSource,
  { label: string; className: string; icon: typeof Edit3 }
> = {
  manual: {
    label: "Manual",
    className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
    icon: Edit3,
  },
  hotel: {
    label: "Hotel",
    className: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100",
    icon: Hotel,
  },
  csv: {
    label: "CSV",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100",
    icon: FileUp,
  },
  future: {
    label: "Integration",
    className: "bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100",
    icon: Sparkles,
  },
};

export function SourceBadge({ source }: { source: ContactSource }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
