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
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { DocumentsSection } from "@/components/pages/client-portal/sections/documents-section";
import { CompletenessAutoTrigger } from "@/components/pages/client-portal/sections/completeness-auto-trigger";
import {
  HaveQuestionsSection,
  ContactInfo,
} from "@/components/pages/client-portal/sections/have-questions-section";
import { Mail } from "lucide-react";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { BenefitsFAQAccordion } from "@/components/pages/client-portal/sections/benefits-faq-accordion";
import {
  RetirementJourneySection,
  JourneyVideo,
  FeaturedJourneyVideo,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  tag?: string;
  description?: string;
}

export default function WellnessProgramsPage() {
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

  const featuredVideo = {
    id: "wellness-programs-featured",
    title: "Whole-Person Wellness Programs",
    description:
      "Discover how your company supports every aspect of your wellbeing—from mental health resources and fitness challenges to financial coaching and personalized wellness journeys. Learn what’s included and how to get started today.",
    thumbnail:
      "https://images.unsplash.com/photo-1528590316233-4c417adf211d?w=1600&q=80",
    duration: "10:45",
    rating: "4.7",
    category: "Wellbeing",
    embedUrl: "https://www.youtube.com/embed/YE7VzlLtp-4",
  };

  const wellnessVideos: VideoItem[] = [
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

  const mindfulnessVideos: VideoItem[] = [
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

  const handleVideoClick = (video: VideoItem) => {
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

  // Filter and map real contacts from database
  const contacts = useMemo(() => {
    const rawContacts = Array.isArray(clientData?.keyContacts)
      ? clientData?.keyContacts
      : (clientData?.keyContacts as any)?.contacts || [];

    // Filter contacts for this category
    const relevantContacts = rawContacts.filter((c: any) =>
      c.benefitsCategory === "Company / Plan Sponsor" ||
      c.benefitsCategories?.includes("Company / Plan Sponsor")
    );

    if (relevantContacts.length === 0) return undefined;

    return relevantContacts.map((c: any) => ({
      id: c.id,
      title: c.name || `${c.firstName} ${c.lastName}`,
      description: c.customRole || c.title || "Wellness Program Representative",
      icon: Mail,
      email: c.email,
      phone: c.phone,
      iconType: c.headshot ? "image" : undefined,
      iconSrc: c.headshot,
      iconAlt: c.name
    })) as ContactInfo[];
  }, [clientData?.keyContacts]);

  return (
    <div className="min-h-screen bg-black">
      <CompletenessAutoTrigger
        category="Company / Plan Sponsor"
        clientData={clientData}
        clientId={clientId}
      />
      <main>
        <PortalWelcomeBanner
          clientData={clientData}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
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
          mainTitle="Understanding Your Health Benefits"
          subtitle="Protect yourself and your family with comprehensive coverage."
          firstCarouselTitle="Health Plan Essentials"
          secondCarouselTitle="Insurance Benefits"
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
          items={[
            {
              id: "life-1",
              question: "What is life insurance?",
              answer:
                "Life insurance is a contract between an insurance company and a policyholder, where the insurer promises to pay a death benefit to named beneficiaries upon the death of the policyholder.",
              linkLabel: "View Life Insurance Benefits >>",
              linkHref: "/benefits/life-insurance",
            },
            {
              id: "life-2",
              question: "What is life insurance?",
              answer:
                "Life insurance is a contract between an insurance company and a policyholder, where the insurer promises to pay a death benefit to named beneficiaries upon the death of the policyholder.",
              linkLabel: "View Life Insurance Benefits >>",
              linkHref: "/benefits/life-insurance",
            },
            {
              id: "life-3",
              question: "What is life insurance?",
              answer:
                "Life insurance is a contract between an insurance company and a policyholder, where the insurer promises to pay a death benefit to named beneficiaries upon the death of the policyholder.",
              linkLabel: "View Life Insurance Benefits >>",
              linkHref: "/benefits/life-insurance",
            },
          ]}
          brandColor={brandColor}
          accentColor={secondaryColor}
        />

        <PortalMaterialsHero brandColor={brandColor} />

        <DocumentsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
          documentHubCategory="Company / Plan Sponsor"
        />

        <HaveQuestionsSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contacts={contacts}
          cardWidth="390px"
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
