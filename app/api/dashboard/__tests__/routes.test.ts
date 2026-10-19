import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getActivePlans } from "../active-plans/route";
import { GET as getMeetingsThisWeek } from "../meetings-this-week/route";
import { GET as getNeedsAttention } from "../needs-attention/route";
import { GET as getRecentActivity } from "../recent-activity/route";
import { GET as getStats } from "../stats/route";
import { GET as getTasks, POST as postTask } from "../tasks/route";
import {
  DELETE as deleteTask,
  PATCH as patchTask,
} from "../tasks/[id]/route";
import { GET as getUpcomingMeetings } from "../upcoming-meetings/route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  accessiblePlanIds: vi.fn(),
  activeStatus: { in: ["active"] },
  meetingsWhere: vi.fn((args: unknown) => ({ where: args })),
  countAttention: vi.fn(),
  listAttention: vi.fn(),
  suppressedDerivedRows: vi.fn(),
  listSystemTasks: vi.fn(),
  listManualTasks: vi.fn(),
  upcomingWhere: vi.fn((args: unknown) => ({ upcoming: args })),
  startOfDay: vi.fn(() => new Date("2026-01-01T00:00:00Z")),
  resolveMeetingStartMs: vi.fn(),
  prisma: {
    client: { count: vi.fn(), findMany: vi.fn() },
    meeting: { count: vi.fn(), findMany: vi.fn() },
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("@/lib/teammates/access.server", () => ({
  listAccessiblePlanIds: mocks.accessiblePlanIds,
}));
vi.mock("@/lib/active-client-status", () => ({
  ACTIVE_CLIENT_STATUS_FILTER: mocks.activeStatus,
}));
vi.mock("@/lib/meetings-this-week", () => ({
  meetingsThisWeekWhere: mocks.meetingsWhere,
}));
vi.mock("@/lib/plan-needs-attention.server", () => ({
  countPlansNeedingAttention: mocks.countAttention,
  listPlansNeedingAttention: mocks.listAttention,
}));
vi.mock("@/lib/dashboard-tasks.server", () => ({
  suppressedDerivedRows: mocks.suppressedDerivedRows,
  listSystemTasks: mocks.listSystemTasks,
  listManualTasks: mocks.listManualTasks,
}));
vi.mock("@/lib/upcoming-meetings", () => ({
  startOfSchedulingDayUtc: mocks.startOfDay,
  upcomingMeetingsWhere: mocks.upcomingWhere,
}));
vi.mock("@/lib/meeting-start-at", () => ({
  resolveMeetingStartMs: mocks.resolveMeetingStartMs,
}));

function request(path: string, init?: any) {
  return new NextRequest(new URL(path, "http://localhost"), init);
}

function post(body: unknown) {
  return request("/api/dashboard/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(body: unknown) {
  return request("/api/dashboard/tasks/t1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id = "t1") {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  mocks.accessiblePlanIds.mockResolvedValue(["plan-1", "plan-2"]);
  mocks.suppressedDerivedRows.mockResolvedValue(new Set<string>());
  mocks.listSystemTasks.mockResolvedValue([]);
  mocks.listManualTasks.mockResolvedValue([]);
  mocks.countAttention.mockResolvedValue(0);
  mocks.listAttention.mockResolvedValue([]);
  mocks.prisma.client.count.mockResolvedValue(0);
  mocks.prisma.client.findMany.mockResolvedValue([]);
  mocks.prisma.meeting.count.mockResolvedValue(0);
  mocks.prisma.meeting.findMany.mockResolvedValue([]);
  mocks.resolveMeetingStartMs.mockReturnValue(null);
});

describe("GET /api/dashboard/stats", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await getStats(request("/api/dashboard/stats"));

    expect(response.status).toBe(401);
  });

  it("counts accessible plans, this week's meetings, and needs-attention plans", async () => {
    mocks.prisma.client.count.mockResolvedValue(4);
    mocks.prisma.meeting.count.mockResolvedValue(2);
    mocks.countAttention.mockResolvedValue(3);

    const response = await getStats(request("/api/dashboard/stats"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      activePlans: 4,
      meetingsThisWeek: 2,
      needsAttention: 3,
    });
    expect(mocks.accessiblePlanIds).toHaveBeenCalledWith("user-1");
    expect(mocks.prisma.client.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["plan-1", "plan-2"] },
          status: mocks.activeStatus,
        }),
      }),
    );
    expect(mocks.meetingsWhere).toHaveBeenCalledWith({
      userId: "user-1",
      accessiblePlanIds: ["plan-1", "plan-2"],
    });
  });

  it("returns 500 when the aggregate query fails", async () => {
    mocks.prisma.client.count.mockRejectedValue(new Error("db down"));

    const response = await getStats(request("/api/dashboard/stats"));

    expect(response.status).toBe(500);
  });
});

