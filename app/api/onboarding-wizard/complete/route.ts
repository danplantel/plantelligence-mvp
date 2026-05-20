import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { completeWizardOnboarding } from "@/lib/wizard-completion";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { finalData } = await request.json();

    // Find the active wizard session
    const wizardSession = await prisma.wizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      include: {
        clientProfile: true,
        teamSize: true,
        services: true,
        insuranceLicensing: true,
        teamMembers: true,
        branding: true,
        benefitTypes: true,
        employerScope: true,
        userSetup: true,
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session" }, { status: 404 });
    }

    // Use the comprehensive wizard completion function to merge all wizard data into User
    console.log("🚀 Starting wizard completion for user:", session.user.id);
    console.log("📋 Wizard session ID:", wizardSession.id);
    
    const completionResult = await completeWizardOnboarding({
      userId: session.user.id,
      wizardSessionId: wizardSession.id,
    });
    
    console.log("✅ Wizard completion result:", completionResult);

    // Check if user wants to be saved as a contact for future plans
    if (finalData?.userSetup?.saveAsContact) {
      try {
        const userSetup = finalData.userSetup;

        // Prepare contact payload
        const contactPayload = {
          userId: session.user.id,
          name: userSetup.name,
          email: userSetup.email,
          phone: userSetup.phone,
          title: userSetup.title,
          headshot: userSetup.headshot,
          role: "Advisor/Specialist", // Default role for advisor
          displayScope: "futureUse",
          isPrimary: true, // Default to primary since it's the advisor
          // Add other fields if available
          firstName: userSetup.name.split(" ")[0],
          lastName: userSetup.name.split(" ").slice(1).join(" "),
        };

        // Check for duplicates before creating (simple check by email)
        const existingContact = await prisma.futureContact.findFirst({
          where: {
            userId: session.user.id,
            email: userSetup.email,
          },
        });

        if (!existingContact) {
          await prisma.futureContact.create({
            data: contactPayload,
          });
        }
      } catch (contactError) {
        console.error("Error saving advisor as contact:", contactError);
        // Don't fail the whole request if contact saving fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Wizard completed successfully",
      updatedFields: completionResult.updatedFields,
    });
  } catch (error) {
    console.error("Error completing wizard:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
