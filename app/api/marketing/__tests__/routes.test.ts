import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getRoot } from "../route";
import {
  GET as getAssets,
  POST as postAsset,
} from "../assets/route";
import {
  DELETE as deleteAsset,
  PATCH as patchAsset,
} from "../assets/[id]/route";
import { GET as getPublicAssets } from "../assets/public/route";
import { GET as getFlyers } from "../flyers/route";
import { PATCH as patchFlyer } from "../flyers/[id]/route";
import { GET as getFlyerFile } from "../flyers/[id]/file/route";
import { POST as postGenerateCopy } from "../flyers/generate-copy/route";
import { POST as postRenderFlyer } from "../flyers/render/route";
import { POST as postGenerateQr } from "../qr/generate/route";
import { POST as postSavePdf } from "../save-pdf/route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolvePlanAccess: vi.fn(),
  resolveCategory: vi.fn(),
  fetch: vi.fn(),
  isR2Configured: vi.fn(),
  putObjectBuffer: vi.fn(),
  buildKey: vi.fn(({ variant }: any) => `key-${variant}`),
  getPresignedReadUrl: vi.fn(),
  getOwnedClient: vi.fn(),
  isFlyerMode: vi.fn(),
  buildBrand: vi.fn(),
  getHubUrl: vi.fn(),
  renderFlyerPdf: vi.fn(),
  renderFlyerPng: vi.fn(),
  generateFlyerCopy: vi.fn(),
  generateQrViaQrIo: vi.fn(),
  renderQrToDataUrl: vi.fn(),
  prisma: {
    client: { findFirst: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    marketingAsset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    marketingFlyer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    document: { create: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/teammates/access.server", () => ({
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/document-category", () => ({
  resolvePersistedDocumentCategory: mocks.resolveCategory,
}));
vi.mock("@/lib/marketing", () => ({
  getOwnedClient: mocks.getOwnedClient,
  isFlyerMode: mocks.isFlyerMode,
  buildFlyerBrandSnapshot: mocks.buildBrand,
  getBenefitsHubAbsoluteUrl: mocks.getHubUrl,
  renderFlyerPdf: mocks.renderFlyerPdf,
  renderFlyerPng: mocks.renderFlyerPng,
  generateFlyerCopy: mocks.generateFlyerCopy,
}));
vi.mock("@/lib/marketing/qr-service", () => ({
  generateQrViaQrIo: mocks.generateQrViaQrIo,
  renderQrToDataUrl: mocks.renderQrToDataUrl,
}));
vi.mock("@/lib/r2", () => ({
  isR2Configured: mocks.isR2Configured,
  putObjectBuffer: mocks.putObjectBuffer,
  buildMarketingFlyerAssetKey: mocks.buildKey,
  getPresignedReadUrl: mocks.getPresignedReadUrl,
}));
vi.mock("mongodb", () => ({
  ObjectId: class {
    toHexString() {
      return "65f1c2a9b3d4e5f6a7b8c9d0";
    }
  },
}));

const PLAN_ID = "65f1c2a9b3d4e5f6a7b8c9d1";
const ASSET_ID = "65f1c2a9b3d4e5f6a7b8c9d2";
const FLYER_ID = "65f1c2a9b3d4e5f6a7b8c9d3";

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

function ctx(id: string) {
  return { params: { id } };
}

