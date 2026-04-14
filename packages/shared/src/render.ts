import type { Language } from "./languages.js";

export interface GuestContext {
  name: string;
  phoneE164: string;
  language: Language | string;
}

/**
 * Minimal mustache-style renderer: {{name}} → guest.name.
 * Missing keys render as an empty string.
 */
export function renderBody(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => ctx[key] ?? "");
}

export function pickBody(
  bodies: Record<string, string>,
  language: string,
  fallback: string,
): string {
  return bodies[language] ?? bodies[fallback] ?? Object.values(bodies)[0] ?? "";
}

export function renderForGuest(
  bodies: Record<string, string>,
  guest: GuestContext,
  fallbackLanguage: string,
): { language: string; body: string } {
  const language = bodies[guest.language] ? guest.language : fallbackLanguage;
  const body = pickBody(bodies, language, fallbackLanguage);
  return { language, body: renderBody(body, { name: guest.name }) };
}
