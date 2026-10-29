import type { Metadata } from "next";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";

import { MarketingPage } from "@/components/marketing/marketing-page";
import { MARKETING_HERO } from "@/config/marketing";
import { authOptions } from "@/lib/auth-options";
import { getMarketingPageOrigins } from "@/lib/marketing/host";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  // The page advertises the origin that served it (plantel.pro,
  // dev.plantel.pro, localhost); only the marketing host keeps plantel.ai as
  // its canonical URL.
  const { marketingOrigin: site } = getMarketingPageOrigins(headers());

  return {
    metadataBase: new URL(site),
    title: "PlanTelligence | Benefits communication, end to end",
    description: MARKETING_HERO.description,
    keywords: [
      "benefits communication",
      "employee benefits portal",
      "retirement plan portal",
      "group health benefits",
      "benefits administration",
      "participant portal",
    ],
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      url: site,
      siteName: "PlanTelligence",
      title: "PlanTelligence | Benefits communication, end to end",
      description: MARKETING_HERO.description,
    },
    twitter: {
      card: "summary_large_image",
      title: "PlanTelligence | Benefits communication, end to end",
      description: MARKETING_HERO.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function MarketingHomePage() {
  const { appOrigin, marketingOrigin } = getMarketingPageOrigins(headers());
  const session = await getServerSession(authOptions);

  return (
    <MarketingPage
      appOrigin={appOrigin}
      marketingOrigin={marketingOrigin}
      isSignedIn={Boolean(session?.user)}
    />
  );
}
