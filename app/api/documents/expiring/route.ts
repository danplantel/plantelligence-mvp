export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  DOCUMENT_EXPIRATION_LIMIT,
  DOCUMENT_EXPIRATION_WINDOW_DAYS,
  compareDocumentExpirations,
  resolveDocumentExpirationStatus,
} from "@/lib/notifications/document-expirations";
import {
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  isDateKey,
  toDateKey,
  todayDateKey,
} from "@/lib/notifications/date-keys";

/**
 * Expiring document reminders for the header Notifications menu.
 *
 * Mirrors `app/api/meetings/reminders/route.ts`: user-scoped, soft-archived
 * documents excluded, and limited to the exact day-of / 2-day / 7-day marks.
 *
 * Review dates are date-only values, so every tier is resolved from the stored
 * date's calendar day (see `toDateKey`). The viewer's timezone is deliberately
 * not consulted: this is a US-based app and a reminder must fire on the day the
 * document is due, matching the documents dashboard, wherever the viewer is.
 *
 * The client still passes `?today=yyyy-MM-dd`; it is used only as a fallback
 * when the request arrives without a usable day key.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedToday = searchParams.get("today");
    const today = isDateKey(requestedToday)
      ? (requestedToday as string)
      : todayDateKey();


    // Pad the DB window by a day on each side so rows shifted by a timezone
    // offset are still fetched; the exact day keys are filtered below.
    const rangeStart = dateKeyToUtcDate(today, -1);
    const rangeEnd = dateKeyToUtcDate(today, DOCUMENT_EXPIRATION_WINDOW_DAYS + 1);

    const documents = await prisma.document.findMany({
      where: {
        client: {
          userId: session.user.id,
        },
        expirationDate: {
          not: null,
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        category: true,
        expirationDate: true,
        // Selected for the archived filter below, NOT filtered in the query:
        // `archivedAt: null` in a Prisma MongoDB where clause matches no rows
        // (it omits documents where the field is missing or explicitly null).
        // Same JS-filter convention as GET /api/documents.
        archivedAt: true,
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    const expiringDocuments = documents
      .filter((document) => document.archivedAt == null)
      .map((document) => {
        const dateKey = toDateKey(document.expirationDate);
        if (!dateKey) return null;

        const daysUntilExpiration = daysBetweenDateKeys(today, dateKey);
        if (daysUntilExpiration === null) return null;

        const status = resolveDocumentExpirationStatus(daysUntilExpiration);
        if (!status) return null;

        return {
          id: document.id,
          title: document.title,
          client: document.client,
          dateKey,
          category: document.category,
          type: document.type,
          daysUntilExpiration,
          status,
        };
      })
      .filter(
        (document): document is NonNullable<typeof document> =>
          document !== null,
      )
      .sort(compareDocumentExpirations)
      .slice(0, DOCUMENT_EXPIRATION_LIMIT);

    return NextResponse.json({
      success: true,
      data: expiringDocuments,
    });
  } catch (error) {
    console.error("Error fetching expiring documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch expiring documents" },
      { status: 500 },
    );
  }
}
