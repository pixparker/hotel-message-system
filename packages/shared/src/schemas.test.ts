import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  settingsUpdateSchema,
  waConfigSchema,
  contactCreateSchema,
  contactUpdateSchema,
  audienceCreateSchema,
  audienceMembershipSchema,
  tagCreateSchema,
  campaignCreateSchema,
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

describe("contactCreateSchema", () => {
  it("requires a valid phone", () => {
    expect(() =>
      contactCreateSchema.parse({ name: "X", phone: "+905321112233", language: "tr" }),
    ).not.toThrow();
    expect(() =>
      contactCreateSchema.parse({ name: "X", phone: "invalid", language: "tr" }),
    ).toThrow();
  });

  it("accepts source + audienceIds + tagIds", () => {
    const parsed = contactCreateSchema.parse({
      name: "Sara",
      phone: "+905321112233",
      language: "tr",
      source: "manual",
      audienceIds: ["11111111-1111-1111-1111-111111111111"],
      tagIds: ["22222222-2222-2222-2222-222222222222"],
      isActive: true,
    });
    expect(parsed.source).toBe("manual");
    expect(parsed.audienceIds).toHaveLength(1);
    expect(parsed.tagIds).toHaveLength(1);
    expect(parsed.isActive).toBe(true);
  });

  it("rejects non-uuid audience ids", () => {
    expect(() =>
      contactCreateSchema.parse({
        name: "Sara",
        phone: "+905321112233",
        language: "tr",
        audienceIds: ["not-a-uuid"],
      }),
    ).toThrow();
  });

  it("rejects unknown source values", () => {
    expect(() =>
      contactCreateSchema.parse({
        name: "Sara",
        phone: "+905321112233",
        language: "tr",
        source: "bogus" as never,
      }),
    ).toThrow();
  });

  it("is aliased as guestCreateSchema for backwards compatibility", () => {
    expect(guestCreateSchema).toBe(contactCreateSchema);
  });
});

describe("contactUpdateSchema", () => {
  it("is fully partial — empty object is valid", () => {
    expect(() => contactUpdateSchema.parse({})).not.toThrow();
  });

  it("validates fields when present", () => {
    expect(() =>
      contactUpdateSchema.parse({ phone: "invalid" }),
    ).toThrow();
  });
});

describe("audienceCreateSchema", () => {
  it("defaults kind to custom", () => {
    const parsed = audienceCreateSchema.parse({ name: "Returning" });
    expect(parsed.kind).toBe("custom");
  });

  it("rejects empty or overly long names", () => {
    expect(() => audienceCreateSchema.parse({ name: "" })).toThrow();
    expect(() =>
      audienceCreateSchema.parse({ name: "x".repeat(81) }),
    ).toThrow();
  });

  it("rejects unknown kinds", () => {
    expect(() =>
      audienceCreateSchema.parse({ name: "X", kind: "unknown" as never }),
    ).toThrow();
  });
});

describe("audienceMembershipSchema", () => {
  it("requires at least one uuid", () => {
    expect(() => audienceMembershipSchema.parse({ contactIds: [] })).toThrow();
    expect(() =>
      audienceMembershipSchema.parse({
        contactIds: ["33333333-3333-3333-3333-333333333333"],
      }),
    ).not.toThrow();
  });
});

describe("tagCreateSchema", () => {
  it("accepts a hex color and normalises to lowercase", () => {
    const parsed = tagCreateSchema.parse({ label: "VIP", color: "F59E0B" });
    expect(parsed.color).toBe("#f59e0b");
  });

  it("rejects non-hex colors", () => {
    expect(() =>
      tagCreateSchema.parse({ label: "VIP", color: "red" }),
    ).toThrow();
  });
});

describe("campaignCreateSchema", () => {
  it("accepts audience-based targeting", () => {
    expect(() =>
      campaignCreateSchema.parse({
        title: "Live music Friday",
        templateId: "44444444-4444-4444-4444-444444444444",
        audienceIds: ["55555555-5555-5555-5555-555555555555"],
      }),
    ).not.toThrow();
  });

  it("still accepts legacy recipientFilter input", () => {
    const parsed = campaignCreateSchema.parse({
      title: "Breakfast reminder",
      templateId: "44444444-4444-4444-4444-444444444444",
    });
    expect(parsed.recipientFilter.status).toBe("checked_in");
  });

  it("requires template or customBodies", () => {
    expect(() =>
      campaignCreateSchema.parse({ title: "No body" }),
    ).toThrow();
  });
});
