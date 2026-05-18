import prisma from "@/lib/prisma";
import { step2ServicesToCategories } from "@/lib/service-categories";

export interface WizardCompletionData {
  userId: string;
  wizardSessionId: string;
}

export async function completeWizardOnboarding({ userId, wizardSessionId }: WizardCompletionData) {
  try {
    // Get the wizard session with all related data
    const wizardSession = await prisma.wizardSession.findUnique({
      where: { id: wizardSessionId },
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
      throw new Error("Wizard session not found");
    }

    // Prepare user update data
    const updateData: any = {};
    
    // Client Profile data
    if (wizardSession.clientProfile) {
      updateData.company = wizardSession.clientProfile.organizationType;
      if (wizardSession.clientProfile.customOrganization) {
        updateData.customOrganization = wizardSession.clientProfile.customOrganization;
      }
    }
    
    // Branding data - only logo is stored in User table
    // Other fields (organizationName, website, missionStatement, brandColor, subdomain)
    // remain in WizardBranding table and can be accessed via wizardSessions relation
    if (wizardSession.branding) {
      updateData.advisorLogo = wizardSession.branding.logo;
      updateData.advisorLogoUrl = wizardSession.branding.logo;
    }

    // Team Members data (first admin member becomes advisor)
    if (wizardSession.teamMembers?.members) {
      const members = wizardSession.teamMembers.members as any[];
      const adminMember = members.find((member: any) => member.isAdmin);
      if (adminMember) {
        updateData.advisorName = adminMember.name;
        updateData.advisorEmail = adminMember.email;
        updateData.advisorPhone = adminMember.phone;
      }
    }

    // Services data (Step 2) -> primaryServiceCategories for User profile (same labels as Settings)
    if (wizardSession.services?.services?.length) {
      const categories = step2ServicesToCategories(wizardSession.services.services);
      if (categories.length) {
        updateData.primaryServiceCategories = categories;
      }
    }

    // Insurance Licensing data
    if (wizardSession.insuranceLicensing?.offersInsurance) {
      updateData.insuranceLicensing = true;
      if (wizardSession.insuranceLicensing.licenseTypes?.length) {
        updateData.licenseTypes = wizardSession.insuranceLicensing.licenseTypes.join(',');
      }
      if (wizardSession.insuranceLicensing.statesLicensed?.length) {
        updateData.statesLicensed = wizardSession.insuranceLicensing.statesLicensed.join(',');
      }
    }

    // Employer Scope data
    if (wizardSession.employerScope?.servesMultipleEmployers) {
      updateData.servesMultipleEmployers = true;
    }

    // Team Size data
    if (wizardSession.teamSize?.teamSize) {
      updateData.teamSize = wizardSession.teamSize.teamSize;
    }

    // Benefit Types data
    if (wizardSession.benefitTypes?.benefitTypes?.length) {
      updateData.benefitTypes = wizardSession.benefitTypes.benefitTypes.join(',');
    }

    // Update user with all collected data
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    }

    // Mark wizard session as completed
    await prisma.wizardSession.update({
      where: { id: wizardSessionId },
      data: {
        completed: true,
        currentStep: 5,
        updatedAt: new Date(),
      }
    });

    // Mark all other incomplete sessions as completed
    await prisma.wizardSession.updateMany({
      where: {
        userId: userId,
        completed: false,
        id: { not: wizardSessionId }
      },
      data: {
        completed: true,
        updatedAt: new Date(),
      }
    });

    return {
      success: true,
      message: "Wizard completed successfully",
      updatedFields: Object.keys(updateData)
    };

  } catch (error) {
    console.error("Error completing wizard:", error);
    throw error;
  }
}