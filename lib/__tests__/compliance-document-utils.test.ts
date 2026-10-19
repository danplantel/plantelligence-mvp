import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  franc: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("franc", () => ({ franc: mocks.franc }));
vi.mock("@/lib/pdf-text-normalize", () => ({
  normalizePdfText: (text: string) => text.trim(),
}));

import {
  analyzeDocumentCategory,
  convertToDocumentFormat,
  detectBenefitsCategory,
  detectDocumentType,
  extractTextFromPDF,
  getDocumentDescription,
  guessLanguageFromDocument,
} from "@/lib/compliance-document-utils";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.franc.mockReturnValue("eng");
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("detectDocumentType", () => {
  it.each([
    ["spd-2026.pdf", "SPD"],
    ["summary plan description.pdf", "SPD"],
    ["plan highlights.pdf", "SPD"],
    ["sbc.pdf", "SBC"],
    ["summary of benefits.pdf", "SBC"],
    ["enrollment-guide.pdf", "Enrollment"],
    ["qdia-notice.pdf", "QDIA"],
    ["fee disclosure.pdf", "Fee Disclosure"],
    ["beneficiary-form.pdf", "Beneficiary"],
    ["random.pdf", "Document"],
  ])("maps %s to %s", (fileName, expected) => {
    expect(detectDocumentType(fileName)).toBe(expected);
  });
});

describe("analyzeDocumentCategory", () => {
  it("recognizes a strong retirement filename", () => {
    expect(analyzeDocumentCategory("401k-spd-2026.pdf").category).toBe(
      "Retirement",
    );
  });

  it("recognizes a strong health filename", () => {
    expect(analyzeDocumentCategory("group-health-sbc.pdf").category).toBe(
      "Group Health",
    );
  });

  it("recognizes a strong life filename", () => {
    expect(analyzeDocumentCategory("group life insurance.pdf").category).toBe(
      "Group Life",
    );
  });

  it("uses body text when the filename is generic", () => {
    const body = `401(k) retirement plan summary plan description ${"participant contribution vesting ".repeat(30)}`;
    expect(analyzeDocumentCategory("document.pdf", body).category).toBe(
      "Retirement",
    );
  });

  it("returns Other Benefits with low confidence when nothing matches", () => {
    const result = analyzeDocumentCategory("misc.pdf");
    expect(result.category).toBe("Other Benefits");
    expect(result.confidence).toBeLessThanOrEqual(42);
  });

  it("keeps confidence conservative when categories are close", () => {
    const result = analyzeDocumentCategory(
      "beneficiary-health-plan-summary.pdf",
    );
    expect(result.confidence).toBeLessThan(70);
  });

  it("delegates through detectBenefitsCategory", () => {
    expect(detectBenefitsCategory("401k-spd.pdf")).toBe("Retirement");
  });
});

describe("getDocumentDescription", () => {
  it("prefers and trims a short description", () => {
    expect(
      getDocumentDescription({
        shortDescription: "  Custom description  ",
        name: "spd.pdf",
      } as any),
    ).toBe("Custom description");
  });

  it.each([
    ["spd.pdf", "Comprehensive plan benefits and features"],
    ["sbc.pdf", "Summary of benefits and coverage information"],
    ["enrollment.pdf", "Complete guide to your retirement plan options"],
    ["qdia.pdf", "Qualified Default Investment Alternative information"],
    ["fee disclosure.pdf", "Participant fee disclosure and plan expenses"],
    ["beneficiary.pdf", "Beneficiary designation form and instructions"],
    ["notes.pdf", "Complete guide to your retirement plan options"],
  ])("uses the default copy for %s", (name, expected) => {
    expect(getDocumentDescription({ name } as any)).toBe(expected);
  });
});

