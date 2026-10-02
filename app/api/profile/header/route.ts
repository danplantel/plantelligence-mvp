import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { getR2ObjectProxyUrl, toR2BrandingKey } from "@/lib/branding-image-url";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/header
 *
 * The dashboard header (user-nav) displays a name, an email, a title and an
 * avatar, and it used to read all four from GET /api/profile — a route that
 * carries the wizard sessions (branding + userSetup, and via
 * `getEffectiveWizardUserSetup` up to 30 more userSetup rows) and takes seconds
 * on every dashboard page.
 *
 * This returns the same four values from two narrow selects, and hands back an
 * already-presigned avatar URL so the image can load straight from R2 rather than
 * being streamed through `/api/r2/object` (measured at ~5.5s for one headshot).
 * `avatarFallbackUrl` carries the proxy path for setups where a presigned URL
 * won't render, so the client can fall back instead of losing the image.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [user, latestSession, teammateProfile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, title: true, headshot: true },
      }),
      prisma.wizardSession.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          branding: { select: { aiAvatar: true } },
          userSetup: {
            select: { name: true, email: true, title: true, headshot: true },
          },
        },
      }),
      /**
       * The caller's own seat in somebody else's organization, when they hold one.
       *
       * An invited teammate's `User` row is created by the acceptance flow from a name, an
       * email and a password — nothing else — so `User.headshot` and `User.title` are null for
       * them, and they have no wizard session either. Their details do exist, on the
       * `TeammateProfile` the seat was granted from (the Key Contact's headshot and job title,
       * mirrored onto the profile), and that is what People & Access renders them from. The
       * header was reading only the first two sources, so those four fields came back empty and
       * the avatar fell through to a monogram.
       *
       * Deliberately the EARLIEST profile, matching `findTeammateOrganizationId`'s
       * `orderBy: { createdAt: "asc" }`: if a person somehow holds more than one, the one the
       * rest of the app treats as theirs is the one that names them here.
       */
      prisma.teammateProfile.findFirst({
        where: { loginUserId: userId },
        orderBy: { createdAt: "asc" },
        select: { headshot: true, jobTitle: true },
      }),
    ]);

    const setup = latestSession?.userSetup ?? null;

    // Same precedence the header previously applied to the full profile payload,
    // so what it displays is unchanged.
    const name = setup?.name || user?.name || session.user.name || "";
    const email = setup?.email || user?.email || session.user.email || "";
    // `jobTitle` is the seat record's name for the same field the User row calls `title`.
    const title = setup?.title || user?.title || teammateProfile?.jobTitle || "";

    // The teammate profile sits LAST of the editable sources and ahead of the session: it is
    // the organization's record of the person, so a headshot they set themselves (which writes
    // `User.headshot`) must win, but it must beat an empty `User` row and a null session image —
    // which is exactly the invited teammate's situation.
    const rawAvatar =
      latestSession?.branding?.aiAvatar ||
      setup?.headshot ||
      user?.headshot ||
      teammateProfile?.headshot ||
      session.user.image ||
      null;

    const avatarKey = toR2BrandingKey(rawAvatar);
    let avatarUrl: string | null = rawAvatar;
    let avatarFallbackUrl: string | null = null;

    if (avatarKey) {
      // Mirrors /api/r2/signed-url: only sign objects under this user's prefix.
      const ownedByUser = avatarKey.startsWith(`org/${userId}/`);
      avatarFallbackUrl = getR2ObjectProxyUrl(avatarKey);
      avatarUrl =
        ownedByUser && isR2Configured()
          ? await getPresignedReadUrl({ key: avatarKey })
          : null;
    }

    return NextResponse.json({
      success: true,
      data: { name, email, title, avatarUrl, avatarFallbackUrl },
    });
  } catch (error) {
    console.error("Error fetching header profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
