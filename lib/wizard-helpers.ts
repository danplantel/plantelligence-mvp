import prisma from "@/lib/prisma";
import {
  WizardClientProfile,
  WizardTeamSize,
  WizardServices,
  WizardInsuranceLicensing,
  WizardTeamMembers,
  WizardBranding,
  WizardBenefitTypes,
  WizardEmployerScope,
  OrganizationType,
  TeamSize,
  ServiceType,
  LicenseType,
  BenefitType
} from "@/types/wizard";

export class WizardDataHelper {
  // Get wizard session for user
  static async getWizardSession(userId: string) {
    return prisma.wizardSession.findFirst({
      where: { userId, completed: false },
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
  }

  // Get specific step data
  static async getClientProfile(userId: string): Promise<WizardClientProfile | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.clientProfile) return null;
    
    return {
      ...session.clientProfile,
      organizationType: session.clientProfile.organizationType as any,
      customOrganization: session.clientProfile.customOrganization || undefined
    };
  }

  static async getTeamSize(userId: string): Promise<WizardTeamSize | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.teamSize) return null;
    
    return {
      ...session.teamSize,
      teamSize: session.teamSize.teamSize as any
    };
  }

  static async getServices(userId: string): Promise<WizardServices | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.services) return null;
    
    return {
      ...session.services,
      services: session.services.services as any
    };
  }

  static async getInsuranceLicensing(userId: string): Promise<WizardInsuranceLicensing | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.insuranceLicensing) return null;
    
    return {
      ...session.insuranceLicensing,
      licenseTypes: session.insuranceLicensing.licenseTypes as any,
      licenseNumbers: session.insuranceLicensing.licenseNumbers as any
    };
  }

  static async getTeamMembers(userId: string): Promise<WizardTeamMembers | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.teamMembers) return null;
    
    return {
      ...session.teamMembers,
      members: session.teamMembers.members as any
    };
  }

  static async getBranding(userId: string): Promise<WizardBranding | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.branding) return null;
    
    return {
      ...session.branding,
      logo: session.branding.logo || undefined,
      aiAvatar: session.branding.aiAvatar || undefined
    };
  }

  static async getBenefitTypes(userId: string): Promise<WizardBenefitTypes | null> {
    const session = await this.getWizardSession(userId);
    if (!session?.benefitTypes) return null;
    
    return {
      ...session.benefitTypes,
      benefitTypes: session.benefitTypes.benefitTypes as any,
      customBenefitType: session.benefitTypes.customBenefitType || undefined
    };
  }

  static async getEmployerScope(userId: string): Promise<WizardEmployerScope | null> {
    const session = await this.getWizardSession(userId);
    return session?.employerScope || null;
  }

  // Get specific fields
  static async getOrganizationType(userId: string): Promise<OrganizationType | null> {
    const clientProfile = await this.getClientProfile(userId);
    return clientProfile?.organizationType || null;
  }

  static async getTeamSizeValue(userId: string): Promise<TeamSize | null> {
    const teamSize = await this.getTeamSize(userId);
    return teamSize?.teamSize || null;
  }

  static async getServicesValue(userId: string): Promise<ServiceType[] | null> {
    const services = await this.getServices(userId);
    return services?.services || null;
  }

  static async doesUserOfferInsurance(userId: string): Promise<boolean> {
    const insurance = await this.getInsuranceLicensing(userId);
    return insurance?.offersInsurance || false;
  }

  static async getLicenseTypes(userId: string): Promise<LicenseType[] | null> {
    const insurance = await this.getInsuranceLicensing(userId);
    return insurance?.licenseTypes || null;
  }

  static async getStatesLicensed(userId: string): Promise<string[] | null> {
    const insurance = await this.getInsuranceLicensing(userId);
    return insurance?.statesLicensed || null;
  }

  static async getBrandColor(userId: string): Promise<string | null> {
    const branding = await this.getBranding(userId);
    return branding?.brandColor || null;
  }

  static async getSubdomain(userId: string): Promise<string | null> {
    const branding = await this.getBranding(userId);
    return branding?.subdomain || null;
  }

  static async getBenefitTypesValue(userId: string): Promise<BenefitType[] | null> {
    const benefitTypes = await this.getBenefitTypes(userId);
    return benefitTypes?.benefitTypes || null;
  }

  static async servesMultipleEmployers(userId: string): Promise<boolean> {
    const employerScope = await this.getEmployerScope(userId);
    return employerScope?.servesMultipleEmployers || false;
  }

  // Analytics and reporting
  static async getUsersByOrganizationType(orgType: OrganizationType) {
    return prisma.wizardClientProfile.findMany({
      where: { organizationType: orgType },
      include: {
        session: {
          include: { user: true }
        }
      }
    });
  }

  static async getUsersByTeamSize(teamSize: TeamSize) {
    return prisma.wizardTeamSize.findMany({
      where: { teamSize },
      include: {
        session: {
          include: { user: true }
        }
      }
    });
  }

  static async getUsersWithInsurance() {
    return prisma.wizardInsuranceLicensing.findMany({
      where: { offersInsurance: true },
      include: {
        session: {
          include: { user: true }
        }
      }
    });
  }

  static async getUsersByBenefitType(benefitType: BenefitType) {
    return prisma.wizardBenefitTypes.findMany({
      where: {
        benefitTypes: {
          has: benefitType
        }
      },
      include: {
        session: {
          include: { user: true }
        }
      }
    });
  }

  // Wizard progress
  static async getWizardProgress(userId: string) {
    const session = await this.getWizardSession(userId);
    if (!session) {
      return {
        currentStep: 1,
        completedSteps: 0,
        totalSteps: 9,
        isCompleted: false,
        progress: 0
      };
    }

    const completedSteps = [
      session.clientProfile,
      session.teamSize,
      session.services,
      session.insuranceLicensing,
      session.teamMembers,
      session.branding,
      session.benefitTypes,
      session.employerScope,
    ].filter(Boolean).length;

    return {
      currentStep: session.currentStep,
      completedSteps,
      totalSteps: 9,
      isCompleted: session.completed,
      progress: Math.round((completedSteps / 9) * 100)
    };
  }

  // Complete wizard
  static async completeWizard(userId: string) {
    const session = await prisma.wizardSession.findFirst({
      where: { userId, completed: false }
    });

    if (!session) {
      throw new Error("No active wizard session found");
    }

    return prisma.wizardSession.update({
      where: { id: session.id },
      data: {
        completed: true,
        updatedAt: new Date()
      }
    });
  }
}
