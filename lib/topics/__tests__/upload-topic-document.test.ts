import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Attaching a file from the advisor's computer to ONE topic.
 *
 * The row it creates must stay out of the benefit's Documents & Forms list, which
 * is why the category it is filed under is asserted here: `documentRowMatchesHub`
 * compares a row's resolved category with the hub's own label, and the private
 * label matches none of them.
 */

const mocks = vi.hoisted(() => ({
  suggestDocumentName: vi.fn(
    async (): Promise<{ display_title: string }> => ({
      display_title: "2026 Loan Request Form",
    }),
  ),
  uploadFileToR2: vi.fn(
    async (): Promise<string | null> =>
      "org/plan-1/documents/topic-documents/loan.pdf",
  ),
  fetch: vi.fn(
    async (
      _url: string,
      _init?: RequestInit,
    ): Promise<{ ok: boolean; json: () => Promise<unknown> }> => ({
      ok: true,
      json: async () => ({ document: { id: "doc-9" } }),
    }),
  ),
}));

vi.mock("@/lib/gemini-suggest-doc-name", () => ({
  suggestDocumentName: mocks.suggestDocumentName,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  uploadFileToR2: mocks.uploadFileToR2,
}));

import {
  TOPIC_DOCUMENT_CATEGORY,
  TOPIC_DOCUMENT_MAX_BYTES,
  uploadTopicDocument,
} from "@/lib/topics/upload-topic-document";

function pdf(name = "loan.pdf", size = 1024): File {
  const file = new File(["%PDF-1.4"], name, { type: "application/pdf" });
  // jsdom's File has no way to fake a size, so it is defined for the size guard.
  if (size !== file.size) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
}

describe("uploadTopicDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.suggestDocumentName.mockResolvedValue({
      display_title: "2026 Loan Request Form",
    });
    mocks.uploadFileToR2.mockResolvedValue(
      "org/plan-1/documents/topic-documents/loan.pdf",
    );
  });

  it("names the file, stores it, and returns the plan-scoped link", async () => {
    const result = await uploadTopicDocument({
      file: pdf(),
      planId: "plan-1",
    });

    expect(mocks.suggestDocumentName).toHaveBeenCalledWith(
      "",
      "loan.pdf",
      TOPIC_DOCUMENT_CATEGORY,
      expect.stringContaining("data:"),
    );
    expect(mocks.uploadFileToR2).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.any(File),
        purpose: "document",
        clientId: "plan-1",
        category: TOPIC_DOCUMENT_CATEGORY,
      }),
    );

    // A Document row, filed under a label no hub claims…
    const [url, init] = mocks.fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/documents");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      clientId: "plan-1",
      storageKey: "org/plan-1/documents/topic-documents/loan.pdf",
      title: "2026 Loan Request Form",
      category: TOPIC_DOCUMENT_CATEGORY,
      showQrCode: false,
    });

    // …so participants open it through the viewer the hub already uses.
    expect(result).toEqual({
      title: "2026 Loan Request Form",
      url: "/api/documents/doc-9/view",
    });
  });

  it("falls back to the file name when the model suggests nothing", async () => {
    mocks.suggestDocumentName.mockResolvedValue({ display_title: "" });

    const result = await uploadTopicDocument({
      file: pdf("loan-request-form.pdf"),
      planId: "plan-1",
    });

    expect(result.title).toBe("loan-request-form");
  });

  it("does not name a file the model cannot read", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    const result = await uploadTopicDocument({ file, planId: "plan-1" });

    expect(mocks.suggestDocumentName).not.toHaveBeenCalled();
    expect(result.title).toBe("notes");
  });

  it("refuses a file that is too large", async () => {
    await expect(
      uploadTopicDocument({
        file: pdf("huge.pdf", TOPIC_DOCUMENT_MAX_BYTES + 1),
        planId: "plan-1",
      }),
    ).rejects.toThrow(/too large/);
    expect(mocks.uploadFileToR2).not.toHaveBeenCalled();
  });

  it("explains when storage is not configured", async () => {
    mocks.uploadFileToR2.mockResolvedValue(null);

    await expect(
      uploadTopicDocument({ file: pdf(), planId: "plan-1" }),
    ).rejects.toThrow(/Storage is not configured/);
  });

  it("surfaces the API's refusal", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Client not found" }),
    });

    await expect(
      uploadTopicDocument({ file: pdf(), planId: "plan-1" }),
    ).rejects.toThrow("Client not found");
  });
});
