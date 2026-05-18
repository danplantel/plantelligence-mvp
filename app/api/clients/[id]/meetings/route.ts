import { NextRequest, NextResponse } from "next/server";
import type { Meeting } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { computeStartAtUtc, getMeetingSortInstantMs } from "@/lib/meeting-start-at";
import type { MeetingScheduleFormData } from "@/lib/meetings/meeting-schedule-shared";
import {
  buildHubLocationFromForm,
  resolveMeetingTypeToSend,
  resolvePlatformForDb,
  validateMeetingScheduleForm,
} from "@/lib/meetings/meeting-schedule-shared";

function serializePlanMeeting(m: Meeting) {
  return {
    id: m.id,
    meeting: m.meeting,
    meetingType: m.meetingType,
    date: m.date.toISOString(),
    time: m.time,
    timezone: m.timezone,
    duration: m.duration,
    hubLocation: m.hubLocation,
    registrationUrl: m.registrationUrl,
    replayUrl: m.replayUrl,
    displayOnPortal: m.displayOnPortal,
    archived: m.archived,
    startAtUtc: m.startAtUtc?.toISOString() ?? null,
    meetingLink: m.meetingLink,
    format: m.format,
    platform: m.platform,
    description: m.description,
    maxAttendees: m.maxAttendees,
    address: m.address,
    city: m.city,
    state: m.state,
    zip: m.zip,
  };
}

