import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-1" } } as any,
  portalAdvisorId: null as string | null,
  accessiblePlans: ["plan-1"] as string[],
  planAccess: { allowed: true, clientId: "plan-1" } as any,
  prisma: {
    webinar: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: { findFirst: vi.fn() },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => mocks.session),
}));

vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));

vi.mock("@/lib/prisma", () => ({
  default: mocks.prisma,
  prisma: mocks.prisma,
}));

vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: vi.fn(async () => mocks.portalAdvisorId),
}));

vi.mock("@/lib/teammates/access.server", () => ({
  listAccessiblePlanIds: vi.fn(async () => mocks.accessiblePlans),
  resolvePlanAccess: vi.fn(async () => mocks.planAccess),
}));

import { DELETE as deleteWebinar, GET as getWebinar, PUT as putWebinar } from "../[id]/route";
import { POST as bulkDelete } from "../bulk-delete/route";
import { GET as getWebinars, POST as postWebinar } from "../route";

const WEBINAR_ID = "66f000000000000000000001";
const OTHER_ID = "66f000000000000000000002";

function request(url: string, init: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? "GET",
    ...(init.body !== undefined
      ? {
          body: JSON.stringify(init.body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

function params(id: string) {
  return { params: { id } };
}

function webinarRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WEBINAR_ID,
    userId: "user-1",
    clientId: "plan-1",
    clientName: "Acme Corp",
    webinarTitle: "Retirement Replay",
    description: "Desc",
    thumbnail: "data:image/png;base64,t",
    benefitsCategory: "Retirement",
    placements: ["news-events"],
    eventDate: new Date("2027-05-10T12:00:00Z"),
    sourceType: { upload: true, url: false },
    videoFileUrl: "BASE64",
    videoSize: 6,
    duration: null,
    videoUrl: null,
    createdAt: new Date("2027-05-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { user: { id: "user-1" } };
  mocks.portalAdvisorId = null;
  mocks.accessiblePlans = ["plan-1"];
  mocks.planAccess = { allowed: true, clientId: "plan-1" };
  mocks.prisma.webinar.findMany.mockResolvedValue([]);
  mocks.prisma.webinar.findFirst.mockResolvedValue(null);
  mocks.prisma.webinar.create.mockResolvedValue(webinarRow());
  mocks.prisma.webinar.update.mockResolvedValue(webinarRow());
  mocks.prisma.webinar.delete.mockResolvedValue({});
  mocks.prisma.webinar.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.client.findFirst.mockResolvedValue({
    id: "plan-1",
    companyName: "Acme Corp",
  });
});

describe("GET /api/webinars", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await getWebinars(request("/api/webinars"));

    expect(res.status).toBe(401);
  });

  it("allows the public portal to resolve an advisor", async () => {
    mocks.session = null;
    mocks.portalAdvisorId = "user-9";

    const res = await getWebinars(
      request("/api/webinars?clientId=acme&includeVideoFiles=0"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.webinar.findMany).toHaveBeenCalled();
  });

  it("returns nothing when the caller cannot access the named plan", async () => {
    mocks.planAccess = { allowed: false };

    const res = await getWebinars(request("/api/webinars?clientId=other"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, data: [] });
    expect(mocks.prisma.webinar.findMany).not.toHaveBeenCalled();
  });

  it("scopes the query to every accessible plan", async () => {
    mocks.accessiblePlans = ["plan-1", "plan-2"];

    await getWebinars(request("/api/webinars"));

    expect(mocks.prisma.webinar.findMany).toHaveBeenCalledWith({
      where: { clientId: { in: ["plan-1", "plan-2"] } },
    });
  });

  it("narrows to the resolved plan", async () => {
    await getWebinars(request("/api/webinars?clientId=acme"));

    expect(mocks.prisma.webinar.findMany).toHaveBeenCalledWith({
      where: { clientId: "plan-1" },
    });
  });

  it("omits the base64 payload when includeVideoFiles=0", async () => {
    mocks.prisma.webinar.findMany.mockResolvedValue([
      webinarRow({ videoFileUrl: undefined, videoSize: 6 }),
    ]);

    const res = await getWebinars(
      request("/api/webinars?includeVideoFiles=0"),
    );
    const json = await res.json();

    const query = mocks.prisma.webinar.findMany.mock.calls[0][0];
    expect(query.select).toMatchObject({
      id: true,
      webinarTitle: true,
      videoSize: true,
    });
    expect(query.select).not.toHaveProperty("videoFileUrl");
    expect(json.data[0]).toMatchObject({
      videoFileUrl: null,
      hasVideoFile: true,
      videoSize: 6,
      placements: ["news-events"],
    });
  });

  it("reports the stored runtime without the payload", async () => {
    // This is the number the portal's poster card prints bottom-right. It has to
    // arrive with the list read: the list omits the multi-MB video on purpose, so
    // a card that waited to measure the file itself would never show anything.
    mocks.prisma.webinar.findMany.mockResolvedValue([
      webinarRow({ videoFileUrl: undefined, videoSize: 6, duration: "1:01" }),
    ]);

    const res = await getWebinars(
      request("/api/webinars?includeVideoFiles=0"),
    );
    const json = await res.json();

    expect(mocks.prisma.webinar.findMany.mock.calls[0][0].select).toMatchObject({
      duration: true,
    });
    expect(json.data[0]).toMatchObject({
      duration: "1:01",
      videoFileUrl: null,
    });
  });

  it("includes the payload and falls back to its length for the size", async () => {
    mocks.prisma.webinar.findMany.mockResolvedValue([
      webinarRow({ videoSize: null }),
    ]);

    const res = await getWebinars(request("/api/webinars"));
    const json = await res.json();

    expect(mocks.prisma.webinar.findMany.mock.calls[0][0]).toEqual({
      where: { clientId: { in: ["plan-1"] } },
    });
    expect(json.data[0].videoFileUrl).toBe("BASE64");
    expect(json.data[0].videoSize).toBe(6);
  });

  it("filters by a valid placement and ignores an invalid one", async () => {
    mocks.prisma.webinar.findMany.mockResolvedValue([
      webinarRow({ id: WEBINAR_ID, placements: ["retirement"] }),
      webinarRow({ id: OTHER_ID, placements: ["news-events"] }),
    ]);

    const filtered = await getWebinars(
      request("/api/webinars?placement=retirement"),
    );
    expect((await filtered.json()).data.map((w: any) => w.id)).toEqual([
      WEBINAR_ID,
    ]);

    const invalid = await getWebinars(
      request("/api/webinars?placement=unknown"),
    );
    expect((await invalid.json()).data).toHaveLength(2);
  });

  it("sorts newest event first", async () => {
    mocks.prisma.webinar.findMany.mockResolvedValue([
      webinarRow({ id: WEBINAR_ID, eventDate: new Date("2027-05-10") }),
      webinarRow({ id: OTHER_ID, eventDate: new Date("2027-06-10") }),
    ]);

    const res = await getWebinars(request("/api/webinars"));
    const json = await res.json();

    expect(json.data.map((w: any) => w.id)).toEqual([OTHER_ID, WEBINAR_ID]);
  });

  it("returns 500 when the query throws", async () => {
    mocks.prisma.webinar.findMany.mockRejectedValue(new Error("db"));

    const res = await getWebinars(request("/api/webinars"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/webinars", () => {
  const base = {
    client: "Acme Corp",
    sourceType: { upload: false, url: true },
    webinarTitle: "New Webinar",
    eventDate: "2027-05-10T12:00:00Z",
    videoUrl: "https://youtu.be/abcdefghijk",
    thumbnail: "data:image/png;base64,t",
    placements: ["news-events"],
  };

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await postWebinar(request("/api/webinars", { method: "POST", body: base }));

    expect(res.status).toBe(401);
  });

  it("requires the core fields", async () => {
    const res = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: { client: "Acme Corp" },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Missing required fields",
    });
  });

  it("returns 500 when sourceType is omitted (current behavior)", async () => {
    const res = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: {
          client: "Acme Corp",
          webinarTitle: "T",
          eventDate: base.eventDate,
        },
      }),
    );

    // The handler dereferences `sourceType.upload` before validating it.
    expect(res.status).toBe(500);
  });

  it("validates the source type combination", async () => {
    const none = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: { ...base, sourceType: { upload: false, url: false } },
      }),
    );
    expect(none.status).toBe(400);
    await expect(none.json()).resolves.toMatchObject({
      error: "Please select a source type",
    });

    const both = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: { ...base, sourceType: { upload: true, url: true } },
      }),
    );
    expect(both.status).toBe(400);
    await expect(both.json()).resolves.toMatchObject({
      error: "Please select only one source type",
    });

    const noFile = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: { ...base, sourceType: { upload: true, url: false } },
      }),
    );
    expect(noFile.status).toBe(400);
    await expect(noFile.json()).resolves.toMatchObject({
      error: "Please upload a video file",
    });

    const noUrl = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: { ...base, sourceType: { upload: false, url: true }, videoUrl: "" },
      }),
    );
    expect(noUrl.status).toBe(400);
    await expect(noUrl.json()).resolves.toMatchObject({
      error: "Please enter a video URL",
    });
  });

  it("returns 404 when the client is not accessible", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const res = await postWebinar(
      request("/api/webinars", { method: "POST", body: base }),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      error: "Client not found",
    });
  });

  it("enforces marketing edit access", async () => {
    mocks.planAccess = { allowed: false, message: "No edit permission" };

    const res = await postWebinar(
      request("/api/webinars", { method: "POST", body: base }),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: "No edit permission",
    });
  });

  it("rejects a base64 video above the 13MB cap", async () => {
    const res = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: {
          ...base,
          sourceType: { upload: true, url: false },
          videoFile: "a".repeat(13 * 1024 * 1024 + 1),
        },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("Maximum size is 10MB"),
    });
  });

  it("creates a URL webinar with normalized fields", async () => {
    const res = await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: {
          ...base,
          description: "  Trim me  ",
          benefitsCategory: "",
          placements: ["retirement", "bogus"],
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.webinar.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        clientId: "plan-1",
        clientName: "Acme Corp",
        webinarTitle: "New Webinar",
        description: "Trim me",
        thumbnail: "data:image/png;base64,t",
        benefitsCategory: null,
        placements: ["retirement"],
        sourceType: { upload: false, url: true },
        videoFileUrl: null,
        videoSize: 0,
        videoUrl: "https://youtu.be/abcdefghijk",
      }),
    });
  });

  it("creates an uploaded webinar and records the payload size", async () => {
    await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: {
          ...base,
          sourceType: { upload: true, url: false },
          videoFile: "BASE64",
          videoUrl: "",
          placements: undefined,
        },
      }),
    );

    const data = mocks.prisma.webinar.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      videoFileUrl: "BASE64",
      videoSize: 6,
      videoUrl: null,
      placements: ["news-events"],
    });
  });

  it("stores the runtime the upload form measured", async () => {
    await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: {
          ...base,
          sourceType: { upload: true, url: false },
          videoFile: "BASE64",
          duration: "3:42",
        },
      }),
    );

    expect(mocks.prisma.webinar.create.mock.calls[0][0].data).toMatchObject({
      duration: "3:42",
    });
  });

  it("stores a null runtime when the form could not measure one", async () => {
    await postWebinar(
      request("/api/webinars", {
        method: "POST",
        body: {
          ...base,
          sourceType: { upload: true, url: false },
          videoFile: "BASE64",
          duration: "   ",
        },
      }),
    );

    expect(mocks.prisma.webinar.create.mock.calls[0][0].data).toMatchObject({
      duration: null,
    });
  });

  it("returns 500 when the create throws", async () => {
    mocks.prisma.webinar.create.mockRejectedValue(new Error("db"));

    const res = await postWebinar(
      request("/api/webinars", { method: "POST", body: base }),
    );

    expect(res.status).toBe(500);
  });
});

