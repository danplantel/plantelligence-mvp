import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";
import { resolvePortalAdvisorId } from "@/lib/portal-access";
import {
  hasWebinarPlacement,
  isWebinarPlacementKey,
  normalizeWebinarPlacements,
} from "@/lib/webinar-placements";

/** Row shape handed to the dashboard list and the portal Webinars section. */
type WebinarRow = {
  id: string;
  clientId: string;
  clientName: string;
  webinarTitle: string;
  description: string | null;
  thumbnail: string | null;
  benefitsCategory?: string | null;
  /** Stored as JSON; normalised through `normalizeWebinarPlacements`. */
  placements?: unknown;
  eventDate: Date;
  sourceType: unknown;
  /** Absent on list responses that omit the base64 payload. */
  videoFileUrl?: string | null;
  /** Length of the stored base64 video — stored so lists needn't read it. */
  videoSize?: number | null;
  videoUrl: string | null;
  createdAt: Date;
};

/**
 * `includeVideoFiles: false` keeps the multi-MB base64 video out of the payload,
 * which is what lets the dashboard list render thumbnails without pulling every
 * video on load. Size and presence are still reported so the list's "Size" sort
 * and play affordance keep working — the video itself is fetched on demand from
 * `/api/webinars/[id]` when the user actually plays one.
 */
function serializeWebinar(
  webinar: WebinarRow,
  options: { includeVideoFiles: boolean } = { includeVideoFiles: true },
) {
  const videoFileUrl = webinar.videoFileUrl ?? null;
  // List queries omit the payload, so fall back to the stored size column.
  const videoSize =
    webinar.videoSize ?? (videoFileUrl ? videoFileUrl.length : 0);

  return {
    id: webinar.id,
    clientId: webinar.clientId,
    clientName: webinar.clientName,
    webinarTitle: webinar.webinarTitle,
    description: webinar.description,
    thumbnail: webinar.thumbnail,
    benefitsCategory: webinar.benefitsCategory ?? null,
    placements: normalizeWebinarPlacements(webinar.placements),
    eventDate: webinar.eventDate,
    sourceType: webinar.sourceType as { upload: boolean; url: boolean },
    videoFileUrl: options.includeVideoFiles ? videoFileUrl : null,
    hasVideoFile: Boolean(videoFileUrl) || videoSize > 0,
    videoSize,
    videoUrl: webinar.videoUrl,
    createdAt: webinar.createdAt,
  };
}

