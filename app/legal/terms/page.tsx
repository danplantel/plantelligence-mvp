import type { Metadata } from "next";
import { headers } from "next/headers";

import { PlatformLegalDocumentPage } from "@/components/legal/platform-legal-document-page";
import { platformTermsOfService } from "@/lib/legal/content/platform-terms-of-service";
import { getMarketingPageOrigins } from "@/lib/marketing/host";

export function generateMetadata(): Metadata {
  // The page can be served on the marketing origin or the app origin (the
  // dashboard links to it). The canonical URL follows whichever origin served
  // the request, matching the marketing home page's behaviour.
  const { marketingOrigin } = getMarketingPageOrigins(headers());

  return {
    metadataBase: new URL(marketingOrigin),
    title: "Terms of Service | PlanTelligence",
    description:
      "Terms governing access to and use of the PlanTelligence platform, administrative dashboard, and related services.",
    alternates: { canonical: "/legal/terms" },
    robots: { index: true, follow: true },
  };
}

export default function PlatformTermsOfServicePage() {
  return (
    <PlatformLegalDocumentPage
      doc="terms"
      markdown={platformTermsOfService}
    />
  );
}
