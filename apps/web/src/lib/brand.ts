/**
 * Brand color theming. The Tailwind palette is wired to CSS custom
 * properties (`--brand-50` … `--brand-900`), so mutating those at runtime
 * re-themes the whole app instantly with no rebuild.
 *
 *  - presets: curated swatches the Settings page exposes
 *  - generateBrandScale(hex): builds a 50→900 scale from one base color
 *  - applyBrandColor(hex): writes the scale onto :root + persists locally
 *  - getStoredBrandColor(): reads the persisted color (used at boot to
 *    avoid a flash before the server settings load)
 */

const STORAGE_KEY = "hms-brand-color";
export const DEFAULT_BRAND_COLOR = "#14a77a";

export interface BrandPreset {
  id: string;
  name: string;
  hex: string;
}

export const BRAND_PRESETS: BrandPreset[] = [
  { id: "teal", name: "Hospitality Teal", hex: "#14a77a" },
  { id: "ocean", name: "Ocean Blue", hex: "#2563eb" },
  { id: "royal", name: "Royal Purple", hex: "#7c3aed" },
  { id: "sunset", name: "Sunset Coral", hex: "#f97316" },
  { id: "rose", name: "Rose", hex: "#e11d48" },
  { id: "slate", name: "Charcoal", hex: "#475569" },
];

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function mix(a: number, b: number, t: number): number {
  return Math.round(a * (1 - t) + b * t);
}

/**
 * Build a 9-stop scale by mixing the input toward white (lighter shades)
 * and toward black (darker shades). The input hex anchors stop 500.
 */
export function generateBrandScale(hex: string): Record<number, string> {
  const [r, g, b] = hexToRgb(hex);
  const blend = (
    target: [number, number, number],
    t: number,
  ): [number, number, number] => [
    mix(r, target[0], t),
    mix(g, target[1], t),
    mix(b, target[2], t),
  ];
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  const stops: Record<number, [number, number, number]> = {
    50: blend(white, 0.92),
    100: blend(white, 0.84),
    200: blend(white, 0.68),
    300: blend(white, 0.48),
    400: blend(white, 0.24),
    500: [r, g, b],
    600: blend(black, 0.16),
    700: blend(black, 0.32),
    800: blend(black, 0.48),
    900: blend(black, 0.64),
  };
  const out: Record<number, string> = {};
  for (const [k, [rr, gg, bb]] of Object.entries(stops)) {
    out[Number(k)] = `${rr} ${gg} ${bb}`;
  }
  return out;
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export function normalizeHex(value: string): string {
  let h = value.trim();
  if (!h.startsWith("#")) h = "#" + h;
  return h.toLowerCase();
}

export function applyBrandColor(hex: string | null | undefined): void {
  if (typeof document === "undefined") return;
  const color = hex && isValidHex(hex) ? normalizeHex(hex) : DEFAULT_BRAND_COLOR;
  const scale = generateBrandScale(color);
  const root = document.documentElement;
  for (const [stop, value] of Object.entries(scale)) {
    root.style.setProperty(`--brand-${stop}`, value);
  }
  try {
    localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // quota / privacy mode — ignore
  }
}

export function getStoredBrandColor(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && isValidHex(v) ? normalizeHex(v) : null;
  } catch {
    return null;
  }
}