function jsonResponse(payload: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => payload, text: async () => "" };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.QR_IO_API_KEY;

  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.resolvePlanAccess.mockResolvedValue({
    allowed: true,
    clientId: PLAN_ID,
  });
  mocks.resolveCategory.mockImplementation(
    (_type: string, category?: string) => category || "Other Benefits",
  );
  mocks.isR2Configured.mockReturnValue(true);
  mocks.putObjectBuffer.mockResolvedValue(true);
  mocks.getPresignedReadUrl.mockResolvedValue("https://r2.example/file");
  mocks.getOwnedClient.mockResolvedValue({ id: PLAN_ID, companyName: "Acme" });
  mocks.isFlyerMode.mockImplementation(
    (mode: string) => mode === "hub_promo_general",
  );
  mocks.buildBrand.mockReturnValue({ brand: true });
  mocks.getHubUrl.mockReturnValue("https://hub.example/acme");
  mocks.renderFlyerPdf.mockResolvedValue(Buffer.from("pdf"));
  mocks.renderFlyerPng.mockResolvedValue(Buffer.from("png"));
  mocks.generateFlyerCopy.mockResolvedValue({
    headline: "Headline",
    body: "Body",
    cta: "Learn more",
    aiModel: "model",
    aiPromptVersion: "v1",
  });
  mocks.generateQrViaQrIo.mockResolvedValue({
    id: "qr-1",
    name: "QR",
    imageUrl: "https://qr.example/image.png",
  });
  mocks.renderQrToDataUrl.mockResolvedValue("data:image/png;base64,qr");

  mocks.prisma.client.findFirst.mockResolvedValue(null);
  mocks.prisma.client.findUnique.mockResolvedValue({
    id: PLAN_ID,
    userId: "user-1",
  });
  mocks.prisma.user.findUnique.mockResolvedValue({
    organizationType: "RIA",
    name: "Advisor",
    advisorLogo: null,
    advisorLogoUrl: "logo",
  });
  mocks.prisma.marketingAsset.findMany.mockResolvedValue([]);
  mocks.prisma.marketingAsset.findUnique.mockResolvedValue(null);
  mocks.prisma.marketingAsset.create.mockResolvedValue({ id: ASSET_ID });
  mocks.prisma.marketingAsset.update.mockResolvedValue({ id: ASSET_ID });
  mocks.prisma.marketingAsset.delete.mockResolvedValue({ id: ASSET_ID });
  mocks.prisma.marketingFlyer.findMany.mockResolvedValue([]);
  mocks.prisma.marketingFlyer.findFirst.mockResolvedValue(null);
  mocks.prisma.marketingFlyer.update.mockResolvedValue({
    id: FLYER_ID,
    title: null,
    archivedAt: null,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
  mocks.prisma.marketingFlyer.create.mockResolvedValue({
    id: "65f1c2a9b3d4e5f6a7b8c9d0",
    clientId: PLAN_ID,
    mode: "hub_promo_general",
    hubUrlSnapshot: "https://hub.example/acme",
    pdfStorageKey: "key-pdf",
    pngStorageKey: "key-png",
    title: "Flyer",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  mocks.prisma.document.create.mockResolvedValue({
    id: "doc-1",
    title: "Marketing PDF",
    fileName: "flyer.pdf",
  });

  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(jsonResponse({ success: true }));
});

describe("GET /api/marketing", () => {
  it("returns the legacy empty array", async () => {
    const response = await getRoot();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe("GET /api/marketing/assets", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await getAssets(request(`/api/marketing/assets?clientId=${PLAN_ID}`)))
        .status,
    ).toBe(401);
  });

  it("requires clientId", async () => {
    expect((await getAssets(request("/api/marketing/assets"))).status).toBe(400);
  });

  it("returns 404 when the plan does not exist", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue(null);

    expect(
      (await getAssets(request(`/api/marketing/assets?clientId=${PLAN_ID}`)))
        .status,
    ).toBe(404);
  });

  it("returns 403 when marketing edit access is denied", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      message: "no marketing",
    });

    expect(
      (await getAssets(request(`/api/marketing/assets?clientId=${PLAN_ID}`)))
        .status,
    ).toBe(403);
  });

  it("filters by client, owner, type, and status", async () => {
    await getAssets(
      request(
        `/api/marketing/assets?clientId=${PLAN_ID}&type=flyer&status=Published`,
      ),
    );

    expect(mocks.prisma.marketingAsset.findMany).toHaveBeenCalledWith({
      where: {
        clientId: PLAN_ID,
        userId: "user-1",
        type: "flyer",
        status: "Published",
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.marketingAsset.findMany.mockRejectedValue(new Error("db"));

    expect(
      (await getAssets(request(`/api/marketing/assets?clientId=${PLAN_ID}`)))
        .status,
    ).toBe(500);
  });
});

describe("POST /api/marketing/assets", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await postAsset(jsonRequest("/api/marketing/assets", "POST", {}))).status).toBe(
      401,
    );
  });

  it("requires clientId, type, and headline", async () => {
    const response = await postAsset(
      jsonRequest("/api/marketing/assets", "POST", { clientId: PLAN_ID }),
    );

    expect(response.status).toBe(400);
  });

  it("propagates the plan gate", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({ allowed: false, message: "no" });

    const response = await postAsset(
      jsonRequest("/api/marketing/assets", "POST", {
        clientId: PLAN_ID,
        type: "flyer",
        headline: "Headline",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("creates an asset with defaults", async () => {
    const response = await postAsset(
      jsonRequest("/api/marketing/assets", "POST", {
        clientId: PLAN_ID,
        type: "flyer",
        headline: "Headline",
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.marketingAsset.create).toHaveBeenCalledWith({
      data: {
        clientId: PLAN_ID,
        userId: "user-1",
        type: "flyer",
        status: "Draft",
        headline: "Headline",
        body: "",
        ctaText: "",
        startDate: null,
        endDate: null,
        bgColor: "#23919c",
        data: undefined,
      },
    });
  });

  it("returns 500 when creation fails", async () => {
    mocks.prisma.marketingAsset.create.mockRejectedValue(new Error("db"));

    const response = await postAsset(
      jsonRequest("/api/marketing/assets", "POST", {
        clientId: PLAN_ID,
        type: "flyer",
        headline: "Headline",
      }),
    );

    expect(response.status).toBe(500);
  });
});

describe("PATCH /api/marketing/assets/[id]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await patchAsset(jsonRequest(`/api/marketing/assets/${ASSET_ID}`, "PATCH", {}), ctx(ASSET_ID)))
        .status,
    ).toBe(401);
  });

  it("returns 404 when the asset is missing", async () => {
    expect(
      (await patchAsset(jsonRequest(`/api/marketing/assets/${ASSET_ID}`, "PATCH", { status: "Published" }), ctx(ASSET_ID)))
        .status,
    ).toBe(404);
  });

  it("returns 403 for another user's asset", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-2",
    });

    expect(
      (await patchAsset(jsonRequest(`/api/marketing/assets/${ASSET_ID}`, "PATCH", { status: "Published" }), ctx(ASSET_ID)))
        .status,
    ).toBe(403);
  });

  it("rejects a body without allowed fields", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
    });

    const response = await patchAsset(
      jsonRequest(`/api/marketing/assets/${ASSET_ID}`, "PATCH", { clientId: "x" }),
      ctx(ASSET_ID),
    );

    expect(response.status).toBe(400);
  });

  it("updates only whitelisted fields", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
    });

    const response = await patchAsset(
      jsonRequest(`/api/marketing/assets/${ASSET_ID}`, "PATCH", {
        status: "Archived",
        headline: "New",
        clientId: "ignored",
      }),
      ctx(ASSET_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.marketingAsset.update).toHaveBeenCalledWith({
      where: { id: ASSET_ID },
      data: { status: "Archived", headline: "New" },
    });
  });

  it("returns 500 when the update fails", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
    });
    mocks.prisma.marketingAsset.update.mockRejectedValue(new Error("db"));

    expect(
      (await patchAsset(jsonRequest(`/api/marketing/assets/${ASSET_ID}`, "PATCH", { status: "Published" }), ctx(ASSET_ID)))
        .status,
    ).toBe(500);
  });
});

