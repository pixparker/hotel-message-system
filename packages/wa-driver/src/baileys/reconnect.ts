import { DisconnectReason } from "@whiskeysockets/baileys";

/**
 * Whether a given Baileys disconnect should trigger an auto-reconnect.
 * `loggedOut` means WhatsApp explicitly terminated the linked device — no
 * amount of retries recovers from that; the user has to re-scan the QR.
 */
export function shouldReconnect(statusCode: number | undefined): boolean {
  if (statusCode === DisconnectReason.loggedOut) return false;
  if (statusCode === DisconnectReason.forbidden) return false;
  return true;
}

/**
 * Exponential-ish backoff with jitter. Capped at 60s; giving up after 5
 * attempts is a deliberate choice — retry storms trip WhatsApp's abuse
 * detection and are the #1 avoidable ban trigger. After the cap, the user
 * must manually reconnect from Settings.
 */
export const RECONNECT_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
export const MAX_RECONNECT_ATTEMPTS = RECONNECT_BACKOFF_MS.length;

export function backoffDelayMs(attempt: number): number {
  const base = RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)]!;
  const jitter = 0.8 + Math.random() * 0.4; // ±20%
  return Math.round(base * jitter);
}
