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

        // Find all Draft Clients for current user
        const drafts = await prisma.client.findMany({
            where: {
                userId: session.user.id,
                status: "Draft",
            },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                companyName: true,
                companyWebsite: true,
                companyLogo: true,
                brandColor: true,
                secondaryColor: true,
                updatedAt: true,
                createdAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            drafts,
            count: drafts.length
        });

    } catch (error) {
        console.error("Error fetching drafts:", error);
        return NextResponse.json({
            error: "Failed to fetch drafts"
        }, { status: 500 });
    }
}
