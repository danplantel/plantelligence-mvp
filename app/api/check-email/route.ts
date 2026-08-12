// app/api/check-email/route.ts
// GET /api/check-email?email=foo@example.com
// Public endpoint used by the signup form to check whether an email is already registered.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json(
      { error: "Missing or invalid email parameter" },
      { status: 400 },
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    });

    return NextResponse.json({
      exists: Boolean(existing),
      available: !existing,
    });
  } catch (error) {
    console.error("Error checking email availability:", error);
    return NextResponse.json(
      { error: "Failed to check email availability" },
      { status: 500 },
    );
  }
}
