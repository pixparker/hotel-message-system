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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 py-6 md:py-8">
      <div className="mb-6 md:mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
