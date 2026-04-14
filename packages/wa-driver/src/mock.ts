import { randomUUID } from "node:crypto";
import type { InboundMessage, SendResult, StatusEvent, WaDriver } from "./driver.js";

export interface MockDriverOptions {
  /** Probability 0..1 of simulated failure on send. Default 0.02. */
  failureRate?: number;
  /** Milliseconds from send → delivered. Default 400-1200ms. */
  deliveryDelayMs?: () => number;
  /** Milliseconds from delivered → read. Default 1000-4000ms. */
  readDelayMs?: () => number;
}

export class MockWaDriver implements WaDriver {
  readonly name = "mock" as const;
  private statusHandlers: Array<(e: StatusEvent) => void> = [];
  private inboundHandlers: Array<(e: InboundMessage) => void> = [];
  private readonly failureRate: number;
  private readonly deliveryDelayMs: () => number;
  private readonly readDelayMs: () => number;

  constructor(opts: MockDriverOptions = {}) {
    this.failureRate = opts.failureRate ?? 0.02;
    this.deliveryDelayMs = opts.deliveryDelayMs ?? (() => 400 + Math.random() * 800);
    this.readDelayMs = opts.readDelayMs ?? (() => 1000 + Math.random() * 3000);
  }

  async sendText(_to: string, _body: string): Promise<SendResult> {
    if (Math.random() < this.failureRate) {
      throw new Error("mock: simulated provider failure");
    }
    const providerMessageId = `mock_${randomUUID()}`;
    this.scheduleTransitions(providerMessageId);
    return { providerMessageId };
  }

  onStatus(cb: (e: StatusEvent) => void): void {
    this.statusHandlers.push(cb);
  }

  onInbound(cb: (e: InboundMessage) => void): void {
    this.inboundHandlers.push(cb);
  }

  private emit(e: StatusEvent) {
    for (const h of this.statusHandlers) h(e);
  }

  private scheduleTransitions(providerMessageId: string) {
    setTimeout(() => {
      this.emit({ providerMessageId, status: "delivered", at: new Date() });
      setTimeout(() => {
        this.emit({ providerMessageId, status: "read", at: new Date() });
      }, this.readDelayMs());
    }, this.deliveryDelayMs());
  }
}
