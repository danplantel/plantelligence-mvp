import type {
  BrandImagesData,
  CompanyBasicsData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";

const emptyBrandImages = (): BrandImagesData => ({
  header: null,
  thumbnail: null,
  secondaryBanner: null,
  favicon: null,
});

type ProfileLike = {
  company?: string | null;
  name?: string | null;
  advisorLink?: string | null;
  additionalAdvisorLink?: string | null;
  wizardSessions?: Array<{
    branding?: { primaryColor?: string; secondaryColor?: string } | null;
  }>;
};

/**
 * Fills empty plan-level fields from GET /api/profile for a new Create Plan session.
 * Does not copy advisor logo or advisor hero into Step 1 company branding — those assets
 * are used for **benefits-category** flows (e.g. seeded key contacts / category hub preview),
 * not the plan’s Company Logo or Background Header Image.
 */
export function mergeAdvisorProfileIntoWizardStepData(
  stepData: Record<string, unknown>,
  profile: ProfileLike,
): Record<string, unknown> {
  const existing = (stepData.companyBasics || {}) as Partial<CompanyBasicsData>;
  const brandImages: BrandImagesData = {
    ...emptyBrandImages(),
    ...existing.brandImages,
  };

  const cb: Partial<CompanyBasicsData> = { ...existing, brandImages };

  // Do not prefill Benefits Hub / plan companyName from profile.company (often "Independent"
  // or org-type placeholder). Advisors enter the client plan name explicitly on Step 1.

  if (!cb.companyWebsite?.trim()) {
    const link =
      (profile.advisorLink && profile.advisorLink.trim()) ||
      (profile.additionalAdvisorLink && profile.additionalAdvisorLink.trim()) ||
      "";
    if (link) cb.companyWebsite = link;
  }

  const wsExisting = (stepData.welcomeStatement || {}) as Partial<WelcomeStatementData>;
  const welcomeStatement: WelcomeStatementData = {
    headline: wsExisting.headline ?? "",
    bodyText: wsExisting.bodyText ?? "",
    isAIGenerated: wsExisting.isAIGenerated ?? false,
    advisorName: wsExisting.advisorName,
    advisorAvatar: wsExisting.advisorAvatar ?? null,
  };
  if (!welcomeStatement.advisorName?.trim() && profile.name?.trim()) {
    welcomeStatement.advisorName = profile.name.trim();
  }

  return {
    ...stepData,
    companyBasics: { ...cb } as CompanyBasicsData,
    welcomeStatement,
  };
}
