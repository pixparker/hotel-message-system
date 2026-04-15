import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  settingsUpdateSchema,
  waConfigSchema,
  guestCreateSchema,
} from "./schemas.js";

describe("loginSchema", () => {
  it("requires email + non-empty password", () => {
    expect(() => loginSchema.parse({ email: "a@b.com", password: "x" })).not.toThrow();
    expect(() => loginSchema.parse({ email: "not-an-email", password: "x" })).toThrow();
    expect(() => loginSchema.parse({ email: "a@b.com", password: "" })).toThrow();
  });
});

describe("registerSchema", () => {
  it("enforces min 8-char password", () => {
    expect(() =>
      registerSchema.parse({ orgName: "Reform Hotel", email: "a@b.com", password: "1234567" }),
    ).toThrow();
  });

  it("defaults populateSampleData to false", () => {
    const res = registerSchema.parse({
      orgName: "Hotel",
      email: "a@b.com",
      password: "12345678",
    });
    expect(res.populateSampleData).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires a long token", () => {
    expect(() => resetPasswordSchema.parse({ token: "short", password: "12345678" })).toThrow();
    expect(() =>
      resetPasswordSchema.parse({
        token: "a".repeat(32),
        password: "12345678",
      }),
    ).not.toThrow();
  });
});

describe("waConfigSchema", () => {
  it("allows partial configs", () => {
    expect(() => waConfigSchema.parse({ phoneNumberId: "123" })).not.toThrow();
  });

  it("rejects empty strings for present fields", () => {
    expect(() => waConfigSchema.parse({ phoneNumberId: "" })).toThrow();
  });

  it("preserves passthrough fields", () => {
    const res = waConfigSchema.parse({ foo: "bar", phoneNumberId: "123" });
    expect((res as Record<string, unknown>).foo).toBe("bar");
  });
});

describe("settingsUpdateSchema", () => {
  it("uses waConfigSchema for the wa_config field", () => {
    expect(() =>
      settingsUpdateSchema.parse({ waConfig: { phoneNumberId: "" } }),
    ).toThrow();
    expect(() =>
      settingsUpdateSchema.parse({ waConfig: { phoneNumberId: "123" } }),
    ).not.toThrow();
  });
});

describe("guestCreateSchema", () => {
  it("requires valid phone", () => {
    expect(() =>
      guestCreateSchema.parse({ name: "X", phone: "+905321112233", language: "tr" }),
    ).not.toThrow();
    expect(() =>
      guestCreateSchema.parse({ name: "X", phone: "invalid", language: "tr" }),
    ).toThrow();
  });
});
