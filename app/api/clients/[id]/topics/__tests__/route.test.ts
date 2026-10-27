import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST, PUT } from "../route";

/**
 * `/api/clients/[id]/topics` — the Quick Answers builder's read and write (TF-3).
 *
 * Authorization and reconciliation have their own unit tests; this suite pins the
 * ROUTE contract: the location is validated before anything else, the access helper's
 * refusal is passed through untouched, and a board the reconciler rejects is never
 * reported as success.
 */

const mocks = vi.hoisted(() => ({
  resolveBuilderClient: vi.fn(),
  loadTopicBoard: vi.fn(),
  applyTopicBoard: vi.fn(),
  ensureLocationSeeded: vi.fn(),
}));

vi.mock("@/lib/topics/builder-access.server", () => ({
  resolveBuilderClient: mocks.resolveBuilderClient,
}));

vi.mock("@/lib/topics/board.server", () => ({
  loadTopicBoard: mocks.loadTopicBoard,
  applyTopicBoard: mocks.applyTopicBoard,
}));

vi.mock("@/lib/topics/seed-plan-topics", () => ({
  ensureLocationSeeded: mocks.ensureLocationSeeded,
}));

const ALLOWED = { ok: true as const, clientId: "plan-1", organizationId: "org-1" };

function board(overrides: Record<string, unknown> = {}) {
  return {
    location: "retirement",
    featured: [],
    groups: [],
    hidden: [],
    featuredCap: 12,
    ...overrides,
  };
}

function getRequest(query = "?location=retirement") {
  return new NextRequest(
    new URL(`/api/clients/plan-1/topics${query}`, "http://localhost"),
  );
}

function writeRequest(method: "PUT" | "POST", body: unknown) {
  return new NextRequest(new URL("/api/clients/plan-1/topics", "http://localhost"), {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const params = { params: { id: "plan-1" } };

function callGet(query?: string) {
  return GET(getRequest(query), params);
}

function callPut(body: unknown) {
  return PUT(writeRequest("PUT", body), params);
}

function callPost(body: unknown) {
  return POST(writeRequest("POST", body), params);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.resolveBuilderClient.mockResolvedValue(ALLOWED);
  mocks.loadTopicBoard.mockResolvedValue(board());
  mocks.applyTopicBoard.mockResolvedValue({ ok: true, applied: true, plan: {} });
  mocks.ensureLocationSeeded.mockResolvedValue({ seeded: true, createdPlacements: 12 });
});

describe("GET /api/clients/[id]/topics", () => {
  it("requires a valid location before it checks access", async () => {
    const response = await callGet("");

    expect(response.status).toBe(400);
    expect(mocks.resolveBuilderClient).not.toHaveBeenCalled();
  });

  it("serves the Employee Resources location under its own permission scope (TF-6)", async () => {
    const response = await callGet("?location=employee_resources");

    // The fifth hub uses the SAME builder, so its board is addressable here — and the
    // category it checks is the hub's own label, which is what lets an HR collaborator
    // be granted this location and nothing else.
    expect(response.status).toBe(200);
    expect(mocks.resolveBuilderClient).toHaveBeenCalledWith(
      expect.objectContaining({ category: "Employee Resources" }),
    );
  });

  it("returns the access helper's response verbatim", async () => {
    mocks.resolveBuilderClient.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await callGet();

    expect(response.status).toBe(403);
    expect(mocks.loadTopicBoard).not.toHaveBeenCalled();
  });

  it("checks the category that owns the location", async () => {
    await callGet("?location=group_life");

    expect(mocks.resolveBuilderClient).toHaveBeenCalledWith({
      id: "plan-1",
      level: "view",
      category: "Group Life",
    });
  });

  it("offers only library topics not already on the board", async () => {
    mocks.loadTopicBoard.mockResolvedValue(
      board({
        featured: [{ slug: "sys.rollovers-distributions", title: "Rollovers" }],
        groups: [
          {
            id: "g1",
            name: "Planning Ahead",
            sortOrder: 0,
            topics: [{ slug: "sys.social-security", title: "Social Security" }],
          },
        ],
      }),
    );

    const body = await (await callGet()).json();
    const slugs = body.library.map((topic: any) => topic.slug);

    expect(slugs).not.toContain("rollovers-distributions");
    expect(slugs).not.toContain("social-security");
    expect(slugs).toContain("financial-planning");
  });

  it("returns 500 when the board cannot be read", async () => {
    mocks.loadTopicBoard.mockRejectedValue(new Error("db down"));

    expect((await callGet()).status).toBe(500);
  });
});

describe("PUT /api/clients/[id]/topics", () => {
  it("rejects an unreadable body", async () => {
    const response = await callPut("{not json");

    expect(response.status).toBe(400);
    expect(mocks.applyTopicBoard).not.toHaveBeenCalled();
  });

  it("requires edit rights", async () => {
    await callPut({ location: "retirement", groups: [], placements: [] });

    expect(mocks.resolveBuilderClient).toHaveBeenCalledWith({
      id: "plan-1",
      level: "edit",
      category: "Retirement",
    });
  });

  it("reports a rejected board with the reconciler's message", async () => {
    mocks.applyTopicBoard.mockResolvedValue({
      ok: false,
      applied: false,
      error: "Featured holds 12 cards (3 rows of 4). Move one down to Quick Answers first.",
    });

    const response = await callPut({
      location: "retirement",
      groups: [],
      placements: [],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Featured holds");
  });

  it("returns the reconciled board, after the write", async () => {
    mocks.loadTopicBoard.mockResolvedValue(
      board({ featured: [{ slug: "sys.financial-planning" }] }),
    );

    const body = await (
      await callPut({
        location: "retirement",
        groups: [{ name: "Investing" }],
        placements: [{ topicId: "topic-1", displayMode: "quick_answers" }],
      })
    ).json();

    expect(body.applied).toBe(true);
    expect(body.board.featured[0].slug).toBe("sys.financial-planning");
    expect(mocks.applyTopicBoard.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadTopicBoard.mock.invocationCallOrder[0],
    );
  });

  it("passes the location through to the reconciler", async () => {
    await callPut({ location: "group_health", groups: [], placements: [] });

    expect(mocks.applyTopicBoard).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "plan-1", location: "group_health" }),
    );
  });

  it("returns 500 when the write throws", async () => {
    mocks.applyTopicBoard.mockRejectedValue(new Error("boom"));

    expect(
      (await callPut({ location: "retirement", groups: [], placements: [] })).status,
    ).toBe(500);
  });
});

describe("POST /api/clients/[id]/topics", () => {
  it("seeds the location and answers with the new board", async () => {
    const body = await (await callPost({ location: "retirement" })).json();

    expect(mocks.ensureLocationSeeded).toHaveBeenCalledWith({
      clientId: "plan-1",
      category: "Retirement",
    });
    expect(body.success).toBe(true);
    expect(body.board.location).toBe("retirement");
  });

  it("requires edit rights, because seeding writes placements", async () => {
    await callPost({ location: "retirement" });

    expect(mocks.resolveBuilderClient).toHaveBeenCalledWith(
      expect.objectContaining({ level: "edit" }),
    );
  });

  it("rejects a missing location", async () => {
    expect((await callPost({})).status).toBe(400);
  });
});