describe("GET /api/dashboard/active-plans", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await getActivePlans(request("/api/dashboard/active-plans"))).status).toBe(
      401,
    );
  });

  it("returns the minified active plans", async () => {
    mocks.prisma.client.findMany.mockResolvedValue([
      { id: "plan-1", companyName: "Acme", companyLogo: "logo" },
    ]);

    const response = await getActivePlans(
      request("/api/dashboard/active-plans"),
    );
    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(mocks.prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["plan-1", "plan-2"] } }),
        take: 25,
      }),
    );
  });
});

describe("GET /api/dashboard/meetings-this-week", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await getMeetingsThisWeek(request("/api/dashboard/meetings-this-week")))
        .status,
    ).toBe(401);
  });

  it("returns the week's meetings", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue([
      { id: "m1", meeting: "Review" },
    ]);

    const response = await getMeetingsThisWeek(
      request("/api/dashboard/meetings-this-week"),
    );
    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(mocks.meetingsWhere).toHaveBeenCalledWith({
      userId: "user-1",
      accessiblePlanIds: ["plan-1", "plan-2"],
    });
  });
});

describe("GET /api/dashboard/needs-attention", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await getNeedsAttention(request("/api/dashboard/needs-attention"))).status,
    ).toBe(401);
  });

  it("maps flagged plans to the panel shape", async () => {
    mocks.listAttention.mockResolvedValue([
      {
        id: "plan-1",
        companyName: "Acme",
        companyLogo: null,
        details: { issues: [{ kind: "incomplete-benefit", label: "Missing" }] },
      },
    ]);

    const response = await getNeedsAttention(
      request("/api/dashboard/needs-attention"),
    );
    const body = await response.json();

    expect(body.data.total).toBe(1);
    expect(body.data.plans[0]).toEqual({
      id: "plan-1",
      companyName: "Acme",
      companyLogo: null,
      issues: [{ kind: "incomplete-benefit", label: "Missing" }],
    });
  });
});

describe("GET /api/dashboard/tasks", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await getTasks(request("/api/dashboard/tasks"))).status).toBe(401);
  });

  it("returns derived and manual tasks", async () => {
    const suppressed = new Set(["plan-1|incomplete-benefit|"]);
    mocks.suppressedDerivedRows.mockResolvedValue(suppressed);
    mocks.listSystemTasks.mockResolvedValue([{ id: "s1" }]);
    mocks.listManualTasks.mockResolvedValue([{ id: "t1" }]);

    const response = await getTasks(request("/api/dashboard/tasks"));
    const body = await response.json();

    expect(body.data).toEqual({
      system: [{ id: "s1" }],
      manual: [{ id: "t1" }],
    });
    expect(mocks.listSystemTasks).toHaveBeenCalledWith(
      ["plan-1", "plan-2"],
      suppressed,
    );
    expect(mocks.listManualTasks).toHaveBeenCalledWith("user-1", [
      "plan-1",
      "plan-2",
    ]);
  });
});

describe("POST /api/dashboard/tasks", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await postTask(post({ title: "Call" }))).status).toBe(401);
  });

  it("requires a title", async () => {
    const response = await postTask(post({ title: "   " }));

    expect(response.status).toBe(400);
  });

  it("caps the title length", async () => {
    const response = await postTask(post({ title: "a".repeat(201) }));

    expect(response.status).toBe(400);
  });

  it("rejects a plan the reader cannot reach", async () => {
    const response = await postTask(
      post({ title: "Call", clientId: "someone-elses-plan" }),
    );

    expect(response.status).toBe(400);
  });

  it("creates the task with a reachable plan", async () => {
    mocks.prisma.task.create.mockResolvedValue({
      id: "t1",
      title: "Call",
      done: false,
    });

    const response = await postTask(
      post({ title: "  Call  ", clientId: "plan-1" }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mocks.prisma.task.create).toHaveBeenCalledWith({
      data: { userId: "user-1", title: "Call", clientId: "plan-1" },
      select: expect.any(Object),
    });
  });

  it("creates a task with no plan link", async () => {
    mocks.prisma.task.create.mockResolvedValue({ id: "t1" });

    const response = await postTask(post({ title: "Call" }));

    expect(response.status).toBe(201);
    expect(mocks.prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "user-1", title: "Call", clientId: null },
      }),
    );
  });
});

