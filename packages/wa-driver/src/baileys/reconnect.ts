import { DisconnectReason } from "@whiskeysockets/baileys";

/**
 * Whether a given Baileys disconnect should trigger an auto-reconnect.
 *
 * `loggedOut`, `forbidden`, `connectionReplaced` are all terminal: WhatsApp
 * has explicitly rejected this session identity. Reconnecting with the same
 * creds just reproduces the rejection in a loop and — worse — in the
 * `connectionReplaced` case each retry may itself be seen as another pairing
 * attempt, tripping ban heuristics. The user must re-scan a QR to recover.
 */
export function shouldReconnect(statusCode: number | undefined): boolean {
  if (statusCode === DisconnectReason.loggedOut) return false;
  if (statusCode === DisconnectReason.forbidden) return false;
  if (statusCode === DisconnectReason.connectionReplaced) return false;
  return true;
}

/** Terminal-but-we-should-clean-up statuses (treat as logged-out for UI). */
export function isTerminalKick(statusCode: number | undefined): boolean {
  return (
    statusCode === DisconnectReason.loggedOut ||
    statusCode === DisconnectReason.forbidden ||
    statusCode === DisconnectReason.connectionReplaced
  );
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
