"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
import { useParams } from "next/navigation";
import { VideoModal } from "@/components/video-modal";
import { InteractiveTools } from "@/components/interactive-tools";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions-faq";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import {
  RetirementJourneySection,
  JourneyVideo,
  FeaturedJourneyVideo,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import {
  RetirementDocumentsAccordion,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";
import { mergePlanDocumentRows } from "@/lib/plan-client-documents-merge";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";

/** Same hub label as Create Benefits → Retirement card (`resolvePersistedDocumentCategory("Document", "Retirement")`). */
const RETIREMENT_DOCUMENT_HUB = benefitCategoryToDocumentHubLabel("Retirement");

export default function RetirementPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [selectedVideo, setSelectedVideo] = useState<JourneyVideo | null>(null);
  const [retirementDocs, setRetirementDocs] = useState<
    RetirementDocumentItem[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [dbVideos, setDbVideos] = useState<JourneyVideo[]>([]);
  const [dbFeaturedVideo, setDbFeaturedVideo] =
    useState<FeaturedJourneyVideo | null>(null);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  const categoryHeroBg = useMemo(
    () => getCategoryHeroBackgroundUrl(clientData ?? null),
    [clientData],
  );

  // Extract benefit data (benefitTitle, shortDescription) for this category
  const benefitData = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    return benefits.find((b: any) => b.category === "Retirement");
  }, [clientData?.employeePortalPreview]);

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

  // Extract FAQs for this category from employeePortalPreview.benefits.
  // Falls back to Retirement-specific defaults when no custom FAQs are saved yet.
  const faqsForCategory = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const retirementBenefit = benefits.find(
      (b: any) => b.category === "Retirement",
    );
    const faqs = retirementBenefit?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    // Fall back to default Retirement FAQs when no custom ones are saved
    const defaults = DEFAULT_FAQS["Retirement"];
    if (defaults && defaults.length > 0) {
      return defaults as DynamicFAQItem[];
    }
    return undefined;
  }, [clientData?.employeePortalPreview]);

  // Resolve support contacts from the benefit's supportContacts (selected in wizard Step 3).
  // Cross-references contactId with keyContacts for email/phone/headshot.
  // Returns undefined when no support contacts are selected — hides the card entirely.
  const supportContactsForFAQ = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const retirementBenefit = benefits.find(
      (b: any) => b.category === "Retirement",
    );
    const rawSupportContacts = retirementBenefit?.supportContacts;
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

  // Same data as Benefits Step 4: GET /api/documents/client + embedded docs from context (already loaded by ClientPortalProvider — no duplicate GET /api/clients). Deduped fetch shared with CompletenessAutoTrigger.
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
        setRetirementDocs(
          mapMergedRowsToBenefitHubItems(
            mergedRaw as Record<string, unknown>[],
            RETIREMENT_DOCUMENT_HUB,
          ),
        );
      } catch (error) {
        console.error("Error fetching retirement documents:", error);
        const embeddedDocs = clientDataRef.current?.documents;
        const embedded = Array.isArray(embeddedDocs) ? embeddedDocs : [];
        setRetirementDocs(
          mapMergedRowsToBenefitHubItems(
            mergePlanDocumentRows([], embedded as unknown[]),
            RETIREMENT_DOCUMENT_HUB,
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

  // Load videos from database for this page placement
  useEffect(() => {
    const fetchVideos = async () => {
      if (!clientId) return;

      try {
        const response = await fetch(
          `/api/videos/get-by-placement?pagePlacement=retirement&clientId=${clientId}`,
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

  const featuredVideo: FeaturedJourneyVideo = {
    id: "retirement-journey-featured",
    title: "Your Retirement Journey Starts Here",
    description:
      "This comprehensive video walks you through the key features of your retirement plan—how it works, why it matters, and how to make the most of it. Whether you're just getting started or looking to fine-tune your savings strategy, this is your starting point for building a more secure financial future.",
    thumbnail:
      "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80",
    duration: "8:30",
    rating: "4.9",
    category: "Getting Started",
    embedUrl: "https://www.youtube.com/embed/ysz5S6PUM-U?rel=0",
  };

  const retirementVideos: JourneyVideo[] = [
    {
      id: "charting-course",
      title: "Charting Your Course: Financial Planning",
      thumbnail:
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80",
      duration: "18:30",
      tag: "New",
    },
    {
      id: "should-i-stay",
      title: "Should I Stay or Should I Go: Rollovers",
      thumbnail:
        "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&q=80",
      duration: "15:20",
    },
    {
      id: "market-volatility",
      title: "Market Volatility Mayhem",
      thumbnail:
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80",
      duration: "22:15",
      tag: "Expert",
    },
    {
      id: "social-security",
      title: "Social Security Benefits: What You Need to Know",
      thumbnail:
        "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&q=80",
      duration: "16:45",
    },
    {
      id: "annuities-deal",
      title: "What's the Deal with Annuities?",
      thumbnail:
        "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&q=80",
      duration: "14:30",
    },
    {
      id: "roth-traditional",
      title: "Roth vs Traditional: Which is Right for You?",
      thumbnail:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80",
      duration: "12:45",
      tag: "Popular",
    },
  ];

  const planningVideos: JourneyVideo[] = [
    {
      id: "understanding-inflation",
      title: "Understanding Inflation: The Price is Wrong",
      thumbnail:
        "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80",
      duration: "13:15",
      tag: "Trending",
    },
    {
      id: "cant-retire",
      title: "Top 5 Reasons People Can't Retire",
      thumbnail:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80",
      duration: "17:30",
      tag: "Popular",
    },
  ];

  const handleVideoClick = (video: JourneyVideo) => {
    setSelectedVideo(video);
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
        category="Retirement"
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
          category="Retirement"
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
          mainTitle={benefitData?.journeyHeader || benefitData?.title || "Your Retirement Journey Starts Here"}
          subtitle={benefitData?.journeySubtitle || "Build your future with confidence."}
          description={benefitData?.journeyBodyText || benefitData?.shortDescription || "Take control of your financial future with our comprehensive retirement planning resources. Whether you're just starting your career or preparing for the next chapter, we provide the tools and guidance you need to build a secure retirement."}
          backgroundImage={categoryHeroBg}
          planVideoUrl={(benefitData as any)?.planVideo}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero brandColor={brandColor} cardHeading="Retirement Plan Account Access" category="Retirement" />

        <RetirementDocumentsAccordion
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={retirementDocs}
          title="Retirement Plan Documents & Forms"
          description="Access all your important retirement plan documents, forms, and notices in one convenient location."
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
