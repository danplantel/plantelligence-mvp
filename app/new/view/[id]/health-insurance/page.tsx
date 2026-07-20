"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useClientPortal } from "@/contexts/client-portal-context";
import { VideoCarousel } from "@/components/video-carousel";
import { VideoModal } from "@/components/video-modal";
import { InteractiveTools } from "@/components/interactive-tools";
import { FAQSection } from "@/components/faq-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, Star } from "lucide-react";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { BenefitsFAQAccordion } from "@/components/pages/client-portal/sections/benefits-faq-accordion";
import {
  RetirementJourneySection,
  JourneyVideo,
  FeaturedJourneyVideo,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { HaveQuestionsSection } from "@/components/pages/client-portal/sections/have-questions-section";
import { DocumentsSection } from "@/components/pages/client-portal/sections/documents-section";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  tag?: string;
  description?: string;
}

export default function HealthInsurancePage() {
  const { clientData } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [dbVideos, setDbVideos] = useState<JourneyVideo[]>([]);
  const [dbFeaturedVideo, setDbFeaturedVideo] =
    useState<FeaturedJourneyVideo | null>(null);

  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  const categoryHeroBg = useMemo(
    () => getCategoryHeroBackgroundUrl(clientData ?? null),
    [clientData],
  );

  // Filter and map real contacts from database
  const contacts = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    // Filter contacts for this category
    const relevantContacts = rawContacts.filter((c: any) =>
      c.benefitsCategory === "Group Health" ||
      c.benefitsCategories?.includes("Group Health")
    );

    if (relevantContacts.length === 0) return undefined;

    return relevantContacts.map((c: any) => ({
      id: c.id,
      title: c.name || `${c.firstName} ${c.lastName}`,
      description: c.customRole || c.title || "Health Benefits Representative",
      icon: Play, // Default icon
      email: c.email,
      phone: c.phone,
      iconType: c.headshot ? "image" : undefined,
      iconSrc: c.headshot,
      iconAlt: c.name
    })) as any[];
  }, [clientData?.keyContacts]);

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
          customHeadline="Health Insurance Hub"
          customDescription={[
            "Your health benefits are a vital part of your overall well-being, and we're committed to helping you make the most of them. Your company has partnered with us to ensure you have access to clear information, dependable coverage, and the support you need to navigate your medical, dental, and vision benefits with confidence.",
            "Our goal is simple - to give you the tools, guidance, and resources to protect your health and your family's well-being throughout the year.",
          ]}
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
          backgroundImage={categoryHeroBg}
        />

        <HowCanWeHelpSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
        />

        <BenefitsFAQAccordion
          title="Frequently Asked Questions"
          subtitle="Get quick answers to common benefits questions"
          items={healthFaqItems}
          brandColor={brandColor}
          accentColor={secondaryColor}
        />

        <PortalMaterialsHero brandColor={brandColor} />

        <DocumentsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
          documentHubCategory="Group Health"
        />

        <HaveQuestionsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contacts={contacts}
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

export type FaqItemWithLink = {
  id: string;
  question: string;
  answer: string;
  linkLabel: string;
  linkHref: string;
};

const healthFaqItems: FaqItemWithLink[] = [
  {
    id: "health-coverage",
    question: "What does my health insurance cover?",
    answer:
      "Review your full benefits and cost details in your plan’s Summary of Benefits and Coverage:",
    linkLabel: "View Benefits Summary (SBC) >>",
    linkHref: "/benefits/summary", // placeholder
  },
  {
    id: "enroll-or-change",
    question: "How do I enroll or make changes?",
    answer:
      "You can enroll or update your coverage during open enrollment or after a qualifying life event using your benefits portal:",
    linkLabel: "Go to Benefits Portal >>",
    linkHref: "/benefits/portal",
  },
  {
    id: "in-network-provider",
    question: "How do I find an in-network doctor or specialist?",
    answer:
      "Use your insurance carrier’s provider directory to search for in-network doctors, hospitals, urgent care, and specialists:",
    linkLabel: "Search for Providers >>",
    linkHref: "/benefits/providers",
  },
  {
    id: "digital-id-card",
    question: "Where can I view my digital ID card?",
    answer:
      "Most carriers provide instant access to your digital ID card in your online member account or app:",
    linkLabel: "Download Digital ID Card >>",
    linkHref: "/benefits/id-card",
  },
  {
    id: "deductible-copay-coins",
    question:
      "What’s the difference between a deductible, copay, and coinsurance?",
    answer: "View your personalized cost-sharing details online:",
    linkLabel: "Check My Plan Costs >>",
    linkHref: "/benefits/costs",
  },
  {
    id: "bill-after-visit",
    question: "Why did I receive a bill after visiting the doctor?",
    answer:
      "Compare the bill with your Explanation of Benefits (EOB) from your carrier:",
    linkLabel: "Review Claims & EOBs >>",
    linkHref: "/benefits/claims-eobs",
  },
  {
    id: "preventive-services",
    question: "Do preventive services cost anything?",
    answer:
      "Preventive care is usually covered at 100 percent in-network. Confirm what’s covered under your plan:",
    linkLabel: "See Preventive Services List >>",
    linkHref: "/benefits/preventive-services",
  },
  {
    id: "prescription-covered",
    question: "How do I check if a prescription is covered?",
    answer: "Look up your prescription drug coverage and pricing here:",
    linkLabel: "Check Prescription Coverage >>",
    linkHref: "/benefits/prescriptions",
  },
  {
    id: "add-remove-dependents",
    question: "How do I add or remove dependents?",
    answer: "You can update dependents through your benefits portal:",
    linkLabel: "Manage Dependents >>",
    linkHref: "/benefits/dependents",
  },
];
