import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDocuments, POST as postDocument } from "../route";
import { DELETE as deleteDocument, PATCH as patchDocument } from "../[id]/route";
import { GET as getDocumentView } from "../[id]/view/route";
import { POST as postBatch } from "../batch/route";
import { GET as getClientDocuments } from "../client/[clientId]/route";
import { GET as getExpiring } from "../expiring/route";
import { POST as postReorder } from "../reorder/route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccessiblePlanIds: vi.fn(),
  resolvePlanAccess: vi.fn(),
  getAuthorizedClient: vi.fn(),
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(),
  isR2Configured: vi.fn(),
  getPresignedReadUrl: vi.fn(),
  resolveCategory: vi.fn(),
  prisma: {
    client: { findFirst: vi.fn(), findUnique: vi.fn() },
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    document: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/teammates/access.server", () => ({
  listAccessiblePlanIds: mocks.listAccessiblePlanIds,
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/teammates/plan-guard.server", () => ({
  getAuthorizedClient: mocks.getAuthorizedClient,
}));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: mocks.resolvePortalAdvisorId,
  isLocalDevLoopback: mocks.isLocalDevLoopback,
}));
vi.mock("@/lib/r2", () => ({
  R2_FILEURL_PLACEHOLDER: "r2://placeholder",
  isR2Configured: mocks.isR2Configured,
  getPresignedReadUrl: mocks.getPresignedReadUrl,
}));
vi.mock("@/lib/document-category", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/document-category")>();
  return {
    ...actual,
    resolvePersistedDocumentCategory: mocks.resolveCategory,
  };
});

const DOC_ID = "65f1c2a9b3d4e5f6a7b8c9d0";
const PLAN_ID = "65f1c2a9b3d4e5f6a7b8c9d1";

function request(path: string, init?: any) {
  return new NextRequest(new URL(path, "http://localhost"), init);
}

function jsonRequest(path: string, method: string, body: unknown) {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * NextRequest's undici parser rejects jsdom `File` objects, so serve the
 * already-built FormData directly while keeping a multipart content type so
 * the route takes its FormData branch.
 */
function formRequest(path: string, formData: FormData, method = "POST") {
  const req = request(path, {
    method,
    headers: { "content-type": "multipart/form-data; boundary=----test" },
  });
  (req as any).formData = async () => formData;
  return req;
}

function ctx(id = DOC_ID) {
  return { params: { id } };
}

function clientCtx(clientId = PLAN_ID) {
  return { params: { clientId } };
}

function pdfBody(length = 200): string {
  return `%PDF-1.4\n${"x".repeat(length)}`;
}

function dataUrl(content: string): string {
  return `data:application/pdf;base64,${Buffer.from(content).toString("base64")}`;
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.listAccessiblePlanIds.mockResolvedValue([PLAN_ID]);
  mocks.resolvePlanAccess.mockResolvedValue({
    allowed: true,
    clientId: PLAN_ID,
  });
  mocks.getAuthorizedClient.mockResolvedValue({ id: PLAN_ID });
  mocks.resolvePortalAdvisorId.mockResolvedValue(undefined);
  mocks.isLocalDevLoopback.mockReturnValue(false);
  mocks.isR2Configured.mockReturnValue(false);
  mocks.getPresignedReadUrl.mockResolvedValue(null);
  mocks.resolveCategory.mockImplementation(
    (type: string | null | undefined, category: string | null | undefined) =>
      category || `${type || "Document"}-cat`,
  );

  mocks.prisma.client.findFirst.mockResolvedValue(null);
  mocks.prisma.client.findUnique.mockResolvedValue(null);
  mocks.prisma.document.findMany.mockResolvedValue([]);
  mocks.prisma.document.findFirst.mockResolvedValue(null);
  mocks.prisma.document.findUnique.mockResolvedValue(null);
  mocks.prisma.document.create.mockResolvedValue({
    id: "doc-new",
    title: "Document",
    fileName: "file.pdf",
  });
  mocks.prisma.document.update.mockResolvedValue({ id: DOC_ID });
  mocks.prisma.document.delete.mockResolvedValue({ id: DOC_ID });
  mocks.prisma.document.deleteMany.mockResolvedValue({ count: 0 });
  mocks.tx.document.findMany.mockResolvedValue([]);
  mocks.tx.document.create.mockResolvedValue({
    id: "doc-new",
    fileName: "file.pdf",
  });
  mocks.prisma.$transaction.mockImplementation(async (arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mocks.tx),
  );
});

