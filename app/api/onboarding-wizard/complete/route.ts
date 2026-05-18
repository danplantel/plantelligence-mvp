import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { finalData } = await request.json();

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
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session" }, { status: 404 });
    }

    await prisma.wizardSession.update({
      where: { id: wizardSession.id },
      data: {
        completed: true,
        currentStep: 10,
        updatedAt: new Date(),
      }
    });

    await prisma.wizardSession.updateMany({
      where: {
        userId: session.user.id,
        completed: false,
        id: { not: wizardSession.id }
      },
      data: {
        completed: true,
        updatedAt: new Date(),
      }
    });

    if (finalData) {
      const updateData: any = {};

      if (wizardSession.clientProfile) {
        updateData.company = wizardSession.clientProfile.organizationType;
      }

      if (wizardSession.branding) {
        updateData.advisorLogo = wizardSession.branding.logo;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: updateData
        });
      }
    }

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
        } else {
          // Optional: Update existing contact if needed, or skip
          // For now, we'll skip to avoid overwriting custom data
        }
      } catch (contactError) {
        console.error("Error saving advisor as contact:", contactError);
        // Don't fail the whole request if contact saving fails
      }
    }

    try {
      const storedUserSetup = await prisma.wizardUserSetup.findUnique({
        where: { sessionId: wizardSession.id },
      });
      if (storedUserSetup) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            phone: storedUserSetup.phone || null,
            phoneExtension: storedUserSetup.phoneExtension ?? null,
          } as any,
        });
      }
    } catch (syncError) {
      console.error("Error syncing user phone from wizard user setup:", syncError);
    }

    return NextResponse.json({
      success: true,
      message: "Wizard completed successfully"
    });
  } catch (error) {
    console.error("Error completing wizard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
