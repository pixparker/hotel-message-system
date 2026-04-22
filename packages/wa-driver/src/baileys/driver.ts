import type { WASocket } from "@whiskeysockets/baileys";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import type {
  InboundMessage,
  ProviderName,
  SendResult,
  StatusEvent,
  WaDriver,
} from "../driver.js";
import type { BaileysDriverDeps, PairingEvent } from "./types.js";
import {
  MAX_RECONNECT_ATTEMPTS,
  backoffDelayMs,
  shouldReconnect,
} from "./reconnect.js";

export class BaileysNotConnectedError extends Error {
  constructor(message = "baileys_not_connected") {
    super(message);
    this.name = "BaileysNotConnectedError";
  }
}

/**
 * Baileys (unofficial WhatsApp Web) driver. Owns a long-lived WebSocket per
 * tenant; scheduled by the worker's control listener, not the factory. One
 * instance per org — do not share.
 *
 * Safety: 1.5–4s jitter before every send, and we refuse to send before
 * `waitForSocketOpen()` resolves. Ban-risk mitigations (rate limits,
 * daily caps) live in the worker — this driver is the thin wire layer.
 */
export class BaileysWaDriver implements WaDriver {
  readonly name: ProviderName = "baileys";

  private sock: WASocket | null = null;
  private readonly statusHandlers: Array<(e: StatusEvent) => void> = [];
  private readonly inboundHandlers: Array<(e: InboundMessage) => void> = [];
  private reconnectAttempts = 0;
  private closed = false;
  // Silence Baileys' internal logger — it's extremely noisy on info/debug.
  // Warn keeps useful failure signal without drowning the worker's pino output.
  private readonly logger = pino({ name: "baileys", level: "warn" });

  constructor(private readonly deps: BaileysDriverDeps) {}

  /**
   * Start the WebSocket. Called lazily by the worker — either on a new
   * pairing request (no creds yet → QR flow) or on first send for an
   * already-paired org (creds loaded → resume).
   */
  async connect(): Promise<void> {
    await this.openSocket();
  }

  onStatus(cb: (e: StatusEvent) => void): void {
    this.statusHandlers.push(cb);
  }

  onInbound(cb: (e: InboundMessage) => void): void {
    this.inboundHandlers.push(cb);
  }

  async close(): Promise<void> {
    this.closed = true;
    try {
      this.sock?.end(undefined);
    } catch {
      /* ignore */
    }
    this.sock = null;
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    const sock = this.sock;
    if (!sock) throw new BaileysNotConnectedError();

    // Human-ish jitter. The worker's rate limiter imposes a per-minute ceiling;
    // this enforces per-send spacing so 30/min doesn't mean "30 in the first
    // second then silence for 59s."
    await sleep(1500 + Math.random() * 2500);

    // Wait at most 10s for the socket to be ready. If it's reconnecting, the
    // BullMQ retry will pick up the job again — don't block the worker.
    const ready = await Promise.race([
      sock.waitForSocketOpen().then(() => true),
      sleep(10_000).then(() => false),
    ]);
    if (!ready) throw new BaileysNotConnectedError("socket_open_timeout");

    const jid = toJid(to);
    const msg = await sock.sendMessage(jid, { text: body });
    const id = msg?.key?.id;
    if (!id) {
      throw new Error("baileys_no_message_id");
    }
    return { providerMessageId: id };
  }

  /**
   * Batched validity check — maps raw E.164 numbers to whether they're
   * registered on WhatsApp. Used by the campaign pre-flight safety check.
   * Returns "unknown" if the socket is unavailable.
   */
  async checkOnWhatsApp(
    numbers: string[],
  ): Promise<Map<string, "on-whatsapp" | "not-on-whatsapp" | "unknown">> {
    const out = new Map<string, "on-whatsapp" | "not-on-whatsapp" | "unknown">();
    const sock = this.sock;
    if (!sock || numbers.length === 0) {
      for (const n of numbers) out.set(n, "unknown");
      return out;
    }
    const ready = await Promise.race([
      sock.waitForSocketOpen().then(() => true),
      sleep(5_000).then(() => false),
    ]);
    if (!ready) {
      for (const n of numbers) out.set(n, "unknown");
      return out;
    }
    // WA only accepts one number per onWhatsApp request in some builds; be
    // defensive and map back by the normalized phone, not JID, so the caller
    // can look up by what they provided.
    const jids = numbers.map(toJid);
    try {
      const res = await sock.onWhatsApp(...jids);
      const byJid = new Map<string, boolean>();
      for (const r of res ?? []) byJid.set(r.jid, Boolean(r.exists));
      for (const n of numbers) {
        const jid = toJid(n);
        if (byJid.has(jid)) {
          out.set(n, byJid.get(jid) ? "on-whatsapp" : "not-on-whatsapp");
        } else {
          out.set(n, "unknown");
        }
      }
    } catch {
      for (const n of numbers) out.set(n, "unknown");
    }
    return out;
  }

  // --------------------------------------------------------------------------

