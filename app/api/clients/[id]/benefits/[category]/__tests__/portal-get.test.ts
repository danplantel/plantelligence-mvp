import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../route";

/**
 * `GET /api/clients/[id]/benefits/[category]?forPortal=1` — the read every
 * benefit hub page makes.
 *
 * The route has two very different callers and the existing suite only covers
 * the session one. On the portal path:
 *
 *  - the request is **anonymous**, so the owning advisor is derived from the
 *    plan slug (`resolvePortalAdvisorId`) and the plan lookup is scoped to that
 *    advisor; there is no `resolvePlanAccess` call at all;
 *  - a plan belonging to a different advisor is a 403, not a 404;
 *  - the development loopback preview is deliberately open.
 *
 * The response is also where a stored `planVideo` R2 key becomes a signed URL.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
  resolvePlanAccess: vi.fn(),
  isR2Configured: vi.fn(() => false),
  getPresignedReadUrl: vi.fn(async () => "https://signed.test/video.mp4"),
  prisma: {
    client: { findFirst: vi.fn() },
    benefit: { findUnique: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/plan-lookup", () => ({
  planIdOrSlug: (id: string) => ({ slug: id }),
}));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: mocks.resolvePortalAdvisorId,
  isLocalDevLoopback: mocks.isLocalDevLoopback,
}));
vi.mock("@/lib/teammates/access.server", () => ({
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/r2", () => ({
  isR2Configured: mocks.isR2Configured,
  getPresignedReadUrl: mocks.getPresignedReadUrl,
}));
vi.mock("@/lib/teammates/assignments.server", () => ({
  removeBenefitCategoryAccess: vi.fn(),
}));
vi.mock("@/lib/organization", () => ({
  resolveOrganizationId: vi.fn(async () => "org-1"),
}));
vi.mock("@/lib/branding-r2", () => ({
  uploadBrandingToR2: vi.fn(),
}));
vi.mock("@/lib/portal-category-visibility", () => ({
  getCategoryPortalVisibility: (raw: unknown) => raw ?? {},
}));

function plan(overrides: Record<string, unknown> = {}) {
  return { id: "plan-1", userId: "advisor-1", ...overrides };
}

function benefit(overrides: Record<string, unknown> = {}) {
  return {
    id: "benefit-1",
    clientId: "plan-1",
    category: "Retirement",
    title: "Retirement Plan Benefits",
    planVideo: null,
    ...overrides,
  };
}

function portalRequest(slug = "acme") {
  return new NextRequest(
    new URL(
      `/api/clients/${slug}/benefits/Retirement?forPortal=1`,
      "http://localhost",
    ),
    { method: "GET" },
  );
}

function callGet(slug = "acme") {
  return GET(portalRequest(slug), {
    params: { id: slug, category: "Retirement" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue(null);
  mocks.resolvePortalAdvisorId.mockResolvedValue("advisor-1");
  mocks.isLocalDevLoopback.mockReturnValue(false);
  mocks.isR2Configured.mockReturnValue(false);
  mocks.prisma.client.findFirst.mockResolvedValue(plan());
  mocks.prisma.benefit.findUnique.mockResolvedValue(benefit());
});

describe("portal benefit read", () => {
  it("scopes the plan to the advisor its slug resolves to", async () => {
    const response = await callGet();

    expect(mocks.resolvePortalAdvisorId).toHaveBeenCalled();
    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ slug: "acme" }, { userId: "advisor-1" }] },
    });
    expect(response.status).toBe(200);
  });

  it("returns the benefit row for the category", async () => {
    const body = await (await callGet()).json();

    expect(body).toEqual({ success: true, benefit: benefit() });
    expect(mocks.prisma.benefit.findUnique).toHaveBeenCalledWith({
      where: {
        clientId_category: { clientId: "plan-1", category: "Retirement" },
      },
    });
  });

  it("does not consult the dashboard access layer", async () => {
    await callGet();

    expect(mocks.resolvePlanAccess).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("refuses a plan owned by another advisor", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(plan({ userId: "other" }));

    const response = await callGet();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 404 when the slug resolves to no plan", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(404);
    expect(mocks.prisma.benefit.findUnique).not.toHaveBeenCalled();
  });

  it("requires a session when no advisor can be derived", async () => {
    mocks.resolvePortalAdvisorId.mockResolvedValue(undefined);

    const response = await callGet();

    expect(response.status).toBe(401);
  });

  it("stays open for the local development preview", async () => {
    mocks.resolvePortalAdvisorId.mockResolvedValue(undefined);
    mocks.isLocalDevLoopback.mockReturnValue(true);

    const response = await callGet("plan-1");

    expect(response.status).toBe(200);
    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ slug: "plan-1" }] },
    });
  });

  it("answers with a null benefit when the row does not exist", async () => {
    mocks.prisma.benefit.findUnique.mockResolvedValue(null);

    const body = await (await callGet()).json();

    expect(body).toEqual({ success: true, benefit: null });
  });
});

describe("portal benefit video signing", () => {
  it("signs a stored R2 key", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    mocks.prisma.benefit.findUnique.mockResolvedValue(
      benefit({ planVideo: "benefits/plan-1/video.mp4" }),
    );

    const body = await (await callGet()).json();

    expect(mocks.getPresignedReadUrl).toHaveBeenCalledWith({
      key: "benefits/plan-1/video.mp4",
    });
    expect(body.benefit.planVideo).toBe("https://signed.test/video.mp4");
  });

  it("extracts the key from a proxied video URL", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    mocks.prisma.benefit.findUnique.mockResolvedValue(
      benefit({ planVideo: "/api/r2/object?key=benefits%2Fplan-1%2Fv.mp4" }),
    );

    await callGet();

    expect(mocks.getPresignedReadUrl).toHaveBeenCalledWith({
      key: "benefits/plan-1/v.mp4",
    });
  });

  it("leaves an absolute video URL alone", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    mocks.prisma.benefit.findUnique.mockResolvedValue(
      benefit({ planVideo: "https://cdn.test/video.mp4" }),
    );

    const body = await (await callGet()).json();

    expect(mocks.getPresignedReadUrl).not.toHaveBeenCalled();
    expect(body.benefit.planVideo).toBe("https://cdn.test/video.mp4");
  });

  it("does nothing when R2 is not configured", async () => {
    mocks.prisma.benefit.findUnique.mockResolvedValue(
      benefit({ planVideo: "benefits/plan-1/video.mp4" }),
    );

    await callGet();

    expect(mocks.getPresignedReadUrl).not.toHaveBeenCalled();
  });

  it("returns 500 when the lookup fails", async () => {
    mocks.prisma.benefit.findUnique.mockRejectedValue(new Error("db down"));

    const response = await callGet();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });
});
