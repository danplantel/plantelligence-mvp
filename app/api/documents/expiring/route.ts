export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate dates for notifications
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);

    // Fetch documents that expire within the next 7 days
    const documents = await prisma.document.findMany({
      where: {
        client: {
          userId: session.user.id,
        },
        expirationDate: {
          not: null,
          gte: today,
          lte: in7Days,
        },
      },
      include: {
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

    // Filter and categorize documents
    // Priority: today > 2 days > 7 days
    const expiringDocuments = documents
      .map((doc) => {
        if (!doc.expirationDate) return null;

        const expirationDate = new Date(doc.expirationDate);
        expirationDate.setHours(0, 0, 0, 0);

        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        let status: "expiring_week" | "expiring_2days" | "expiring_today" | null =
          null;

        // Today (0 days) - highest priority
        if (daysUntilExpiration === 0) {
          status = "expiring_today";
        }
        // In 2 days - second priority
        else if (daysUntilExpiration === 2) {
          status = "expiring_2days";
        }
        // In 7 days - third priority
        else if (daysUntilExpiration === 7) {
          status = "expiring_week";
        }

        // Only return documents that match our notification criteria
        if (!status) return null;

        return {
          id: doc.id,
          title: doc.title,
          client: doc.client,
          expirationDate: doc.expirationDate.toISOString(),
          daysUntilExpiration,
          status,
        };
      })
      .filter((doc): doc is NonNullable<typeof doc> => doc !== null)
      .slice(0, 20); // Limit to 20 most urgent notifications

    return NextResponse.json({
      success: true,
      data: expiringDocuments,
    });
  } catch (error) {
    console.error("Error fetching expiring documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch expiring documents" },
      { status: 500 }
    );
  }
}

