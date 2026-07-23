/** Stock hero for category subpages when the plan has no custom background (used to detect “real” vs default). */
export const DEFAULT_CATEGORY_SECTION_BG = "/Hiking-Couple-Looking.webp";

/** Stock beach image when plan has no custom welcome/category background. */
export const DEFAULT_WELCOME_BG =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=2400&q=80";

function onboardingBgFromClient(clientData: {
  employeePortalPreview?: any;
} | null): string {
  const preview = clientData?.employeePortalPreview;
  const flat = preview?.previewData ?? preview ?? {};
  const v = flat.onboardingCategoryBackgroundImage;
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Hero behind video / journey blocks on category subpages (Retirement, Health, Life, …).
 * Priority: employeePortalPreview onbaording → backgroundImg (wizard upload) → secondaryBannerImg → default.
 */
export function getCategoryHeroBackgroundUrl(
  clientData: {
    employeePortalPreview?: any;
    secondaryBannerImg?: string | null;
    backgroundImg?: string | null;
  } | null,
): string {
  const onboarding = onboardingBgFromClient(clientData);
  if (onboarding) return onboarding;
  const main = (clientData?.backgroundImg || "").trim();
  if (main) return main;
  const secondary = (clientData?.secondaryBannerImg || "").trim();
  if (secondary) return secondary;
  return DEFAULT_CATEGORY_SECTION_BG;
}

/**
 * Welcome banner on hub + category pages.
 * Priority: employeePortalPreview onboarding → backgroundImg (wizard upload) → secondaryBannerImg → default.
 */
export function getPortalWelcomeBackgroundUrl(
  clientData: {
    employeePortalPreview?: any;
    secondaryBannerImg?: string | null;
    backgroundImg?: string | null;
  } | null,
): string {
  const onboarding = onboardingBgFromClient(clientData);
  if (onboarding) return onboarding;
  const main = (clientData?.backgroundImg || "").trim();
  if (main) return main;
  const secondary = (clientData?.secondaryBannerImg || "").trim();
  if (secondary) return secondary;
  return DEFAULT_WELCOME_BG;
}
