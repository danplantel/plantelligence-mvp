import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-1" } } as any,
  startAt: new Date("2027-05-10T13:30:00.000Z"),
  computeStartAtUtc: vi.fn(),
  prisma: {
    client: { findFirst: vi.fn() },
    meeting: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    meetingCustomType: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => mocks.session),
}));

vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
  default: mocks.prisma,
}));

vi.mock("@/lib/meeting-start-at", () => ({
  computeStartAtUtc: mocks.computeStartAtUtc,
}));

import { DELETE as deleteMeeting, PATCH as patchMeeting, PUT as putMeeting } from "../[id]/route";
import { GET as getReminders } from "../reminders/route";
import { GET as getMeetings, POST as postMeeting } from "../route";
import {
  DELETE as deleteCustomMeeting,
  GET as getCustomMeetings,
  PUT as putCustomMeetings,
} from "../../user/[id]/custom-meetings/route";

function request(
  url: string,
  init: { method?: string; body?: unknown } = {},
) {
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { user: { id: "user-1" } };
  mocks.computeStartAtUtc.mockReturnValue(mocks.startAt);
  mocks.prisma.client.findFirst.mockResolvedValue(null);
  mocks.prisma.meeting.create.mockResolvedValue({ id: "m-new" });
  mocks.prisma.meeting.findMany.mockResolvedValue([]);
  mocks.prisma.meeting.findFirst.mockResolvedValue(null);
  mocks.prisma.meeting.update.mockResolvedValue({ id: "m-1" });
  mocks.prisma.meeting.delete.mockResolvedValue({ id: "m-1" });
  mocks.prisma.meetingCustomType.findMany.mockResolvedValue([]);
  mocks.prisma.meetingCustomType.create.mockImplementation(
    async ({ data }: any) => ({ id: `ct-${data.value}`, ...data }),
  );
  mocks.prisma.meetingCustomType.delete.mockResolvedValue({ id: "ct-1" });
  mocks.prisma.meetingCustomType.deleteMany.mockResolvedValue({ count: 0 });
});

describe("POST /api/meetings", () => {
  const validBody = {
    meetingType: "Open Enrollment",
    client: "Acme Corp",
    date: "2027-05-10",
    time: "13:30",
    timezone: "America/New_York",
    duration: "1 hour",
    format: "Virtual",
    platform: "Zoom",
    meetingLink: "https://zoom.us/j/1",
  };

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await postMeeting(request("/api/meetings", { method: "POST", body: validBody }));

    expect(res.status).toBe(401);
  });

  it("requires the core fields", async () => {
    const res = await postMeeting(
      request("/api/meetings", {
        method: "POST",
        body: { meetingType: "Open Enrollment" },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Missing required fields",
    });
    expect(mocks.prisma.meeting.create).not.toHaveBeenCalled();
  });

  it("rejects a clientId the user does not own", async () => {
    const res = await postMeeting(
      request("/api/meetings", {
        method: "POST",
        body: { ...validBody, clientId: "other-plan" },
      }),
    );

    expect(res.status).toBe(400);
    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other-plan", userId: "user-1" },
      }),
    );
    expect(mocks.prisma.meeting.create).not.toHaveBeenCalled();
  });

  it("attaches an owned plan and derives the start instant", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: "plan-1" });

    const res = await postMeeting(
      request("/api/meetings", {
        method: "POST",
        body: { ...validBody, clientId: "plan-1", maxAttendees: "25" },
      }),
    );

    expect(res.status).toBe(201);
    expect(mocks.computeStartAtUtc).toHaveBeenCalledWith(
      "2027-05-10",
      "13:30",
      "America/New_York",
    );
    const data = mocks.prisma.meeting.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: "user-1",
      meeting: "Open Enrollment",
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      clientId: "plan-1",
      time: "13:30",
      timezone: "America/New_York",
      startAtUtc: mocks.startAt,
      duration: "1 hour",
      format: "Virtual",
      platform: "Zoom",
      meetingLink: "https://zoom.us/j/1",
      maxAttendees: 25,
      status: "Upcoming",
      attendees: 0,
      displayOnPortal: true,
    });
    expect(data.date).toEqual(new Date("2027-05-10"));
  });

  it("falls back to matching the plan by company name", async () => {
    mocks.prisma.client.findFirst.mockResolvedValue({ id: "plan-1" });

    await postMeeting(
      request("/api/meetings", { method: "POST", body: validBody }),
    );

    expect(mocks.prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          companyName: { equals: "Acme Corp", mode: "insensitive" },
        },
      }),
    );
    expect(mocks.prisma.meeting.create.mock.calls[0][0].data.clientId).toBe(
      "plan-1",
    );
  });

  it("creates without a clientId when no plan matches", async () => {
    await postMeeting(
      request("/api/meetings", { method: "POST", body: validBody }),
    );

    expect(mocks.prisma.meeting.create.mock.calls[0][0].data).not.toHaveProperty(
      "clientId",
    );
  });

  it("defaults nullable fields and the title fallback", async () => {
    await postMeeting(
      request("/api/meetings", { method: "POST", body: validBody }),
    );

    const data = mocks.prisma.meeting.create.mock.calls[0][0].data;
    expect(data.meeting).toBe("Open Enrollment");
    expect(data.maxAttendees).toBeNull();
    expect(data.description).toBeNull();
    expect(data.language).toBeNull();
    expect(data.benefitsCategory).toBeNull();
    expect(data.address).toBeNull();
  });

  it("supports an explicit status and title", async () => {
    await postMeeting(
      request("/api/meetings", {
        method: "POST",
        body: { ...validBody, meeting: "Custom Title", status: "Draft" },
      }),
    );

    const data = mocks.prisma.meeting.create.mock.calls[0][0].data;
    expect(data.meeting).toBe("Custom Title");
    expect(data.status).toBe("Draft");
  });

  it("returns 500 when the create throws", async () => {
    mocks.prisma.meeting.create.mockRejectedValue(new Error("db down"));

    const res = await postMeeting(
      request("/api/meetings", { method: "POST", body: validBody }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "Failed to create meeting",
      details: "db down",
    });
  });
});

