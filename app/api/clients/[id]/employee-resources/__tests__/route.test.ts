import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "../route";

/**
 * TF-6 · the Employee Resources hub read and its per-plan toggle.
 *
 * Two behaviours matter and both are asserted here:
 *
 *  1. A plan that has NOT opted in answers `enabled: false` without reading a single
 *     placement, so the flag genuinely costs nothing until it is turned on.
 *  2. The toggle is a WRITE, so it must never travel the anonymous portal path — it
 *     goes through the dashboard-only builder access, scoped to "Employee Resources".
 */

const mocks = vi.hoisted(() => ({
  resolveBuilderClient: vi.fn(),
  loadLocationTopics: vi.fn(),
  seedLocationTopics: vi.fn(),
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
  prisma: {
    client: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/plan-lookup", () => ({
  planIdOrSlug: (id: string) => ({ slug: id }),
}));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: mocks.resolvePortalAdvisorId,
  isLocalDevLoopback: mocks.isLocalDevLoopback,
}));
vi.mock("@/lib/topics/builder-access.server", () => ({
  resolveBuilderClient: mocks.resolveBuilderClient,
}));
vi.mock("@/lib/topics/resolve-location", () => ({
  loadLocationTopics: mocks.loadLocationTopics,
}));
vi.mock("@/lib/topics/seed-plan-topics", () => ({
  seedLocationTopics: mocks.seedLocationTopics,
}));

function portalGet(slug = "acme") {
  return new NextRequest(
    new URL(`/api/clients/${slug}/employee-resources?forPortal=1`, "http://localhost"),
    { method: "GET" },
  );
}

function callGet(slug = "acme") {
  return GET(portalGet(slug), { params: { id: slug } });
}

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/clients/acme/employee-resources", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.resolvePortalAdvisorId.mockResolvedValue("advisor-1");
  mocks.isLocalDevLoopback.mockReturnValue(false);
  mocks.prisma.client.findFirst.mockResolvedValue({
    id: "plan-1",
    userId: "advisor-1",
    slug: "acme",
    employeeResourcesEnabled: false,
  });
  mocks.prisma.client.findUnique.mockResolvedValue({
    id: "plan-1",
    slug: "acme",
    employeeResourcesEnabled: false,
  });
  mocks.prisma.client.update.mockResolvedValue({ id: "plan-1" });
  mocks.seedLocationTopics.mockResolvedValue({ seeded: true });
  mocks.loadLocationTopics.mockResolvedValue({
    location: "employee_resources",
    featured: [],
    groups: [],
    hiddenCount: 0,
  });
});

describe("GET /api/clients/[id]/employee-resources", () => {
  it("answers enabled:false without reading a single placement", async () => {
    const body = await (await callGet()).json();

    expect(body).toEqual({
      success: true,
      enabled: false,
      slug: "acme",
      topics: null,
    });
    expect(mocks.loadLocationTopics).not.toHaveBeenCalled();
  });

  it("returns the plan's SLUG, so the admin card links to the portal URL", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "advisor-1",
      slug: "acme",
      employeeResourcesEnabled: true,
    });

    const body = await (await callGet()).json();

    // Not the id: `/…/<slug>/employee-resources` is what the portal is addressed by.
    expect(body.slug).toBe("acme");
  });

  it("returns the hub's placements once the plan has enabled it", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "advisor-1",
      employeeResourcesEnabled: true,
    });

    const body = await (await callGet()).json();

    expect(body.enabled).toBe(true);
    expect(body.topics).toEqual(
      expect.objectContaining({ location: "employee_resources" }),
    );
    expect(mocks.loadLocationTopics).toHaveBeenCalledWith(
      "plan-1",
      "employee_resources",
    );
  });

  it("scopes the portal read to the advisor its slug resolves to", async () => {
    await callGet();

    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ userId: "advisor-1" }]),
        }),
      }),
    );
  });

  it("refuses a plan owned by another advisor", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "someone-else",
      employeeResourcesEnabled: true,
    });

    const response = await callGet();

    expect(response.status).toBe(403);
    expect(mocks.loadLocationTopics).not.toHaveBeenCalled();
  });
});

describe("PUT /api/clients/[id]/employee-resources", () => {
  it("requires edit rights and passes them the hub's own scope", async () => {
    mocks.resolveBuilderClient.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 403 }) as never,
    });

    await PUT(putRequest({ enabled: true }), { params: { id: "acme" } });

    expect(mocks.resolveBuilderClient).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "edit",
        category: "Employee Resources",
      }),
    );
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
    expect(mocks.seedLocationTopics).not.toHaveBeenCalled();
  });

  it("saves the flag and seeds the location when switching it on", async () => {
    mocks.resolveBuilderClient.mockResolvedValue({ ok: true, clientId: "plan-1" });

    const body = await (
      await PUT(putRequest({ enabled: true }), { params: { id: "acme" } })
    ).json();

    expect(body).toEqual({ success: true, enabled: true });
    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { employeeResourcesEnabled: true },
    });
    expect(mocks.seedLocationTopics).toHaveBeenCalledWith({
      clientId: "plan-1",
      location: "employee_resources",
    });
  });

  it("does not seed when switching it off, and deletes nothing", async () => {
    mocks.resolveBuilderClient.mockResolvedValue({ ok: true, clientId: "plan-1" });

    await PUT(putRequest({ enabled: false }), { params: { id: "acme" } });

    expect(mocks.prisma.client.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { employeeResourcesEnabled: false },
    });
    expect(mocks.seedLocationTopics).not.toHaveBeenCalled();
  });

  it("rejects a body it cannot read", async () => {
    mocks.resolveBuilderClient.mockResolvedValue({ ok: true, clientId: "plan-1" });

    const response = await PUT(
      new NextRequest("http://localhost/api/clients/acme/employee-resources", {
        method: "PUT",
        body: "not json",
      }),
      { params: { id: "acme" } },
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.client.update).not.toHaveBeenCalled();
  });
});
