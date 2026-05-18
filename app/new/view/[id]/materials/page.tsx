"use client";

import { useClientPortal } from "@/contexts/client-portal-context";
import { WebinarsDashboard } from "@/components/pages/client-portal/sections/webinars-dashboard";
import { useParams } from "next/navigation";
import { DocumentsSection } from "@/components/pages/client-portal/sections/documents-section";
import { HaveQuestionsSection } from "@/components/pages/client-portal/sections/have-questions-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";

export default function MaterialsPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  return (
    <div className="min-h-screen bg-white">
      <main>
        <PortalMaterialsHero brandColor={brandColor} />

        {/* Documents Section - Using WebinarsDashboard component */}
        <DocumentsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
        />

        <HaveQuestionsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
        />
      </main>
    </div>
  );
}