describe("GET /api/meetings", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await getMeetings(request("/api/meetings"));

    expect(res.status).toBe(401);
  });

  it("applies search, client, type, and status filters", async () => {
    const res = await getMeetings(
      request(
        "/api/meetings?search=enroll&client=Acme%20Corp&type=Open%20Enrollment&status=Scheduled",
      ),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meeting.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { meeting: { contains: "enroll", mode: "insensitive" } },
          { client: { contains: "enroll", mode: "insensitive" } },
        ],
        client: "Acme Corp",
        meetingType: "Open Enrollment",
        status: "Scheduled",
      },
      orderBy: { date: "desc" },
    });
  });

  it("skips the type and status filters when they are 'all'", async () => {
    await getMeetings(request("/api/meetings?type=all&status=all"));

    const where = mocks.prisma.meeting.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: "user-1" });
  });

  it("moves a Scheduled meeting into In Progress while it is running", async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 60_000);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const time = `${start.getHours().toString().padStart(2, "0")}:${start
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    mocks.prisma.meeting.findMany.mockResolvedValue([
      {
        id: "m-1",
        meeting: "Running",
        date,
        time,
        duration: "10 minutes",
        status: "Scheduled",
      },
    ]);

    const res = await getMeetings(request("/api/meetings"));
    const json = await res.json();

    expect(json.data[0].status).toBe("In Progress");
    expect(mocks.prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { status: "In Progress" },
    });
  });

  it("completes an In Progress meeting whose end has passed", async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 3_600_000);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const time = `${start.getHours().toString().padStart(2, "0")}:${start
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    mocks.prisma.meeting.findMany.mockResolvedValue([
      {
        id: "m-2",
        meeting: "Ended",
        date,
        time,
        duration: "10 minutes",
        status: "In Progress",
      },
    ]);

    const res = await getMeetings(request("/api/meetings"));
    const json = await res.json();

    expect(json.data[0].status).toBe("Completed");
    expect(mocks.prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: "m-2" },
      data: { status: "Completed" },
    });
  });

  it("treats '2 hours' as two minutes when deriving the end (current behavior)", async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 3 * 60_000);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const time = `${start.getHours().toString().padStart(2, "0")}:${start
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    mocks.prisma.meeting.findMany.mockResolvedValue([
      {
        id: "m-3",
        meeting: "Two hours",
        date,
        time,
        duration: "2 hours",
        status: "Scheduled",
      },
    ]);

    const res = await getMeetings(request("/api/meetings"));
    const json = await res.json();

    // `parseInt(duration.replace(/\D/g, ""))` reads "2 hours" as 2 minutes.
    expect(json.data[0].status).toBe("Completed");
  });

  it("leaves Draft meetings untouched", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue([
      {
        id: "m-4",
        meeting: "Draft",
        date: new Date("2020-01-01T00:00:00Z"),
        time: "09:00",
        duration: "1 hour",
        status: "Draft",
      },
    ]);

    const res = await getMeetings(request("/api/meetings"));
    const json = await res.json();

    expect(json.data[0].status).toBe("Draft");
    expect(mocks.prisma.meeting.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the query throws", async () => {
    mocks.prisma.meeting.findMany.mockRejectedValue(new Error("db down"));

    const res = await getMeetings(request("/api/meetings"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "Failed to fetch meetings",
    });
  });
});

describe("PUT /api/meetings/[id]", () => {
  const existing = {
    id: "m-1",
    clientId: "plan-1",
    date: new Date("2027-05-01T00:00:00Z"),
    time: "09:00",
    timezone: "America/New_York",
  };

  const body = {
    meetingType: "Open Enrollment",
    client: "Acme Corp",
    date: "2027-05-10",
    time: "13:30",
    timezone: "America/New_York",
    duration: "1 hour",
    format: "Virtual",
    status: "Upcoming",
  };

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await putMeeting(
      request("/api/meetings/m-1", { method: "PUT", body }),
      params("m-1"),
    );

    expect(res.status).toBe(401);
  });

  it("returns 404 when the meeting is not owned", async () => {
    const res = await putMeeting(
      request("/api/meetings/m-1", { method: "PUT", body }),
      params("m-1"),
    );

    expect(res.status).toBe(404);
    expect(mocks.prisma.meeting.update).not.toHaveBeenCalled();
  });

  it("rejects a plan the user does not own", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);

    const res = await putMeeting(
      request("/api/meetings/m-1", {
        method: "PUT",
        body: { ...body, clientId: "other-plan" },
      }),
      params("m-1"),
    );

    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
  });

  it("clears the clientId when an empty value is sent", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);

    const res = await putMeeting(
      request("/api/meetings/m-1", {
        method: "PUT",
        body: { ...body, clientId: "" },
      }),
      params("m-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meeting.update.mock.calls[0][0].data.clientId).toBe(
      null,
    );
  });

  it("rejects an unparseable date", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);

    const res = await putMeeting(
      request("/api/meetings/m-1", {
        method: "PUT",
        body: { ...body, date: "not-a-date" },
      }),
      params("m-1"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "Invalid date" });
  });

  it("rejects a non-numeric maxAttendees", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);

    const res = await putMeeting(
      request("/api/meetings/m-1", {
        method: "PUT",
        body: { ...body, maxAttendees: "many" },
      }),
      params("m-1"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Invalid maxAttendees",
    });
  });

  it("updates the meeting and recomputes startAtUtc", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);

    const res = await putMeeting(
      request("/api/meetings/m-1", {
        method: "PUT",
        body: { ...body, maxAttendees: "30" },
      }),
      params("m-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.computeStartAtUtc).toHaveBeenCalledWith(
      "2027-05-10",
      "13:30",
      "America/New_York",
    );
    const data = mocks.prisma.meeting.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      meeting: "Open Enrollment",
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      time: "13:30",
      status: "Upcoming",
      startAtUtc: mocks.startAt,
      maxAttendees: 30,
    });
    expect(data.date).toEqual(new Date("2027-05-10"));
  });

  it("falls back to the stored schedule when fields are omitted", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);

    await putMeeting(
      request("/api/meetings/m-1", {
        method: "PUT",
        body: { meetingType: "Open Enrollment", client: "Acme Corp" },
      }),
      params("m-1"),
    );

    expect(mocks.computeStartAtUtc).toHaveBeenCalledWith(
      "2027-05-01",
      "09:00",
      "America/New_York",
    );
  });

  it("returns 500 when the update throws", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue(existing);
    mocks.prisma.meeting.update.mockRejectedValue(new Error("db down"));

    const res = await putMeeting(
      request("/api/meetings/m-1", { method: "PUT", body }),
      params("m-1"),
    );

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/meetings/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await patchMeeting(
      request("/api/meetings/m-1", { method: "PATCH", body: { status: "Completed" } }),
      params("m-1"),
    );

    expect(res.status).toBe(401);
  });

  it("validates the status before looking up the meeting", async () => {
    const res = await patchMeeting(
      request("/api/meetings/m-1", { method: "PATCH", body: { status: "Nope" } }),
      params("m-1"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "Invalid status" });
    expect(mocks.prisma.meeting.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the meeting is not owned", async () => {
    const res = await patchMeeting(
      request("/api/meetings/m-1", { method: "PATCH", body: { status: "Completed" } }),
      params("m-1"),
    );

    expect(res.status).toBe(404);
  });

  it("updates the status", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue({ id: "m-1" });

    const res = await patchMeeting(
      request("/api/meetings/m-1", {
        method: "PATCH",
        body: { status: "Cancelled" },
      }),
      params("m-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { status: "Cancelled" },
    });
  });

  it("returns 500 when the update throws", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue({ id: "m-1" });
    mocks.prisma.meeting.update.mockRejectedValue(new Error("db down"));

    const res = await patchMeeting(
      request("/api/meetings/m-1", { method: "PATCH", body: { status: "Completed" } }),
      params("m-1"),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/meetings/[id]", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await deleteMeeting(
      request("/api/meetings/m-1", { method: "DELETE" }),
      params("m-1"),
    );

    expect(res.status).toBe(401);
  });

  it("returns 404 when the meeting is not owned", async () => {
    const res = await deleteMeeting(
      request("/api/meetings/m-1", { method: "DELETE" }),
      params("m-1"),
    );

    expect(res.status).toBe(404);
    expect(mocks.prisma.meeting.delete).not.toHaveBeenCalled();
  });

  it("deletes the meeting", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue({ id: "m-1" });

    const res = await deleteMeeting(
      request("/api/meetings/m-1", { method: "DELETE" }),
      params("m-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meeting.delete).toHaveBeenCalledWith({
      where: { id: "m-1" },
    });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      message: "Meeting deleted successfully",
    });
  });

  it("returns 500 when the delete throws", async () => {
    mocks.prisma.meeting.findFirst.mockResolvedValue({ id: "m-1" });
    mocks.prisma.meeting.delete.mockRejectedValue(new Error("db down"));

    const res = await deleteMeeting(
      request("/api/meetings/m-1", { method: "DELETE" }),
      params("m-1"),
    );

    expect(res.status).toBe(500);
  });
});

describe("GET /api/meetings/reminders", () => {
  function meeting(id: string, dateKey: string, time = "09:00") {
    return {
      id,
      meeting: `Meeting ${id}`,
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      clientId: "plan-1",
      date: new Date(`${dateKey}T00:00:00Z`),
      time,
      timezone: "America/New_York",
      format: "Virtual",
      status: "Upcoming",
    };
  }

  it("rejects an unauthenticated request", async () => {
    mocks.session = null;

    const res = await getReminders(
      request("/api/meetings/reminders?today=2027-05-10"),
    );

    expect(res.status).toBe(401);
  });

  it("queries the padded window and excludes Draft/Cancelled", async () => {
    const res = await getReminders(
      request("/api/meetings/reminders?today=2027-05-10"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meeting.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        archived: false,
        status: { notIn: ["Draft", "Cancelled"] },
        date: {
          gte: new Date("2027-05-09T00:00:00.000Z"),
          lte: new Date("2027-05-18T00:00:00.000Z"),
        },
      },
      select: expect.any(Object),
      orderBy: { date: "asc" },
    });
  });

  it("keeps only the day-of, 2-day, and 7-day tiers and sorts them", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue([
      meeting("week", "2027-05-17", "09:00"),
      meeting("two", "2027-05-12", "14:00"),
      meeting("today", "2027-05-10", "08:00"),
      meeting("soon", "2027-05-11", "10:00"),
      meeting("far", "2027-05-18", "10:00"),
    ]);

    const res = await getReminders(
      request("/api/meetings/reminders?today=2027-05-10"),
    );
    const json = await res.json();

    expect(json.data.map((r: any) => r.id)).toEqual(["today", "two", "week"]);
    expect(json.data.map((r: any) => r.reminderStatus)).toEqual([
      "today",
      "in_2days",
      "in_week",
    ]);
    expect(json.data.map((r: any) => r.daysUntil)).toEqual([0, 2, 7]);
  });

  it("sort by day then start time", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue([
      meeting("late", "2027-05-12", "16:00"),
      meeting("early", "2027-05-12", "09:00"),
    ]);

    const res = await getReminders(
      request("/api/meetings/reminders?today=2027-05-10"),
    );
    const json = await res.json();

    expect(json.data.map((r: any) => r.id)).toEqual(["early", "late"]);
  });

  it("caps the response at the reminder limit", async () => {
    mocks.prisma.meeting.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) =>
        meeting(`m-${i}`, "2027-05-10", `${String(8 + (i % 10)).padStart(2, "0")}:00`),
      ),
    );

    const res = await getReminders(
      request("/api/meetings/reminders?today=2027-05-10"),
    );
    const json = await res.json();

    expect(json.data).toHaveLength(20);
  });

  it("falls back to today's key when the param is invalid", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2027, 4, 10, 12, 0, 0));
      const res = await getReminders(
        request("/api/meetings/reminders?today=not-a-day"),
      );

      expect(res.status).toBe(200);
      expect(mocks.prisma.meeting.findMany.mock.calls[0][0].where.date.gte).toEqual(
        new Date("2027-05-09T00:00:00.000Z"),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 500 when the query throws", async () => {
    mocks.prisma.meeting.findMany.mockRejectedValue(new Error("db down"));

    const res = await getReminders(
      request("/api/meetings/reminders?today=2027-05-10"),
    );

    expect(res.status).toBe(500);
  });
});

describe("/api/user/[id]/custom-meetings", () => {
  it("lists the user's custom meeting types", async () => {
    mocks.prisma.meetingCustomType.findMany.mockResolvedValue([
      { id: "ct-1", value: "Custom" },
    ]);

    const res = await getCustomMeetings(
      request("/api/user/user-1/custom-meetings"),
      params("user-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meetingCustomType.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { value: "asc" },
    });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: "ct-1" }],
    });
  });

  it("returns 500 when listing throws", async () => {
    mocks.prisma.meetingCustomType.findMany.mockRejectedValue(new Error("db"));

    const res = await getCustomMeetings(
      request("/api/user/user-1/custom-meetings"),
      params("user-1"),
    );

    expect(res.status).toBe(500);
  });

  it("replaces the user's custom meeting types", async () => {
    const res = await putCustomMeetings(
      request("/api/user/user-1/custom-meetings", {
        method: "PUT",
        body: {
          customMeetings: [
            { value: "Custom", label: "Custom", description: "Mine" },
          ],
        },
      }),
      params("user-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meetingCustomType.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mocks.prisma.meetingCustomType.create).toHaveBeenCalledWith({
      data: {
        value: "Custom",
        label: "Custom",
        description: "Mine",
        userId: "user-1",
      },
    });
  });

  it("returns 500 when saving throws", async () => {
    mocks.prisma.meetingCustomType.deleteMany.mockRejectedValue(new Error("db"));

    const res = await putCustomMeetings(
      request("/api/user/user-1/custom-meetings", {
        method: "PUT",
        body: { customMeetings: [] },
      }),
      params("user-1"),
    );

    expect(res.status).toBe(500);
  });

  it("requires a meetingId to delete", async () => {
    const res = await deleteCustomMeeting(
      request("/api/user/user-1/custom-meetings", {
        method: "DELETE",
        body: {},
      }),
      params("user-1"),
    );

    expect(res.status).toBe(400);
    expect(mocks.prisma.meetingCustomType.delete).not.toHaveBeenCalled();
  });

  it("deletes a custom meeting type", async () => {
    const res = await deleteCustomMeeting(
      request("/api/user/user-1/custom-meetings", {
        method: "DELETE",
        body: { meetingId: "ct-1" },
      }),
      params("user-1"),
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.meetingCustomType.delete).toHaveBeenCalledWith({
      where: { id: "ct-1" },
    });
  });
});
