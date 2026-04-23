import { Check } from "lucide-react";

export function ProviderCard(props: {
  active: boolean;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  onActivate: () => void;
  /** Prevents switching to a provider that isn't ready (e.g. Baileys not paired). */
  canActivate?: boolean;
}) {
  const activatable = props.canActivate ?? true;
  const canSelect = activatable && !props.active;
  const handleActivate = () => {
    if (canSelect) props.onActivate();
  };
  return (
    <div
      role="radio"
      aria-checked={props.active}
      aria-disabled={!activatable}
      tabIndex={canSelect ? 0 : -1}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && canSelect) {
          e.preventDefault();
          props.onActivate();
        }
      }}
      title={
        !activatable
          ? "Connect first, then activate this provider."
          : props.active
            ? "This provider is active"
            : "Activate this provider"
      }
      className={
        "rounded-lg border p-4 flex items-start gap-3 transition " +
        (props.active
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
          : canSelect
            ? "border-slate-200 bg-white cursor-pointer hover:border-brand-300 hover:bg-brand-50/40"
            : "border-slate-200 bg-white cursor-not-allowed opacity-90")
      }
    >
      <div
        aria-hidden
        className={
          "mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center transition " +
          (props.active
            ? "bg-brand-600 text-white"
            : activatable
              ? "border-2 border-slate-300"
              : "border-2 border-slate-200")
        }
      >
        {props.active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          {props.badge}
        </div>
        <div className="mt-0.5 text-xs text-slate-600">{props.subtitle}</div>
      </div>
      {props.action && (
        <div onClick={(e) => e.stopPropagation()}>{props.action}</div>
      )}
    </div>
  );
}
