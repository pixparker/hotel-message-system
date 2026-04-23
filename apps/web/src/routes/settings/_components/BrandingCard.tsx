import { useState } from "react";
import { Check, Loader2, Palette, RotateCcw } from "lucide-react";
import { api } from "../../../lib/api.js";
import { useToast } from "../../../components/toast.js";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLOR,
  applyBrandColor,
  isValidHex,
  normalizeHex,
} from "../../../lib/brand.js";
import { cn } from "../../../lib/cn.js";

export function BrandingCard({
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
