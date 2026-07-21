"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import { VideoModal } from "@/components/video-modal";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { DocumentsSection } from "@/components/pages/client-portal/sections/documents-section";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import {
  RetirementJourneySection,
  JourneyVideo,
  FeaturedJourneyVideo,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";

export default function WellnessProgramsPage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [selectedVideo, setSelectedVideo] = useState<JourneyVideo | null>(null);
  const [dbVideos, setDbVideos] = useState<JourneyVideo[]>([]);
  const [dbFeaturedVideo, setDbFeaturedVideo] =
    useState<FeaturedJourneyVideo | null>(null);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  const categoryHeroBg = useMemo(
    () => getCategoryHeroBackgroundUrl(clientData ?? null),
    [clientData],
  );

  // Extract FAQs for this category from employeePortalPreview.benefits.
  const faqsForCategory = useMemo(() => {
    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const wellnessBenefit = benefits.find(
      (b: any) => b.category === "Company / Plan Sponsor",
    );
    const faqs = wellnessBenefit?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    const defaults = DEFAULT_FAQS["Company / Plan Sponsor"];
    if (defaults && defaults.length > 0) {
      return defaults as DynamicFAQItem[];
    }
    return undefined;
  }, [clientData?.employeePortalPreview]);

  // Resolve support contacts for this category.
  const supportContactsForFAQ = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    const benefits = (clientData as any)?.employeePortalPreview?.benefits ?? [];
    const wellnessBenefit = benefits.find(
      (b: any) => b.category === "Company / Plan Sponsor",
    );
    const rawSupportContacts = wellnessBenefit?.supportContacts;
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
    return benefits.find((b: any) => b.category === "Company / Plan Sponsor");
  }, [clientData?.employeePortalPreview]);

  const featuredVideo = {
    id: "wellness-programs-featured",
    title: "Whole-Person Wellness Programs",
    description:
      "Discover how your company supports every aspect of your wellbeing—from mental health resources and fitness challenges to financial coaching and personalized wellness journeys. Learn what's included and how to get started today.",
    thumbnail:
      "https://images.unsplash.com/photo-1528590316233-4c417adf211d?w=1600&q=80",
    duration: "10:45",
    rating: "4.7",
    category: "Wellbeing",
    embedUrl: "https://www.youtube.com/embed/YE7VzlLtp-4",
  };

  const wellnessVideos: JourneyVideo[] = [
    {
      id: "mental-health",
      title: "Mental Health Support Overview",
      thumbnail:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80",
      duration: "09:15",
      tag: "New",
    },
    {
      id: "fitness-stipend",
      title: "How to Use Your Fitness Stipend",
      thumbnail:
        "https://images.unsplash.com/photo-1571019613576-2b22c76fd955?w=400&q=80",
      duration: "07:50",
      tag: "Popular",
    },
    {
      id: "nutrition-coaching",
      title: "Nutrition Coaching Perks",
      thumbnail:
        "https://images.unsplash.com/photo-1467453678174-768ec283a940?w=400&q=80",
      duration: "08:40",
    },
  ];

  // Load videos from database for this page placement
  useEffect(() => {
    const fetchVideos = async () => {
      if (!clientId) return;

      try {
        const response = await fetch(
          `/api/videos/get-by-placement?pagePlacement=wellness-programs&clientId=${clientId}`,
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

  const mindfulnessVideos: JourneyVideo[] = [
    {
      id: "burnout-toolkit",
      title: "Burnout Recovery Toolkit",
      thumbnail:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=80",
      duration: "12:05",
      tag: "Essential",
    },
    {
      id: "guided-meditation",
      title: "10-Min Guided Meditation",
      thumbnail:
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80",
      duration: "10:00",
    },
    {
      id: "financial-wellness",
      title: "Financial Wellness Coaching",
      thumbnail:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80",
      duration: "11:35",
      tag: "Trending",
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
        category="Company / Plan Sponsor"
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
          category="Company / Plan Sponsor"
        />

        <RetirementJourneySection
          brandColor={brandColor}
          featuredVideo={featuredVideo}
          retirementVideos={wellnessVideos}
          planningVideos={mindfulnessVideos}
          onVideoClick={handleVideoClick}
          onFeaturedVideoClick={handleFeaturedVideoClick}
          dbVideos={dbVideos}
          dbFeaturedVideo={dbFeaturedVideo || undefined}
          mainTitle={benefitData?.title || "Whole-Person Wellness Programs"}
          subtitle="Supporting your health, mind, and financial well-being."
          description={benefitData?.shortDescription || "Your well-being goes beyond traditional benefits. Discover programs designed to support your physical, mental, and financial health—from fitness stipends and nutrition coaching to mental health resources and financial wellness tools. Thrive at work and at home."}
          firstCarouselTitle="Wellness Programs"
          secondCarouselTitle="Mindfulness & Well-being"
          backgroundImage={categoryHeroBg}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <FAQSection brandColor={brandColor} secondaryColor={secondaryColor} faqs={faqsForCategory} contacts={supportContactsForFAQ} />

        <PortalMaterialsHero brandColor={brandColor} />

        <DocumentsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
          documentHubCategory="Company / Plan Sponsor"
        />
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
