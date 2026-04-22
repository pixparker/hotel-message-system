import type { ProviderName, WaDriver } from "./driver.js";
import { MockWaDriver } from "./mock.js";
import { CloudWaDriver, type CloudDriverConfig } from "./cloud.js";
import { BaileysWaDriver } from "./baileys/index.js";
import type { BaileysDriverDeps } from "./baileys/index.js";

export interface CreateDriverOptions {
  cloud?: CloudDriverConfig;
  baileys?: BaileysDriverDeps;
}

export function createDriver(name: ProviderName, opts: CreateDriverOptions = {}): WaDriver {
  switch (name) {
    case "mock":
      return new MockWaDriver();
    case "cloud":
      if (!opts.cloud) {
        throw new Error("cloud driver requires { accessToken, phoneNumberId }");
      }
      return new CloudWaDriver(opts.cloud);
    case "baileys":
      if (!opts.baileys) {
        throw new Error("baileys driver requires { orgId, authState, saveCreds }");
      }
      return new BaileysWaDriver(opts.baileys);
  }
}
