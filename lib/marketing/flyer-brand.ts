/**
 * Co-brand snapshot for flyers: plan sponsor (Client) + broker organization (User).
 * Persisted on MarketingFlyer.brandSnapshot so rendered assets stay stable over time.
 */

import type { Client, User } from "@prisma/client";

export type FlyerBrandSnapshot = {
  sponsor: {
    companyName: string;
    brandColor: string;
    secondaryColor: string;
    companyLogo: string | null;
  };
  organization: {
    organizationType: string | null;
    name: string;
    advisorLogo: string | null;
    advisorLogoUrl: string | null;
  };
};

export function buildFlyerBrandSnapshot(
  client: Pick<
    Client,
    "companyName" | "brandColor" | "secondaryColor" | "companyLogo"
  >,
  user: Pick<
    User,
    "organizationType" | "name" | "advisorLogo" | "advisorLogoUrl"
  >,
): FlyerBrandSnapshot {
  return {
    sponsor: {
      companyName: client.companyName,
      brandColor: client.brandColor,
      secondaryColor: client.secondaryColor,
      companyLogo: client.companyLogo ?? null,
    },
    organization: {
      organizationType: user.organizationType ?? null,
      name: user.name,
      advisorLogo: user.advisorLogo ?? null,
      advisorLogoUrl: user.advisorLogoUrl ?? null,
    },
  };
}
