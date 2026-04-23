import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Page } from "../components/Page.js";
import { api } from "../lib/api.js";
import { MODULES, type ModuleKey } from "../lib/modules.js";

interface SettingsResponse {
  modules?: {
    checkIn?: { enabled?: boolean };
  };
}

/**
 * Looks at per-workspace state to decide whether each catalog module's
 * behavior is currently active. Keeps the per-module mapping local — the
 * registry shouldn't know about the settings shape.
 */
function useEnabledModules(): Record<ModuleKey, boolean> {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsResponse>("/api/settings"),
  });
  return {
    // Default ON — mirrors the backend's default-on behavior for workspaces
    // that haven't explicitly toggled the module.
    check_in: data?.modules?.checkIn?.enabled ?? true,
  };
}

export function ModulesPage() {
  const enabledMap = useEnabledModules();
  return (
    <Page
      title="Modules"
      description="Optional capabilities that extend the core sending workflow. Install once, enable per workspace."
    >
      <div className="grid gap-4 sm:grid-cols-2 max-w-4xl">
        {MODULES.map((m) => {
          const enabled = enabledMap[m.key];
          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className="card p-5 flex flex-col gap-4"
              data-testid={`module-card-${m.key}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {m.name}
                    </h2>
                    <span className="badge bg-slate-100 text-slate-600">
                      Installed
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span
                  className={
                    enabled
                      ? "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"
                      : "inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"
                  }
                >
                  {enabled ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Enabled
                    </>
                  ) : (
                    <>
                      <Circle className="h-3.5 w-3.5" /> Not enabled
                    </>
                  )}
                </span>
                <Link to={m.settingsPath} className="btn-secondary">
                  Configure <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