// GET all webinars
export async function GET(request: NextRequest) {
  try {
    // Public portal (News & Events, and the benefit hub pages) resolves the owning
    // advisor from the plan named in `?clientId=` (a slug or an ObjectId); the
    // dashboard (Communications → Webinars) requires the session as before.
    const portalAdvisorId = await resolvePortalAdvisorId(request, true);
    let userId: string | undefined = portalAdvisorId;
    if (!userId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = session.user.id;
    }

    // Narrow to one plan when the caller named one (portal pages pass the route's
    // plan slug, the News & Events section passes the same plan's ObjectId). The
    // *server* does this filtering on purpose: sending every plan's rows to a
    // portal page and hiding all but its own client-side meant each visitor
    // downloaded every video on the account, and the response body exposed other
    // plans' videos even though the UI never showed them.
    const clientIdParam =
      request.nextUrl.searchParams.get("clientId")?.trim() ?? "";
    let planId: string | null = null;
    if (clientIdParam) {
      const plan = await prisma.client.findFirst({
        where: {
          userId,
          ...(ObjectId.isValid(clientIdParam)
            ? { id: clientIdParam }
            : { slug: clientIdParam }),
        },
        select: { id: true },
      });
      // An unresolvable plan returns nothing rather than falling through to the
      // unrestricted query, which would leak the advisor's other plans.
      if (!plan) {
        return NextResponse.json({ success: true, data: [] });
      }
      planId = plan.id;
    }

    const where = planId ? { userId, clientId: planId } : { userId };

    // Typed Prisma, not $runCommandRaw: the raw command serializes BSON values
    // (ObjectId, Date) to strings, so rows written that way are stored as
    // `clientId: "<hex>"` / `eventDate: "<iso>"` and can never be matched by the
    // ObjectId filters used elsewhere in the app. Writing through the model keeps
    // `userId`, `clientId` and `eventDate` in the types the schema declares.
    // Deliberately no `orderBy`: a webinar row can carry a multi-MB base64 video
    // (and now a thumbnail), and MongoDB's in-memory sort aborts once it passes
    // 32MB with `QueryExceededMemoryLimitNoDiskUseAllowed` (error 292). Sorting
    // full documents is the expensive part, so fetch and sort the small per-user
    // set here instead.
    // The dashboard list sends `includeVideoFiles=0`; the portal (News & Events,
    // and the meetings preview that embeds it) omits the param and keeps getting
    // the videos it needs to play replays inline.
    const includeVideoFiles =
      request.nextUrl.searchParams.get("includeVideoFiles") !== "0";

    // The benefit hub sections ask for just their own page's videos
    // (`?placement=retirement`). Empty means "no placement filter".
    const placementParam =
      request.nextUrl.searchParams.get("placement")?.trim() ?? "";
    const placement = isWebinarPlacementKey(placementParam)
      ? placementParam
      : null;

    // Two shapes on purpose. With videos included (portal) the full rows come
    // back. Without them (dashboard list) `videoFileUrl` is left out of the
    // projection entirely, so the multi-MB base64 never leaves MongoDB — reading
    // it only to drop it is what made this endpoint take ~13s. The stored
    // `videoSize` column keeps the "Size" sort meaningful without the payload.
    const webinars: WebinarRow[] = includeVideoFiles
      ? await prisma.webinar.findMany({ where })
      : await prisma.webinar.findMany({
          where,
          select: {
            id: true,
            clientId: true,
            clientName: true,
            webinarTitle: true,
            description: true,
            thumbnail: true,
            benefitsCategory: true,
            placements: true,
            eventDate: true,
            sourceType: true,
            videoUrl: true,
            videoSize: true,
            createdAt: true,
          },
        });

    webinars.sort(
      (a, b) =>
        new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
    );

    // Narrow to the requested page before serializing, so a hub section never
    // receives — or downloads — the other pages' video payloads.
    const visible = placement
      ? webinars.filter((webinar) =>
          hasWebinarPlacement(webinar.placements, placement),
        )
      : webinars;

    return NextResponse.json({
      success: true,
      data: visible.map((webinar) =>
        serializeWebinar(webinar, { includeVideoFiles }),
      ),
    });
  } catch (error) {
    console.error("Error fetching webinars:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST create new webinar
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      client,
      sourceType,
      webinarTitle,
      description,
      thumbnail,
      benefitsCategory,
      placements,
      eventDate,
      videoFile,
      videoUrl,
    } = body;

    // Validation
    if (!client || !webinarTitle || !eventDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!sourceType.upload && !sourceType.url) {
      return NextResponse.json(
        { error: "Please select a source type" },
        { status: 400 }
      );
    }

    if (sourceType.upload && sourceType.url) {
      return NextResponse.json(
        { error: "Please select only one source type" },
        { status: 400 }
      );
    }

    if (sourceType.upload && !videoFile) {
      return NextResponse.json(
        { error: "Please upload a video file" },
        { status: 400 }
      );
    }

    if (sourceType.url && !videoUrl) {
      return NextResponse.json(
        { error: "Please enter a video URL" },
        { status: 400 }
      );
    }

    // Find client by company name
    const clientRecord = await prisma.client.findFirst({
      where: {
        companyName: client,
        userId: session.user.id,
      },
    });

    if (!clientRecord) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Handle video file upload if provided
    let videoFileUrl = null;
    if (sourceType.upload && videoFile) {
      // Check base64 size (MongoDB has 16MB document limit)
      // Base64 string is ~33% larger than original file
      const maxBase64Size = 13 * 1024 * 1024; // ~13MB base64 = ~10MB original file
      if (videoFile.length > maxBase64Size) {
        console.error("Video file too large:", {
          base64Length: videoFile.length,
          maxSize: maxBase64Size,
        });
        return NextResponse.json(
          {
            error:
              "Video file is too large. Maximum size is 10MB. Please use YouTube/Vimeo URL or compress the video.",
          },
          { status: 400 }
        );
      }
      // Stored as base64 for now; a future revision should move this to R2.
      videoFileUrl = videoFile;
    }

    // Create through the Prisma model so the ids land as real ObjectIds and
    // `eventDate` as a BSON date — the raw command stringified all of them, which
    // is what made freshly added webinars invisible to the ObjectId-filtered read.
    const webinar = await prisma.webinar.create({
      data: {
        userId: session.user.id,
        clientId: clientRecord.id,
        clientName: clientRecord.companyName,
        webinarTitle,
        description: typeof description === "string" && description.trim()
          ? description.trim()
          : null,
        thumbnail: typeof thumbnail === "string" && thumbnail ? thumbnail : null,
        benefitsCategory:
          typeof benefitsCategory === "string" && benefitsCategory
            ? benefitsCategory
            : null,
        // Defaults to News & Events when the caller sends nothing usable.
        placements: normalizeWebinarPlacements(placements),
        eventDate: new Date(eventDate),
        sourceType,
        videoFileUrl,
        // Kept in sync so list queries can sort by size without ever reading the
        // base64 payload.
        videoSize: videoFileUrl ? videoFileUrl.length : 0,
        videoUrl: sourceType.url ? videoUrl : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeWebinar(webinar),
    });
  } catch (error) {
    console.error("Error creating webinar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