async function assertClientOwner(clientId: string, userId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, userId: true, companyName: true },
  });
  if (!client) return { error: "Client not found" as const, status: 404 };
  if (client.userId !== userId)
    return { error: "Forbidden" as const, status: 403 };
  return { client };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;
    const forHub = request.nextUrl.searchParams.get("forHub") === "1";
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "1";

    const gate = await assertClientOwner(clientId, session.user.id);
    if ("error" in gate) {
      return NextResponse.json(
        { error: gate.error },
        { status: gate.status },
      );
    }

    // Plan-scoped: rows created via /api/clients/[id]/meetings have clientId set.
    // Legacy /api/meetings only stored `client` (company name) and left clientId null —
    // include those when the name matches this plan (same user) so the Hub shows them.
    const planScope = {
      OR: [
        { clientId },
        {
          clientId: null,
          client: gate.client.companyName,
        },
      ],
    } as const;

    const where: Record<string, unknown> = {
      userId: session.user.id,
      ...planScope,
    };

    if (!includeArchived) {
      where.archived = { not: true };
    }

    if (forHub) {
      // Treat missing as visible (legacy rows) — hide only when explicitly false
      where.displayOnPortal = { not: false };
    }

    const rows = await prisma.meeting.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const now = Date.now();

    if (!forHub) {
      return NextResponse.json({
        success: true,
        data: rows.map(serializePlanMeeting),
      });
    }

    const withMs = rows.map((m) => ({
      m,
      ms: getMeetingSortInstantMs({
        startAtUtc: m.startAtUtc,
        date: m.date,
        time: m.time,
      }),
    }));

    const upcoming = withMs
      .filter((x) => x.ms != null && x.ms >= now)
      .sort((a, b) => (a.ms! - b.ms!))
      .map((x) => serializePlanMeeting(x.m));

    const past = withMs
      .filter((x) => x.ms != null && x.ms < now)
      .sort((a, b) => (b.ms! - a.ms!))
      .map((x) => serializePlanMeeting(x.m));

    return NextResponse.json({
      success: true,
      data: { upcoming, past },
    });
  } catch (error) {
    console.error("GET /api/clients/[id]/meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;
    const gate = await assertClientOwner(clientId, session.user.id);
    if ("error" in gate) {
      return NextResponse.json(
        { error: gate.error },
        { status: gate.status },
      );
    }

    const body = await request.json();

    /** Legacy short payload from older plan UI */
    if (
      typeof body.title === "string" &&
      body.title.trim() &&
      typeof body.location === "string" &&
      body.location.trim() &&
      typeof body.meetingType === "string" &&
      !body.duration
    ) {
      const date = String(body.date || "");
      const time = String(body.time || "");
      const meetingType = String(body.meetingType || "").trim();
      const tz =
        typeof body.timezone === "string" && body.timezone.trim()
          ? body.timezone.trim()
          : "America/New_York";
      if (!date || !time.trim() || !meetingType) {
        return NextResponse.json(
          { error: "Missing date, time, or meeting type" },
          { status: 400 },
        );
      }
      const dateObj = new Date(
        date.includes("T") ? date : `${date}T12:00:00.000Z`,
      );
      if (Number.isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const startAtUtc = computeStartAtUtc(
        date.includes("T") ? date.slice(0, 10) : date,
        time,
        tz,
      );
      const display =
        typeof body.displayOnPortal === "boolean" ? body.displayOnPortal : true;
      const reg =
        typeof body.registrationUrl === "string" && body.registrationUrl.trim()
          ? body.registrationUrl.trim()
          : null;
      const rep =
        typeof body.replayUrl === "string" && body.replayUrl.trim()
          ? body.replayUrl.trim()
          : null;
      const meeting = await prisma.meeting.create({
        data: {
          userId: session.user.id,
          clientId,
          meeting: body.title.trim(),
          meetingType,
          client: gate.client.companyName,
          date: dateObj,
          time: time.trim(),
          timezone: tz,
          duration: "60 minutes",
          format: "Virtual",
          platform: null,
          meetingLink: null,
          status: "Scheduled",
          attendees: 0,
          hubLocation: body.location.trim(),
          displayOnPortal: display,
          archived: false,
          registrationUrl: reg,
          replayUrl: rep,
          startAtUtc,
        },
      });
      return NextResponse.json(
        { success: true, data: serializePlanMeeting(meeting) },
        { status: 201 },
      );
    }

    /** Same shape as /new/meetings form submit */
    const formLike: MeetingScheduleFormData = {
      meetingType: String(body.meetingType || ""),
      customMeetingType: String(body.customMeetingType || ""),
      client: gate.client.companyName,
      date: String(body.date || ""),
      time: String(body.time || ""),
      hour: "",
      minute: "",
      ampm: "",
      timezone:
        typeof body.timezone === "string" && body.timezone.trim()
          ? body.timezone.trim()
          : "America/New_York",
      duration: String(body.duration || ""),
      customDuration: "",
      format: String(body.format || ""),
      platform: String(body.platform || ""),
      customPlatform: String(body.customPlatform || ""),
      meetingUrl: String(body.meetingUrl || ""),
      meetingLink: String(body.meetingLink || ""),
      maxAttendees:
        body.maxAttendees != null && body.maxAttendees !== ""
          ? String(body.maxAttendees)
          : "",
      description:
        body.description != null ? String(body.description) : "",
      address: String(body.address || ""),
      city: String(body.city || ""),
      state: String(body.state || ""),
      zip: String(body.zip || ""),
      displayOnPortal: body.displayOnPortal !== false,
      replayUrl: String(body.replayUrl || ""),
    };

    const validationErrors = validateMeetingScheduleForm(formLike, {
      requireClient: true,
    });
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 400 },
      );
    }

    const meetingTypeToSend = resolveMeetingTypeToSend(formLike);
    if (!meetingTypeToSend) {
      return NextResponse.json(
        { error: "Invalid meeting type" },
        { status: 400 },
      );
    }

    const dateRaw = formLike.date;
    const dateObj = new Date(
      dateRaw.includes("T") ? dateRaw : `${dateRaw}T12:00:00.000Z`,
    );
    if (Number.isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const startAtUtc = computeStartAtUtc(
      dateRaw.includes("T") ? dateRaw.slice(0, 10) : dateRaw,
      formLike.time.trim(),
      formLike.timezone,
    );

    const hubLocation = buildHubLocationFromForm(formLike);
    const platformResolved = resolvePlatformForDb(formLike);
    const meetingLinkTrim = formLike.meetingLink.trim();
    const meetingUrlTrim = formLike.meetingUrl.trim();
    const regExplicit =
      typeof body.registrationUrl === "string" && body.registrationUrl.trim()
        ? body.registrationUrl.trim()
        : null;
    const replayTrim = formLike.replayUrl.trim() || null;
    const maxInt =
      formLike.maxAttendees.trim() === ""
        ? null
        : parseInt(formLike.maxAttendees, 10);

    const meeting = await prisma.meeting.create({
      data: {
        userId: session.user.id,
        clientId,
        meeting: meetingTypeToSend,
        meetingType: meetingTypeToSend,
        client: gate.client.companyName,
        date: dateObj,
        time: formLike.time.trim(),
        timezone: formLike.timezone,
        duration: formLike.duration,
        format: formLike.format,
        platform: platformResolved,
        meetingLink: meetingLinkTrim || meetingUrlTrim || null,
        maxAttendees: maxInt != null && !Number.isNaN(maxInt) ? maxInt : null,
        description: formLike.description.trim() || null,
        status: "Scheduled",
        attendees: 0,
        address: formLike.address.trim() || null,
        city: formLike.city.trim() || null,
        state: formLike.state.trim() || null,
        zip: formLike.zip.trim() || null,
        hubLocation,
        displayOnPortal: formLike.displayOnPortal,
        archived: false,
        registrationUrl: regExplicit || meetingLinkTrim || null,
        replayUrl: replayTrim,
        startAtUtc,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: serializePlanMeeting(meeting),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/clients/[id]/meetings:", error);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 },
    );
  }
}