describe("GET /api/documents", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await getDocuments(request("/api/documents"));

    expect(response.status).toBe(401);
  });

  it("scopes a plan-less list to every accessible plan", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        title: "SPD",
        fileName: "spd.pdf",
        type: "SPD",
        shortDescription: null,
        language: "EN",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
        expirationDate: null,
        category: "Retirement",
        categorySuggested: null,
        categoryConfidence: null,
        showQrCode: true,
        archivedAt: null,
        fileUrl: "data:secret",
        client: { id: PLAN_ID, companyName: "Acme" },
      },
    ]);

    const response = await getDocuments(request("/api/documents"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listAccessiblePlanIds).toHaveBeenCalledWith("user-1");
    expect(mocks.prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: { in: [PLAN_ID] } },
        orderBy: { uploadedAt: "desc" },
        take: 500,
      }),
    );
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        id: DOC_ID,
        title: "SPD",
        viewUrl: `/api/documents/${DOC_ID}/view`,
      }),
    );
    expect(body.data[0].fileUrl).toBeUndefined();
  });

  it("authorizes an explicit plan and uses the resolved client id", async () => {
    await getDocuments(
      request(`/api/documents?clientId=acme-slug`),
    );

    expect(mocks.resolvePlanAccess).toHaveBeenCalledWith({
      userId: "user-1",
      clientIdOrSlug: "acme-slug",
      permission: "documents",
      level: "view",
    });
    expect(mocks.prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: PLAN_ID },
      }),
    );
  });

  it("returns 403 for a denied plan", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "not_assigned",
      message: "You don't have access to this plan/section",
    });

    const response = await getDocuments(
      request(`/api/documents?clientId=${PLAN_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: "You don't have access to this plan/section",
      code: "not_assigned",
    });
  });

  it("returns 404 when the plan does not exist", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "plan_not_found",
      message: "Client not found",
    });

    const response = await getDocuments(
      request("/api/documents?clientId=missing"),
    );

    expect(response.status).toBe(404);
  });

  it("builds search and type filters", async () => {
    await getDocuments(
      request("/api/documents?search=spd&type=SPD"),
    );

    expect(mocks.prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: "spd", mode: "insensitive" } },
            { fileName: { contains: "spd", mode: "insensitive" } },
            {
              client: {
                companyName: { contains: "spd", mode: "insensitive" },
              },
            },
          ]),
          title: { contains: "SPD", mode: "insensitive" },
        }),
      }),
    );
  });

  it("filters archived rows in JS unless includeArchived=1", async () => {
    const active = {
      id: "active",
      title: "Active",
      fileName: "a.pdf",
      uploadedAt: new Date("2026-01-02T00:00:00Z"),
      archivedAt: null,
      client: { id: PLAN_ID, companyName: "Acme" },
    };
    const archived = {
      id: "archived",
      title: "Archived",
      fileName: "b.pdf",
      uploadedAt: new Date("2026-01-01T00:00:00Z"),
      archivedAt: new Date("2026-01-03T00:00:00Z"),
      client: { id: PLAN_ID, companyName: "Acme" },
    };
    mocks.prisma.document.findMany.mockResolvedValue([archived, active]);

    const withoutArchived = await getDocuments(request("/api/documents"));
    expect((await withoutArchived.json()).data.map((d: any) => d.id)).toEqual([
      "active",
    ]);

    const withArchived = await getDocuments(
      request("/api/documents?includeArchived=1"),
    );
    expect((await withArchived.json()).data.map((d: any) => d.id)).toEqual([
      "active",
      "archived",
    ]);
  });

  it("maps expiration dates to ISO strings and null", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      {
        id: "dated",
        title: "Dated",
        fileName: "d.pdf",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
        expirationDate: new Date("2026-03-01T00:00:00Z"),
        client: { id: PLAN_ID, companyName: "Acme" },
      },
      {
        id: "undated",
        title: "Undated",
        fileName: "u.pdf",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
        expirationDate: null,
        client: { id: PLAN_ID, companyName: "Acme" },
      },
    ]);

    const body = await (await getDocuments(request("/api/documents"))).json();

    expect(body.data.find((d: any) => d.id === "dated").expirationDate).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(
      body.data.find((d: any) => d.id === "undated").expirationDate,
    ).toBeNull();
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.document.findMany.mockRejectedValue(new Error("db down"));

    const response = await getDocuments(request("/api/documents"));

    expect(response.status).toBe(500);
  });
});

describe("POST /api/documents", () => {
  const validJson = {
    clientId: PLAN_ID,
    storageKey: "org/plans/docs/spd.pdf",
    fileName: "spd.pdf",
  };

  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await postDocument(
      jsonRequest("/api/documents", "POST", validJson),
    );

    expect(response.status).toBe(401);
  });

  it("rejects a JSON create missing required fields", async () => {
    const response = await postDocument(
      jsonRequest("/api/documents", "POST", { clientId: PLAN_ID }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the plan edit guard rejects the caller", async () => {
    mocks.getAuthorizedClient.mockResolvedValue(null);

    const response = await postDocument(
      jsonRequest("/api/documents", "POST", validJson),
    );

    expect(response.status).toBe(404);
  });

  it("creates an R2 document with normalized defaults", async () => {
    const response = await postDocument(
      jsonRequest("/api/documents", "POST", {
        ...validJson,
        category: " retirement ",
        categorySuggested: " Retirement ",
        categoryConfidence: 91.6,
        expirationDate: "2026-04-01",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getAuthorizedClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIdOrSlug: PLAN_ID,
        userId: "user-1",
        permission: "documents",
        level: "edit",
      }),
    );
    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "spd",
        fileName: "spd.pdf",
        fileUrl: "r2://placeholder",
        storageKey: "org/plans/docs/spd.pdf",
        type: "Document",
        language: "EN",
        category: "retirement",
        categorySuggested: "Retirement",
        categoryConfidence: 92,
        showQrCode: true,
        expirationDate: new Date("2026-04-01"),
      }),
    });
    expect(body.message).toBe("Document created (R2)");
  });

  it("returns the existing row instead of creating a duplicate storage key", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue({
      id: "existing",
      title: "Existing",
      fileName: "spd.pdf",
    });

    const response = await postDocument(
      jsonRequest("/api/documents", "POST", validJson),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Document already exists (R2)");
    expect(body.document.id).toBe("existing");
    expect(mocks.prisma.document.create).not.toHaveBeenCalled();
  });

  it("rejects FormData uploads when R2 is configured", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    const formData = new FormData();
    formData.append("clientId", PLAN_ID);

    const response = await postDocument(
      request("/api/documents", { method: "POST", body: formData }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a legacy FormData upload missing required fields", async () => {
    const formData = new FormData();
    formData.append("clientId", PLAN_ID);

    const response = await postDocument(
      request("/api/documents", { method: "POST", body: formData }),
    );

    expect(response.status).toBe(400);
  });

  it("creates legacy SPD and SBC rows and replaces the old SPD", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      { id: "old-spd", title: "SPD (old)" },
    ]);
    mocks.prisma.document.create.mockResolvedValue({
      id: "new-spd",
      title: "SPD",
      fileName: "spd.pdf",
    });
    const formData = new FormData();
    formData.append("clientId", PLAN_ID);
    formData.append(
      "spdFile",
      new File([new Uint8Array([1, 2, 3])], "spd.pdf", {
        type: "application/pdf",
      }),
    );
    formData.append("spdFileName", "spd.pdf");
    formData.append("spdTitle", "SPD 2026");
    formData.append("spdShortDescription", "Summary");
    formData.append(
      "sbcFile_0",
      new File([new Uint8Array([4, 5, 6])], "sbc.pdf", {
        type: "application/pdf",
      }),
    );
    formData.append("sbcFileName_0", "sbc.pdf");
    formData.append("sbcTitle_0", "SBC 2026");

    const response = await postDocument(
      formRequest("/api/documents", formData),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.document.deleteMany).toHaveBeenCalledWith({
      where: { clientId: PLAN_ID, title: { contains: "SPD" } },
    });
    expect(mocks.prisma.document.create).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.document.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          title: "SPD 2026",
          fileName: "spd.pdf",
          type: "SPD",
        }),
      }),
    );
    expect(mocks.prisma.document.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          title: "SBC 2026",
          fileName: "sbc.pdf",
          type: "SBC",
        }),
      }),
    );
  });

  it("rejects a metadata-only FormData POST because spdFile is required", async () => {
    const formData = new FormData();
    formData.append("clientId", PLAN_ID);
    formData.append("spdFileName", "spd.pdf");
    formData.append("spdTitle", "New SPD");

    const response = await postDocument(
      formRequest("/api/documents", formData),
    );

    // The route's "no new file" branch is unreachable: the guard above it
    // already requires `spdFile`. Documented as a remaining finding.
    expect(response.status).toBe(400);
    expect(mocks.prisma.document.update).not.toHaveBeenCalled();
  });

  it("returns 500 when creation fails", async () => {
    mocks.prisma.document.create.mockRejectedValue(new Error("db down"));

    const response = await postDocument(
      jsonRequest("/api/documents", "POST", validJson),
    );

    expect(response.status).toBe(500);
  });
});

describe("PATCH /api/documents/[id]", () => {
  const storedDocument = {
    id: DOC_ID,
    clientId: PLAN_ID,
    title: "Old title",
    type: "SPD",
    fileUrl: dataUrl(pdfBody()),
    fileName: "old.pdf",
  };

  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", { title: "New" }),
      ctx(),
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document does not exist", async () => {
    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", { title: "New" }),
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when plan edit access is denied", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "permission_denied",
      message: "no edit",
    });

    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", { title: "New" }),
      ctx(),
    );

    expect(response.status).toBe(403);
  });

  it("rejects an invalid expiration date", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);

    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", {
        expirationDate: "not-a-date",
      }),
      ctx(),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an empty title", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);

    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", { title: "   " }),
      ctx(),
    );

    expect(response.status).toBe(400);
  });

  it("applies JSON metadata, archive, QR, and R2 storage updates", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);

    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", {
        title: "New title",
        shortDescription: "New description",
        language: "ES",
        category: "Group Health",
        showQrCode: false,
        archivedAt: "2026-05-01T00:00:00Z",
        expirationDate: "2026-06-01",
        storageKey: " org/plans/docs/new.pdf ",
        fileName: "new.pdf",
      }),
      ctx(),
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveCategory).toHaveBeenCalledWith("SPD", "Group Health");
    expect(mocks.prisma.document.update).toHaveBeenCalledWith({
      where: { id: DOC_ID },
      data: expect.objectContaining({
        title: "New title",
        shortDescription: "New description",
        language: "ES",
        category: "Group Health",
        showQrCode: false,
        archivedAt: new Date("2026-05-01T00:00:00Z"),
        expirationDate: new Date("2026-06-01"),
        fileUrl: "r2://placeholder",
        fileName: "new.pdf",
        storageKey: "org/plans/docs/new.pdf",
      }),
    });
  });

  it("rejects a FormData file replacement when R2 is configured", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);
    mocks.isR2Configured.mockReturnValue(true);
    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "new.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await patchDocument(
      formRequest(`/api/documents/${DOC_ID}`, formData, "PATCH"),
      ctx(),
    );

    expect(response.status).toBe(400);
  });

  it("accepts a legacy FormData file replacement when R2 is off", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);
    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "new.pdf", {
        type: "application/pdf",
      }),
    );
    formData.append("title", "Replaced");
    formData.append("shortDescription", "Replaced description");
    formData.append("language", "EN");
    formData.append("category", "Retirement");

    const response = await patchDocument(
      formRequest(`/api/documents/${DOC_ID}`, formData, "PATCH"),
      ctx(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.document.update).toHaveBeenCalledWith({
      where: { id: DOC_ID },
      data: expect.objectContaining({
        title: "Replaced",
        shortDescription: "Replaced description",
        language: "EN",
        fileUrl: expect.stringMatching(/^data:application\/pdf;base64,/),
        fileName: "new.pdf",
        uploadedAt: expect.any(Date),
      }),
    });
  });

  it("returns 500 when the update fails", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue(storedDocument);
    mocks.prisma.document.update.mockRejectedValue(new Error("db down"));

    const response = await patchDocument(
      jsonRequest(`/api/documents/${DOC_ID}`, "PATCH", { title: "New" }),
      ctx(),
    );

    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/documents/[id]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await deleteDocument(request(`/api/documents/${DOC_ID}`), ctx()))
        .status,
    ).toBe(401);
  });

  it("returns 404 when the document is missing", async () => {
    expect(
      (await deleteDocument(request(`/api/documents/${DOC_ID}`), ctx()))
        .status,
    ).toBe(404);
  });

  it("returns 403 when edit access is denied", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
    });
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "not_assigned",
      message: "no",
    });

    expect(
      (await deleteDocument(request(`/api/documents/${DOC_ID}`), ctx()))
        .status,
    ).toBe(403);
  });

  it("deletes an authorized document", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
    });

    const response = await deleteDocument(
      request(`/api/documents/${DOC_ID}`),
      ctx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Document deleted successfully");
    expect(mocks.prisma.document.delete).toHaveBeenCalledWith({
      where: { id: DOC_ID },
    });
  });

  it("returns 500 when deletion fails", async () => {
    mocks.prisma.document.findFirst.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
    });
    mocks.prisma.document.delete.mockRejectedValue(new Error("db down"));

    expect(
      (await deleteDocument(request(`/api/documents/${DOC_ID}`), ctx()))
        .status,
    ).toBe(500);
  });
});

describe("GET /api/documents/[id]/view", () => {
  it("returns 401 for an anonymous non-portal request", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(401);
  });

  it("rejects temp ids before querying", async () => {
    const response = await getDocumentView(
      request("/api/documents/doc-123/view"),
      ctx("doc-123"),
    );

    expect(response.status).toBe(404);
    expect(mocks.prisma.document.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the document is missing", async () => {
    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the document has no client relation", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      client: null,
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("refuses a portal document owned by another advisor", async () => {
    mocks.resolvePortalAdvisorId.mockResolvedValue("advisor-1");
    mocks.getSession.mockResolvedValue(null);
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      client: { userId: "advisor-2" },
      fileUrl: dataUrl(pdfBody()),
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view?clientSlug=acme`),
      ctx(),
    );

    expect(response.status).toBe(403);
  });

  it("refuses a session caller without plan view access", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      category: "Retirement",
      fileUrl: dataUrl(pdfBody()),
      fileName: "spd.pdf",
    });
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "plan_not_found",
      message: "Client not found",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(404);
    expect(mocks.resolvePlanAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Retirement",
        permission: "documents",
        level: "view",
      }),
    );
  });

  it("redirects an R2-backed document to a presigned URL", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    mocks.getPresignedReadUrl.mockResolvedValue("https://r2.example/signed");
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      storageKey: "org/plans/docs/spd.pdf",
      fileName: "spd.pdf",
      fileUrl: null,
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://r2.example/signed",
    );
    expect(mocks.getPresignedReadUrl).toHaveBeenCalledWith({
      key: "org/plans/docs/spd.pdf",
      responseContentDisposition: `inline; filename="${encodeURIComponent("spd.pdf")}"`,
      responseContentType: "application/pdf",
    });
  });

  it("returns 404 when a legacy document has no file data", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: null,
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("rejects a data URL without a comma", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: "data:application/pdf;base64",
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(500);
  });

  it("rejects a data URL that is not base64", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: "data:application/pdf;utf8,abc",
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(500);
  });

  it("rejects empty base64 data", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: "data:application/pdf;base64,",
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("rejects a buffer that is too small", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: dataUrl("%PDF"),
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(500);
  });

  it("rejects a file without a PDF header", async () => {
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: dataUrl("not a pdf".repeat(30)),
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(500);
  });

  it("serves a valid legacy PDF with cache and disposition headers", async () => {
    const pdf = pdfBody();
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: dataUrl(pdf),
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="${encodeURIComponent("spd.pdf")}"`,
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("allows the development loopback preview without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.isLocalDevLoopback.mockReturnValue(true);
    mocks.prisma.document.findUnique.mockResolvedValue({
      id: DOC_ID,
      clientId: PLAN_ID,
      client: { userId: "owner-1" },
      fileUrl: dataUrl(pdfBody()),
      fileName: "spd.pdf",
    });

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(200);
  });

  it("returns 500 when the document query fails", async () => {
    mocks.prisma.document.findUnique.mockRejectedValue(new Error("db down"));

    const response = await getDocumentView(
      request(`/api/documents/${DOC_ID}/view`),
      ctx(),
    );

    expect(response.status).toBe(500);
  });
});

describe("POST /api/documents/batch", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await postBatch(jsonRequest("/api/documents/batch", "POST", {})))
        .status,
    ).toBe(401);
  });

  it("rejects a missing client or empty items", async () => {
    expect(
      (
        await postBatch(
          jsonRequest("/api/documents/batch", "POST", { clientId: PLAN_ID }),
        )
      ).status,
    ).toBe(400);
  });

  it("returns 404 when the client is not owned by the caller", async () => {
    const response = await postBatch(
      jsonRequest("/api/documents/batch", "POST", {
        clientId: PLAN_ID,
        items: [{ storageKey: "k", fileName: "f.pdf" }],
      }),
    );

    expect(response.status).toBe(404);
  });

  it("collects per-row validation errors", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });

    const response = await postBatch(
      jsonRequest("/api/documents/batch", "POST", {
        clientId: PLAN_ID,
        items: [{ title: "No key" }, { storageKey: "k" }],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors).toEqual([
      { index: 0, message: "storageKey is required" },
      { index: 0, message: "fileName is required" },
      { index: 1, message: "fileName is required" },
    ]);
  });

  it("normalizes rows before creating them in a transaction", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });

    const response = await postBatch(
      jsonRequest("/api/documents/batch", "POST", {
        clientId: PLAN_ID,
        items: [
          {
            storageKey: "k1",
            fileName: "guide.pdf",
            type: "other",
            category: "",
            language: "XX",
            categoryConfidence: 88.7,
            showQrCode: false,
            expirationDate: "2026-02-01",
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveCategory).toHaveBeenCalledWith(
      "Document",
      undefined,
      "k1",
    );
    expect(mocks.tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "guide",
        fileName: "guide.pdf",
        type: "Document",
        language: "EN",
        categoryConfidence: 89,
        showQrCode: false,
        expirationDate: new Date("2026-02-01"),
      }),
    });
  });

  it("skips storage keys that already exist for the client", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.tx.document.findMany.mockResolvedValue([{ storageKey: "k1" }]);

    await postBatch(
      jsonRequest("/api/documents/batch", "POST", {
        clientId: PLAN_ID,
        items: [
          { storageKey: "k1", fileName: "one.pdf" },
          { storageKey: "k2", fileName: "two.pdf" },
        ],
      }),
    );

    expect(mocks.tx.document.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storageKey: "k2", fileName: "two.pdf" }),
    });
  });

  it("returns 500 when the transaction fails", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.$transaction.mockRejectedValue(new Error("db down"));

    expect(
      (
        await postBatch(
          jsonRequest("/api/documents/batch", "POST", {
            clientId: PLAN_ID,
            items: [{ storageKey: "k", fileName: "f.pdf" }],
          }),
        )
      ).status,
    ).toBe(500);
  });
});

describe("GET /api/documents/client/[clientId]", () => {
  it("returns 401 without a session, portal, or dev loopback", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (
        await getClientDocuments(
          request(`/api/documents/client/${PLAN_ID}`),
          clientCtx(),
        )
      ).status,
    ).toBe(401);
  });

  it("returns 404 when the plan is not visible to the caller", async () => {
    const response = await getClientDocuments(
      request(`/api/documents/client/${PLAN_ID}`),
      clientCtx(),
    );

    expect(response.status).toBe(404);
  });

  it("orders by category hub order then newest first and hides archived", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.document.findMany.mockResolvedValue([
      {
        id: "other-new",
        title: "Other",
        category: "Other Benefits",
        uploadedAt: new Date("2026-01-03T00:00:00Z"),
        archivedAt: null,
      },
      {
        id: "ret-old",
        title: "Ret Old",
        category: "Retirement",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
        archivedAt: null,
      },
      {
        id: "ret-new",
        title: "Ret New",
        category: "Retirement",
        uploadedAt: new Date("2026-01-02T00:00:00Z"),
        archivedAt: null,
      },
      {
        id: "archived",
        title: "Archived",
        category: "Retirement",
        uploadedAt: new Date("2026-01-04T00:00:00Z"),
        archivedAt: new Date("2026-01-05T00:00:00Z"),
      },
    ]);

    const response = await getClientDocuments(
      request(`/api/documents/client/${PLAN_ID}`),
      clientCtx(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((d: any) => d.id)).toEqual([
      "ret-new",
      "ret-old",
      "other-new",
    ]);
  });

  it("resolves a portal advisor and a slug-scoped plan", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.resolvePortalAdvisorId.mockResolvedValue("advisor-1");
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });

    await getClientDocuments(
      request(`/api/documents/client/acme?forPortal=1`),
      clientCtx("acme"),
    );

    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ id: "acme" }, { slug: "acme" }],
        userId: "advisor-1",
      },
      select: { id: true },
    });
  });

  it("includes archived rows when requested", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.document.findMany.mockResolvedValue([
      {
        id: "archived",
        title: "Archived",
        category: "Retirement",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
        archivedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const body = await (
      await getClientDocuments(
        request(`/api/documents/client/${PLAN_ID}?includeArchived=1`),
        clientCtx(),
      )
    ).json();

    expect(body.data.map((d: any) => d.id)).toEqual(["archived"]);
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.document.findMany.mockRejectedValue(new Error("db down"));

    expect(
      (
        await getClientDocuments(
          request(`/api/documents/client/${PLAN_ID}`),
          clientCtx(),
        )
      ).status,
    ).toBe(500);
  });
});

describe("GET /api/documents/expiring", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await getExpiring(request("/api/documents/expiring?today=2026-01-01")))
        .status,
    ).toBe(401);
  });

  it("keeps only the 0/2/7-day tiers, drops archived rows, and sorts", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      {
        id: "week",
        title: "Week",
        expirationDate: new Date("2026-01-08T00:00:00Z"),
        archivedAt: null,
        client: { id: PLAN_ID, companyName: "Acme" },
      },
      {
        id: "today",
        title: "Today",
        expirationDate: new Date("2026-01-01T00:00:00Z"),
        archivedAt: null,
        client: { id: PLAN_ID, companyName: "Acme" },
      },
      {
        id: "two",
        title: "Two",
        expirationDate: new Date("2026-01-03T00:00:00Z"),
        archivedAt: null,
        client: { id: PLAN_ID, companyName: "Acme" },
      },
      {
        id: "four",
        title: "Four",
        expirationDate: new Date("2026-01-05T00:00:00Z"),
        archivedAt: null,
        client: { id: PLAN_ID, companyName: "Acme" },
      },
      {
        id: "archived",
        title: "Archived",
        expirationDate: new Date("2026-01-01T00:00:00Z"),
        archivedAt: new Date("2026-01-01T00:00:00Z"),
        client: { id: PLAN_ID, companyName: "Acme" },
      },
    ]);

    const response = await getExpiring(
      request("/api/documents/expiring?today=2026-01-01"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((d: any) => [d.id, d.status, d.daysUntilExpiration])).toEqual([
      ["today", "expiring_today", 0],
      ["two", "expiring_2days", 2],
      ["week", "expiring_week", 7],
    ]);
  });

  it("caps the response at 20 reminders", async () => {
    mocks.prisma.document.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        id: `doc-${index}`,
        title: `Doc ${index}`,
        expirationDate: new Date("2026-01-01T00:00:00Z"),
        archivedAt: null,
        client: { id: PLAN_ID, companyName: "Acme" },
      })),
    );

    const body = await (
      await getExpiring(request("/api/documents/expiring?today=2026-01-01"))
    ).json();

    expect(body.data).toHaveLength(20);
  });

  it("falls back to today when the day key is invalid", async () => {
    await getExpiring(
      request("/api/documents/expiring?today=not-a-date"),
    );

    expect(mocks.prisma.document.findMany).toHaveBeenCalled();
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.document.findMany.mockRejectedValue(new Error("db down"));

    expect(
      (await getExpiring(request("/api/documents/expiring?today=2026-01-01")))
        .status,
    ).toBe(500);
  });
});

describe("POST /api/documents/reorder", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await postReorder(jsonRequest("/api/documents/reorder", "POST", {})))
        .status,
    ).toBe(401);
  });

  it("rejects an invalid JSON body", async () => {
    const response = await postReorder(
      request("/api/documents/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an empty orderedIds array", async () => {
    expect(
      (
        await postReorder(
          jsonRequest("/api/documents/reorder", "POST", { orderedIds: [] }),
        )
      ).status,
    ).toBe(400);
  });

  it("updates only documents on plans the caller may edit", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      { id: "a", clientId: "plan-a" },
      { id: "b", clientId: "plan-a" },
      { id: "c", clientId: "plan-b" },
    ]);
    mocks.resolvePlanAccess.mockImplementation(async ({ clientIdOrSlug }: any) =>
      clientIdOrSlug === "plan-a"
        ? { allowed: true, clientId: "plan-a" }
        : { allowed: false, reason: "not_assigned", message: "no" },
    );
    mocks.prisma.document.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      sortOrder: data.sortOrder,
    }));
    mocks.prisma.$transaction.mockResolvedValue([{ id: "a" }, { id: "b" }]);

    const response = await postReorder(
      jsonRequest("/api/documents/reorder", "POST", {
        orderedIds: ["c", "a", "b"],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.document.update).toHaveBeenCalledTimes(2);
    // Indices are compacted after unowned ids are filtered out.
    expect(mocks.prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: "a" },
      data: { sortOrder: 0 },
      select: { id: true },
    });
    expect(mocks.prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: "b" },
      data: { sortOrder: 1 },
      select: { id: true },
    });
  });

  it("returns an empty success when no id is editable", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      { id: "a", clientId: "plan-a" },
    ]);
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "not_assigned",
      message: "no",
    });

    const response = await postReorder(
      jsonRequest("/api/documents/reorder", "POST", { orderedIds: ["a"] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 500 when the transaction fails", async () => {
    mocks.prisma.document.findMany.mockResolvedValue([
      { id: "a", clientId: PLAN_ID },
    ]);
    mocks.prisma.$transaction.mockRejectedValue(new Error("db down"));

    expect(
      (
        await postReorder(
          jsonRequest("/api/documents/reorder", "POST", { orderedIds: ["a"] }),
        )
      ).status,
    ).toBe(500);
  });
});
