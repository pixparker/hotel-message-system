import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(raw: string, defaultCountry?: string): string {
  const trimmed = raw.trim();
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry as any);
  if (!parsed || !parsed.isValid()) {
    throw new Error("Invalid phone number");
  }
  return parsed.number;
}

export function isValidPhone(raw: string, defaultCountry?: string): boolean {
  const parsed = parsePhoneNumberFromString(raw.trim(), defaultCountry as any);
  return parsed?.isValid() ?? false;
}

export function formatPhoneDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.formatInternational() ?? e164;
}
