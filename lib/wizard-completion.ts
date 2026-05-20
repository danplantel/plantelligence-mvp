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
        disclaimers: true,
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
    
    // Client Profile data (Step 1)
    if (wizardSession.clientProfile) {
      // User.company stores the organization type (e.g., "independent", "ria")
      updateData.company = wizardSession.clientProfile.organizationType;
      
      // User.customOrganization stores the free-text description when "other" is selected
      if (wizardSession.clientProfile.customOrganization) {
        updateData.customOrganization = wizardSession.clientProfile.customOrganization;
        console.log("📋 Setting customOrganization:", updateData.customOrganization);
      }
      
      console.log("📋 Setting company:", updateData.company);
    }

    // Team Size data (Step 1B)
    if (wizardSession.teamSize) {
      updateData.teamSize = wizardSession.teamSize.teamSize;
      console.log("📋 Setting teamSize:", updateData.teamSize);
    }
    
    // Branding data (Step 3)
    if (wizardSession.branding) {
      // Logo
      if (wizardSession.branding.logo) {
        updateData.advisorLogo = wizardSession.branding.logo;
        updateData.advisorLogoUrl = wizardSession.branding.logo;
      }
      // Organization name
      if (wizardSession.branding.organizationName) {
        updateData.organizationName = wizardSession.branding.organizationName;
      }
      // Website
      if (wizardSession.branding.website) {
        updateData.website = wizardSession.branding.website;
      }
      // Brand color
      if (wizardSession.branding.brandColor) {
        updateData.brandColor = wizardSession.branding.brandColor;
      }
      // Primary color
      if (wizardSession.branding.primaryColor) {
        updateData.primaryColor = wizardSession.branding.primaryColor;
      }
      // Secondary color
      if (wizardSession.branding.secondaryColor) {
        updateData.secondaryColor = wizardSession.branding.secondaryColor;
      }
      // Subdomain
      if (wizardSession.branding.subdomain) {
        updateData.subdomain = wizardSession.branding.subdomain;
      }
      // Background image
      if (wizardSession.branding.backgroundImage) {
        updateData.backgroundImage = wizardSession.branding.backgroundImage;
      }
      // AI Avatar
      if (wizardSession.branding.aiAvatar) {
        updateData.aiAvatar = wizardSession.branding.aiAvatar;
      }
      console.log("📋 Setting branding data:", {
        hasLogo: !!wizardSession.branding.logo,
        hasOrganizationName: !!wizardSession.branding.organizationName,
        hasWebsite: !!wizardSession.branding.website,
        hasBrandColor: !!wizardSession.branding.brandColor,
        hasPrimaryColor: !!wizardSession.branding.primaryColor,
        hasSecondaryColor: !!wizardSession.branding.secondaryColor,
        hasSubdomain: !!wizardSession.branding.subdomain,
        hasBackgroundImage: !!wizardSession.branding.backgroundImage,
        hasAiAvatar: !!wizardSession.branding.aiAvatar,
      });
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
    // Priority: WizardUserSetup.primaryServiceCategories (synced from Step 2) > WizardServices.services (converted)
    let resolvedCategories: string[] = [];

    // First, try WizardUserSetup.primaryServiceCategories (synced from Step 2 via saveStepData)
    if (wizardSession.userSetup) {
      const userSetupCategories = (wizardSession.userSetup as any).primaryServiceCategories;
      if (Array.isArray(userSetupCategories) && userSetupCategories.length > 0) {
        resolvedCategories = userSetupCategories;
        console.log("📋 Using primaryServiceCategories from WizardUserSetup:", resolvedCategories);
      }
    }

    // Fallback: convert WizardServices.services to categories
    if (resolvedCategories.length === 0 && wizardSession.services) {
      const rawServices = wizardSession.services.services;
      console.log("📋 Raw WizardServices.services value:", JSON.stringify(rawServices), "type:", typeof rawServices);
      
      // Handle both array and potential string/other formats from MongoDB
      let servicesArray: string[] = [];
      if (Array.isArray(rawServices)) {
        servicesArray = rawServices;
      } else if (typeof rawServices === 'string') {
        // Handle case where MongoDB might return a single string
        servicesArray = [rawServices];
      } else if (rawServices && typeof rawServices === 'object' && Array.isArray((rawServices as any).values)) {
        // Handle case where services might be wrapped in an object
        servicesArray = (rawServices as any).values;
      }
      
      if (servicesArray.length > 0) {
        const categories = step2ServicesToCategories(servicesArray);
        if (categories.length > 0) {
          resolvedCategories = categories;
          console.log("📋 Converted primaryServiceCategories from WizardServices:", resolvedCategories);
        }
      }
    }

    if (resolvedCategories.length > 0) {
      updateData.primaryServiceCategories = resolvedCategories;
    }

    // User Setup data (Step 4) - name, phone, title, etc.
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
      // Headshot
      if (wizardSession.userSetup.headshot) {
        updateData.headshot = wizardSession.userSetup.headshot;
      }
      // Background image from user setup
      if (wizardSession.userSetup.backgroundImage) {
        updateData.backgroundImage = wizardSession.userSetup.backgroundImage;
      }
      // Designations
      if (wizardSession.userSetup.designations && Array.isArray(wizardSession.userSetup.designations) && wizardSession.userSetup.designations.length > 0) {
        updateData.designations = wizardSession.userSetup.designations;
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
      // Verify user exists before update
      const userCheck = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!userCheck) {
        console.error("❌ User not found in completeWizardOnboarding for ID:", userId);
        throw new Error(`User record not found for ID: ${userId}`);
      }
      console.log("✅ User exists in database, proceeding with update");
      
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
      console.log("✅ User updated successfully with fields:", Object.keys(updateData));
    } else {
      console.log("⚠️ No data to update for user");
    }

    // Delete all wizard step records associated with this session
    // Data has been transferred to the User object above, so these are no longer needed
    console.log("🗑️ Cleaning up wizard step records for session:", wizardSessionId);
    
    const stepModels = [
      { name: "WizardClientProfile", record: wizardSession.clientProfile },
      { name: "WizardTeamSize", record: wizardSession.teamSize },
      { name: "WizardServices", record: wizardSession.services },
      { name: "WizardInsuranceLicensing", record: wizardSession.insuranceLicensing },
      { name: "WizardTeamMembers", record: wizardSession.teamMembers },
      { name: "WizardBranding", record: wizardSession.branding },
      { name: "WizardBenefitTypes", record: wizardSession.benefitTypes },
      { name: "WizardEmployerScope", record: wizardSession.employerScope },
      { name: "WizardUserSetup", record: wizardSession.userSetup },
      { name: "WizardDisclaimers", record: wizardSession.disclaimers },
    ];

    for (const step of stepModels) {
      if (step.record) {
        try {
          await (prisma as any)[step.name].delete({
            where: { id: (step.record as any).id }
          });
          console.log(`🗑️ Deleted ${step.name} record:`, (step.record as any).id);
        } catch (deleteError) {
          console.error(`⚠️ Failed to delete ${step.name} record:`, deleteError);
        }
      }
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

    console.log("✅ Wizard completion cleanup finished successfully");

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