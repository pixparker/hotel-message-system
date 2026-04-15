import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, isEncrypted } from "./crypto.js";

describe("crypto", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = "EAAG0xxx-meta-access-token-abc123";
    const encrypted = encryptSecret(secret);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext every call (IV randomness)", () => {
    const secret = "same-input";
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it("round-trips multi-byte utf-8", () => {
    const secret = "密钥🔒فارسی";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("returns plain text unchanged (graceful migration path)", () => {
    const plain = "legacy-plaintext-token";
    expect(decryptSecret(plain)).toBe(plain);
  });

  it("isEncrypted detects prefix", () => {
    expect(isEncrypted(encryptSecret("foo"))).toBe(true);
    expect(isEncrypted("plaintext")).toBe(false);
    expect(isEncrypted(42)).toBe(false);
  });

  it("throws on malformed prefixed blob", () => {
    expect(() => decryptSecret("enc:v1:malformed")).toThrow();
  });
});
