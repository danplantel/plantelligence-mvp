import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "@/app/api/clients/[id]/route";

/**
 * The plan-level half of the Browse Benefits publish/hide toggle.
 *
 * `/benefits` sends the FULL `categoryPortalVisibility` map (the row's own map
 * with one key flipped), because this route writes what it is given rather than
 * merging it. These tests pin that contract plus the authorization gate.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  resolvePlanAccess: vi.fn(),
  permissionAllows: vi.fn(),
  prisma: {
    client: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  normalizeContactImagesToR2: vi.fn(),
  mirrorPlanContacts: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/plan-lookup", () => ({ planIdOrSlug: vi.fn() }));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
}));
vi.mock("@/lib/teammates/access.server", () => ({
  NO_ACCESS_MESSAGE: "No access",
  permissionAllows: mocks.permissionAllows,
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/slug-registry", () => ({
  renameClientSlug: vi.fn(),
  isSlugTaken: vi.fn(),
  resolvePortalSlug: vi.fn(),
}));
vi.mock("@/lib/image-processing", () => ({
  processBase64Image: vi.fn(),
  processBase64ImageWithCrop: vi.fn(),
  isBase64Image: vi.fn(() => false),
}));
vi.mock("@/lib/document-category", () => ({
  resolvePersistedDocumentCategory: vi.fn(),
}));
vi.mock("@/lib/branding-image-url", () => ({
  normalizeClientBrandingKeysForResponse: vi.fn(),
  toR2BrandingKey: vi.fn(),
}));
vi.mock("@/lib/r2", () => ({
  getPresignedReadUrl: vi.fn(),
  isR2Configured: vi.fn(() => false),
}));
vi.mock("@/lib/branding-r2", () => ({
  normalizeContactImagesToR2: mocks.normalizeContactImagesToR2,
}));
vi.mock("@/lib/organization", () => ({
  getOrCreateOrganizationForUser: vi.fn(),
}));
vi.mock("@/lib/teammates/hub-contacts.server", () => ({
  buildPortalKeyContacts: vi.fn(),
}));
vi.mock("@/lib/teammates/contact-mirror.server", () => ({
  mirrorPlanContacts: mocks.mirrorPlanContacts,
}));

function existingClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    slug: "acme",
    companyName: "Acme Corp",
    userId: "owner-1",
    categoryPortalVisibility: {
      Retirement: true,
      "Group Health": false,
      "Group Life": true,
      Other: false,
    },
    ...overrides,
  };
}

function request(body: Record<string, unknown>, id = "plan-1"): NextRequest {
  return new NextRequest(new URL(`/api/clients/${id}`, "http://localhost"), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPut(body: Record<string, unknown>, id = "plan-1") {
  return PUT(request(body, id), { params: { id } });
}

async function payload(response: Response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  mocks.getSession.mockResolvedValue({ user: { id: "owner-1" } });
  mocks.resolvePlanAccess.mockResolvedValue({ allowed: true, kind: "owner" });
  mocks.permissionAllows.mockReturnValue(true);
  mocks.prisma.client.findFirst.mockResolvedValue(existingClient());
  mocks.prisma.client.update.mockResolvedValue({ id: "plan-1" });
});

describe("PUT /api/clients/[id] — categoryPortalVisibility", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await callPut({ categoryPortalVisibility: {} });

    expect(response.status).toBe(401);
    expect(mocks.prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when neither the id nor the slug resolves", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await callPut({ categoryPortalVisibility: {} });

    expect(response.status).toBe(404);
  });

  it("refuses a caller without plan access", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "not_assigned",
      message: "No access",
    });

    const response = await callPut({ categoryPortalVisibility: {} });

    expect(response.status).toBe(403);
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });

  it("refuses a teammate with neither benefits nor branding edit rights", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: true,
      kind: "teammate",
      permissionSet: {},
    });
    mocks.permissionAllows.mockReturnValue(false);

    const response = await callPut({ categoryPortalVisibility: {} });

    expect(response.status).toBe(403);
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });

  it("persists the full map the page sends", async () => {
    const categoryPortalVisibility = {
      Retirement: false,
      "Group Health": true,
      "Group Life": false,
      Other: true,
    };

    const response = await callPut({ categoryPortalVisibility });

    expect(response.status).toBe(200);
    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: expect.objectContaining({ categoryPortalVisibility }),
    });
  });

  it("preserves the stored map when the request omits it", async () => {
    await callPut({ companyName: "Acme Corp" });

    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: expect.objectContaining({
        categoryPortalVisibility: existingClient().categoryPortalVisibility,
      }),
    });
  });

  it("normalizes string and numeric visibility values into booleans", async () => {
    await callPut({
      categoryPortalVisibility: {
        Retirement: "false",
        "Group Health": 0,
        "Group Life": "true",
        Other: 1,
      },
    });

    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: expect.objectContaining({
        categoryPortalVisibility: {
          Retirement: false,
          "Group Health": false,
          "Group Life": true,
          Other: true,
        },
      }),
    });
  });

  it("returns 500 when the update fails", async () => {
    mocks.prisma.client.update.mockRejectedValue(new Error("write failed"));

    const response = await callPut({ categoryPortalVisibility: {} });

    expect(response.status).toBe(500);
    expect(await payload(response)).toMatchObject({
      error: "Failed to update client",
      details: "write failed",
    });
  });
});