describe("DELETE /api/marketing/assets/[id]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await deleteAsset(request(`/api/marketing/assets/${ASSET_ID}`), ctx(ASSET_ID))).status).toBe(
      401,
    );
  });

  it("returns 404 when the asset is missing", async () => {
    expect((await deleteAsset(request(`/api/marketing/assets/${ASSET_ID}`), ctx(ASSET_ID))).status).toBe(
      404,
    );
  });

  it("returns 403 for another user's asset", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-2",
    });

    expect((await deleteAsset(request(`/api/marketing/assets/${ASSET_ID}`), ctx(ASSET_ID))).status).toBe(
      403,
    );
  });

  it("deletes the QR.io code when configured, then the asset", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
      data: { flyerQrIoId: "qr-1" },
    });

    const response = await deleteAsset(
      request(`/api/marketing/assets/${ASSET_ID}`),
      ctx(ASSET_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.qr.io/v1/delete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.prisma.marketingAsset.delete).toHaveBeenCalledWith({
      where: { id: ASSET_ID },
    });
  });

  it("skips QR.io when no key is configured", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
      data: { flyerQrIoId: "qr-1" },
    });

    await deleteAsset(request(`/api/marketing/assets/${ASSET_ID}`), ctx(ASSET_ID));

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.prisma.marketingAsset.delete).toHaveBeenCalled();
  });

  it("still deletes when QR.io fails", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "nope" }, false, 500));
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
      data: { flyerQrIoId: "qr-1" },
    });

    const response = await deleteAsset(
      request(`/api/marketing/assets/${ASSET_ID}`),
      ctx(ASSET_ID),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.marketingAsset.delete).toHaveBeenCalled();
  });

  it("returns 500 when deletion fails", async () => {
    mocks.prisma.marketingAsset.findUnique.mockResolvedValue({
      id: ASSET_ID,
      userId: "user-1",
      data: {},
    });
    mocks.prisma.marketingAsset.delete.mockRejectedValue(new Error("db"));

    expect((await deleteAsset(request(`/api/marketing/assets/${ASSET_ID}`), ctx(ASSET_ID))).status).toBe(
      500,
    );
  });
});

