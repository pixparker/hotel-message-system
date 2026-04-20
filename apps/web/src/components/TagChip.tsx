import type { Tag } from "../hooks/useTags.js";

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
      style={tag.color ? { borderLeft: `3px solid ${tag.color}` } : undefined}
    >
      {tag.label}
    </span>
  );
}
