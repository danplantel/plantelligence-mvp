import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PUT } from "../route";

/**
 * `/api/clients/[id]/benefits/[category]` contract.
 *
 * The Edit Benefit page and the Create Benefit wizard both write through this
 * route. These tests pin the access gate, the `updateOnly` draft path, the
 * `purge` hard-delete and the default soft-disable.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolvePlanAccess: vi.fn(),
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
  removeBenefitCategoryAccess: vi.fn(async () => {}),
  resolveOrganizationId: vi.fn(async () => "org-1"),
  isR2Configured: vi.fn(() => false),
  getPresignedReadUrl: vi.fn(async () => "https://signed.test/video.mp4"),
  uploadBrandingToR2: vi.fn(async () => "r2-key"),
  prisma: {
    client: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    benefit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    commentThread: { deleteMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/plan-lookup", () => ({
  planIdOrSlug: (id: string) => ({ id }),
}));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: mocks.resolvePortalAdvisorId,
  isLocalDevLoopback: mocks.isLocalDevLoopback,
}));
vi.mock("@/lib/teammates/access.server", () => ({
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/teammates/assignments.server", () => ({
  removeBenefitCategoryAccess: mocks.removeBenefitCategoryAccess,
}));
vi.mock("@/lib/organization", () => ({
  resolveOrganizationId: mocks.resolveOrganizationId,
}));
vi.mock("@/lib/r2", () => ({
  isR2Configured: mocks.isR2Configured,
  getPresignedReadUrl: mocks.getPresignedReadUrl,
}));
vi.mock("@/lib/branding-r2", () => ({
  uploadBrandingToR2: mocks.uploadBrandingToR2,
}));
vi.mock("@/lib/portal-category-visibility", () => ({
  getCategoryPortalVisibility: (raw: unknown) => raw ?? {},
}));

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    userId: "user-1",
    organizationId: "org-1",
    employeePortalPreview: { benefits: [] },
    ...overrides,
  };
}

function benefit(overrides: Record<string, unknown> = {}) {
  return {
    id: "benefit-1",
    clientId: "plan-1",
    category: "Retirement",
    title: "Retirement Plan Benefits",
    isEnabled: true,
    planVideo: null,
    ...overrides,
  };
}

function request(
  method: string,
  path = "/api/clients/plan-1/benefits/Retirement",
  body?: unknown,
) {
  return new NextRequest(new URL(path, "http://localhost"), {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = { id: "plan-1", category: "Retirement" };

async function json(response: Response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.resolvePlanAccess.mockResolvedValue({ allowed: true, kind: "owner" });
  mocks.resolvePortalAdvisorId.mockResolvedValue(undefined);
  mocks.isLocalDevLoopback.mockReturnValue(false);
  mocks.isR2Configured.mockReturnValue(false);
  mocks.prisma.client.findFirst.mockResolvedValue(client());
  mocks.prisma.client.update.mockResolvedValue({});
  mocks.prisma.benefit.findUnique.mockResolvedValue(null);
  mocks.prisma.benefit.findMany.mockResolvedValue([]);
  mocks.prisma.benefit.upsert.mockImplementation(async (args: any) => ({
    ...benefit(),
    ...args.update,
  }));
  mocks.prisma.benefit.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.benefit.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.commentThread.deleteMany.mockResolvedValue({ count: 1 });
});

describe("GET /api/clients/[id]/benefits/[category]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await GET(request("GET"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the plan does not resolve", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await GET(request("GET"), { params });

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller has no plan access", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "not_assigned",
      message: "No access",
    });

    const response = await GET(request("GET"), { params });

    expect(response.status).toBe(403);
  });

  it("returns a null benefit when the row does not exist", async () => {
    const response = await GET(request("GET"), { params });

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ success: true, benefit: null });
  });

  it("signs a stored plan video when R2 is configured", async () => {
    mocks.isR2Configured.mockReturnValue(true);
    mocks.prisma.benefit.findUnique.mockResolvedValue(
      benefit({ planVideo: "raw-key" }),
    );

    const response = await GET(request("GET"), { params });
    const body = await json(response);

    expect(mocks.getPresignedReadUrl).toHaveBeenCalledWith({ key: "raw-key" });
    expect(body.benefit.planVideo).toBe("https://signed.test/video.mp4");
  });
});

describe("PUT /api/clients/[id]/benefits/[category]", () => {
  it("returns 403 when the caller may view but not edit", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "permission_denied",
      message: "No edit access",
    });

    const response = await PUT(request("PUT", undefined, { isEnabled: true }), {
      params,
    });

    expect(response.status).toBe(403);
    expect(mocks.prisma.benefit.upsert).not.toHaveBeenCalled();
  });

  it("skips an updateOnly write when no row exists", async () => {
    mocks.prisma.benefit.findUnique.mockResolvedValue(null);

    const response = await PUT(
      request("PUT", "/api/clients/plan-1/benefits/Retirement?updateOnly=1", {
        title: "Draft",
      }),
      { params },
    );

    expect(await json(response)).toEqual({
      success: true,
      benefit: null,
      skipped: true,
    });
    expect(mocks.prisma.benefit.upsert).not.toHaveBeenCalled();
  });

  it("updates an existing row through updateOnly", async () => {
    mocks.prisma.benefit.findUnique.mockResolvedValue({ id: "benefit-1" });

    const response = await PUT(
      request("PUT", "/api/clients/plan-1/benefits/Retirement?updateOnly=1", {
        title: "Updated",
      }),
      { params },
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.benefit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId_category: { clientId: "plan-1", category: "Retirement" },
        },
      }),
    );
  });

  it("patches the Show on page toggle when it is sent", async () => {
    await PUT(request("PUT", undefined, { planVideoVisible: false }), {
      params,
    });

    expect(mocks.prisma.benefit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ planVideoVisible: false }),
      }),
    );
  });

  it("leaves the toggle alone when the request omits it", async () => {
    await PUT(request("PUT", undefined, { title: "Updated" }), { params });

    const upsertArgs = mocks.prisma.benefit.upsert.mock.calls[0][0] as any;
    expect(upsertArgs.update.planVideoVisible).toBeUndefined();
  });

  it("defaults a new row to visible", async () => {
    await PUT(request("PUT", undefined, { title: "New" }), { params });

    const upsertArgs = mocks.prisma.benefit.upsert.mock.calls[0][0] as any;
    expect(upsertArgs.create.planVideoVisible).toBe(true);
  });

  it("stores the no-video image on create", async () => {
    await PUT(
      request("PUT", undefined, {
        title: "New",
        planVideoFallbackImage: "https://cdn.test/fallback.jpg",
      }),
      { params },
    );

    const upsertArgs = mocks.prisma.benefit.upsert.mock.calls[0][0] as any;
    expect(upsertArgs.create.planVideoFallbackImage).toBe(
      "https://cdn.test/fallback.jpg",
    );
  });

  it("patches the no-video image when it is sent", async () => {
    await PUT(
      request("PUT", undefined, {
        planVideoFallbackImage: "https://cdn.test/fallback.jpg",
      }),
      { params },
    );

    expect(mocks.prisma.benefit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          planVideoFallbackImage: "https://cdn.test/fallback.jpg",
        }),
      }),
    );
  });

  it("leaves the no-video image alone when the request omits it", async () => {
    await PUT(request("PUT", undefined, { title: "Updated" }), { params });

    const upsertArgs = mocks.prisma.benefit.upsert.mock.calls[0][0] as any;
    expect(upsertArgs.update.planVideoFallbackImage).toBeUndefined();
  });

  it("clears the no-video image when it is sent as null", async () => {
    await PUT(request("PUT", undefined, { planVideoFallbackImage: null }), {
      params,
    });

    const upsertArgs = mocks.prisma.benefit.upsert.mock.calls[0][0] as any;
    expect(upsertArgs.update.planVideoFallbackImage).toBeNull();
  });

  it("writes isEnabled false and mirrors the rows", async () => {
    mocks.prisma.benefit.findMany.mockResolvedValue([
      benefit({ isEnabled: false }),
    ]);

    const response = await PUT(
      request("PUT", undefined, { isEnabled: false }),
      { params },
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.benefit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ isEnabled: false }),
      }),
    );
    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: {
        employeePortalPreview: expect.objectContaining({
          benefits: expect.any(Array),
        }),
      },
    });
  });

  it("returns 500 when the upsert fails", async () => {
    mocks.prisma.benefit.upsert.mockRejectedValue(new Error("write failed"));

    const response = await PUT(request("PUT", undefined, {}), { params });

    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({ error: "Internal server error" });
  });
});

describe("DELETE /api/clients/[id]/benefits/[category]", () => {
  it("soft-disables the benefit by default", async () => {
    const response = await DELETE(request("DELETE"), { params });

    expect(response.status).toBe(200);
    expect(mocks.prisma.benefit.updateMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1", category: "Retirement" },
      data: { isEnabled: false },
    });
    expect(mocks.prisma.benefit.deleteMany).not.toHaveBeenCalled();
  });

  it("hard-deletes and cleans comments, access and the legacy mirror on purge", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(
      client({
        employeePortalPreview: {
          benefits: [{ category: "Retirement" }, { category: "Group Health" }],
        },
      }),
    );

    const response = await DELETE(
      request("DELETE", "/api/clients/plan-1/benefits/Retirement?purge=1"),
      { params },
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ success: true, purged: 1 });
    expect(mocks.prisma.benefit.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1", category: "Retirement" },
    });
    expect(mocks.prisma.commentThread.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1", benefitCategory: "retirement" },
    });
    expect(mocks.removeBenefitCategoryAccess).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "plan-1",
      category: "Retirement",
      actorUserId: "user-1",
    });
    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: {
        employeePortalPreview: {
          benefits: [{ category: "Group Health" }],
        },
      },
    });
  });

  it("still reports success when access cleanup fails", async () => {
    mocks.removeBenefitCategoryAccess.mockRejectedValue(
      new Error("cleanup failed"),
    );

    const response = await DELETE(
      request("DELETE", "/api/clients/plan-1/benefits/Retirement?purge=1"),
      { params },
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ success: true, purged: 1 });
  });

  it("returns 500 when the delete fails", async () => {
    mocks.prisma.benefit.deleteMany.mockRejectedValue(new Error("db down"));

    const response = await DELETE(
      request("DELETE", "/api/clients/plan-1/benefits/Retirement?purge=1"),
      { params },
    );

    expect(response.status).toBe(500);
  });
});
