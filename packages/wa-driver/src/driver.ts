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

export interface WaDriver {
  readonly name: ProviderName;
  sendText(to: string, body: string): Promise<SendResult>;
  onStatus(cb: (e: StatusEvent) => void): void;
  onInbound(cb: (e: InboundMessage) => void): void;
  /** Called once on shutdown. */
  close?(): Promise<void>;
}
