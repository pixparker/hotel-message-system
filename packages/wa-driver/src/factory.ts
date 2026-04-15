import type { ProviderName, WaDriver } from "./driver.js";
import { MockWaDriver } from "./mock.js";
import { CloudWaDriver, type CloudDriverConfig } from "./cloud.js";

export interface CreateDriverOptions {
  cloud?: CloudDriverConfig;
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
      throw new Error("baileys driver not implemented");
  }
}