describe("GET /api/webinars/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await getWebinar(
      request(`/api/webinars/${WEBINAR_ID}`),
      params(WEBINAR_ID),
    );

    expect(res.status).toBe(401);
  });

  it("404s an unknown id by looking it up, not by rejecting its shape", async () => {
    // Ids are cuids, so there is no valid "shape" to test — the old
    // `ObjectId.isValid` guard 404'd every real row. An id that matches nothing
    // is a plain not-found, and the lookup is what decides it.
    const res = await getWebinar(
      request("/api/webinars/not-an-id"),
      params("not-an-id"),
    );

    expect(res.status).toBe(404);
    expect(mocks.prisma.webinar.findFirst).toHaveBeenCalled();
  });

  it("returns 404 when the named plan is unknown", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const res = await getWebinar(
      request(`/api/webinars/${WEBINAR_ID}?clientId=acme`),
      params(WEBINAR_ID),
    );

    expect(res.status).toBe(404);
    expect(mocks.prisma.webinar.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the row is not owned by the plan", async () => {
    const res = await getWebinar(
      request(`/api/webinars/${WEBINAR_ID}`),
      params(WEBINAR_ID),
    );

    expect(res.status).toBe(404);
  });

  it("serializes a default placement when the stored value is missing", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(
      webinarRow({ placements: undefined }),
    );

    const res = await getWebinar(
      request(`/api/webinars/${WEBINAR_ID}`),
      params(WEBINAR_ID),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({
      id: WEBINAR_ID,
      placements: ["news-events"],
      videoFileUrl: "BASE64",
    });
  });

  it("returns the stored runtime with the row", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(
      webinarRow({ duration: "1:01" }),
    );

    const res = await getWebinar(
      request(`/api/webinars/${WEBINAR_ID}`),
      params(WEBINAR_ID),
    );

    expect((await res.json()).data.duration).toBe("1:01");
  });

  it("returns 500 when the query throws", async () => {
    mocks.prisma.webinar.findFirst.mockRejectedValue(new Error("db"));

    const res = await getWebinar(
      request(`/api/webinars/${WEBINAR_ID}`),
      params(WEBINAR_ID),
    );

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/webinars/[id]", () => {
  const existing = webinarRow();

  function put(body: unknown) {
    return putWebinar(
      request(`/api/webinars/${WEBINAR_ID}`, { method: "PUT", body }),
      params(WEBINAR_ID),
    );
  }

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    expect((await put({})).status).toBe(401);
  });

  it("returns 404 for an invalid id", async () => {
    const res = await putWebinar(
      request("/api/webinars/not-an-id", { method: "PUT", body: {} }),
      params("not-an-id"),
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when the row is not owned", async () => {
    expect((await put({})).status).toBe(404);
  });

  it("keeps the stored upload when no replacement is sent", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);

    const res = await put({ sourceType: { upload: true, url: false } });

    expect(res.status).toBe(200);
    expect(mocks.prisma.webinar.update.mock.calls[0][0].data).toMatchObject({
      videoFileUrl: "BASE64",
      videoSize: 6,
      videoUrl: null,
    });
  });

  it("stores a new runtime and keeps the stored one when the key is omitted", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(
      webinarRow({ duration: "1:01" }),
    );

    await put({ sourceType: { upload: true, url: false }, duration: "2:30" });
    expect(mocks.prisma.webinar.update.mock.calls[0][0].data).toMatchObject({
      duration: "2:30",
    });

    // Re-saving without touching the video must not erase the badge.
    mocks.prisma.webinar.update.mockClear();
    await put({ sourceType: { upload: true, url: false } });
    expect(mocks.prisma.webinar.update.mock.calls[0][0].data).toMatchObject({
      duration: "1:01",
    });
  });

  it("clears the upload and stores the URL for a URL source", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);

    await put({
      sourceType: { upload: false, url: true },
      videoUrl: "https://youtu.be/abcdefghijk",
    });

    expect(mocks.prisma.webinar.update.mock.calls[0][0].data).toMatchObject({
      videoFileUrl: null,
      videoSize: 0,
      videoUrl: "https://youtu.be/abcdefghijk",
    });
  });

  it("wipes the stored video when sourceType is omitted (current behavior)", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);

    await put({ webinarTitle: "Renamed" });

    expect(mocks.prisma.webinar.update.mock.calls[0][0].data).toMatchObject({
      webinarTitle: "Renamed",
      videoFileUrl: null,
      videoSize: 0,
      videoUrl: null,
    });
  });

  it("applies partial field semantics", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);

    await put({
      description: "",
      thumbnail: "",
      benefitsCategory: "",
      placements: [],
      sourceType: { upload: true, url: false },
    });

    expect(mocks.prisma.webinar.update.mock.calls[0][0].data).toMatchObject({
      description: null,
      thumbnail: null,
      benefitsCategory: null,
      placements: ["news-events"],
    });
  });

  it("keeps omitted fields and the existing date", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);

    await put({ sourceType: { upload: true, url: false } });

    const data = mocks.prisma.webinar.update.mock.calls[0][0].data;
    expect(data.description).toBe("Desc");
    expect(data.thumbnail).toBe("data:image/png;base64,t");
    expect(data.benefitsCategory).toBe("Retirement");
    expect(data.eventDate).toBe(existing.eventDate);
  });

  it("returns 404 when changing to an unknown client", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const res = await put({ client: "Other Co" });

    expect(res.status).toBe(404);
  });

  it("returns 500 when the update throws", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(existing);
    mocks.prisma.webinar.update.mockRejectedValue(new Error("db"));

    expect((await put({})).status).toBe(500);
  });
});

