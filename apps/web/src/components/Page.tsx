import type { ReactNode } from "react";

export function Page({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="mb-1.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