describe("PATCH /api/dashboard/tasks/[id]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await patchTask(patch({ done: true }), ctx())).status).toBe(401);
  });

  it("returns 404 when the task is not the reader's", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    expect((await patchTask(patch({ done: true }), ctx())).status).toBe(404);
  });

  it("rejects an empty update", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: "t1" });

    expect((await patchTask(patch({}), ctx())).status).toBe(400);
  });

  it("caps a renamed title", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: "t1" });

    expect(
      (await patchTask(patch({ title: "a".repeat(201) }), ctx())).status,
    ).toBe(400);
  });

  it("ticks a task off and stamps doneAt", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: "t1" });
    mocks.prisma.task.update.mockResolvedValue({ id: "t1", done: true });

    const response = await patchTask(patch({ done: true }), ctx());

    expect(response.status).toBe(200);
    expect(mocks.prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: { done: true, doneAt: expect.any(Date) },
      }),
    );
  });

  it("renames a task", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: "t1" });
    mocks.prisma.task.update.mockResolvedValue({ id: "t1" });

    await patchTask(patch({ title: "  New title  " }), ctx());

    expect(mocks.prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: "New title" },
      }),
    );
  });
});

describe("DELETE /api/dashboard/tasks/[id]", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await deleteTask(patch({}), ctx())).status).toBe(401);
  });

  it("returns 404 when the task is not the reader's", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);

    expect((await deleteTask(patch({}), ctx())).status).toBe(404);
  });

  it("deletes the task", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue({ id: "t1" });

    const response = await deleteTask(patch({}), ctx());

    expect(response.status).toBe(200);
    expect(mocks.prisma.task.delete).toHaveBeenCalledWith({
      where: { id: "t1" },
    });
  });
});

describe("GET /api/dashboard/upcoming-meetings", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await getUpcomingMeetings(request("/api/dashboard/upcoming-meetings")))
        .status,
    ).toBe(401);
  });

  it("filters past meetings and keeps at most four", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `m${index}`,
      meeting: `Meeting ${index}`,
      status: "Scheduled",
    }));
    mocks.prisma.meeting.findMany.mockResolvedValue(rows);
    mocks.resolveMeetingStartMs.mockImplementation((row: any) => {
      if (row.id === "m0") return Date.now() - 60_000;
      return Date.now() + 60_000;
    });

    const response = await getUpcomingMeetings(
      request("/api/dashboard/upcoming-meetings"),
    );
    const body = await response.json();

    expect(body.data).toHaveLength(4);
    expect(body.data.map((row: any) => row.id)).toEqual([
      "m1",
      "m2",
      "m3",
      "m4",
    ]);
  });

  it("keeps an in-progress meeting and an underivable row", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue([
      { id: "m1", meeting: "In progress", status: "In Progress" },
      { id: "m2", meeting: "Underivable", status: "Scheduled" },
    ]);
    mocks.resolveMeetingStartMs.mockReturnValue(null);

    const response = await getUpcomingMeetings(
      request("/api/dashboard/upcoming-meetings"),
    );
    const body = await response.json();

    expect(body.data.map((row: any) => row.id)).toEqual(["m1", "m2"]);
  });

  it("returns the debug summary with ?debug=1", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue([
      {
        status: "Scheduled",
        archived: false,
        date: new Date("2026-01-02T00:00:00Z"),
        startAtUtc: new Date("2026-01-02T09:00:00Z"),
      },
    ]);

    const response = await getUpcomingMeetings(
      request("/api/dashboard/upcoming-meetings?debug=1"),
    );
    const body = await response.json();

    expect(body.data).toEqual([]);
    expect(body.debug.totalForUser).toBe(1);
    expect(body.debug.withStartAtUtc).toBe(1);
    expect(body.debug.earliestDate).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("GET /api/dashboard/recent-activity", () => {
  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(
      (await getRecentActivity(request("/api/dashboard/recent-activity"))).status,
    ).toBe(401);
  });

  it("returns 500 when the source query fails", async () => {
    mocks.prisma.client.findMany.mockRejectedValue(new Error("db down"));

    const response = await getRecentActivity(
      request("/api/dashboard/recent-activity"),
    );

    expect(response.status).toBe(500);
  });
});