  private async openSocket(): Promise<void> {
    if (this.closed) return;

    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: undefined as unknown as [number, number, number] | undefined,
    }));

    this.sock = makeWASocket({
      auth: this.deps.authState,
      browser: Browsers.ubuntu("HMS"),
      printQRInTerminal: false,
      logger: this.logger,
      version,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    // Persist creds whenever Baileys mutates them.
    this.sock.ev.on("creds.update", () => {
      this.deps.saveCreds().catch((err) => {
        this.logger.error({ err, orgId: this.deps.orgId }, "saveCreds failed");
      });
    });

    this.sock.ev.on("connection.update", (u) => this.onConnectionUpdate(u));
    this.sock.ev.on("messages.update", (updates) => this.onMessagesUpdate(updates));
    this.sock.ev.on("messages.upsert", (evt) => this.onMessagesUpsert(evt));
  }

  private async onConnectionUpdate(
    u: Partial<import("@whiskeysockets/baileys").ConnectionState>,
  ): Promise<void> {
    const { connection, qr, lastDisconnect } = u;

    if (qr) {
      this.deps.onPairingEvent?.({ type: "qr", qr, expiresInSec: 20 });
      return;
    }

    if (connection === "connecting") {
      this.deps.onPairingEvent?.({ type: "connecting" });
      return;
    }

    if (connection === "open") {
      this.reconnectAttempts = 0;
      const phoneE164 = userIdToE164(this.sock?.user?.id);
      this.deps.onPairingEvent?.({ type: "connected", phoneE164 });
      return;
    }

    if (connection === "close") {
      // lastDisconnect.error is a Boom error; we duck-type it to avoid an
      // extra dep just for the type.
      const statusCode =
        (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode ?? undefined;

      // Explicit logout: WhatsApp terminated the linked device. This is the
      // strongest signal of a potential ban — surface it to the caller so
      // they can stop retrying and warn the user.
      if (statusCode === DisconnectReason.loggedOut) {
        this.deps.onPairingEvent?.({ type: "logged_out" });
        await this.deps.onSessionLoggedOut?.().catch(() => {});
        await this.close();
        return;
      }

      if (!shouldReconnect(statusCode) || this.closed) return;

      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.deps.onPairingEvent?.({
          type: "failed",
          reason: `max_reconnects (last: ${statusCode ?? "unknown"})`,
        });
        await this.close();
        return;
      }

      const delay = backoffDelayMs(this.reconnectAttempts);
      this.reconnectAttempts += 1;
      this.logger.warn(
        { orgId: this.deps.orgId, attempt: this.reconnectAttempts, delay, statusCode },
        "baileys reconnecting",
      );
      await sleep(delay);
      if (!this.closed) {
        await this.openSocket().catch((err) => {
          this.logger.error({ err }, "baileys reconnect open failed");
        });
      }
    }
  }

  private onMessagesUpdate(
    updates: import("@whiskeysockets/baileys").WAMessageUpdate[],
  ): void {
    for (const u of updates) {
      // We only track our own outbound messages. Inbound status reports
      // (fromMe=false) shouldn't touch our message table.
      if (!u.key?.fromMe) continue;
      const providerMessageId = u.key.id;
      if (!providerMessageId) continue;

      const mapped = mapBaileysStatus(u.update?.status);
      if (!mapped) continue;

      const event: StatusEvent = {
        providerMessageId,
        status: mapped,
        at: new Date(),
        error: mapped === "failed" ? "baileys_error" : undefined,
      };
      for (const h of this.statusHandlers) h(event);
    }
  }

  private onMessagesUpsert(
    evt: {
      messages: import("@whiskeysockets/baileys").proto.IWebMessageInfo[];
      type: "notify" | "append";
    },
  ): void {
    if (evt.type !== "notify") return;
    for (const m of evt.messages) {
      if (m.key.fromMe) continue; // our own echoes
      const fromJid = m.key.remoteJid;
      if (!fromJid || fromJid.endsWith("@g.us")) continue; // no groups in MVP
      const fromE164 = jidToE164(fromJid);
      if (!fromE164) continue;
      this.deps
        .onInboundTouch?.(fromE164, new Date())
        .catch(() => {
          /* best-effort — inbound touch is advisory, never blocks */
        });

      const body =
        m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "";
      if (body && this.inboundHandlers.length > 0) {
        const event: InboundMessage = {
          from: fromE164,
          body,
          at: new Date(
            (typeof m.messageTimestamp === "number"
              ? m.messageTimestamp
              : Number(m.messageTimestamp ?? 0)) * 1000 || Date.now(),
          ),
        };
        for (const h of this.inboundHandlers) h(event);
      }
    }
  }
}

// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * E.164 → WhatsApp JID. `+905551112233` becomes `905551112233@s.whatsapp.net`.
 * Baileys rejects the leading `+`.
 */
function toJid(phoneE164: string): string {
  const digits = phoneE164.replace(/[^0-9]/g, "");
  return `${digits}@s.whatsapp.net`;
}

/** WhatsApp user id → E.164 (strips the device suffix and reprefixes +). */
function userIdToE164(userId: string | undefined | null): string {
  if (!userId) return "";
  // e.g. "905551112233:23@s.whatsapp.net" → "905551112233"
  const [left] = userId.split("@");
  const digits = (left ?? "").split(":")[0]?.replace(/[^0-9]/g, "") ?? "";
  return digits ? `+${digits}` : "";
}

function jidToE164(jid: string): string | null {
  const [left] = jid.split("@");
  const digits = (left ?? "").split(":")[0]?.replace(/[^0-9]/g, "") ?? "";
  return digits ? `+${digits}` : null;
}

/**
 * Map Baileys' numeric WAMessageStatus → our StatusEvent status.
 *   0 ERROR | 1 PENDING | 2 SERVER_ACK (sent) | 3 DELIVERY_ACK | 4 READ | 5 PLAYED
 * SERVER_ACK is ignored because we set status='sent' on the send path itself.
 */
function mapBaileysStatus(
  status: number | null | undefined,
): StatusEvent["status"] | null {
  switch (status) {
    case 0:
      return "failed";
    case 3:
      return "delivered";
    case 4:
    case 5:
      return "read";
    default:
      return null;
  }
}