describe("DELETE /api/webinars/[id]", () => {
  function del(id = WEBINAR_ID) {
    return deleteWebinar(
      request(`/api/webinars/${id}`, { method: "DELETE" }),
      params(id),
    );
  }

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    expect((await del()).status).toBe(401);
  });

  it("returns 404 for an invalid id", async () => {
    expect((await del("not-an-id")).status).toBe(404);
  });

  it("returns 404 when the row is not owned", async () => {
    expect((await del()).status).toBe(404);
  });

  it("deletes the webinar", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(webinarRow());

    const res = await del();

    expect(res.status).toBe(200);
    expect(mocks.prisma.webinar.delete).toHaveBeenCalledWith({
      where: { id: WEBINAR_ID },
    });
  });

  it("returns 500 when the delete throws", async () => {
    mocks.prisma.webinar.findFirst.mockResolvedValue(webinarRow());
    mocks.prisma.webinar.delete.mockRejectedValue(new Error("db"));

    expect((await del()).status).toBe(500);
  });
});

describe("POST /api/webinars/bulk-delete", () => {
  function bulk(body: unknown) {
    return bulkDelete(
      request("/api/webinars/bulk-delete", { method: "POST", body }),
    );
  }

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    expect((await bulk({ ids: [WEBINAR_ID] })).status).toBe(401);
  });

  it("requires a non-empty id array", async () => {
    const missing = await bulk({});
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({
      error: "No webinars selected",
    });

    const empty = await bulk({ ids: [] });
    expect(empty.status).toBe(400);
  });

  it("requires at least one valid ObjectId", async () => {
    const res = await bulk({ ids: ["bad", 42] });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "No valid webinars selected",
    });
    expect(mocks.prisma.webinar.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes only valid ids scoped to the session user", async () => {
    mocks.prisma.webinar.deleteMany.mockResolvedValue({ count: 2 });

    const res = await bulk({ ids: [WEBINAR_ID, "bad", OTHER_ID] });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.prisma.webinar.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: [WEBINAR_ID, OTHER_ID] },
        userId: "user-1",
      },
    });
    expect(json).toEqual({ success: true, deleted: 2 });
  });

  it("returns 500 when the delete throws", async () => {
    mocks.prisma.webinar.deleteMany.mockRejectedValue(new Error("db"));

    expect((await bulk({ ids: [WEBINAR_ID] })).status).toBe(500);
  });
});
