import type { AuthenticationState } from "@whiskeysockets/baileys";

/**
 * Events emitted during the pairing lifecycle. The worker subscribes to these
 * to forward them over Redis pub/sub → SSE → UI.
 */
export type PairingEvent =
  | { type: "connecting" }
  | { type: "qr"; qr: string; expiresInSec: number }
  | { type: "connected"; phoneE164: string }
  | { type: "logged_out" }
  | { type: "failed"; reason: string };

/**
 * Dependencies the worker passes when constructing a BaileysWaDriver. The
 * auth state + saveCreds are produced by the Postgres adapter
 * (apps/worker/src/baileys-auth.ts).
 */
export interface BaileysDriverDeps {
  orgId: string;
  authState: AuthenticationState;
  saveCreds: () => Promise<void>;
  /** Forward QR + connection updates to the control listener. */
  onPairingEvent?: (e: PairingEvent) => void;
  /** Fired when WhatsApp terminates the linked-device session. */
  onSessionLoggedOut?: () => Promise<void>;
  /**
   * Fired when an inbound message arrives from a new number. We only record
   * the timestamp in `wa_inbound_touches` — no body, no full inbox.
   */
  onInboundTouch?: (fromE164: string, at: Date) => Promise<void>;
}
