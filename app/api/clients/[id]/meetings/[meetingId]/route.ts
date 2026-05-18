import { NextRequest, NextResponse } from "next/server";
import type { Meeting } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { computeStartAtUtc } from "@/lib/meeting-start-at";
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

async function loadPlanMeeting(
  clientId: string,
  meetingId: string,
  userId: string,
) {
  return prisma.meeting.findFirst({
    where: {
      id: meetingId,
      clientId,
      userId,
    },
  });
}

function existingToFormPartial(
  existing: Meeting,
  companyName: string,
): Partial<MeetingScheduleFormData> {
  return {
    meetingType: existing.meetingType || "",
    customMeetingType: "",
    client: companyName,
    date: existing.date.toISOString().slice(0, 10),
    time: existing.time,
    timezone: existing.timezone || "America/New_York",
    duration: existing.duration || "",
    format: existing.format || "Virtual",
    platform: existing.platform || "",
    customPlatform: "",
    meetingUrl: "",
    meetingLink: existing.meetingLink || "",
    maxAttendees:
      existing.maxAttendees != null ? String(existing.maxAttendees) : "",
    description: existing.description || "",
    address: existing.address || "",
    city: existing.city || "",
    state: existing.state || "",
    zip: existing.zip || "",
    displayOnPortal: existing.displayOnPortal !== false,
    replayUrl: existing.replayUrl || "",
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; meetingId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId, meetingId } = params;
    const existing = await loadPlanMeeting(
      clientId,
      meetingId,
      session.user.id,
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 },
      );
    }

    const clientRow = await prisma.client.findUnique({
      where: { id: clientId },
      select: { companyName: true },
    });
    const companyName = clientRow?.companyName ?? "";

    const body = await request.json();

    const isFullScheduleUpdate =
      typeof body.date === "string" &&
      typeof body.time === "string" &&
      typeof body.duration === "string" &&
      typeof body.format === "string";

    if (isFullScheduleUpdate) {
      const base = existingToFormPartial(existing, companyName);
      const formLike: MeetingScheduleFormData = {
        meetingType: String(body.meetingType ?? base.meetingType ?? ""),
        customMeetingType: String(
          body.customMeetingType ?? base.customMeetingType ?? "",
        ),
        client: companyName,
        date: String(body.date),
        time: String(body.time),
        hour: "",
        minute: "",
        ampm: "",
        timezone:
          typeof body.timezone === "string" && body.timezone.trim()
            ? body.timezone.trim()
            : base.timezone || "America/New_York",
        duration: String(body.duration),
        customDuration: "",
        format: String(body.format),
        platform: String(body.platform ?? base.platform ?? ""),
        customPlatform: String(body.customPlatform ?? ""),
        meetingUrl: String(body.meetingUrl ?? ""),
        meetingLink: String(body.meetingLink ?? ""),
        maxAttendees:
          body.maxAttendees != null && body.maxAttendees !== ""
            ? String(body.maxAttendees)
            : base.maxAttendees ?? "",
        description:
          body.description != null
            ? String(body.description)
            : base.description ?? "",
        address: String(body.address ?? base.address ?? ""),
        city: String(body.city ?? base.city ?? ""),
        state: String(body.state ?? base.state ?? ""),
        zip: String(body.zip ?? base.zip ?? ""),
        displayOnPortal:
          typeof body.displayOnPortal === "boolean"
            ? body.displayOnPortal
            : (base.displayOnPortal ?? true),
        replayUrl: String(body.replayUrl ?? base.replayUrl ?? ""),
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

      const updated = await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          meeting: meetingTypeToSend,
          meetingType: meetingTypeToSend,
          client: companyName,
          date: dateObj,
          time: formLike.time.trim(),
          timezone: formLike.timezone,
          duration: formLike.duration,
          format: formLike.format,
          platform: platformResolved,
          meetingLink: meetingLinkTrim || meetingUrlTrim || null,
          maxAttendees: maxInt != null && !Number.isNaN(maxInt) ? maxInt : null,
          description: formLike.description.trim() || null,
          address: formLike.address.trim() || null,
          city: formLike.city.trim() || null,
          state: formLike.state.trim() || null,
          zip: formLike.zip.trim() || null,
          hubLocation,
          displayOnPortal: formLike.displayOnPortal,
          registrationUrl: regExplicit || meetingLinkTrim || null,
          replayUrl: replayTrim,
          startAtUtc,
        },
      });

      return NextResponse.json({
        success: true,
        data: serializePlanMeeting(updated),
      });
    }

    /** Partial updates (hub toggle, archive, legacy short fields) */
    const data: Record<string, unknown> = {};
    const {
      title,
      meetingType,
      date,
      time,
      timezone,
      location,
      displayOnPortal,
      registrationUrl,
      replayUrl,
      archived,
    } = body;

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
      }
      data.meeting = title.trim();
    }

    if (meetingType !== undefined) {
      if (typeof meetingType !== "string" || !meetingType.trim()) {
        return NextResponse.json(
          { error: "Invalid meeting type" },
          { status: 400 },
        );
      }
      data.meetingType = meetingType.trim();
      if (!data.meeting) data.meeting = meetingType.trim();
    }

    let nextDate = existing.date;
    let nextTime = existing.time;
    let nextTz = existing.timezone;

    if (date !== undefined) {
      const d =
        typeof date === "string"
          ? new Date(date.includes("T") ? date : `${date}T12:00:00.000Z`)
          : null;
      if (!d || Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      nextDate = d;
      data.date = d;
    }

    if (time !== undefined) {
      if (typeof time !== "string" || !time.trim()) {
        return NextResponse.json({ error: "Invalid time" }, { status: 400 });
      }
      nextTime = time.trim();
      data.time = nextTime;
    }

    if (timezone !== undefined) {
      if (typeof timezone !== "string" || !timezone.trim()) {
        return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
      }
      nextTz = timezone.trim();
      data.timezone = nextTz;
    }

    if (location !== undefined) {
      if (typeof location === "string" && location.trim()) {
        data.hubLocation = location.trim();
      }
    }

    if (displayOnPortal !== undefined) {
      if (typeof displayOnPortal !== "boolean") {
        return NextResponse.json(
          { error: "displayOnPortal must be boolean" },
          { status: 400 },
        );
      }
      data.displayOnPortal = displayOnPortal;
    }

    if (registrationUrl !== undefined) {
      data.registrationUrl =
        typeof registrationUrl === "string" && registrationUrl.trim()
          ? registrationUrl.trim()
          : null;
    }

    if (replayUrl !== undefined) {
      data.replayUrl =
        typeof replayUrl === "string" && replayUrl.trim()
          ? replayUrl.trim()
          : null;
    }

    if (archived !== undefined) {
      if (typeof archived !== "boolean") {
        return NextResponse.json({ error: "archived must be boolean" }, { status: 400 });
      }
      data.archived = archived;
    }

    const dateStr =
      nextDate instanceof Date
        ? nextDate.toISOString().slice(0, 10)
        : String(nextDate).slice(0, 10);

    if (
      data.date !== undefined ||
      data.time !== undefined ||
      data.timezone !== undefined
    ) {
      data.startAtUtc = computeStartAtUtc(
        dateStr,
        nextTime,
        nextTz || "America/New_York",
      );
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: data as any,
    });

    return NextResponse.json({
      success: true,
      data: serializePlanMeeting(updated),
    });
  } catch (error) {
    console.error("PATCH /api/clients/[id]/meetings/[meetingId]:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; meetingId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId, meetingId } = params;
    const existing = await loadPlanMeeting(
      clientId,
      meetingId,
      session.user.id,
    );

    if (!existing) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 },
      );
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { archived: true },
    });

    return NextResponse.json({
      success: true,
      message: "Meeting archived",
    });
  } catch (error) {
    console.error("DELETE /api/clients/[id]/meetings/[meetingId]:", error);
    return NextResponse.json(
      { error: "Failed to archive meeting" },
      { status: 500 },
    );
  }
}
