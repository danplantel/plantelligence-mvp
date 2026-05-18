import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { deletePlansAndScopedDataForUser } from "@/lib/delete-user-plans-and-scoped-data";
import { resetOnboardingWizardData } from "@/lib/reset-onboarding-wizard-data";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    let deletePlansAndScopedData = false;
    try {
      const body = await request.json();
      deletePlansAndScopedData = Boolean(
        body?.deletePlansAndScopedData === true,
      );
    } catch {
      // Empty or invalid JSON body — treat as onboarding-only reset
    }

    if (deletePlansAndScopedData) {
      await deletePlansAndScopedDataForUser(userId);
    }

    await resetOnboardingWizardData(userId);

    return NextResponse.json({
      success: true,
      message: deletePlansAndScopedData
        ? "Onboarding and plans reset successfully"
        : "Onboarding data reset successfully",
      redirectUrl: "/new/onboarding",
      deletePlansAndScopedData,
    });
  } catch (error) {
    console.error("Error resetting onboarding:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
