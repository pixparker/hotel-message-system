import type { Language } from "./languages.js";

export interface ContactContext {
  name: string;
  phoneE164: string;
  language: Language | string;
}

/** @deprecated use ContactContext */
export type GuestContext = ContactContext;

/**
 * Minimal mustache-style renderer: {{name}} → contact.name.
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

export function renderForContact(
  bodies: Record<string, string>,
  contact: ContactContext,
  fallbackLanguage: string,
): { language: string; body: string } {
  const language = bodies[contact.language] ? contact.language : fallbackLanguage;
  const body = pickBody(bodies, language, fallbackLanguage);
  return { language, body: renderBody(body, { name: contact.name }) };
}

/** @deprecated use renderForContact */
export const renderForGuest = renderForContact;
