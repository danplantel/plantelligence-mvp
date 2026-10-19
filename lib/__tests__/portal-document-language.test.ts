import { describe, expect, it } from "vitest";

import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";

describe("normalizePortalDocumentLanguage", () => {
  it("defaults empty values to EN", () => {
    expect(normalizePortalDocumentLanguage(null)).toBe("EN");
    expect(normalizePortalDocumentLanguage(undefined)).toBe("EN");
    expect(normalizePortalDocumentLanguage("   ")).toBe("EN");
  });

  it("honors a custom fallback", () => {
    expect(normalizePortalDocumentLanguage("", "ES")).toBe("ES");
    expect(normalizePortalDocumentLanguage("fr", "ES")).toBe("ES");
  });

  it("normalizes Spanish variants", () => {
    for (const value of ["ES", "es", "español", "espanol", " sp "]) {
      const expected = value.trim().toLowerCase() === "sp" ? "EN" : "ES";
      expect(normalizePortalDocumentLanguage(value)).toBe(expected);
    }
  });

  it("normalizes English variants", () => {
    expect(normalizePortalDocumentLanguage("EN")).toBe("EN");
    expect(normalizePortalDocumentLanguage("english")).toBe("EN");
    expect(normalizePortalDocumentLanguage("en-us")).toBe("EN");
    expect(normalizePortalDocumentLanguage("en_us")).toBe("EN");
  });

  it("accepts short two-letter prefixes only", () => {
    expect(normalizePortalDocumentLanguage("es-MX")).toBe("EN");
    expect(normalizePortalDocumentLanguage("en-GB")).toBe("EN");
  });

  it("trims and ignores case", () => {
    expect(normalizePortalDocumentLanguage("  ENGLISH  ")).toBe("EN");
    expect(normalizePortalDocumentLanguage("  Español  ")).toBe("ES");
  });

  it("falls back for an unknown language", () => {
    expect(normalizePortalDocumentLanguage("fr")).toBe("EN");
    expect(normalizePortalDocumentLanguage("de", "ES")).toBe("ES");
  });
});
