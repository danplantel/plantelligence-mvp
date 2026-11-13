import type { Metadata } from "next";
import { headers } from "next/headers";

import { PlatformLegalDocumentPage } from "@/components/legal/platform-legal-document-page";
import { platformPrivacyPolicy } from "@/lib/legal/content/platform-privacy-policy";
import { getMarketingPageOrigins } from "@/lib/marketing/host";

export function generateMetadata(): Metadata {
  // The page can be served on the marketing origin or the app origin (the
  // dashboard links to it). The canonical URL follows whichever origin served
  // the request, matching the marketing home page's behaviour.
  const { marketingOrigin } = getMarketingPageOrigins(headers());

  return {
    metadataBase: new URL(marketingOrigin),
    title: "Privacy Policy | PlanTelligence",
    description:
      "How PlanTelligence collects, uses, discloses, and protects information through the Platform, administrative dashboard, and related services.",
    alternates: { canonical: "/legal/privacy" },
    robots: { index: true, follow: true },
  };
}

export default function PlatformPrivacyPolicyPage() {
  return (
    <PlatformLegalDocumentPage
      doc="privacy"
      markdown={platformPrivacyPolicy}
    />
  );
}
