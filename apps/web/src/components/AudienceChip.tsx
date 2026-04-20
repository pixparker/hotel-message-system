import { Hotel, Crown, Heart, Folder, Lock } from "lucide-react";
import type { AudienceKind } from "../hooks/useAudiences.js";

const KIND_META: Record<
  AudienceKind,
  { className: string; icon: typeof Folder }
> = {
  hotel_guests: {
    className: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100",
    icon: Hotel,
  },
  vip: {
    className:
      "bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100",
    icon: Crown,
  },
  friends: {
    className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
    icon: Heart,
  },
  custom: {
    className:
      "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100",
    icon: Folder,
  },
};

export function AudienceChip({
  name,
  kind,
  isSystem,
  size = "sm",
}: {
  name: string;
  kind: AudienceKind;
  isSystem?: boolean;
  size?: "sm" | "md";
}) {
  const meta = KIND_META[kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const sizeClass =
    size === "md"
      ? "px-2.5 py-1 text-[13px] gap-1.5"
      : "px-2 py-0.5 text-xs gap-1";
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${meta.className}`}
    >
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {name}
      {isSystem && (
        <Lock className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} />
      )}
    </span>
  );
}
