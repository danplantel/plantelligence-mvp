import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/teammates/plan-assignments/route";

/**
 * `GET /api/teammates/plan-assignments?planId=…`
 *
 * Browse Benefits reads this once per selected plan to render the "Assigned to …"
 * line on each category card. It must be scoped to the real plan id even when the
 * caller entered by slug, or a slug query would report an empty roster.
 */

const mocks = vi.hoisted(() => ({
  getOrgSession: vi.fn(),
  listPlanAssignments: vi.fn(),
  resolvePlanAccess: vi.fn(),
  organizationOwnerEmails: vi.fn(),
}));

vi.mock("@/lib/organization-session", () => ({
  getOrgSession: mocks.getOrgSession,
}));
vi.mock("@/lib/teammates/invites.server", () => ({
  listPlanAssignments: mocks.listPlanAssignments,
}));
vi.mock("@/lib/teammates/access.server", () => ({
  resolvePlanAccess: mocks.resolvePlanAccess,
}));
vi.mock("@/lib/teammates/contact-mirror.server", () => ({
  organizationOwnerEmails: mocks.organizationOwnerEmails,
}));

function request(path = "/api/teammates/plan-assignments?planId=plan-1") {
  return new NextRequest(new URL(path, "http://localhost"));
}

async function payload(response: Response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrgSession.mockResolvedValue({
    userId: "user-1",
    organizationId: "org-1",
  });
  mocks.resolvePlanAccess.mockResolvedValue({
    allowed: true,
    clientId: "plan-1",
  });
  mocks.listPlanAssignments.mockResolvedValue([]);
  mocks.organizationOwnerEmails.mockResolvedValue(new Set(["owner@acme.test"]));
});

describe("GET /api/teammates/plan-assignments", () => {
  it("returns 401 without an organization session", async () => {
    mocks.getOrgSession.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.resolvePlanAccess).not.toHaveBeenCalled();
  });

  it("requires a planId", async () => {
    const response = await GET(request("/api/teammates/plan-assignments"));

    expect(response.status).toBe(400);
    expect(await payload(response)).toEqual({ error: "planId is required" });
  });

  it("treats a whitespace-only planId as missing", async () => {
    const response = await GET(
      request("/api/teammates/plan-assignments?planId=%20%20"),
    );

    expect(response.status).toBe(400);
  });

  it("refuses a plan the caller cannot view", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "not_assigned",
      message: "No access to this plan",
    });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.listPlanAssignments).not.toHaveBeenCalled();
  });

  it("returns 404 when the plan does not exist", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: false,
      reason: "plan_not_found",
      message: "Plan not found",
    });

    const response = await GET(request());

    expect(response.status).toBe(404);
  });

  it("uses the resolved plan id even when the request came in by slug", async () => {
    mocks.resolvePlanAccess.mockResolvedValue({
      allowed: true,
      clientId: "plan-real-id",
    });
    mocks.listPlanAssignments.mockResolvedValue([
      {
        assignmentId: "a1",
        profileId: "p1",
        name: "Ada Lovelace",
        email: "ada@acme.test",
        headshot: null,
        role: "editor",
        categoryScope: "all",
        categories: [],
        state: "active",
      },
    ]);

    const response = await GET(
      request("/api/teammates/plan-assignments?planId=acme-slug"),
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(mocks.listPlanAssignments).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "plan-real-id",
    });
    expect(body.assignments).toHaveLength(1);
    expect(body.assignments[0].name).toBe("Ada Lovelace");
  });

  it("returns the owner email set alongside the assignments", async () => {
    const response = await GET(request());
    const body = await payload(response);

    expect(body).toEqual({
      assignments: [],
      ownerEmails: ["owner@acme.test"],
    });
  });
});