describe("extractTextFromPDF", () => {
  it("skips empty, R2, and short non-data values", async () => {
    await expect(extractTextFromPDF("")).resolves.toBe("");
    await expect(extractTextFromPDF("r2:stored")).resolves.toBe("");
    await expect(extractTextFromPDF("org/user/plans/doc.pdf")).resolves.toBe("");
    await expect(extractTextFromPDF("short")).resolves.toBe("");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("posts inline data and normalizes the returned text", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "  extracted text  " }),
    });

    await expect(
      extractTextFromPDF(`data:application/pdf;base64,${"a".repeat(120)}`),
    ).resolves.toBe("extracted text");
    expect(mocks.fetch).toHaveBeenCalledWith("/api/extract-pdf-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("fileBase64"),
    });
  });

  it("returns empty text when extraction fails", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "bad pdf" }),
    });

    await expect(
      extractTextFromPDF(`data:application/pdf;base64,${"a".repeat(120)}`),
    ).resolves.toBe("");
  });

  it("swallows a thrown request", async () => {
    mocks.fetch.mockRejectedValue(new Error("network"));

    await expect(
      extractTextFromPDF(`data:application/pdf;base64,${"a".repeat(120)}`),
    ).resolves.toBe("");
  });
});

describe("guessLanguageFromDocument", () => {
  it("uses Spanish markers in the filename", async () => {
    await expect(
      guessLanguageFromDocument({
        name: "Plan (ES)",
        originalFileName: "plan.pdf",
      } as any),
    ).resolves.toBe("ES");
  });

  it("uses English markers in the filename", async () => {
    await expect(
      guessLanguageFromDocument({
        name: "Plan (EN)",
        originalFileName: "plan.pdf",
      } as any),
    ).resolves.toBe("EN");
  });

  it("uses franc when inline PDF text is long enough", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "texto ".repeat(60) }),
    });
    mocks.franc.mockReturnValue("spa");

    await expect(
      guessLanguageFromDocument({
        name: "document",
        originalFileName: "document.pdf",
        file: `data:application/pdf;base64,${"a".repeat(300)}`,
      } as any),
    ).resolves.toBe("ES");
  });

  it("falls back to Spanish special characters", async () => {
    mocks.franc.mockImplementation(() => {
      throw new Error("no detection");
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "información para el participante ".repeat(20) }),
    });

    await expect(
      guessLanguageFromDocument({
        name: "guía",
        originalFileName: "guia.pdf",
        file: `data:application/pdf;base64,${"a".repeat(300)}`,
      } as any),
    ).resolves.toBe("ES");
  });

  it("defaults to English", async () => {
    await expect(
      guessLanguageFromDocument({
        name: "document",
        originalFileName: "document.pdf",
        shortDescription: "",
      } as any),
    ).resolves.toBe("EN");
  });
});

describe("convertToDocumentFormat", () => {
  it("maps an R2 storage key to the signed-url display path", async () => {
    const result = await convertToDocumentFormat({
      id: "doc-1",
      title: "SPD",
      fileName: "spd.pdf",
      storageKey: "org/user/plans/plan/documents/retirement/spd.pdf",
      language: "EN",
      category: "Retirement",
    });

    expect(result.file).toBe(
      `/api/r2/signed-url?key=${encodeURIComponent(
        "org/user/plans/plan/documents/retirement/spd.pdf",
      )}&redirect=1`,
    );
    expect(result.id).toBe("doc-1");
    expect(result.name).toBe("SPD");
    expect(result.originalFileName).toBe("spd.pdf");
    expect(result.category).toBe("Retirement");
  });

  it("generates an id when one is missing", async () => {
    const result = await convertToDocumentFormat(
      { title: "Notes", fileName: "notes.pdf" },
      2,
      "plan-doc",
    );

    expect(result.id).toMatch(/^plan-doc-\d+-2$/);
  });

  it("preserves an existing language and derives a suggested category", async () => {
    const result = await convertToDocumentFormat({
      id: "doc-1",
      title: "401k SPD",
      fileName: "401k-spd.pdf",
      language: "ES",
    });

    expect(result.language).toBe("ES");
    expect(result.categorySuggested).toBe("Retirement");
    expect(result.categoryConfidence).toBeGreaterThan(0);
  });

  it("only auto-applies a suggested category at high confidence", async () => {
    const suggested = analyzeDocumentCategory("401k-spd.pdf");
    const result = await convertToDocumentFormat({
      id: "doc-1",
      title: "401k SPD",
      fileName: "401k-spd.pdf",
    });

    expect(result.category).toBe(
      suggested.confidence >= 70 ? suggested.category : undefined,
    );
  });
});
