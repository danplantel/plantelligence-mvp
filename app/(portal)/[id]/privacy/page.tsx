import type { Metadata } from "next";

import { PortalLegalDocumentPage } from "@/components/legal/portal-legal-document-page";
import { benefitsHubPrivacyPolicy } from "@/lib/legal/content/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for this PlanTelligence-powered Benefits Hub, including how information is collected, used, and shared.",
};

export default function PrivacyPolicyPage() {
  return (
    <PortalLegalDocumentPage
      doc="privacy"
      markdown={benefitsHubPrivacyPolicy}
    />
  );
}
