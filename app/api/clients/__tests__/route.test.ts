import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../route";

/**
 * `GET /api/clients` contract.
 *
 * This one route feeds every plan picker in the app, and the All Plans table
 * depends on the `view=table` projection specifically: no contact JSON, no
 * `employeePortalPreview`, and a pre-computed contact count.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccessiblePlanIds: vi.fn(),
  getOrCreateOrganizationForUser: vi.fn(),
  mirrorPlanContactsSafely: vi.fn(),
  prisma: {
    client: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
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
}));
vi.mock("@/lib/organization", () => ({
  getOrCreateOrganizationForUser: mocks.getOrCreateOrganizationForUser,
}));
vi.mock("@/lib/teammates/contact-mirror.server", () => ({
  mirrorPlanContactsSafely: mocks.mirrorPlanContactsSafely,
}));

function request(path = "/api/clients") {
  return new NextRequest(new URL(path, "http://localhost"));
}

async function payload(response: Response) {
  return response.json();
}

function lastQuery() {
  return mocks.prisma.client.findMany.mock.calls[0]?.[0];
}

function lastCountQuery() {
  return mocks.prisma.client.count.mock.calls[0]?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.listAccessiblePlanIds.mockResolvedValue(["plan-1", "plan-2"]);
  mocks.prisma.client.findMany.mockResolvedValue([]);
  mocks.prisma.client.count.mockResolvedValue(0);
});

describe("GET /api/clients", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: "Unauthorized" });
    expect(mocks.prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("scopes both the page and the total to the caller's accessible plans", async () => {
    mocks.prisma.client.findMany.mockResolvedValue([{ id: "plan-1" }]);
    mocks.prisma.client.count.mockResolvedValue(1);

    await GET(request("/api/clients?page=1&limit=10"));

    expect(mocks.listAccessiblePlanIds).toHaveBeenCalledWith("user-1");
    expect(lastQuery()).toMatchObject({
      where: { id: { in: ["plan-1", "plan-2"] } },
      skip: 0,
      take: 10,
    });
    expect(lastCountQuery()).toEqual({
      where: { id: { in: ["plan-1", "plan-2"] } },
    });
  });

  it("returns no rows when the caller has no accessible plans", async () => {
    mocks.listAccessiblePlanIds.mockResolvedValue([]);

    const response = await GET(request());
    const body = await payload(response);

    expect(lastQuery().where.id.in).toEqual([]);
    expect(body.data).toEqual([]);
  });

  describe("view=table", () => {
    it("strips keyContacts and adds a count for each stored shape", async () => {
      mocks.prisma.client.findMany.mockResolvedValue([
        {
          id: "plan-array",
          companyName: "Array Co",
          keyContacts: [{ id: "c1" }, { id: "c2" }],
        },
        {
          id: "plan-object",
          companyName: "Object Co",
          keyContacts: { contacts: [{ id: "c1" }] },
        },
        { id: "plan-null", companyName: "Null Co", keyContacts: null },
      ]);
      mocks.prisma.client.count.mockResolvedValue(3);

      const response = await GET(request("/api/clients?view=table"));
      const body = await payload(response);

      expect(body.data).toEqual([
        { id: "plan-array", companyName: "Array Co", keyContactsCount: 2 },
        { id: "plan-object", companyName: "Object Co", keyContactsCount: 1 },
        { id: "plan-null", companyName: "Null Co", keyContactsCount: 0 },
      ]);
      for (const row of body.data) {
        expect(row).not.toHaveProperty("keyContacts");
      }
    });

    it("selects the slim projection and never the heavy JSON columns", async () => {
      await GET(request("/api/clients?view=table"));

      const select = lastQuery().select;
      expect(select).toMatchObject({
        id: true,
        slug: true,
        companyName: true,
        companyLogo: true,
        brandColor: true,
        status: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        currentStep: true,
        keyContacts: true,
      });
      expect(select.employeePortalPreview).toBeUndefined();
      expect(select.documents).toBeUndefined();
      expect(select.backgroundImg).toBeUndefined();
    });
  });

  describe("summary=1", () => {
    it("returns the picker contract without the table transform", async () => {
      mocks.prisma.client.findMany.mockResolvedValue([
        {
          id: "plan-1",
          slug: "acme",
          companyName: "Acme",
          status: "Active",
          type: "client",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        },
      ]);
      mocks.prisma.client.count.mockResolvedValue(1);

      const response = await GET(request("/api/clients?summary=1"));
      const body = await payload(response);

      expect(lastQuery().select).toEqual({
        id: true,
        slug: true,
        companyName: true,
        status: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      });
      expect(body.data[0]).not.toHaveProperty("keyContactsCount");
    });
  });

  describe("filters", () => {
    it("passes status, type and a case-insensitive name search to Prisma", async () => {
      await GET(request("/api/clients?status=draft&type=prospect&search=acme"));

      expect(lastQuery().where).toEqual({
        id: { in: ["plan-1", "plan-2"] },
        status: "draft",
        type: "prospect",
        companyName: { contains: "acme", mode: "insensitive" },
      });
      expect(lastCountQuery().where).toEqual(lastQuery().where);
    });

    it("omits status and type when the caller asks for all", async () => {
      await GET(request("/api/clients?status=all&type=all"));

      expect(lastQuery().where).toEqual({ id: { in: ["plan-1", "plan-2"] } });
    });
  });

  describe("pagination", () => {
    it("computes skip/take and reports the page metadata", async () => {
      mocks.prisma.client.count.mockResolvedValue(120);

      const response = await GET(request("/api/clients?page=3&limit=50"));
      const body = await payload(response);

      expect(lastQuery()).toMatchObject({ skip: 100, take: 50 });
      expect(body.pagination).toEqual({
        page: 3,
        limit: 50,
        total: 120,
        pages: 3,
      });
    });

    it("defaults to page 1 and a 25-row page", async () => {
      await GET(request());

      expect(lastQuery()).toMatchObject({ skip: 0, take: 25 });
    });
  });

  describe("sorting", () => {
    it.each([
      ["companyName", "asc"],
      ["createdAt", "asc"],
      ["updatedAt", "desc"],
      ["status", "asc"],
      ["type", "desc"],
    ])("orders by %s %s", async (column, direction) => {
      await GET(
        request(`/api/clients?sortColumn=${column}&sortDirection=${direction}`),
      );

      expect(lastQuery().orderBy).toEqual({ [column]: direction });
    });

    it("falls back to createdAt desc for an unknown column", async () => {
      await GET(
        request("/api/clients?sortColumn=companyLogo&sortDirection=asc"),
      );

      expect(lastQuery().orderBy).toEqual({ createdAt: "desc" });
    });
  });

  describe("full projection", () => {
    it("normalizes brand images and reports the document count", async () => {
      mocks.prisma.client.findMany.mockResolvedValue([
        {
          id: "plan-1",
          backgroundImg: "legacy-header",
          backgroundImgName: "header.png",
          brandImages: { header: { url: "json-header", fileName: "h.png" } },
          documents: [{ id: "doc-1" }, { id: "doc-2" }],
        },
      ]);
      mocks.prisma.client.count.mockResolvedValue(1);

      const response = await GET(request());
      const body = await payload(response);

      expect(body.data[0].documentCount).toBe(2);
      expect(body.data[0].brandImages.header).toEqual({
        url: "json-header",
        fileName: "h.png",
      });
      expect(body.data[0].brandImages.thumbnail).toBeNull();
    });
  });

  it("returns 500 when the query fails", async () => {
    mocks.prisma.client.findMany.mockRejectedValue(new Error("db down"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: "Internal server error" });
  });
});
