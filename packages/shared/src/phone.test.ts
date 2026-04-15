import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone, formatPhoneDisplay } from "./phone.js";

describe("normalizePhone", () => {
  it("normalizes a valid international number to E.164", () => {
    expect(normalizePhone("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("handles Turkish mobile", () => {
    expect(normalizePhone("+90 532 111 22 33")).toBe("+905321112233");
  });

  it("throws on invalid input", () => {
    expect(() => normalizePhone("not a phone")).toThrow("Invalid phone number");
  });

  it("throws on too short numbers", () => {
    expect(() => normalizePhone("+1")).toThrow();
  });
});

describe("isValidPhone", () => {
  it("returns true for valid E.164", () => {
    expect(isValidPhone("+905321112233")).toBe(true);
  });

  it("returns false for garbage input", () => {
    expect(isValidPhone("abc")).toBe(false);
  });

  it("returns false for empty", () => {
    expect(isValidPhone("")).toBe(false);
  });
});

describe("formatPhoneDisplay", () => {
  it("pretty-formats E.164", () => {
    const out = formatPhoneDisplay("+14155552671");
    // libphonenumber uses non-breaking spaces; just assert it changed.
    expect(out).not.toBe("+14155552671");
    expect(out).toMatch(/415/);
  });

  it("returns input on unparseable E.164", () => {
    expect(formatPhoneDisplay("not-a-phone")).toBe("not-a-phone");
  });
});