describe("GET /api/marketing/assets/public", () => {
  it("requires clientId", async () => {
    expect((await getPublicAssets(request("/api/marketing/assets/public"))).status).toBe(
      400,
    );
  });

  it("returns an empty list for an unknown slug", async () => {
    const response = await getPublicAssets(
      request("/api/marketing/assets/public?clientId=missing"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("resolves a slug and returns published portal assets", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });

    await getPublicAssets(
      request("/api/marketing/assets/public?clientId=acme"),
    );

    expect(mocks.prisma.marketingAsset.findMany).toHaveBeenCalledWith({
      where: {
        clientId: PLAN_ID,
        status: "Published",
        type: { in: ["portal-notice", "pop-up", "news-post"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

  it("filters by an explicit public type", async () => {
    await getPublicAssets(
      request(`/api/marketing/assets/public?clientId=${PLAN_ID}&type=pop-up`),
    );

    expect(mocks.prisma.marketingAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "pop-up" }),
      }),
    );
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.marketingAsset.findMany.mockRejectedValue(new Error("db"));

    expect(
      (await getPublicAssets(
        request(`/api/marketing/assets/public?clientId=${PLAN_ID}`),
      )).status,
    ).toBe(500);
  });
});

describe("GET /api/marketing/flyers", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await getFlyers(request(`/api/marketing/flyers?clientId=${PLAN_ID}`))).status).toBe(
      401,
    );
  });

  it("requires clientId", async () => {
    expect((await getFlyers(request("/api/marketing/flyers"))).status).toBe(400);
  });

  it("returns 404 for an unknown plan", async () => {
    expect((await getFlyers(request(`/api/marketing/flyers?clientId=${PLAN_ID}`))).status).toBe(
      404,
    );
  });

  it("hides archived flyers and serializes dates", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.marketingFlyer.findMany.mockResolvedValue([
      {
        id: FLYER_ID,
        clientId: PLAN_ID,
        archivedAt: null,
        generatedCopyAt: new Date("2026-01-02T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
      },
      {
        id: "archived",
        clientId: PLAN_ID,
        archivedAt: new Date("2026-01-04T00:00:00Z"),
        generatedCopyAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);

    const body = await (
      await getFlyers(request(`/api/marketing/flyers?clientId=${PLAN_ID}`))
    ).json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        id: FLYER_ID,
        generatedCopyAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
    );
  });

  it("includes archived flyers when requested", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.marketingFlyer.findMany.mockResolvedValue([
      {
        id: "archived",
        archivedAt: new Date("2026-01-04T00:00:00Z"),
        generatedCopyAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);

    const body = await (
      await getFlyers(
        request(`/api/marketing/flyers?clientId=${PLAN_ID}&includeArchived=1`),
      )
    ).json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].archivedAt).toBe("2026-01-04T00:00:00.000Z");
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.marketingFlyer.findMany.mockRejectedValue(new Error("db"));

    expect((await getFlyers(request(`/api/marketing/flyers?clientId=${PLAN_ID}`))).status).toBe(
      500,
    );
  });
});

