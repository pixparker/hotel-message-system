import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Palette,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Page } from "../components/Page.js";
import { api } from "../lib/api.js";
import { useToast } from "../components/toast.js";
import { PhoneInput } from "../components/PhoneInput.js";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLOR,
  applyBrandColor,
  isValidHex,
  normalizeHex,
} from "../lib/brand.js";
import { cn } from "../lib/cn.js";

interface Settings {
  waProvider: "mock" | "cloud" | "baileys";
  defaultTestPhone: string | null;
  brandPrimaryColor: string | null;
}

interface BaileysStatus {
  status: "none" | "pending" | "connected" | "logged_out" | "failed";
  phoneE164?: string | null;
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });
  const { data: baileys } = useQuery({
    queryKey: ["baileys-status"],
    queryFn: () => api<BaileysStatus>("/api/settings/whatsapp/baileys/status"),
  });
  const [defaultTestPhone, setDefaultTestPhone] = useState(
    data?.defaultTestPhone ?? "",
  );
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!data) return;
    setDefaultTestPhone(data.defaultTestPhone ?? "");
  }, [data]);

  async function saveTestPhone() {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ defaultTestPhone: defaultTestPhone || undefined }),
      });
      push({ variant: "success", title: "Default test number saved" });
      refetch();
    } catch {
      push({ variant: "error", title: "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function switchProvider(next: Settings["waProvider"]) {
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ waProvider: next }),
      });
      refetch();
    } catch {
      push({ variant: "error", title: "Could not switch provider" });
    }
  }

  return (
    <Page
      title="Settings"
      description="Configure WhatsApp delivery, branding, and defaults."
    >
      <div className="space-y-6 max-w-2xl">
        <BrandingCard
          currentColor={data?.brandPrimaryColor ?? null}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["settings"] });
            qc.invalidateQueries({ queryKey: ["settings-brand"] });
          }}
        />

        <div className="card p-6 space-y-5">
          <div>
            <div className="text-sm font-semibold">WhatsApp delivery</div>
            <p className="mt-1 text-xs text-slate-500">
              Pick how outgoing messages reach your contacts. You can switch at any time.
            </p>
          </div>

          <ProviderCard
            active={data?.waProvider === "mock"}
            title="Mock"
            subtitle="Demo / testing — messages are simulated, nothing is sent."
            onActivate={() => switchProvider("mock")}
          />

          <ProviderCard
            active={data?.waProvider === "baileys"}
            title="WhatsApp Web (Baileys) — Unofficial"
            subtitle={
              baileys?.status === "connected"
                ? `Connected as ${baileys.phoneE164 ?? "your phone"}`
                : "Scan a QR with your phone. Easy setup, no Meta verification — but ban risk."
            }
            badge={
              baileys?.status === "connected" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              ) : baileys?.status === "logged_out" || baileys?.status === "failed" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                  <AlertTriangle className="h-3 w-3" /> Session lost
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-700">Unofficial</span>
              )
            }
            action={
              <Link to="/settings/whatsapp-baileys" className="btn-secondary">
                {baileys?.status === "connected" ? "Manage" : "Connect"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            onActivate={() => switchProvider("baileys")}
            canActivate={baileys?.status === "connected"}
          />

          <ProviderCard
            active={data?.waProvider === "cloud"}
            title="Meta Cloud API — Official"
            subtitle="Reliable, high-volume. Requires WhatsApp Business verification."
            action={
              <Link to="/settings/whatsapp" className="btn-secondary">
                Connect
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            onActivate={() => switchProvider("cloud")}
          />
        </div>

        <div className="card p-6 space-y-4">
          <div>
            <label className="label" htmlFor="test">
              Default test number
            </label>
            <PhoneInput
              id="test"
              value={defaultTestPhone}
              onChange={setDefaultTestPhone}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-slate-500">
              Fallback test phone for staff without a personal one saved.
            </p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={saveTestPhone} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="card p-6 space-y-1">
          <div className="text-sm font-semibold">About</div>
          <div className="text-xs text-slate-500 select-all tabular-nums">
            {__APP_VERSION__}
          </div>
        </div>
      </div>
    </Page>
  );
}

function ProviderCard(props: {
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
  return (
    <div
      className={
        "rounded-lg border p-4 flex items-start gap-3 " +
        (props.active
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
          : "border-slate-200 bg-white")
      }
    >
      <button
        type="button"
        onClick={() => activatable && !props.active && props.onActivate()}
        disabled={!activatable}
        title={
          !activatable
            ? "Connect first, then activate this provider."
            : props.active
              ? "This provider is active"
              : "Activate this provider"
        }
        className={
          "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 " +
          (props.active
            ? "border-brand-600 bg-brand-600"
            : activatable
              ? "border-slate-300 hover:border-brand-500"
              : "border-slate-200 cursor-not-allowed")
        }
        aria-label={props.active ? "Active" : "Activate"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          {props.badge}
        </div>
        <div className="mt-0.5 text-xs text-slate-600">{props.subtitle}</div>
      </div>
      {props.action}
    </div>
  );
}

function BrandingCard({
  currentColor,
  onSaved,
}: {
  currentColor: string | null;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [customHex, setCustomHex] = useState("");
  const [saving, setSaving] = useState(false);

  // The color the UI is currently rendered with. Preset buttons show a
  // checkmark when their hex matches this.
  const active = currentColor ?? DEFAULT_BRAND_COLOR;
  const activePreset = BRAND_PRESETS.find(
    (p) => p.hex.toLowerCase() === active.toLowerCase(),
  );

  async function apply(hex: string) {
    const normalized = normalizeHex(hex);
    // Optimistically apply to the page so the user sees the change instantly;
    // persist in the background.
    applyBrandColor(normalized);
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ brandPrimaryColor: normalized }),
      });
      push({ variant: "success", title: "Theme updated" });
      onSaved();
    } catch {
      push({ variant: "error", title: "Could not save theme" });
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    await apply(DEFAULT_BRAND_COLOR);
  }

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidHex(customHex)) {
      push({
        variant: "error",
        title: "Invalid color",
        description: "Use a 3- or 6-digit hex code like #14a77a.",
      });
      return;
    }
    apply(customHex);
    setCustomHex("");
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-brand-600" />
            Brand color
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Sets the accent color across buttons, links, charts, and badges.
            Pick a preset or drop in any hex.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className="h-6 w-6 rounded-md ring-1 ring-slate-200"
            style={{ backgroundColor: active }}
            aria-hidden
          />
          <span className="font-mono text-slate-600">{active}</span>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-500 mb-2">Presets</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BRAND_PRESETS.map((p) => {
            const selected = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => apply(p.hex)}
                disabled={saving}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl border bg-white p-3 transition disabled:opacity-60",
                  selected
                    ? "border-slate-900/30 ring-2 ring-offset-2"
                    : "border-slate-200 hover:border-slate-300 hover:-translate-y-[1px]",
                )}
                style={
                  selected
                    ? ({
                        "--tw-ring-color": p.hex,
                      } as React.CSSProperties)
                    : undefined
                }
                title={p.name}
                aria-pressed={selected}
              >
                <span
                  className="relative h-9 w-9 rounded-full shadow-sm ring-1 ring-inset ring-black/5"
                  style={{ backgroundColor: p.hex }}
                  aria-hidden
                >
                  {selected && (
                    <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
                  )}
                </span>
                <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-500 mb-2">
          Or enter a custom hex
        </div>
        <form onSubmit={submitCustom} className="flex items-center gap-2">
          <input
            type="color"
            value={isValidHex(customHex) ? normalizeHex(customHex) : active}
            onChange={(e) => setCustomHex(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300"
            aria-label="Pick color"
          />
          <input
            type="text"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            placeholder="#14a77a"
            className="input w-36 font-mono tabular-nums"
            maxLength={7}
          />
          <button type="submit" className="btn-secondary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Applying
              </>
            ) : (
              "Apply"
            )}
          </button>
          <button
            type="button"
            onClick={resetDefault}
            className="btn-ghost ml-auto"
            disabled={saving}
            title="Reset to Hospitality Teal"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </form>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-slate-200 bg-surface-50 p-4">
        <div className="text-xs font-medium text-slate-500 mb-3">Preview</div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" type="button">
            Primary button
          </button>
          <button className="btn-secondary" type="button">
            Secondary
          </button>
          <span className="badge bg-brand-100 text-brand-800">Active</span>
          <a className="text-sm font-medium text-brand-700 hover:text-brand-900">
            Link example →
          </a>
          <div className="flex-1 min-w-[120px]">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "68%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
