export interface SendResult {
  providerMessageId: string;
}

export type TerminalStatus = "delivered" | "read" | "failed";

export interface StatusEvent {
  providerMessageId: string;
  status: "delivered" | "read" | "failed";
  at: Date;
  error?: string;
}

export interface InboundMessage {
  from: string;
  body: string;
  at: Date;
}

export type ProviderName = "mock" | "cloud" | "baileys";

/**
 * Result of a pre-flight validity lookup for a batch of E.164 numbers. Drivers
 * that can't answer (Cloud without a paid tier, mock, disconnected sockets)
 * should return "unknown" so the UI downgrades gracefully rather than blocking
 * sends on an unavailable signal.
 */
export type OnWhatsAppStatus = "on-whatsapp" | "not-on-whatsapp" | "unknown";

export interface WaDriver {
  readonly name: ProviderName;
  sendText(to: string, body: string): Promise<SendResult>;
  onStatus(cb: (e: StatusEvent) => void): void;
  onInbound(cb: (e: InboundMessage) => void): void;
  /** Optional pre-flight: is each number registered on WhatsApp? */
  checkOnWhatsApp?(numbers: string[]): Promise<Map<string, OnWhatsAppStatus>>;
  /** Called once on shutdown. */
  close?(): Promise<void>;
}
