import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET } from "../slugs/route";

/**
 * `GET|DELETE /api/clients/[id]/slugs` contract — the "Previous URLs" list in
 * Edit Plan's Branding tab.
 *
 * Two things matter here beyond the usual auth matrix:
 *
 *  - The route accepts either an ObjectId or a portal slug in the URL, but the
 *    registry is keyed by the resolved `Client.id`. Every assertion therefore
 *    checks the *resolved* id reaches `listClientSlugs` / `releaseClientSlug`,
 *    never the raw URL segment.
 *  - Releasing is a destructive-ish operation on a reserved alias, so a slug
 *    that is not an alias of this plan must be a 400 — not a silent success.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  listClientSlugs: vi.fn(),
  releaseClientSlug: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/slug-registry", () => ({
  listClientSlugs: mocks.listClientSlugs,
  releaseClientSlug: mocks.releaseClientSlug,
}));

const OWNER_ID = "user-1";
const PLAN_ID = new ObjectId().toHexString();

function ownedPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    slug: "acme",
    userId: OWNER_ID,
    ...overrides,
  };
}

function getRequest(id = PLAN_ID) {
  return new NextRequest(
    new URL(`/api/clients/${id}/slugs`, "http://localhost"),
    { method: "GET" },
  );
}

function deleteRequest(id = PLAN_ID, slug: string | null = "old-portal") {
  const query = slug === null ? "" : `?slug=${encodeURIComponent(slug)}`;
  return new NextRequest(
    new URL(`/api/clients/${id}/slugs${query}`, "http://localhost"),
    { method: "DELETE" },
  );
}

function callGet(id = PLAN_ID) {
  return GET(getRequest(id), { params: { id } });
}

function callDelete(id = PLAN_ID, slug: string | null = "old-portal") {
  return DELETE(deleteRequest(id, slug), { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: OWNER_ID } });
  mocks.prisma.client.findUnique.mockResolvedValue(ownedPlan());
  mocks.prisma.client.findFirst.mockResolvedValue(ownedPlan());
  mocks.listClientSlugs.mockResolvedValue([
    { slug: "acme", isCurrent: true },
    { slug: "old-portal", isCurrent: false },
  ]);
  mocks.releaseClientSlug.mockResolvedValue(true);
});

describe("GET /api/clients/[id]/slugs", () => {
  it("returns 401 without a session and reads no registry rows", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(401);
    expect(mocks.listClientSlugs).not.toHaveBeenCalled();
  });

  it("returns 404 when neither the id nor the slug resolves", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue(null);
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(404);
    expect(mocks.listClientSlugs).not.toHaveBeenCalled();
  });

  it("lists slugs for the resolved plan id", async () => {
    const response = await callGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      slugs: [
        { slug: "acme", isCurrent: true },
        { slug: "old-portal", isCurrent: false },
      ],
    });
    expect(mocks.prisma.client.findUnique).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
    });
    expect(mocks.listClientSlugs).toHaveBeenCalledWith(PLAN_ID);
  });

  it("resolves a portal slug to the plan and still lists by id", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue(null);

    const response = await callGet("acme");

    expect(response.status).toBe(200);
    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith({
      where: { slug: "acme", userId: OWNER_ID },
    });
    expect(mocks.listClientSlugs).toHaveBeenCalledWith(PLAN_ID);
  });

  it("refuses a plan that belongs to another advisor", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue(
      ownedPlan({ userId: "someone-else" }),
    );

    const response = await callGet();

    expect(response.status).toBe(404);
    expect(mocks.listClientSlugs).not.toHaveBeenCalled();
  });

  it("returns 500 when the registry read fails", async () => {
    mocks.listClientSlugs.mockRejectedValue(new Error("db down"));

    const response = await callGet();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to list portal slugs",
    });
  });
});

describe("DELETE /api/clients/[id]/slugs", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await callDelete();

    expect(response.status).toBe(401);
    expect(mocks.releaseClientSlug).not.toHaveBeenCalled();
  });

  it("requires the slug query parameter", async () => {
    const missing = await callDelete(PLAN_ID, null);
    const blank = await callDelete(PLAN_ID, "   ");

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({
      error: "Missing query parameter: slug",
    });
    expect(blank.status).toBe(400);
    expect(mocks.releaseClientSlug).not.toHaveBeenCalled();
  });

  it("returns 404 for a plan the caller does not own", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue(
      ownedPlan({ userId: "someone-else" }),
    );

    const response = await callDelete();

    expect(response.status).toBe(404);
    expect(mocks.releaseClientSlug).not.toHaveBeenCalled();
  });

  it("rejects a slug that is not a releasable alias of this plan", async () => {
    mocks.releaseClientSlug.mockResolvedValue(false);

    const response = await callDelete(PLAN_ID, "someone-elses-url");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Slug is not a releasable alias of this plan",
    });
  });

  it("releases the trimmed alias for the resolved plan id", async () => {
    const response = await callDelete(PLAN_ID, "  old-portal  ");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      released: "old-portal",
    });
    expect(mocks.releaseClientSlug).toHaveBeenCalledWith(PLAN_ID, "old-portal");
  });

  it("releases through a portal slug by resolving it first", async () => {
    mocks.prisma.client.findUnique.mockResolvedValue(null);

    const response = await callDelete("acme", "old-portal");

    expect(response.status).toBe(200);
    expect(mocks.releaseClientSlug).toHaveBeenCalledWith(PLAN_ID, "old-portal");
  });

  it("returns 500 when the registry release fails", async () => {
    mocks.releaseClientSlug.mockRejectedValue(new Error("db down"));

    const response = await callDelete();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to release portal slug",
    });
  });
});
