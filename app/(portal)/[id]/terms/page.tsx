import type { Metadata } from "next";

import { PortalLegalDocumentPage } from "@/components/legal/portal-legal-document-page";
import { benefitsHubTermsOfService } from "@/lib/legal/content/terms-of-service";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for this PlanTelligence-powered Benefits Hub, including the scope, limitations, and responsibilities that apply to the Portal.",
};

export default function TermsOfServicePage() {
  return (
    <PortalLegalDocumentPage
      doc="terms"
      markdown={benefitsHubTermsOfService}
    />
  );
}
