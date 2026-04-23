import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";
import { useTemplates, type Template } from "../../hooks/useTemplates.js";
import { MODULES, type ModuleDefinition, type ModuleKey } from "../../lib/modules.js";

interface SettingsResponse {
  modules?: {
    checkIn?: {
      enabled?: boolean;
      checkInTemplateId?: string | null;
      checkOutTemplateId?: string | null;
    };
  };
}

/**
 * Settings → Modules tab.
 *
 * Installed modules are presented as a grid of square cards (logo + name).
 * Clicking a card opens a configuration modal for that module. A trailing
 * "+" placeholder opens the catalog modal so future modules can be added
 * without changing this page.
 */
export function ModulesSettingsPanel() {
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // First-party catalog: every module ships pre-installed, so the "installed"
  // list IS the registry today. The catalog modal will become meaningful when
  // a future module ships as not-installed-by-default.
  const installed = MODULES;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Modules add optional capabilities on top of the core sending workflow.
        Click a module to configure it.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {installed.map((m) => (
          <ModuleTile
            key={m.key}
            module={m}
            onClick={() => setActiveModule(m.key)}
          />
        ))}
        <AddModuleTile onClick={() => setCatalogOpen(true)} />
      </div>

      <CheckInModuleDialog
        open={activeModule === "check_in"}
        onOpenChange={(v) => setActiveModule(v ? "check_in" : null)}
      />

      <ModuleCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        installed={installed}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module tile (square card)

function ModuleTile({
  module: m,
  onClick,
}: {
  module: ModuleDefinition;
  onClick: () => void;
}) {
  const Icon = m.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`module-tile-${m.key}`}
      className="group relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100">
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-sm font-semibold text-slate-900">{m.name}</span>
      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" /> Installed
      </span>
    </button>
  );
}

function AddModuleTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="module-tile-add"
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/40 p-4 text-center text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-current">
        <Plus className="h-6 w-6" />
      </span>
      <span className="text-sm font-semibold">Add module</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Catalog modal (browse modules to install)

function ModuleCatalogDialog({
  open,
  onOpenChange,
  installed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  installed: ModuleDefinition[];
}) {
  // Today every module in the registry is installed. When the registry adds
  // a not-installed-by-default module, this page already has a place for it.
  const installedKeys = new Set(installed.map((m) => m.key));
  const available = MODULES.filter((m) => !installedKeys.has(m.key));

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add module"
      description="Browse the catalog and pick a module to install."
    >
      {available.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <div className="text-sm font-medium text-slate-700">
            You're all caught up
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Every module currently in the catalog is already installed. New
            modules will appear here as they ship.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {available.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.description}</div>
                </div>
                <button className="btn-secondary" disabled>
                  Install
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Check-In module configuration modal

interface CheckInForm {
  enabled: boolean;
  checkInTemplateId: string | null;
  checkOutTemplateId: string | null;
}

function CheckInModuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsResponse>("/api/settings"),
  });
  const { data: templates } = useTemplates();

  const initial: CheckInForm = {
    enabled: !!settings?.modules?.checkIn?.enabled,
    checkInTemplateId: settings?.modules?.checkIn?.checkInTemplateId ?? null,
    checkOutTemplateId: settings?.modules?.checkIn?.checkOutTemplateId ?? null,
  };

  const [form, setForm] = useState<CheckInForm>(initial);
  const [saving, setSaving] = useState(false);

  // Reset form whenever the modal opens or the server snapshot changes,
  // so an external save (or a stale local edit from a previous open) doesn't
  // leak across opens.
  useEffect(() => {
    if (!open) return;
    setForm({
      enabled: !!settings?.modules?.checkIn?.enabled,
      checkInTemplateId: settings?.modules?.checkIn?.checkInTemplateId ?? null,
      checkOutTemplateId: settings?.modules?.checkIn?.checkOutTemplateId ?? null,
    });
  }, [open, settings]);

  const dirty =
    form.enabled !== initial.enabled ||
    form.checkInTemplateId !== initial.checkInTemplateId ||
    form.checkOutTemplateId !== initial.checkOutTemplateId;

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          modules: {
            checkIn: {
              enabled: form.enabled,
              checkInTemplateId: form.checkInTemplateId,
              checkOutTemplateId: form.checkOutTemplateId,
            },
          },
        }),
      });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      push({ variant: "success", title: "Module settings saved" });
      onOpenChange(false);
    } catch {
      push({ variant: "error", title: "Could not save module settings" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Check-In module"
      description="Send a WhatsApp message automatically when a guest is checked in or out."
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Save changes
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Module enabled
            </div>
            <div className="text-xs text-slate-500">
              When off, no automatic check-in or check-out messages are sent.
            </div>
          </div>
          <ToggleSwitch
            checked={form.enabled}
            onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            label="Enable Check-In module"
          />
        </div>

        <fieldset
          disabled={!form.enabled}
          className="space-y-5 disabled:opacity-50 disabled:pointer-events-none"
        >
          <TemplatePickerRow
            title="On check-in"
            description="Sent the moment a guest's status flips to checked in."
            templates={templates ?? []}
            value={form.checkInTemplateId}
            onChange={(v) => setForm((f) => ({ ...f, checkInTemplateId: v }))}
          />
          <TemplatePickerRow
            title="On check-out"
            description="Sent the moment a guest is checked out — great for thank-you notes or feedback prompts."
            templates={templates ?? []}
            value={form.checkOutTemplateId}
            onChange={(v) => setForm((f) => ({ ...f, checkOutTemplateId: v }))}
          />
        </fieldset>

        {form.enabled &&
          !form.checkInTemplateId &&
          !form.checkOutTemplateId && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The module is on but no templates are picked yet — nothing will be
              sent. Choose at least one template above.
            </div>
          )}
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Shared building blocks

function ModalShell({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-slate-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mt-5">{children}</div>

          {footer && (
            <div className="mt-6 flex justify-end gap-2">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TemplatePickerRow(props: {
  title: string;
  description: string;
  templates: Template[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="label">{props.title}</label>
        <Link
          to="/templates"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900"
        >
          Manage templates <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{props.description}</p>
      <select
        className="input mt-2"
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value || null)}
      >
        <option value="">— No template —</option>
        {props.templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.bodies.length > 0
              ? ` · ${t.bodies.map((b) => b.language).join(", ")}`
              : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleSwitch(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      onClick={() => props.onChange(!props.checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
        (props.checked ? "bg-brand-600" : "bg-slate-300")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
          (props.checked ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}
