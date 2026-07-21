"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import { VideoModal } from "@/components/video-modal";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import {
  RetirementJourneySection,
  JourneyVideo,
  FeaturedJourneyVideo,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { DocumentsSection } from "@/components/pages/client-portal/sections/documents-section";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";

export default function HealthInsurancePage() {
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
    const healthBenefit = benefits.find(
      (b: any) => b.category === "Group Health",
    );
    const faqs = healthBenefit?.faqs;
    if (faqs && Array.isArray(faqs)) {
      const enabled = faqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    const defaults = DEFAULT_FAQS["Group Health"];
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
    const healthBenefit = benefits.find(
      (b: any) => b.category === "Group Health",
    );
    const rawSupportContacts = healthBenefit?.supportContacts;
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
    return benefits.find((b: any) => b.category === "Group Health");
  }, [clientData?.employeePortalPreview]);

  const featuredVideo: FeaturedJourneyVideo = {
    id: "health-insurance-featured",
    title: "Understanding Your Health Benefits",
    description:
      "Navigate your health insurance options with confidence. This comprehensive guide covers everything from plan types and coverage options to maximizing your benefits and understanding costs. Make informed decisions about your healthcare coverage.",
    thumbnail:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
    duration: "12:15",
    rating: "4.8",
    category: "Essential",
    embedUrl: "https://www.youtube.com/embed/ysz5S6PUM-U?rel=0",
  };

  const retirementVideos: JourneyVideo[] = [
    {
      id: "hdhp-hsa",
      title: "HDHP + HSA: High-Deductible Health Plans Explained",
      thumbnail:
        "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&q=80",
      duration: "14:30",
      tag: "Popular",
    },
    {
      id: "plan-comparison",
      title: "Comparing Health Plan Options",
      thumbnail:
        "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80",
      duration: "16:45",
      tag: "New",
    },
    {
      id: "preventive-care",
      title: "Maximizing Your Preventive Care Benefits",
      thumbnail:
        "https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=400&q=80",
      duration: "11:20",
    },
  ];

  // Load videos from database for this page placement
  useEffect(() => {
    const fetchVideos = async () => {
      if (!clientId) return;

      try {
        const response = await fetch(
          `/api/videos/get-by-placement?pagePlacement=health-insurance&clientId=${clientId}`,
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
      id: "life-insurance",
      title: "Life Insurance Do's & Don'ts",
      thumbnail:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80",
      duration: "11:20",
      tag: "Essential",
    },
    {
      id: "medicare-101",
      title: "Medicare 101: The Basics",
      thumbnail:
        "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80",
      duration: "19:45",
      tag: "New",
    },
    {
      id: "disability-insurance",
      title: "Understanding Disability Insurance",
      thumbnail:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80",
      duration: "13:30",
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
        category="Group Health"
        clientData={clientData}
        clientId={clientId}
      />
      <main className="w-full">
        <PortalWelcomeBanner
          clientData={clientData}
          brandColor={brandColor}
          customHeadline={benefitData?.title}
          customDescription={benefitData?.shortDescription}
          category="Group Health"
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
          mainTitle={benefitData?.title || "Understanding Your Health Benefits"}
          subtitle="Navigate your coverage with confidence."
          description={benefitData?.shortDescription || "Your health and well-being are our priority. Explore our health insurance resources to understand your coverage options, maximize your benefits, and make informed decisions about your medical, dental, and vision care for you and your family."}
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
          documentHubCategory="Group Health"
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

