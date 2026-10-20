import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "../route";

/**
 * `PUT /api/clients/[id]` contract — the write behind Edit Plan's Save button
 * (and the plan-level half of every Benefits save, which PUTs here first).
 *
 * The route is ~950 lines, so this pins the parts a regression would not be
 * caught on elsewhere:
 *
 *  - **Authorization** is the caller's assignment (`resolvePlanAccess`), not
 *    `Client.userId`; an assigned Editor passes, a Viewer does not.
 *  - **Path resolution**: an id or a slug both work, but every subsequent write
 *    uses the resolved `Client.id`.
 *  - **Optional fields stay untouched when omitted.** This is what makes Step
 *    5's two disclaimer saves safe: they never send `keyContacts`, so the
 *    contact array must not be rewritten or mirrored.
 *  - **Normalization** happens server-side: visibility is written as the four
 *    canonical keys, the portal URL goes through the slug registry (so the old
 *    URL survives as an alias), and disclaimer precedence is
 *    `disclaimersData` → parsed string → object → keep stored.
 *  - **Transient Prisma failures are replayed** (P2028 etc.); a real error is
 *    not.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    client: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
  },
  resolvePlanAccess: vi.fn(),
  permissionAllows: vi.fn(),
  isSlugTaken: vi.fn(),
  renameClientSlug: vi.fn(),
  normalizeContactImagesToR2: vi.fn(),
  mirrorPlanContacts: vi.fn(),
  getOrCreateOrganizationForUser: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

// Imported by the module; irrelevant to the contract under test.
vi.mock("@/lib/plan-lookup", () => ({ planIdOrSlug: vi.fn() }));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
}));
vi.mock("@/lib/teammates/access.server", () => ({
  NO_ACCESS_MESSAGE: "You do not have access to this plan",
  permissionAllows: mocks.permissionAllows,
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/slug-registry", () => ({
  renameClientSlug: mocks.renameClientSlug,
  isSlugTaken: mocks.isSlugTaken,
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
  getOrCreateOrganizationForUser: mocks.getOrCreateOrganizationForUser,
}));
vi.mock("@/lib/teammates/hub-contacts.server", () => ({
  buildPortalKeyContacts: vi.fn(),
}));
vi.mock("@/lib/teammates/contact-mirror.server", () => ({
  mirrorPlanContacts: mocks.mirrorPlanContacts,
}));

const OWNER_ID = "user-1";

function ownedPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    slug: "acme",
    companyName: "Acme",
    companyWebsite: "https://acme.test",
    userId: OWNER_ID,
    status: "Active",
    disclaimers: "stored disclaimer",
    organizationId: "org-1",
    keyContacts: [{ name: "Stored" }],
    ...overrides,
  };
}

function putRequest(body: Record<string, unknown>, id = "plan-1") {
  return new NextRequest(new URL(`/api/clients/${id}`, "http://localhost"), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPut(body: Record<string, unknown>, id = "plan-1") {
  return PUT(putRequest(body, id), { params: { id } });
}

function updateData() {
  return mocks.prisma.client.update.mock.calls[0]?.[0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  mocks.getSession.mockResolvedValue({ user: { id: OWNER_ID } });
  mocks.prisma.client.findFirst.mockResolvedValue(ownedPlan());
  mocks.prisma.client.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...ownedPlan(),
      ...data,
    }),
  );
  mocks.prisma.document.findMany.mockResolvedValue([]);
  mocks.resolvePlanAccess.mockResolvedValue({ allowed: true, kind: "owner" });
  mocks.permissionAllows.mockReturnValue(true);
  mocks.isSlugTaken.mockResolvedValue(false);
  mocks.renameClientSlug.mockResolvedValue(undefined);
  mocks.normalizeContactImagesToR2.mockImplementation(
    async (contacts: unknown) => contacts,
  );
  mocks.mirrorPlanContacts.mockResolvedValue(undefined);
  mocks.getOrCreateOrganizationForUser.mockResolvedValue("org-1");
});

describe("PUT /api/clients/[id] authorization", () => {
  it("returns 401 without a session and writes nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await callPut({ companyName: "Acme" });

    expect(response.status).toBe(401);
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });

  it("returns 404 when neither the id nor the slug resolves", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await callPut({ companyName: "Acme" });

    expect(response.status).toBe(404);
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });

  it("resolves a slug and writes against the resolved plan id", async () => {
    mocks.prisma.client.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ownedPlan());

    const response = await callPut({ companyName: "Acme" }, "acme");

    expect(response.status).toBe(200);
    expect(mocks.prisma.client.findFirst).toHaveBeenLastCalledWith({
      where: { slug: "acme", userId: OWNER_ID },
    });
    expect(mocks.prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } }),
    );
  });

  it("refuses a caller the access layer rejects", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "no_assignment",
      message: "You do not have access to this plan",
    });

    const response = await callPut({ companyName: "Acme" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You do not have access to this plan",
      code: "no_assignment",
    });
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });

  it("reports a missing plan from the access layer as 404", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "plan_not_found",
      message: "Plan not found",
    });

    const response = await callPut({ companyName: "Acme" });

    expect(response.status).toBe(404);
  });

  it("refuses a teammate without either edit permission", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: true,
      kind: "teammate",
      permissionSet: { plan_details_branding: "view" },
    });
    mocks.permissionAllows.mockReturnValue(false);

    const response = await callPut({ companyName: "Acme" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You do not have access to this plan",
      code: "permission_denied",
    });
  });

  it("accepts a teammate holding plan-details edit rights", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: true,
      kind: "teammate",
      permissionSet: { plan_details_branding: "edit" },
    });
    mocks.permissionAllows.mockImplementation(
      (_set: unknown, permission: string) =>
        permission === "plan_details_branding",
    );

    const response = await callPut({ companyName: "Acme" });

    expect(response.status).toBe(200);
    expect(mocks.prisma.client.update).toHaveBeenCalled();
  });

  it("checks the plan's own assignment, not its owner id", async () => {
    await callPut({ companyName: "Acme" });

    expect(mocks.resolvePlanAccess).toHaveBeenCalledWith({
      userId: OWNER_ID,
      clientIdOrSlug: "plan-1",
    });
  });
});

describe("PUT /api/clients/[id] payload", () => {
  it("leaves contacts alone when the request does not send them", async () => {
    await callPut({ disclaimers: "step 5 save" });

    const data = updateData();
    expect(data).not.toHaveProperty("keyContacts");
    expect(mocks.normalizeContactImagesToR2).not.toHaveBeenCalled();
    expect(mocks.mirrorPlanContacts).not.toHaveBeenCalled();
  });

  it("normalizes and mirrors contacts when they are sent", async () => {
    mocks.prisma.client.update.mockResolvedValue({
      ...ownedPlan(),
      organizationId: "org-1",
      keyContacts: [{ name: "Ada" }],
    });

    await callPut({ keyContacts: { contacts: [{ name: "Ada" }] } });

    expect(mocks.normalizeContactImagesToR2).toHaveBeenCalledWith(
      { contacts: [{ name: "Ada" }] },
      "plan-1",
    );
    expect(updateData().keyContacts).toEqual({ contacts: [{ name: "Ada" }] });
    expect(mocks.mirrorPlanContacts).toHaveBeenCalledWith({
      organizationId: "org-1",
      actorUserId: OWNER_ID,
      clientId: "plan-1",
      keyContacts: [{ name: "Ada" }],
    });
  });

  it("still returns 200 when the contact mirror fails", async () => {
    mocks.mirrorPlanContacts.mockRejectedValue(new Error("mirror down"));

    const response = await callPut({ keyContacts: [] });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
  });

  it("writes visibility as the four canonical keys", async () => {
    await callPut({
      categoryPortalVisibility: { "group health": false, Other: "false" },
    });

    expect(updateData().categoryPortalVisibility).toEqual({
      Retirement: true,
      "Group Health": false,
      "Group Life": true,
      Other: false,
    });
  });

  it("keeps the stored visibility when the request omits it", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(
      ownedPlan({ categoryPortalVisibility: { Other: false } }),
    );

    await callPut({ companyName: "Acme" });

    expect(updateData().categoryPortalVisibility).toEqual({ Other: false });
  });

  it("prefers disclaimersData over the string disclaimer", async () => {
    const disclaimersData = {
      disclaimers: "new text",
      disclosuresText: "disclosure",
      useDefaultDisclosures: false,
    };

    await callPut({ disclaimers: "old text", disclaimersData });

    expect(updateData().disclaimers).toEqual(disclaimersData);
  });

  it("parses a JSON-string disclaimer", async () => {
    await callPut({
      disclaimers: JSON.stringify({ disclaimers: "json text" }),
    });

    expect(updateData().disclaimers).toEqual({ disclaimers: "json text" });
  });

  it("keeps a plain-text disclaimer as text", async () => {
    await callPut({ disclaimers: "plain footer text" });

    expect(updateData().disclaimers).toBe("plain footer text");
  });

  it("keeps the stored disclaimer when the request omits it", async () => {
    await callPut({ companyName: "Acme" });

    expect(updateData().disclaimers).toBe("stored disclaimer");
  });

  it("falls back to the stored status when an empty one is sent", async () => {
    await callPut({ status: "" });

    expect(updateData().status).toBe("Active");
  });

  it("writes the new status when one is sent", async () => {
    await callPut({ status: "Archived" });

    expect(updateData().status).toBe("Archived");
  });

  it("records previousName only for a real rename", async () => {
    await callPut({ companyName: "Acme Holdings" });

    expect(updateData()).toMatchObject({
      companyName: "Acme Holdings",
      previousName: "Acme",
    });
    expect(updateData().nameUpdatedAt).toBeInstanceOf(Date);
  });

  it("does not record a rename when the name is unchanged", async () => {
    await callPut({ companyName: "Acme" });

    expect(updateData()).not.toHaveProperty("previousName");
    expect(updateData()).not.toHaveProperty("nameUpdatedAt");
  });
});

describe("PUT /api/clients/[id] portal URL", () => {
  it("renames through the registry so the old URL stays as an alias", async () => {
    await callPut({ portalUrl: "Acme-Holdings" });

    expect(mocks.renameClientSlug).toHaveBeenCalledWith(
      "plan-1",
      "acme-holdings",
    );
    expect(updateData().slug).toBe("acme-holdings");
  });

  it("suffixes the slug until it is free", async () => {
    mocks.isSlugTaken
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await callPut({ portalUrl: "new-portal" });

    expect(mocks.isSlugTaken).toHaveBeenNthCalledWith(
      1,
      "new-portal",
      "plan-1",
    );
    expect(mocks.isSlugTaken).toHaveBeenNthCalledWith(
      2,
      "new-portal-2",
      "plan-1",
    );
    expect(mocks.isSlugTaken).toHaveBeenNthCalledWith(
      3,
      "new-portal-3",
      "plan-1",
    );
    expect(updateData().slug).toBe("new-portal-3");
  });

  it("does not rename when the submitted URL is unchanged", async () => {
    await callPut({ portalUrl: "acme" });

    expect(mocks.renameClientSlug).not.toHaveBeenCalled();
    expect(updateData()).not.toHaveProperty("slug");
  });

  it("leaves the slug untouched when the registry rename fails", async () => {
    mocks.renameClientSlug.mockRejectedValue(new Error("registry down"));

    const response = await callPut({ portalUrl: "acme-new" });

    expect(response.status).toBe(200);
    expect(updateData()).not.toHaveProperty("slug");
  });
});

describe("PUT /api/clients/[id] write resilience", () => {
  it("replays a transient Prisma failure and returns the saved plan", async () => {
    vi.useFakeTimers();
    try {
      mocks.prisma.client.update
        .mockRejectedValueOnce({ code: "P2028" })
        .mockResolvedValue({ ...ownedPlan(), companyName: "Acme" });

      const pending = callPut({ companyName: "Acme" });
      await vi.advanceTimersByTimeAsync(300);
      const response = await pending;

      expect(response.status).toBe(200);
      expect(mocks.prisma.client.update).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 500 for an error that is not transient", async () => {
    mocks.prisma.client.update.mockRejectedValue(
      Object.assign(new Error("validation failed"), { code: "P2002" }),
    );

    const response = await callPut({ companyName: "Acme" });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to update client");
    expect(body.code).toBe("P2002");
    expect(mocks.prisma.client.update).toHaveBeenCalledTimes(1);
  });

  it("returns the saved plan with a message", async () => {
    const response = await callPut({ companyName: "Acme Holdings" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: "Client updated successfully",
    });
    expect(body.data.companyName).toBe("Acme Holdings");
  });
});