describe("PATCH /api/marketing/flyers/[id]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await patchFlyer(jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", {}), ctx(FLYER_ID))).status).toBe(
      401,
    );
  });

  it("returns 400 for a blank id", async () => {
    expect((await patchFlyer(jsonRequest("/api/marketing/flyers/ ", "PATCH", {}), ctx(" "))).status).toBe(
      400,
    );
  });

  it("returns 404 when the flyer is missing", async () => {
    expect((await patchFlyer(jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", { title: "x" }), ctx(FLYER_ID))).status).toBe(
      404,
    );
  });

  it("returns 404 when plan access is denied", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
    });
    mocks.resolvePlanAccess.mockResolvedValue({ allowed: false });

    expect((await patchFlyer(jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", { title: "x" }), ctx(FLYER_ID))).status).toBe(
      404,
    );
  });

  it("rejects a body with no valid fields", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
    });

    expect((await patchFlyer(jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", {}), ctx(FLYER_ID))).status).toBe(
      400,
    );
  });

  it("archives and titles a flyer", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
    });
    mocks.prisma.marketingFlyer.update.mockResolvedValue({
      id: FLYER_ID,
      archivedAt: new Date("2026-01-05T00:00:00Z"),
      title: "Renamed",
      updatedAt: new Date("2026-01-06T00:00:00Z"),
    });

    const body = await (
      await patchFlyer(
        jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", {
          archived: true,
          title: "  Renamed  ",
        }),
        ctx(FLYER_ID),
      )
    ).json();

    expect(mocks.prisma.marketingFlyer.update).toHaveBeenCalledWith({
      where: { id: FLYER_ID },
      data: {
        archivedAt: expect.any(Date),
        title: "Renamed",
      },
    });
    expect(body.data.archivedAt).toBe("2026-01-05T00:00:00.000Z");
  });

  it("unarchives and clears a title", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
    });

    await patchFlyer(
      jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", {
        archived: false,
        title: "   ",
      }),
      ctx(FLYER_ID),
    );

    expect(mocks.prisma.marketingFlyer.update).toHaveBeenCalledWith({
      where: { id: FLYER_ID },
      data: { archivedAt: null, title: null },
    });
  });

  it("returns 500 when the update fails", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
    });
    mocks.prisma.marketingFlyer.update.mockRejectedValue(new Error("db"));

    expect((await patchFlyer(jsonRequest(`/api/marketing/flyers/${FLYER_ID}`, "PATCH", { title: "x" }), ctx(FLYER_ID))).status).toBe(
      500,
    );
  });
});

describe("GET /api/marketing/flyers/[id]/file", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await getFlyerFile(request(`/api/marketing/flyers/${FLYER_ID}/file?format=pdf`), ctx(FLYER_ID))).status).toBe(
      401,
    );
  });

  it("rejects an invalid format", async () => {
    expect((await getFlyerFile(request(`/api/marketing/flyers/${FLYER_ID}/file?format=doc`), ctx(FLYER_ID))).status).toBe(
      400,
    );
  });

  it("returns 404 when the flyer is missing or denied", async () => {
    expect((await getFlyerFile(request(`/api/marketing/flyers/${FLYER_ID}/file?format=pdf`), ctx(FLYER_ID))).status).toBe(
      404,
    );
  });

  it("redirects a PDF to its presigned key", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
      pdfStorageKey: "flyer-pdf",
      pngStorageKey: "flyer-png",
    });

    const response = await getFlyerFile(
      request(`/api/marketing/flyers/${FLYER_ID}/file?format=pdf`),
      ctx(FLYER_ID),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://r2.example/file");
    expect(mocks.getPresignedReadUrl).toHaveBeenCalledWith({
      key: "flyer-pdf",
      expiresInSeconds: 3600,
      responseContentDisposition: `attachment; filename="flyer-${FLYER_ID}.pdf"`,
      responseContentType: "application/pdf",
    });
  });

  it("uses the PNG key and content type", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
      pdfStorageKey: "flyer-pdf",
      pngStorageKey: "flyer-png",
    });

    await getFlyerFile(
      request(`/api/marketing/flyers/${FLYER_ID}/file?format=png`),
      ctx(FLYER_ID),
    );

    expect(mocks.getPresignedReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "flyer-png",
        responseContentType: "image/png",
      }),
    );
  });

  it("returns 503 when a download URL cannot be produced", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockResolvedValue({
      id: FLYER_ID,
      clientId: PLAN_ID,
      pdfStorageKey: "flyer-pdf",
    });
    mocks.getPresignedReadUrl.mockResolvedValue(null);

    expect((await getFlyerFile(request(`/api/marketing/flyers/${FLYER_ID}/file?format=pdf`), ctx(FLYER_ID))).status).toBe(
      503,
    );
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.marketingFlyer.findFirst.mockRejectedValue(new Error("db"));

    expect((await getFlyerFile(request(`/api/marketing/flyers/${FLYER_ID}/file?format=pdf`), ctx(FLYER_ID))).status).toBe(
      500,
    );
  });
});

