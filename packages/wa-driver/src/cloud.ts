import type {
  InboundMessage,
  ProviderName,
  SendResult,
  StatusEvent,
  WaDriver,
} from "./driver.js";

export interface CloudDriverConfig {
  accessToken: string;
  phoneNumberId: string;
  /** Meta Graph API version, e.g. "v22.0". Defaults to v22.0. */
  apiVersion?: string;
}

/**
 * Error classification for Meta Cloud API responses.
 * - 429 and 5xx are retryable (transient)
 * - other 4xx are terminal (permission, template rejected, bad phone)
 */
export class CloudApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
    public body?: unknown,
  ) {
    super(message);
    this.name = "CloudApiError";
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Meta WhatsApp Cloud API driver.
 *
 * One instance per tenant. Credentials come from settings.waConfig.
 * Status events are NOT emitted by this driver directly — they arrive
 * via the /api/webhooks/whatsapp endpoint. To wire them into the worker
 * pipeline, see the cloud webhook handler.
 */
export class CloudWaDriver implements WaDriver {
  readonly name: ProviderName = "cloud";

  private readonly apiVersion: string;
  private readonly statusHandlers: Array<(e: StatusEvent) => void> = [];
  private readonly inboundHandlers: Array<(e: InboundMessage) => void> = [];

  constructor(private readonly config: CloudDriverConfig) {
    this.apiVersion = config.apiVersion ?? "v22.0";
  }

  private get endpoint(): string {
    return `https://graph.facebook.com/${this.apiVersion}/${this.config.phoneNumberId}/messages`;
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body, preview_url: false },
    };

    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Network/DNS error — retryable.
      const message = err instanceof Error ? err.message : String(err);
      throw new CloudApiError(`network_error: ${message}`, 0, true);
    }

    const text = await res.text();
    let parsed: { messages?: Array<{ id: string }>; error?: { message: string; code: number } } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* ignore — we'll treat as opaque */
    }

    if (!res.ok) {
      const msg = parsed?.error?.message ?? `HTTP ${res.status}`;
      throw new CloudApiError(msg, res.status, isRetryable(res.status), parsed);
    }

    const messageId = parsed?.messages?.[0]?.id;
    if (!messageId) {
      throw new CloudApiError("no_message_id_in_response", 500, true, parsed);
    }

    return { providerMessageId: messageId };
  }

  onStatus(cb: (e: StatusEvent) => void): void {
    this.statusHandlers.push(cb);
  }

  onInbound(cb: (e: InboundMessage) => void): void {
    this.inboundHandlers.push(cb);
  }

  /**
   * Dispatch status events from an incoming webhook payload.
   * Called by the webhook handler after verifying the signature.
   *
   * Meta payload shape:
   *   entry[].changes[].value.statuses[] = [{ id, status, timestamp, errors? }]
   *   entry[].changes[].value.messages[] = [{ from, text: { body }, timestamp }]
   */
  handleWebhook(payload: unknown): void {
    const p = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id: string;
              status: string;
              timestamp: string;
              errors?: Array<{ title: string; message?: string }>;
            }>;
            messages?: Array<{
              from: string;
              timestamp: string;
              text?: { body: string };
              type: string;
            }>;
          };
        }>;
      }>;
    };

    for (const entry of p?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value) continue;

        for (const st of value.statuses ?? []) {
          const status = mapMetaStatus(st.status);
          if (!status) continue; // "sent" is emitted on send, we only care about terminal updates
          const event: StatusEvent = {
            providerMessageId: st.id,
            status,
            at: new Date(Number(st.timestamp) * 1000),
            error: st.errors?.[0]?.message ?? st.errors?.[0]?.title,
          };
          for (const h of this.statusHandlers) h(event);
        }

        for (const m of value.messages ?? []) {
          if (m.type !== "text" || !m.text?.body) continue;
          const event: InboundMessage = {
            from: m.from,
            body: m.text.body,
            at: new Date(Number(m.timestamp) * 1000),
          };
          for (const h of this.inboundHandlers) h(event);
        }
      }
    }
  }
}

function mapMetaStatus(s: string): StatusEvent["status"] | null {
  switch (s) {
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    // "sent" is emitted on our send path; ignore.
    default:
      return null;
  }
}
