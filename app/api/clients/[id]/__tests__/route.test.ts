import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "../route";

/**
 * `DELETE /api/clients/[id]` contract.
 *
 * Deleting a plan is the one destructive action on the All Plans table, and it
 * fans out across every client-scoped model plus the caller's wizard drafts.
 * These tests pin the important half: who is allowed to delete, that the plan id
 * (not the raw URL segment) drives every cleanup query, and that benefits are
 * removed before the client row so the P2014 foreign-key guard cannot fire.
 *
 * The route imports a long list of helpers that are irrelevant to DELETE
 * authorization, so they are mocked to keep the module import side-effect free.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    client: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    newClientWizardSession: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    newClientCompanyBasics: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    newClientWelcomeStatement: { deleteMany: vi.fn() },
    newClientKeyContacts: { deleteMany: vi.fn() },
    newClientContactBuilder: { deleteMany: vi.fn() },
    newClientComplianceDocuments: { deleteMany: vi.fn() },
    newClientEmployeePortalPreview: { deleteMany: vi.fn() },
    webinar: { deleteMany: vi.fn() },
    benefit: { deleteMany: vi.fn() },
    document: { deleteMany: vi.fn() },
    meeting: { deleteMany: vi.fn() },
    marketingAsset: { deleteMany: vi.fn() },
    marketingFlyer: { deleteMany: vi.fn() },
    video: { deleteMany: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

// Imported by the module but unused by DELETE.
vi.mock("@/lib/plan-lookup", () => ({ planIdOrSlug: vi.fn() }));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
}));
vi.mock("@/lib/teammates/access.server", () => ({
  NO_ACCESS_MESSAGE: "No access",
  permissionAllows: vi.fn(() => true),
  resolvePlanAccess: vi.fn(),
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
vi.mock("@/lib/portal-category-visibility", () => ({
  getCategoryPortalVisibility: vi.fn(),
  filterContactsByPortalVisibility: vi.fn(),
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
  normalizeContactImagesToR2: vi.fn(),
}));
vi.mock("@/lib/organization", () => ({
  getOrCreateOrganizationForUser: vi.fn(),
}));
vi.mock("@/lib/teammates/hub-contacts.server", () => ({
  buildPortalKeyContacts: vi.fn(),
}));
vi.mock("@/lib/teammates/contact-mirror.server", () => ({
  mirrorPlanContacts: vi.fn(),
}));

const OWNER_ID = "user-1";

function ownedPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    slug: "acme",
    companyName: "Acme",
    userId: OWNER_ID,
    ...overrides,
  };
}

function request(id = "plan-1") {
  return new NextRequest(new URL(`/api/clients/${id}`, "http://localhost"), {
    method: "DELETE",
  });
}

function callDelete(id = "plan-1") {
  return DELETE(request(id), { params: { id } });
}

async function payload(response: Response) {
  return response.json();
}

function deleteCalls(model: { deleteMany: ReturnType<typeof vi.fn> }) {
  return model.deleteMany.mock.calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: OWNER_ID } });
  mocks.prisma.client.findFirst.mockResolvedValue(ownedPlan());
  mocks.prisma.client.delete.mockResolvedValue({ id: "plan-1" });
  mocks.prisma.newClientWizardSession.findFirst.mockResolvedValue(null);
  mocks.prisma.newClientWizardSession.deleteMany.mockResolvedValue({
    count: 1,
  });
  mocks.prisma.newClientCompanyBasics.findMany.mockResolvedValue([]);
  mocks.prisma.newClientCompanyBasics.deleteMany.mockResolvedValue({
    count: 0,
  });
  mocks.prisma.newClientWelcomeStatement.deleteMany.mockResolvedValue({
    count: 0,
  });
  mocks.prisma.newClientKeyContacts.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.newClientContactBuilder.deleteMany.mockResolvedValue({
    count: 0,
  });
  mocks.prisma.newClientComplianceDocuments.deleteMany.mockResolvedValue({
    count: 0,
  });
  mocks.prisma.newClientEmployeePortalPreview.deleteMany.mockResolvedValue({
    count: 0,
  });
  mocks.prisma.webinar.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.benefit.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.document.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.meeting.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.marketingAsset.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.marketingFlyer.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.video.deleteMany.mockResolvedValue({ count: 0 });
});

describe("DELETE /api/clients/[id]", () => {
  it("returns 401 without a session and touches no rows", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await callDelete();

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Unauthorized" });
    expect(mocks.prisma.client.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.client.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when neither the id nor the slug resolves", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await callDelete("missing-plan");

    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: "Client not found" });
    expect(mocks.prisma.client.findFirst).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.client.delete).not.toHaveBeenCalled();
  });

  it("falls back to a slug lookup scoped to the caller", async () => {
    mocks.prisma.client.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ownedPlan());

    const response = await callDelete("acme");

    expect(response.status).toBe(200);
    expect(mocks.prisma.client.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "acme" },
    });
    expect(mocks.prisma.client.findFirst).toHaveBeenNthCalledWith(2, {
      where: { slug: "acme", userId: OWNER_ID },
    });
    // The canonical id — not the slug from the URL — drives every cleanup query.
    expect(mocks.prisma.benefit.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
  });

  it("returns 403 when the plan belongs to another advisor", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(
      ownedPlan({ userId: "someone-else" }),
    );

    const response = await callDelete();

    expect(response.status).toBe(403);
    expect(await payload(response)).toEqual({ error: "Forbidden" });
    expect(mocks.prisma.webinar.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.client.delete).not.toHaveBeenCalled();
  });

  it("deletes every client-scoped record and then the client", async () => {
    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(await payload(response)).toEqual({
      success: true,
      message: "Client and all associated data deleted successfully",
    });

    expect(mocks.prisma.webinar.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1", userId: OWNER_ID },
    });
    expect(mocks.prisma.benefit.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
    expect(mocks.prisma.document.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
    expect(mocks.prisma.marketingAsset.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
    expect(mocks.prisma.marketingFlyer.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
    expect(mocks.prisma.video.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
    expect(mocks.prisma.client.delete).toHaveBeenCalledWith({
      where: { id: "plan-1" },
    });
  });

  it("keeps the legacy company-name meeting cleanup for orphaned rows", async () => {
    await callDelete();

    expect(mocks.prisma.meeting.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: OWNER_ID,
        OR: [{ clientId: "plan-1" }, { client: "Acme", clientId: null }],
      },
    });
  });

  it("removes benefits before the client row", async () => {
    await callDelete();

    const benefitOrder =
      mocks.prisma.benefit.deleteMany.mock.invocationCallOrder[0];
    const clientOrder = mocks.prisma.client.delete.mock.invocationCallOrder[0];

    expect(benefitOrder).toBeLessThan(clientOrder);
  });

  it("cleans up the caller's wizard draft rows that claim the deleted plan", async () => {
    mocks.prisma.newClientWizardSession.findFirst.mockResolvedValue({
      id: "sess-1",
    });
    mocks.prisma.newClientCompanyBasics.findMany.mockResolvedValue([
      { sessionId: "sess-1" },
      { sessionId: "sess-2" },
    ]);

    await callDelete();

    // The draft query is scoped to this user and matches the plan by name or slug.
    expect(mocks.prisma.newClientCompanyBasics.findMany).toHaveBeenCalledWith({
      where: {
        session: { userId: OWNER_ID },
        OR: [{ companyName: "Acme" }, { portalUrl: "acme" }],
      },
      select: { sessionId: true },
    });

    const dedupedIds = { sessionId: { in: ["sess-1", "sess-2"] } };
    expect(deleteCalls(mocks.prisma.newClientCompanyBasics)).toEqual([
      [{ where: dedupedIds }],
    ]);
    expect(deleteCalls(mocks.prisma.newClientWelcomeStatement)).toEqual([
      [{ where: dedupedIds }],
    ]);
    expect(deleteCalls(mocks.prisma.newClientKeyContacts)).toEqual([
      [{ where: dedupedIds }],
    ]);
    expect(deleteCalls(mocks.prisma.newClientContactBuilder)).toEqual([
      [{ where: dedupedIds }],
    ]);
    expect(deleteCalls(mocks.prisma.newClientComplianceDocuments)).toEqual([
      [{ where: dedupedIds }],
    ]);
    expect(deleteCalls(mocks.prisma.newClientEmployeePortalPreview)).toEqual([
      [{ where: dedupedIds }],
    ]);
    expect(deleteCalls(mocks.prisma.newClientWizardSession)).toEqual([
      [{ where: { id: { in: ["sess-1", "sess-2"] } } }],
    ]);
  });

  it("skips wizard cleanup when the caller has no draft rows", async () => {
    await callDelete();

    expect(
      mocks.prisma.newClientCompanyBasics.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      mocks.prisma.newClientWelcomeStatement.deleteMany,
    ).not.toHaveBeenCalled();
    expect(mocks.prisma.newClientKeyContacts.deleteMany).not.toHaveBeenCalled();
    expect(
      mocks.prisma.newClientContactBuilder.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      mocks.prisma.newClientComplianceDocuments.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      mocks.prisma.newClientEmployeePortalPreview.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      mocks.prisma.newClientWizardSession.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it("returns 500 and leaves the client row alone when cleanup fails", async () => {
    mocks.prisma.benefit.deleteMany.mockRejectedValue(new Error("db down"));

    const response = await callDelete();

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Internal server error" });
    expect(mocks.prisma.client.delete).not.toHaveBeenCalled();
  });
});
