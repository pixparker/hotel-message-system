import type { ProviderName, WaDriver } from "./driver.js";
import { MockWaDriver } from "./mock.js";

export function createDriver(name: ProviderName): WaDriver {
  switch (name) {
    case "mock":
      return new MockWaDriver();
    case "cloud":
      throw new Error("cloud driver not implemented in M1");
    case "baileys":
      throw new Error("baileys driver not implemented in M1");
  }
}