describe("POST /api/marketing/flyers/generate-copy", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await postGenerateCopy(jsonRequest("/api/marketing/flyers/generate-copy", "POST", {}))).status).toBe(
      401,
    );
  });

  it("requires clientId and mode", async () => {
    expect((await postGenerateCopy(jsonRequest("/api/marketing/flyers/generate-copy", "POST", { clientId: PLAN_ID }))).status).toBe(
      400,
    );
  });

  it("rejects an unknown mode", async () => {
    expect(
      (
        await postGenerateCopy(
          jsonRequest("/api/marketing/flyers/generate-copy", "POST", {
            clientId: PLAN_ID,
            mode: "nope",
          }),
        )
      ).status,
    ).toBe(400);
  });

  it("returns 404 when the plan or user is missing", async () => {
    mocks.getOwnedClient.mockResolvedValue(null);
    expect(
      (
        await postGenerateCopy(
          jsonRequest("/api/marketing/flyers/generate-copy", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
          }),
        )
      ).status,
    ).toBe(404);

    mocks.getOwnedClient.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    expect(
      (
        await postGenerateCopy(
          jsonRequest("/api/marketing/flyers/generate-copy", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
          }),
        )
      ).status,
    ).toBe(404);
  });

  it("returns the generated copy and AI metadata", async () => {
    const response = await postGenerateCopy(
      jsonRequest("/api/marketing/flyers/generate-copy", "POST", {
        clientId: PLAN_ID,
        mode: "hub_promo_general",
        modeOptions: { topic: "Retirement" },
        userHint: "friendly",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.buildBrand).toHaveBeenCalled();
    expect(mocks.generateFlyerCopy).toHaveBeenCalledWith({
      mode: "hub_promo_general",
      modeOptions: { topic: "Retirement" },
      brand: { brand: true },
      userHint: "friendly",
    });
    expect(body.data).toEqual({
      headline: "Headline",
      body: "Body",
      cta: "Learn more",
      aiModel: "model",
      aiPromptVersion: "v1",
    });
  });

  it("returns 500 when generation fails", async () => {
    mocks.generateFlyerCopy.mockRejectedValue(new Error("ai"));

    expect(
      (
        await postGenerateCopy(
          jsonRequest("/api/marketing/flyers/generate-copy", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
          }),
        )
      ).status,
    ).toBe(500);
  });
});

