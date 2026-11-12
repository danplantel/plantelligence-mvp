import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../route";

/**
 * The portal assistant's index endpoint.
 *
 * The route owns exactly three things — the portal-only gate, the plan lookup scoped
 * to the requesting advisor, and handing the plan's hub rows to the reader. The
 * reader itself is tested separately (`assistant-server.test.ts`), so it is mocked
 * here and the assertions stay about auth and wiring.
 */

const mocks = vi.hoisted(() => ({
  resolvePortalAdvisorId: vi.fn(),
  isLocalDevLoopback: vi.fn(() => false),
  loadPlanAssistantTopics: vi.fn(),
  prisma: {
    client: { findFirst: vi.fn() },
    benefit: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mocks.prisma,
  prisma: mocks.prisma,
}));
vi.mock("@/lib/plan-lookup", () => ({
  planIdOrSlug: (id: string) => ({ slug: id }),
}));
vi.mock("@/lib/portal-access", () => ({
  resolvePortalAdvisorId: mocks.resolvePortalAdvisorId,
  isLocalDevLoopback: mocks.isLocalDevLoopback,
}));
vi.mock("@/lib/topics/assistant.server", () => ({
  loadPlanAssistantTopics: mocks.loadPlanAssistantTopics,
}));

function callGet(path = "/api/clients/acme/portal/assistant?forPortal=1") {
  const request = new NextRequest(new URL(path, "http://localhost"), {
    method: "GET",
  });
  return GET(request, { params: { id: "acme" } });
}

const INDEX = {
  topics: [
    {
      slug: "sys.401k-loans",
      location: "retirement",
      title: "Can I take a loan?",
      displayMode: "quick_answers",
    },
  ],
  hiddenSlugs: ["sys.employer-match-vesting"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.resolvePortalAdvisorId.mockResolvedValue("advisor-1");
  mocks.isLocalDevLoopback.mockReturnValue(false);
  mocks.prisma.client.findFirst.mockResolvedValue({
    id: "plan-1",
    userId: "advisor-1",
    categoryPortalVisibility: {
      Retirement: true,
      "Group Health": false,
      "Group Life": true,
      Other: true,
    },
    employeeResourcesEnabled: true,
  });
  mocks.prisma.benefit.findMany.mockResolvedValue([
    { category: "Retirement", isEnabled: true },
    { category: "Group Life", isEnabled: true },
  ]);
  mocks.loadPlanAssistantTopics.mockResolvedValue(INDEX);
});

describe("GET /api/clients/[id]/portal/assistant", () => {
  it("returns the plan index and hands the reader the plan's hub rows", async () => {
    const response = await callGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, ...INDEX });
    expect(mocks.loadPlanAssistantTopics).toHaveBeenCalledWith({
      clientId: "plan-1",
      categoryPortalVisibility: expect.objectContaining({ Retirement: true }),
      employeeResourcesEnabled: true,
      benefitHubs: [
        { category: "Retirement", isEnabled: true },
        { category: "Group Life", isEnabled: true },
      ],
    });
  });

  it("scopes the plan lookup to the advisor the slug resolves to", async () => {
    await callGet();

    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ userId: "advisor-1" }]),
        }),
      }),
    );
  });

  it("refuses a caller that is not a portal request", async () => {
    const response = await callGet("/api/clients/acme/portal/assistant");

    expect(response.status).toBe(400);
    expect(mocks.prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller outside the dev loopback", async () => {
    mocks.resolvePortalAdvisorId.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(401);
    expect(mocks.prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a plan owned by another advisor", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "someone-else",
      employeeResourcesEnabled: true,
    });

    const response = await callGet();

    expect(response.status).toBe(403);
    expect(mocks.loadPlanAssistantTopics).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown plan", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(404);
    expect(mocks.prisma.benefit.findMany).not.toHaveBeenCalled();
  });

  it("answers 500, not a half-built index, when the read fails", async () => {
    mocks.loadPlanAssistantTopics.mockRejectedValue(new Error("db down"));

    const response = await callGet();

    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalled();
  });
});
