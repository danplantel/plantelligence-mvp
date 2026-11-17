import { describe, expect, it } from "vitest";

import {
  canPreviewDocumentInline,
  documentDownloadFileName,
  documentFileExtension,
  resolveDocumentSourceUrl,
  withDocumentDownloadFlag,
  withPortalClientScope,
} from "@/lib/portal-document-url";

/**
 * Building the URL a hub card's "VIEW/DOWNLOAD" opens.
 *
 * The bug this covers: `/api/documents/{id}/view` resolves the owning advisor
 * from the plan identifier on the request. Without it the route answers 401, so
 * the preview modal was empty and "Download PDF" went nowhere. The helper is the
 * single place that attaches the plan, decides whether a `#` means "nothing to
 * open", and works out the file type the browser can draw.
 */

const PLAN = "g-loomis";
const DOC_ID = "5f1d7c9a2b3c4d5e6f7a8b9c";

describe("withPortalClientScope", () => {
  it("scopes the document view route to the plan", () => {
    expect(withPortalClientScope(`/api/documents/${DOC_ID}/view`, PLAN)).toBe(
      `/api/documents/${DOC_ID}/view?clientSlug=${PLAN}`,
    );
  });

  it("appends with & when the URL already carries a query", () => {
    expect(
      withPortalClientScope(`/api/documents/${DOC_ID}/view?inline=1`, PLAN),
    ).toBe(`/api/documents/${DOC_ID}/view?inline=1&clientSlug=${PLAN}`);
  });

  it("encodes a slug that needs it", () => {
    expect(
      withPortalClientScope(`/api/documents/${DOC_ID}/view`, "Acme Plan"),
    ).toBe(`/api/documents/${DOC_ID}/view?clientSlug=Acme%20Plan`);
  });

  it("never double-scopes a URL that names the plan itself", () => {
    const scoped = `/api/documents/${DOC_ID}/view?clientSlug=${PLAN}`;
    expect(withPortalClientScope(scoped, PLAN)).toBe(scoped);
    expect(withPortalClientScope(`${scoped}&x=1`, "another-plan")).toBe(
      `${scoped}&x=1`,
    );
    expect(withPortalClientScope(`/api/documents/${DOC_ID}/view?slug=x`, PLAN)).toBe(
      `/api/documents/${DOC_ID}/view?slug=x`,
    );
  });

  it("leaves self-contained URLs alone", () => {
    for (const url of [
      "https://cdn.example.com/guide.pdf",
      "data:application/pdf;base64,AAA",
      "blob:http://localhost/1234",
    ]) {
      expect(withPortalClientScope(url, PLAN)).toBe(url);
    }
  });

  it("leaves the URL untouched when the caller has no plan", () => {
    expect(withPortalClientScope(`/api/documents/${DOC_ID}/view`, undefined)).toBe(
      `/api/documents/${DOC_ID}/view`,
    );
    expect(withPortalClientScope(`/api/documents/${DOC_ID}/view`, "  ")).toBe(
      `/api/documents/${DOC_ID}/view`,
    );
  });
});

describe("resolveDocumentSourceUrl", () => {
  it("treats a card's placeholder href as nothing to open", () => {
    expect(resolveDocumentSourceUrl("#", PLAN)).toBe("");
    expect(resolveDocumentSourceUrl("  ", PLAN)).toBe("");
    expect(resolveDocumentSourceUrl(undefined, PLAN)).toBe("");
  });

  it("asks for an attachment with ?download=1, which is what saves the file", () => {
    const scoped = `/api/documents/${DOC_ID}/view?clientSlug=${PLAN}`;
    expect(withDocumentDownloadFlag(scoped)).toBe(`${scoped}&download=1`);
    expect(withDocumentDownloadFlag(`/api/documents/${DOC_ID}/view`)).toBe(
      `/api/documents/${DOC_ID}/view?download=1`,
    );
    // Never doubled.
    expect(withDocumentDownloadFlag(`${scoped}&download=1`)).toBe(
      `${scoped}&download=1`,
    );
  });

  it("leaves a file URL alone — only our route knows the flag", () => {
    for (const url of [
      "data:application/pdf;base64,AAA",
      "https://cdn.example.com/guide.pdf",
      "blob:http://localhost/1234",
      "",
    ]) {
      expect(withDocumentDownloadFlag(url)).toBe(url);
    }
  });

  it("refuses the R2 placeholder and a bare R2 key", () => {
    // The browser cannot launch either: "Failed to launch 'r2:stored' because
    // the scheme does not have a registered handler".
    expect(resolveDocumentSourceUrl("r2:stored", PLAN)).toBe("");
    expect(
      resolveDocumentSourceUrl(
        "org/user-1/documents/retirement/enrollment.pdf",
        PLAN,
      ),
    ).toBe("");
  });

  it("resolves a real source, scoped", () => {
    expect(resolveDocumentSourceUrl(`/api/documents/${DOC_ID}/view`, PLAN)).toBe(
      `/api/documents/${DOC_ID}/view?clientSlug=${PLAN}`,
    );
  });
});

describe("documentFileExtension", () => {
  it("prefers the stored file name, because a view URL has no extension", () => {
    expect(
      documentFileExtension({
        fileName: "Beneficiary Form.docx",
        title: "Beneficiary Form",
        href: `/api/documents/${DOC_ID}/view`,
      }),
    ).toBe("docx");
  });

  it("falls back to the title, then the href", () => {
    expect(documentFileExtension({ title: "Summary Plan Description.PDF" })).toBe(
      "pdf",
    );
    expect(
      documentFileExtension({ href: "https://cdn.example.com/guide.pdf" }),
    ).toBe("pdf");
  });

  it("answers empty when nothing names a file type", () => {
    expect(
      documentFileExtension({
        title: "Enrollment Booklet",
        href: `/api/documents/${DOC_ID}/view`,
      }),
    ).toBe("");
  });
});

describe("canPreviewDocumentInline", () => {
  it("lets the browser draw PDFs and images", () => {
    for (const ext of ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt"]) {
      expect(canPreviewDocumentInline(ext)).toBe(true);
    }
  });

  it("sends Office files to the download button", () => {
    for (const ext of ["doc", "docx", "xls", "xlsx", "csv", "zip"]) {
      expect(canPreviewDocumentInline(ext)).toBe(false);
    }
  });

  it("tries when the type is unknown — the route serves PDFs by default", () => {
    expect(canPreviewDocumentInline("")).toBe(true);
  });
});

describe("documentDownloadFileName", () => {
  it("names the saved file after the document", () => {
    expect(documentDownloadFileName("Enrollment Booklet", "pdf")).toBe(
      "Enrollment Booklet.pdf",
    );
  });

  it("does not double the extension a title already carries", () => {
    expect(documentDownloadFileName("Beneficiary Form.docx", "docx")).toBe(
      "Beneficiary Form.docx",
    );
  });

  it("defaults to PDF and never returns an empty name", () => {
    expect(documentDownloadFileName("", "")).toBe("document.pdf");
    expect(documentDownloadFileName(undefined, "pdf")).toBe("document.pdf");
  });

  it("replaces characters a file system refuses", () => {
    expect(documentDownloadFileName("QDIA: Notice / 2024?", "pdf")).toBe(
      "QDIA- Notice - 2024-.pdf",
    );
  });
});
