/**
 * Type-safe helpers for extracting benefit data from employeePortalPreview.
 * Used during the dual-write migration period while the data lives in both
 * the Benefit table and the employeePortalPreview JSON blob.
 */

export interface PortalBenefitData {
  id?: string;
  title?: string;
  category?: string;
  shortDescription?: string;
  journeyHeader?: string;
  journeySubtitle?: string;
  journeyBodyText?: string;
  planVideo?: string;
  planVideoFileName?: string;
  faqs?: any[];
  supportContacts?: any[];
  isEnabled?: boolean;
}

/**
 * Extracts a single benefit from the employeePortalPreview JSON blob.
 * Returns undefined if no matching category is found.
 */
export function getBenefitFromPreview(
  employeePortalPreview: unknown,
  category: string
): PortalBenefitData | undefined {
  if (!employeePortalPreview || typeof employeePortalPreview !== "object") {
    return undefined;
  }
  const ep = employeePortalPreview as Record<string, unknown>;
  const benefits = Array.isArray(ep.benefits) ? ep.benefits : [];
  return benefits.find(
    (b: Record<string, unknown>) => b.category === category
  ) as PortalBenefitData | undefined;
}

/**
 * Extracts the planVideo URL from a benefit, handling both raw R2 keys
 * and already-signed URLs. Returns undefined if no video is set.
 */
export function getPlanVideoUrl(benefit: PortalBenefitData | undefined): string | undefined {
  if (!benefit?.planVideo) return undefined;
  return benefit.planVideo;
}
