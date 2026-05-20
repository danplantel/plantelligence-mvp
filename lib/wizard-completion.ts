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
        userSetup: true,
      }
    });

    if (!wizardSession) {
      throw new Error("Wizard session not found");
    }
    
    console.log("🔍 Wizard Session loaded:", {
      id: wizardSession.id,
      userId: wizardSession.userId,
      hasClientProfile: !!wizardSession.clientProfile,
      hasTeamSize: !!wizardSession.teamSize,
      hasServices: !!wizardSession.services,
      hasTeamMembers: !!wizardSession.teamMembers,
      hasBranding: !!wizardSession.branding,
      hasUserSetup: !!wizardSession.userSetup,
    });

    // Prepare user update data
    const updateData: any = {};
    
    // Client Profile data - only company field exists in User model
    if (wizardSession.clientProfile) {
      updateData.company = wizardSession.clientProfile.organizationType;
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
    if (wizardSession.services) {
      console.log("🔍 WizardServices found:", wizardSession.services);
      const servicesArray = Array.isArray(wizardSession.services.services)
        ? wizardSession.services.services
        : [];
      console.log("📋 Services array:", servicesArray);
      
      if (servicesArray.length > 0) {
        const categories = step2ServicesToCategories(servicesArray);
        console.log("🏷️ Converted categories:", categories);
        if (categories.length) {
          updateData.primaryServiceCategories = categories;
        }
      }
    }

    // User Setup data (Step 4) - overwrites services categories if provided
    if (wizardSession.userSetup) {
      if (wizardSession.userSetup.name) {
        updateData.name = wizardSession.userSetup.name;
      }
      if (wizardSession.userSetup.phone) {
        updateData.phone = wizardSession.userSetup.phone;
      }
      if (wizardSession.userSetup.phoneExtension) {
        updateData.phoneExtension = wizardSession.userSetup.phoneExtension;
      }
      if (wizardSession.userSetup.title) {
        updateData.title = wizardSession.userSetup.title;
      }
      // Use userSetup categories if available, otherwise use services categories
      if (wizardSession.userSetup.primaryServiceCategories?.length) {
        updateData.primaryServiceCategories = wizardSession.userSetup.primaryServiceCategories;
      }
    }
    
    // Note: The following wizard data is NOT stored in User model but remains in wizard tables:
    // - WizardTeamSize (teamSize) - stored in WizardTeamSize table
    // - WizardInsuranceLicensing (offersInsurance, licenseTypes, statesLicensed) - stored in WizardInsuranceLicensing table
    // - WizardEmployerScope (servesMultipleEmployers) - stored in WizardEmployerScope table
    // - WizardBenefitTypes (benefitTypes) - stored in WizardBenefitTypes table
    // These can be accessed via the wizardSessions relation when needed

    // Update user with all collected data
    console.log("📊 Final updateData to save to User:", updateData);
    console.log("📊 Updated fields:", Object.keys(updateData));
    
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
      console.log("✅ User updated successfully with fields:", Object.keys(updateData));
    } else {
      console.log("⚠️ No data to update for user");
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