describe("POST /api/marketing/flyers/render", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await postRenderFlyer(jsonRequest("/api/marketing/flyers/render", "POST", {}))).status).toBe(
      401,
    );
  });

  it("returns 503 when R2 is not configured", async () => {
    mocks.isR2Configured.mockReturnValue(false);

    expect((await postRenderFlyer(jsonRequest("/api/marketing/flyers/render", "POST", {}))).status).toBe(
      503,
    );
  });

  it("requires all copy fields", async () => {
    expect((await postRenderFlyer(jsonRequest("/api/marketing/flyers/render", "POST", { clientId: PLAN_ID }))).status).toBe(
      400,
    );
  });

  it("rejects an unknown mode", async () => {
    expect(
      (
        await postRenderFlyer(
          jsonRequest("/api/marketing/flyers/render", "POST", {
            clientId: PLAN_ID,
            mode: "nope",
            headline: "H",
            body: "B",
            cta: "C",
          }),
        )
      ).status,
    ).toBe(400);
  });

  it("returns 404 for a missing plan or user", async () => {
    mocks.getOwnedClient.mockResolvedValue(null);
    expect(
      (
        await postRenderFlyer(
          jsonRequest("/api/marketing/flyers/render", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
            headline: "H",
            body: "B",
            cta: "C",
          }),
        )
      ).status,
    ).toBe(404);

    mocks.getOwnedClient.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    expect(
      (
        await postRenderFlyer(
          jsonRequest("/api/marketing/flyers/render", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
            headline: "H",
            body: "B",
            cta: "C",
          }),
        )
      ).status,
    ).toBe(404);
  });

  it("returns 500 when the hub URL cannot be built", async () => {
    mocks.getHubUrl.mockImplementation(() => {
      throw new Error("bad hub");
    });

    expect(
      (
        await postRenderFlyer(
          jsonRequest("/api/marketing/flyers/render", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
            headline: "H",
            body: "B",
            cta: "C",
          }),
        )
      ).status,
    ).toBe(500);
  });

  it("returns 500 when either R2 upload fails", async () => {
    mocks.putObjectBuffer.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    expect(
      (
        await postRenderFlyer(
          jsonRequest("/api/marketing/flyers/render", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
            headline: "H",
            body: "B",
            cta: "C",
          }),
        )
      ).status,
    ).toBe(500);
  });

  it("renders, uploads, and records a flyer", async () => {
    const response = await postRenderFlyer(
      jsonRequest("/api/marketing/flyers/render", "POST", {
        clientId: PLAN_ID,
        mode: "hub_promo_general",
        modeOptions: { topic: "Retirement" },
        headline: "H",
        body: "B",
        cta: "C",
        title: "  My Flyer  ",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.renderFlyerPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: "H",
        body: "B",
        cta: "C",
        hubAbsoluteUrl: "https://hub.example/acme",
        brand: { brand: true },
      }),
    );
    expect(mocks.putObjectBuffer).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.marketingFlyer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "65f1c2a9b3d4e5f6a7b8c9d0",
        clientId: PLAN_ID,
        userId: "user-1",
        mode: "hub_promo_general",
        modeOptions: { topic: "Retirement" },
        headline: "H",
        body: "B",
        cta: "C",
        hubUrlSnapshot: "https://hub.example/acme",
        pdfStorageKey: "key-pdf",
        pngStorageKey: "key-png",
        title: "My Flyer",
      }),
    });
    expect(body.data).toEqual(
      expect.objectContaining({
        id: "65f1c2a9b3d4e5f6a7b8c9d0",
        pdfStorageKey: "key-pdf",
        pngStorageKey: "key-png",
      }),
    );
  });

  it("returns 500 when rendering fails", async () => {
    mocks.renderFlyerPdf.mockRejectedValue(new Error("render"));

    expect(
      (
        await postRenderFlyer(
          jsonRequest("/api/marketing/flyers/render", "POST", {
            clientId: PLAN_ID,
            mode: "hub_promo_general",
            headline: "H",
            body: "B",
            cta: "C",
          }),
        )
      ).status,
    ).toBe(500);
  });
});

