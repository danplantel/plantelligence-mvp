"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import { VideoModal } from "@/components/video-modal";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions-faq";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import {
  RetirementJourneySection,
  JourneyVideo,
  FeaturedJourneyVideo,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import {
  RetirementDocumentsAccordion,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { DocumentsSection } from "@/components/pages/client-portal/sections/documents-section";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";

const LIFE_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Group Life");

export default function LifeInsurancePage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [selectedVideo, setSelectedVideo] = useState<JourneyVideo | null>(null);
  const [dbVideos, setDbVideos] = useState<JourneyVideo[]>([]);
  const [dbFeaturedVideo, setDbFeaturedVideo] =
    useState<FeaturedJourneyVideo | null>(null);
  const [lifeDocs, setLifeDocs] = useState<RetirementDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  const categoryHeroBg = useMemo(
    () => getCategoryHeroBackgroundUrl(clientData ?? null),
    [clientData],
  );

  /** Re-merge documents when embedded list ids change — avoids re-fetching on every clientData reference churn. */
  const documentsSig = useMemo(() => {
    const d = clientData?.documents;
    if (!Array.isArray(d)) return "";
    return `${d.length}:${d
      .map((x: { id?: string }) => String(x?.id ?? ""))
      .sort()
      .join(",")}`;
  }, [clientData?.documents]);

  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;

  // Fetch life insurance plan documents
  useEffect(() => {
    if (!clientId) {
      setLoadingDocs(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingDocs(true);
        const apiRows = await fetchPlanDocumentsForClient(clientId);
        if (cancelled) return;

        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];

        const mergedRaw = mergePlanDocumentRows(
          apiRows as unknown[],
          embedded as unknown[],
        );
        setLifeDocs(
          mapMergedRowsToBenefitHubItems(
            mergedRaw as Record<string, unknown>[],
            LIFE_DOCUMENT_HUB,
          ),
        );
      } catch (error) {
        console.error("Error fetching life insurance documents:", error);
        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];
        setLifeDocs(
          mapMergedRowsToBenefitHubItems(
            mergePlanDocumentRows([], embedded as unknown[]),
            LIFE_DOCUMENT_HUB,
          ),
        );
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, documentsSig]);

  // Extract FAQs for this category from employeePortalPreview.benefits.
  // Falls back to Group Life-specific defaults when no custom FAQs are saved yet.
  const faqsForCategory = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const lifeBenefit = benefits.find(
      (b: any) => b.category === "Group Life",
    );
    const faqs = lifeBenefit?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    // Fall back to default Group Life FAQs when no custom ones are saved
    const defaults = DEFAULT_FAQS["Group Life"];
    if (defaults && defaults.length > 0) {
      return defaults as DynamicFAQItem[];
    }
    return undefined;
  }, [clientData?.employeePortalPreview]);

  // Resolve support contacts from the benefit's supportContacts (selected in wizard Step 3).
  const supportContactsForFAQ = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const lifeBenefit = benefits.find(
      (b: any) => b.category === "Group Life",
    );
    const rawSupportContacts = lifeBenefit?.supportContacts;
    if (!Array.isArray(rawSupportContacts)) return undefined;

    const enabled = rawSupportContacts.filter((sc: any) => sc.enabled !== false);
    if (enabled.length === 0) return undefined;

    return enabled.map((sc: any) => {
      const matched = rawContacts.find((c: any) => c.id === sc.contactId);
      return {
        id: sc.contactId,
        title: sc.title || matched?.name || `${matched?.firstName ?? ""} ${matched?.lastName ?? ""}`.trim() || "Support Contact",
        description: sc.description || matched?.customRole || matched?.title || "",
        email: matched?.email || "",
        phone: matched?.phone || "",
        phoneExtension: matched?.phoneExtension,
        headshot: matched?.headshot || undefined,
      } as FAQContact;
    });
  }, [clientData?.employeePortalPreview, clientData?.keyContacts]);

  // Extract benefit data (benefitTitle, shortDescription) for this category
  const benefitData = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    return benefits.find((b: any) => b.category === "Group Life");
  }, [clientData?.employeePortalPreview]);

  const featuredVideo: FeaturedJourneyVideo = {
    id: "life-insurance-featured",
    title: "Life Insurance: Protecting What Matters Most",
    description:
      "Understanding life insurance doesn't have to be complicated. This comprehensive guide covers the basics of term vs. whole life insurance, how much coverage you need, and how to make the right choice for your family's financial security.",
    thumbnail:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80",
    duration: "15:45",
    rating: "4.9",
    category: "Essential",
    embedUrl: "https://www.youtube.com/embed/ysz5S6PUM-U?rel=0",
  };

  const retirementVideos: JourneyVideo[] = [
    {
      id: "life-insurance-basics",
      title: "Life Insurance Do's & Don'ts",
      thumbnail:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80",
      duration: "11:20",
      tag: "Essential",
    },
    {
      id: "term-vs-whole",
      title: "Term vs. Whole Life: Which is Right for You?",
      thumbnail:
        "https://images.unsplash.com/photo-1554224311-beee910c1b8a?w=400&q=80",
      duration: "13:30",
      tag: "Popular",
    },
    {
      id: "coverage-calculator",
      title: "How Much Life Insurance Do You Need?",
      thumbnail:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80",
      duration: "9:45",
      tag: "New",
    },
  ];

  // Load videos from database for this page placement
  useEffect(() => {
    const fetchVideos = async () => {
      if (!clientId) return;

      try {
        const response = await fetch(
          `/api/videos/get-by-placement?pagePlacement=life-insurance&clientId=${clientId}`,
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.videos) {
            setDbVideos(data.videos);
            if (data.featuredVideo) {
              setDbFeaturedVideo(data.featuredVideo);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching videos:", error);
      }
    };

    fetchVideos();
  }, [clientId]);

  const planningVideos: JourneyVideo[] = [
    {
      id: "beneficiary-basics",
      title: "Choosing and Updating Beneficiaries",
      thumbnail:
        "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80",
      duration: "8:30",
    },
    {
      id: "estate-planning",
      title: "Life Insurance and Estate Planning",
      thumbnail:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80",
      duration: "16:20",
      tag: "Expert",
    },
    {
      id: "claims-process",
      title: "Understanding the Claims Process",
      thumbnail:
        "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=80",
      duration: "12:15",
    },
  ];

  const handleVideoClick = (video: JourneyVideo) => {
    setSelectedVideo({
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      description: video.description,
    });
  };

  const handleFeaturedVideoClick = () => {
    setSelectedVideo({
      id: featuredVideo.id,
      title: featuredVideo.title,
      thumbnail: featuredVideo.thumbnail,
      duration: featuredVideo.duration,
      description: featuredVideo.description,
    });
  };

  const closeModal = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen w-full">
      <CompletenessAutoTrigger
        category="Group Life"
        clientData={clientData}
        clientId={clientId}
      />
      <main className="w-full">
        <PortalWelcomeBanner
          clientData={clientData}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          customHeadline={benefitData?.title}
          customDescription={benefitData?.shortDescription}
          category="Group Life"
        />

        <RetirementJourneySection
          brandColor={brandColor}
          featuredVideo={featuredVideo}
          retirementVideos={retirementVideos}
          planningVideos={planningVideos}
          onVideoClick={handleVideoClick}
          onFeaturedVideoClick={handleFeaturedVideoClick}
          dbVideos={dbVideos}
          dbFeaturedVideo={dbFeaturedVideo || undefined}
          mainTitle={benefitData?.journeyHeader || benefitData?.title || "Life Insurance: Protecting What Matters Most"}
          subtitle={benefitData?.journeySubtitle || "Secure your family's financial future with the right coverage."}
          description={benefitData?.journeyBodyText || benefitData?.shortDescription || "Protect what matters most. Our life insurance resources help you understand your coverage options and ensure your loved ones are financially secure, no matter what life brings. Explore term life, whole life, and supplemental coverage tailored to your needs."}
          firstCarouselTitle="Life Insurance Essentials"
          secondCarouselTitle="Beneficiaries & Estate Planning"
          backgroundImage={categoryHeroBg}
          backgroundImageAlt="Life insurance and financial planning"
          planVideoUrl={(benefitData as any)?.planVideo}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero brandColor={brandColor} cardHeading="Group Life Insurance Account Access" category="Group Life" />

        <RetirementDocumentsAccordion
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={lifeDocs}
          title="Life Insurance Documents & Forms"
          description="Access all your important life insurance plan documents, forms, and notices in one convenient location."
          accordionHeaderTitle="Life Insurance Documents"
          loading={loadingDocs}
        />

        <HaveQuestions brandColor={brandColor} secondaryColor={secondaryColor} contacts={supportContactsForFAQ} />
      </main>

      <VideoModal
        isOpen={!!selectedVideo}
        onClose={closeModal}
        videoTitle={selectedVideo?.title || ""}
        videoDescription={selectedVideo?.description}
      />
    </div>
  );
}
