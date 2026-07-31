import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deletePlansAndScopedDataForUser } from "@/lib/delete-user-plans-and-scoped-data";

/**
 * DELETE /api/profile/delete
 * Deletes the authenticated user's profile and all associated data.
 * This is irreversible.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 0. Delete MarketingAsset records FIRST — they reference both User and Client,
    //    so they must be cleared before either parent can be deleted.
    await prisma.marketingAsset.deleteMany({ where: { userId } });

    // 1. Delete plans and scoped data (clients, documents, meetings, etc.)
    await deletePlansAndScopedDataForUser(userId);

    // 2. Delete wizard session data — use $transaction to ensure atomicity
    const wizardSessionIds = (
      await prisma.wizardSession.findMany({
        where: { userId },
        select: { id: true },
      })
    ).map((s) => s.id);

    if (wizardSessionIds.length > 0) {
      await Promise.all([
        prisma.wizardUserSetup.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardBranding.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardClientProfile.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardTeamSize.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardServices.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardInsuranceLicensing.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardTeamMembers.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardDisclaimers.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardEmployerScope.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
        prisma.wizardBenefitTypes.deleteMany({ where: { sessionId: { in: wizardSessionIds } } }),
      ]);
      await prisma.wizardSession.deleteMany({ where: { userId } });
    }

    // 3. Delete remaining user-scoped data (MarketingAsset already handled above)
    await Promise.allSettled([
      prisma.meetingCustomType.deleteMany({ where: { userId } }),
      prisma.futureContact.deleteMany({ where: { userId } }),
      prisma.headshot.deleteMany({ where: { userId } }),
    ]);

    // 4. Delete the user account itself
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return NextResponse.json(
      {
        error:
          "Failed to delete profile. " +
          (error instanceof Error ? error.message : ""),
      },
      { status: 500 },
    );
  }
}
