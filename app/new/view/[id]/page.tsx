"use client";

import { ClientPortal } from "@/components/pages/client-portal/client-portal";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useParams, useRouter } from "next/navigation";
import {
  getCategoryPortalVisibility,
  filterContactsByPortalVisibility,
} from "@/lib/portal-category-visibility";

export default function ViewClientPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;

  if (!clientData) {
    return null;
  }

  // Get heroTitle and heroDescription directly from clientData (now stored in Prisma)
  const heroTitle = clientData.heroTitle;
  const heroDescription = clientData.heroDescription;

  // Normalize keyContacts and filter by showOnPortal + category visibility (same logic as My Benefits Team)
  let visibleContacts: any[] = [];

  if (clientData.keyContacts) {
    if (Array.isArray(clientData.keyContacts)) {
      visibleContacts = clientData.keyContacts.filter(
        (contact: any) => contact.showOnPortal !== false,
      );
    } else if (
      typeof clientData.keyContacts === "object" &&
      clientData.keyContacts !== null
    ) {
      const keyContactsData = clientData.keyContacts as any;
      const contactsArray = Array.isArray(keyContactsData.contacts)
        ? keyContactsData.contacts
        : [];
      visibleContacts = contactsArray.filter(
        (contact: any) => contact.showOnPortal !== false,
      );
    }
  }

  // Same as My Benefits Team: hide contacts whose category is hidden in Edit Panel "Category Display"
  // Fallback: read from employeePortalPreview if top-level missing (e.g. after Complete Setup before Edit save)
  const rawVisibility =
    (clientData as any)?.categoryPortalVisibility ??
    clientData?.categoryPortalVisibility ??
    (typeof (clientData as any)?.employeePortalPreview === "object"
      ? (clientData as any).employeePortalPreview?.categoryPortalVisibility
      : undefined);
  const categoryVisibility = getCategoryPortalVisibility(rawVisibility);
  visibleContacts = filterContactsByPortalVisibility(
    visibleContacts,
    categoryVisibility,
  ) as any[];

  return (
    <>
      {/* Client Portal Content (without header - header is in layout) */}
      <ClientPortal
        data={{
          secondaryBannerImg: (clientData as { secondaryBannerImg?: string })
            .secondaryBannerImg,
          companyData: {
            companyName: clientData.companyName,
            companyWebsite: clientData.companyWebsite || "",
            companyLogo: clientData.companyLogo || "",
            logoFileName: clientData.logoFileName || "",
            brandColor: clientData.brandColor,
            secondaryColor: clientData.secondaryColor,
            missionHeadline: clientData.missionHeadline || "",
            missionBody: clientData.missionBody || "",
            appointmentLink: clientData.appointmentLink || "",
            backgroundImg: clientData.backgroundImg || "",
            backgroundImgName: clientData.backgroundImgName || "",
            thumbnailImg: (clientData as any).thumbnailImg || "",
            thumbnailImgName: (clientData as any).thumbnailImgName || "",
            disclaimers: clientData.disclaimers || "",
            heroTitle,
            heroDescription,
            // Banner Overlay Settings
            heroContainerOpacity: (clientData as any).heroContainerOpacity,
            heroContainerBackgroundOpacity: (clientData as any)
              .heroContainerBackgroundOpacity,
            heroContainerBlockOpacity: (clientData as any)
              .heroContainerBlockOpacity,
            heroCompanyNameColor: (clientData as any).heroCompanyNameColor,
            heroContainerInverted:
              (clientData as any).heroContainerInverted ?? false,
            heroBackgroundInverted:
              (clientData as any).heroBackgroundInverted ?? false,
            // Backward compatibility
            heroInverted: (clientData as any).heroInverted,
            heroOverlayOpacity: (clientData as any).heroOverlayOpacity,
            heroBackgroundOpacity: (clientData as any).heroBackgroundOpacity,
            heroUseGradient: (clientData as any).heroUseGradient,
            desktopHeroBackgroundPosition: (clientData as any).desktopHeroBackgroundPosition,
            mobileHeroBackgroundPosition: (clientData as any).mobileHeroBackgroundPosition,
          },
          keyContacts: visibleContacts,
          documents: (clientData as any).documents,
          employeePortalPreview: clientData.employeePortalPreview,
          categoryPortalVisibility: categoryVisibility,
        }}
        hideHeader={true}
        hideFooter={true}
        clientId={clientId}
      />
    </>
  );
}
