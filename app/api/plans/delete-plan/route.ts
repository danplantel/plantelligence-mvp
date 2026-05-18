import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      throw new Error("Auth required");
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "id is missing" }, { status: 400 });
    }

    const idQuery = /^\d+$/g.test(id)
      ? {
          idIndex: +id,
          user: {
            email: session?.user?.email || "",
          },
        }
      : {
          id: new ObjectId(id) as any,
          user: {
            email: session?.user?.email || "",
          },
        };

    const plan = await prisma.plan.delete({
      where: idQuery,
    });

    return NextResponse.json({
      message: "Delete plan successfully!",
    });
  } catch (error) {
    console.error("Error Api", request.nextUrl.pathname, error);
    return NextResponse.json(
      {
        message: "Delete plan failed!",
      },
      { status: 500 },
    );
  }
}
