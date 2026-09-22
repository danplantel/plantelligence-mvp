import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { ObjectId } from "mongodb";
import { listClientSlugs, releaseClientSlug } from "@/lib/slug-registry";

/**
 * GET    /api/clients/{idOrSlug}/slugs          → all slugs (current + aliases)
 * DELETE /api/clients/{idOrSlug}/slugs?slug=…   → release a retired alias
 *
 * Registry-backed so the Edit Plan UI can show the plan's previous portal URLs
 * and let the advisor explicitly release one (freeing it for other plans).
 */

/** Resolve a client by ObjectId or slug, scoped to the session user. */
async function resolveOwnedClient(idOrSlug: string, userId: string) {
  let client = ObjectId.isValid(idOrSlug)
    ? await prisma.client.findUnique({ where: { id: idOrSlug } })
    : null;
  if (!client) {
    client = await prisma.client.findFirst({
      where: { slug: idOrSlug, userId },
    });
  }
  if (!client || client.userId !== userId) return null;
  return client;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await resolveOwnedClient(params.id, session.user.id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const slugs = await listClientSlugs(client.id);
    return NextResponse.json({ success: true, slugs });
  } catch (error) {
    console.error("Error listing portal slugs:", error);
    return NextResponse.json(
      { error: "Failed to list portal slugs" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const slug = request.nextUrl.searchParams.get("slug")?.trim();
    if (!slug) {
      return NextResponse.json(
        { error: "Missing query parameter: slug" },
        { status: 400 },
      );
    }

    const client = await resolveOwnedClient(params.id, session.user.id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const released = await releaseClientSlug(client.id, slug);
    if (!released) {
      return NextResponse.json(
        { error: "Slug is not a releasable alias of this plan" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, released: slug });
  } catch (error) {
    console.error("Error releasing portal slug:", error);
    return NextResponse.json(
      { error: "Failed to release portal slug" },
      { status: 500 },
    );
  }
}
