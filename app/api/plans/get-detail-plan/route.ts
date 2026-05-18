import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "id is missing" }, { status: 400 });
    }

    const idQuery = /^\d+$/g.test(id) ? { idIndex: +id } : { id: id };

    const plan = await prisma.plan.findFirst({
      where: idQuery,
      include: {
        videos: true,
      },
    });
    return NextResponse.json({
      data: { ...plan },
    });
  } catch (error) {
    console.error("Error Api", request.nextUrl.pathname, error);
    return NextResponse.json(
      { error: "Error fetching videos" },
      { status: 500 },
    );
  }
}
