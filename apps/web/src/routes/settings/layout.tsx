import { Outlet, useLocation, useNavigate } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { Page } from "../../components/Page.js";
import { cn } from "../../lib/cn.js";
import { SETTINGS_TABS, type SettingsTab } from "./_components/tabs.js";

const DEFAULT_TAB: SettingsTab = "general";

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Pathname is /settings/<tab>/...; the segment immediately after /settings
  // is the active tab. Falls back to the default for the bare /settings URL,
  // which the route table also redirects to /settings/general.
  const segment = location.pathname.split("/")[2] ?? DEFAULT_TAB;
  const current: SettingsTab = SETTINGS_TABS.some((t) => t.value === segment)
    ? (segment as SettingsTab)
    : DEFAULT_TAB;

  return (
    <Page title="Settings">
      <Tabs.Root
        value={current}
        // Manual activation: arrow keys move focus only; Enter/Space activates.
        // Without this, arrow-keying the tablist would push a navigate() per
        // step and spam browser history.
        activationMode="manual"
        onValueChange={(v) => navigate(`/settings/${v}`)}
      >
        <Tabs.List
          aria-label="Settings sections"
          className="-mt-2 mb-6 flex gap-1 border-b border-slate-200 overflow-x-auto"
        >
          {SETTINGS_TABS.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              aria-controls="settings-panel"
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-500 transition rounded-t-md",
                "hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
                "data-[state=active]:text-brand-700",
                "data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px",
                "data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-brand-600",
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div id="settings-panel" className="max-w-2xl">
          <Outlet />
        </div>
      </Tabs.Root>
    </Page>
  );
}