describe("POST /api/marketing/qr/generate", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await postGenerateQr(jsonRequest("/api/marketing/qr/generate", "POST", {}))).status).toBe(
      401,
    );
  });

  it("requires a URL", async () => {
    expect((await postGenerateQr(jsonRequest("/api/marketing/qr/generate", "POST", {}))).status).toBe(
      400,
    );
  });

  it("prepends https and uses QR.io when configured", async () => {
    process.env.QR_IO_API_KEY = "key";

    const response = await postGenerateQr(
      jsonRequest("/api/marketing/qr/generate", "POST", {
        url: "hub.example/acme",
        name: "Acme",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.generateQrViaQrIo).toHaveBeenCalledWith(
      "https://hub.example/acme",
      { name: "Acme" },
    );
    expect(body.data).toEqual({
      dataUrl: "https://qr.example/image.png",
      source: "qrio",
      qrIoId: "qr-1",
      name: "QR",
    });
  });

  it("falls back to local QR when QR.io fails", async () => {
    process.env.QR_IO_API_KEY = "key";
    mocks.generateQrViaQrIo.mockRejectedValue(new Error("qrio"));

    const body = await (
      await postGenerateQr(
        jsonRequest("/api/marketing/qr/generate", "POST", {
          url: "https://hub.example",
        }),
      )
    ).json();

    expect(mocks.renderQrToDataUrl).toHaveBeenCalledWith("https://hub.example", {
      sizePx: 320,
      errorCorrectionLevel: "M",
      margin: 2,
    });
    expect(body.data).toEqual({
      dataUrl: "data:image/png;base64,qr",
      source: "local",
    });
  });

  it("returns a local QR when no key is configured", async () => {
    const body = await (
      await postGenerateQr(
        jsonRequest("/api/marketing/qr/generate", "POST", {
          url: "https://hub.example",
        }),
      )
    ).json();

    expect(mocks.generateQrViaQrIo).not.toHaveBeenCalled();
    expect(body.data.source).toBe("local");
  });

  it("returns 500 when local generation fails", async () => {
    mocks.renderQrToDataUrl.mockRejectedValue(new Error("qr"));

    expect(
      (
        await postGenerateQr(
          jsonRequest("/api/marketing/qr/generate", "POST", {
            url: "https://hub.example",
          }),
        )
      ).status,
    ).toBe(500);
  });
});

describe("POST /api/marketing/save-pdf", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await postSavePdf(jsonRequest("/api/marketing/save-pdf", "POST", {}))).status).toBe(
      401,
    );
  });

  it("requires clientId and fileName", async () => {
    expect((await postSavePdf(jsonRequest("/api/marketing/save-pdf", "POST", { clientId: PLAN_ID }))).status).toBe(
      400,
    );
  });

  it("requires either base64 or a storage key", async () => {
    expect(
      (
        await postSavePdf(
          jsonRequest("/api/marketing/save-pdf", "POST", {
            clientId: PLAN_ID,
            fileName: "flyer.pdf",
          }),
        )
      ).status,
    ).toBe(400);
  });

  it("returns 404 for a plan not owned by the caller", async () => {
    expect(
      (
        await postSavePdf(
          jsonRequest("/api/marketing/save-pdf", "POST", {
            clientId: PLAN_ID,
            fileName: "flyer.pdf",
            pdfBase64: "abc",
          }),
        )
      ).status,
    ).toBe(404);
  });

  it("creates an R2-backed document from a storage key", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });

    const response = await postSavePdf(
      jsonRequest("/api/marketing/save-pdf", "POST", {
        clientId: PLAN_ID,
        fileName: "flyer",
        storageKey: " key-1 ",
        title: "My Flyer",
        language: "ES",
        category: "Retirement",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveCategory).toHaveBeenCalledWith("Document", "Retirement");
    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "My Flyer",
        fileName: "flyer.pdf",
        fileUrl: "r2:stored",
        storageKey: "key-1",
        type: "Document",
        language: "ES",
        category: "Retirement",
      }),
    });
  });

  it("normalizes inline base64 and the file extension", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });

    await postSavePdf(
      jsonRequest("/api/marketing/save-pdf", "POST", {
        clientId: PLAN_ID,
        fileName: "flyer",
        pdfBase64: "abc",
      }),
    );

    expect(mocks.prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "flyer",
        fileName: "flyer.pdf",
        fileUrl: "data:application/pdf;base64,abc",
        language: "EN",
      }),
    });
  });

  it("returns 500 when document creation fails", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: PLAN_ID });
    mocks.prisma.document.create.mockRejectedValue(new Error("db"));

    expect(
      (
        await postSavePdf(
          jsonRequest("/api/marketing/save-pdf", "POST", {
            clientId: PLAN_ID,
            fileName: "flyer.pdf",
            pdfBase64: "abc",
          }),
        )
      ).status,
    ).toBe(500);
  });
});
