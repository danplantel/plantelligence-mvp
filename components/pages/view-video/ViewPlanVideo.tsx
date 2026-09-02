"use client";

import { Icons } from "@/components/icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { recordKeepers, videos } from "@/constants/data";
import { useEducationPlans } from "@/lib/education-video";
import type { IPlan } from "@/types/schema";
import { ExternalLinkIcon, PersonIcon } from "@radix-ui/react-icons";
import axios from "axios";
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { FileIcon, KeyIcon, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams } from "next/navigation";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";

interface VideoItem {
  videoUrl?: string;
  title: string;
  image: string;
  data: Array<{
    icon?: React.ElementType;
    title: string;
    subTitle: string;
    email?: string;
    website?: string;
    phone: string;
    planId?: string;
    image: string;
  }>;
}

interface CurrentVideo {
  id?: string;
  title?: string;
  videoUrl?: string;
  clientColor?: string;
  logo?: string;
  status?: string;
  companyName?: string;
  advisorName?: string;
  advisorTitle?: string;
  advisorImage?: string;
  resources: Array<{
    title: string;
    url: string;
    subTitle: string;
    email?: string;
    phone: string;
    image: string;
    icon: React.ElementType;
  }>;
}

interface EducationPlanItem {
  value: string;
  label: string;
  image: string;
  videoUrl?: string;
  icon?: string;
  placeholderTitle?: string;
  subLabel?: string;
}

// Define listEducationPlans directly in this file instead of importing it
const listEducationPlans = [
  {
    value: "top5Reasons",
    label: "The Top 5 Reasons People Can't Retire",
    image: "/content-library/Top5ReasonsPeopleDontSave.png",
    videoUrl:
      "https://waypoint-bucket.s3.us-east-2.amazonaws.com/top-5-reasons.mp4",
  },
  {
    value: "rothOrTraditional",
    label: "Roth vs. Traditional",
    image: "/content-library/TheDecision.png",
  },
  {
    value: "rolloversOrDistributions",
    label: "Rollovers or Distributions",
    image: "/content-library/ShouldIStay.png",
  },
  {
    value: "socialSecurityBenefits",
    label: "Social Security Benefits",
    image: "/content-library/SocialSecurity.png",
  },
  {
    value: "lifeInsurance",
    label: "Life Insurance",
    image: "/content-library/life-insurance.png",
  },
  {
    value: "chartingYourCourse",
    label: "Charting Your Course",
    image: "/content-library/charting-your-course.png",
  },
  {
    value: "medicare101",
    label: "Medicare 101",
    image: "/content-library/medicare-101.png",
  },
  {
    value: "priceIsWrong",
    label: "The Price is Wrong",
    image: "/content-library/ThePriceisWrong.png",
  },
  {
    value: "makingBudget",
    label: "Making a Budget",
    image: "/content-library/budget.jpg",
  },
  {
    value: "basicInvestment",
    label: "Investment Principles",
    image: "/content-library/investment.jpg",
  },
  {
    value: "debtManagement",
    label: "Debt Management",
    image: "/content-library/debt.jpg",
  },
  {
    value: "iras",
    label: "IRAs vs Plan Accounts",
    image: "/content-library/iras.jpg",
  },
  {
    value: "retirementPlanLoans",
    label: "Plan Loans",
    image: "/content-library/loans.jpg",
  },
  {
    value: "socialSecurityBasics",
    label: "Social Security",
    image: "/content-library/social-security.jpg",
  },
  {
    value: "retirementIncome",
    label: "Retirement Income",
    image: "/content-library/retirement-income.jpg",
  },
  {
    value: "understandingFees",
    label: "Understanding Fees",
    image: "/content-library/fees.jpg",
  },
  {
    value: "employerMatch",
    label: "Employer Match",
    image: "/content-library/employer-match.jpg",
  },
  {
    value: "hardshipWithdrawals",
    label: "Hardship Withdrawals",
    image: "/content-library/hardship.jpg",
  },
  {
    value: "requiredDistributions",
    label: "Required Distributions",
    image: "/content-library/distributions.jpg",
  },
  {
    value: "catchUpContributions",
    label: "Catch-Up Contributions",
    image: "/content-library/catch-up.jpg",
  },
  {
    value: "retirementMilestones",
    label: "Retirement Milestones",
    image: "/content-library/milestones.jpg",
  },
  {
    value: "taxStrategies",
    label: "Tax Strategies",
    image: "/content-library/tax.jpg",
  },
  {
    value: "healthSavings",
    label: "Health Savings Accounts",
    image: "/content-library/hsa.jpg",
  },
  {
    value: "estatePlanning",
    label: "Estate Planning",
    image: "/content-library/estate.jpg",
  },
];

// Shapes for the stylized image
const shapes = [
  {
    width: 655,
    height: 680,
    path: "M537.827 9.245A11.5 11.5 0 0 1 549.104 0h63.366c7.257 0 12.7 6.64 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 586.87 151h-28.275a15.999 15.999 0 0 0-15.689 12.862l-59.4 297c-1.98 9.901 5.592 19.138 15.689 19.138h17.275l.127.001c.85.009 1.701.074 2.549.009 11.329-.874 21.411-7.529 24.88-25.981.002-.012.016-.016.023-.007.008.009.022.005.024-.006l24.754-123.771A11.5 11.5 0 0 1 580.104 321h63.366c7.257 0 12.7 6.639 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 617.87 472H559c-22.866 0-28.984 7.98-31.989 25.931-.004.026-.037.035-.052.014-.015-.02-.048-.013-.053.012l-24.759 123.798A11.5 11.5 0 0 1 490.87 631h-29.132a14.953 14.953 0 0 0-14.664 12.021c-4.3 21.502-23.18 36.979-45.107 36.979H83.502c-29.028 0-50.8-26.557-45.107-55.021l102.4-512C145.096 91.477 163.975 76 185.902 76h318.465c10.136 0 21.179-5.35 23.167-15.288l10.293-51.467Zm-512 160A11.5 11.5 0 0 1 37.104 160h63.366c7.257 0 12.7 6.639 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 74.87 311H11.504c-7.257 0-12.7-6.639-11.277-13.755l25.6-128Z",
  },
  {
    width: 719,
    height: 680,
    path: "M89.827 9.245A11.5 11.5 0 0 1 101.104 0h63.366c7.257 0 12.7 6.64 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 138.87 151H75.504c-7.257 0-12.7-6.639-11.277-13.755l25.6-128Zm-64 321A11.5 11.5 0 0 1 37.104 321h63.366c7.257 0 12.7 6.639 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 74.87 472H11.504c-7.257 0-12.7-6.639-11.277-13.755l25.6-128ZM526.795 470a15.999 15.999 0 0 0-15.689 12.862l-32.032 160.159c-4.3 21.502-23.18 36.979-45.107 36.979H115.502c-29.028 0-50.8-26.557-45.107-55.021l102.4-512C177.096 91.477 195.975 76 217.902 76h318.465c29.028 0 50.8 26.557 45.107 55.021l-33.768 168.841c-1.98 9.901 5.592 19.138 15.689 19.138h17.075l.127.001c.85.009 1.701.074 2.549.009 11.329-.874 21.411-7.529 24.88-25.981.002-.012.016-.016.023-.007.008.009.022.005.024-.006l24.754-123.771A11.5 11.5 0 0 1 644.104 160h63.366c7.257 0 12.7 6.639 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 681.87 311H623c-22.866 0-28.984 7.98-31.989 25.931-.004.026-.037.035-.052.014-.015-.02-.048-.013-.053.012l-24.759 123.798A11.5 11.5 0 0 1 554.87 470h-28.075Z",
  },
  {
    width: 719,
    height: 680,
    path: "M632.827 9.245A11.5 11.5 0 0 1 644.104 0h63.366c7.257 0 12.7 6.64 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 681.87 151h-28.275a15.999 15.999 0 0 0-15.689 12.862l-95.832 479.159c-4.3 21.502-23.18 36.979-45.107 36.979H178.502c-29.028 0-50.8-26.557-45.107-55.021l102.4-512C240.096 91.477 258.975 76 280.902 76h318.465c10.136 0 21.179-5.35 23.167-15.288l10.293-51.467Zm0 479A11.5 11.5 0 0 1 644.104 479h63.366c7.257 0 12.7 6.639 11.277 13.755l-25.6 128A11.5 11.5 0 0 1 681.87 630h-63.366c-7.257 0-12.7-6.639-11.277-13.755l25.6-128ZM37.104 159a11.5 11.5 0 0 0-11.277 9.245l-25.6 128C-1.196 303.361 4.247 310 11.504 310H74.87a11.5 11.5 0 0 0 11.277-9.245l24.76-123.798a.03.03 0 0 1 .052-.012c.015.021.048.012.052-.014C114.016 158.98 120.134 151 143 151h58.87a11.5 11.5 0 0 0 11.277-9.245l25.6-128C240.17 6.64 234.727 0 227.47 0h-63.366a11.5 11.5 0 0 0-11.277 9.245l-24.754 123.771c-.002.011-.016.015-.024.006-.007-.009-.021-.005-.023.007-3.469 18.452-13.551 25.107-24.88 25.981-.848.065-1.699 0-2.549-.009l-.127-.001H37.104Z",
  },
];

// Enhanced animation variants with premium effects
const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const scaleUp: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 30,
    filter: "blur(5px)",
  },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const cardHover = {
  rest: {
    scale: 1,
    boxShadow:
      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    filter: "brightness(1) contrast(1)",
  },
  hover: {
    scale: 1.03,
    boxShadow:
      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    filter: "brightness(1.05) contrast(1.05)",
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const buttonHover = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1, ease: [0.22, 1, 0.36, 1] },
  },
};

// Enhanced section component with parallax and blur effects
export const AnimatedSection = ({
  children,
  className,
  delay = 0,
  parallaxFactor = 0.1,
  isModalOpen = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  parallaxFactor?: number;
  isModalOpen?: boolean;
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const isInView = useInView(ref, {
    once: false,
    amount: 0.2,
    margin: "-100px 0px",
  });

  // Parallax effect
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [50 * parallaxFactor, -50 * parallaxFactor],
  );

  // Opacity effect based on scroll position - but override to full opacity when modal is open
  const opacityValue = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    isModalOpen ? [1, 1, 1, 1] : [0.6, 1, 1, 0.6],
  );

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
      style={{
        originY: 0,
        opacity: isModalOpen ? 1 : opacityValue,
      }}
      transition={{ delay }}
    >
      <motion.div
        style={{
          y,
          filter: `blur(${isInView ? 0 : 5}px)`,
          transition: "filter 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

// Reveal component for text with premium animation
export const RevealText = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
      animate={
        isInView
          ? {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
            }
          : {
              opacity: 0,
              y: 20,
              filter: "blur(8px)",
            }
      }
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
};

// Custom RevealText for hero section without blur
const HeroText = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={
        isInView
          ? {
              opacity: 1,
              y: 0,
            }
          : {
              opacity: 0,
              y: 20,
            }
      }
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
};

// Parallax image component
const ParallaxImage = ({
  src,
  alt,
  className = "",
  strength = 100,
}: {
  src: string;
  alt: string;
  className?: string;
  strength?: number;
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [strength, -strength]);

  return (
    <motion.div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y }}
        className="object-cover w-full h-full"
      />
    </motion.div>
  );
};

export const ViewPlanVideo = () => {
  const { theme = "system" } = useTheme();
  const params = useParams();
  const selectedEducationPlans = useEducationPlans();
  const id = params?.id;
  const [currentVideo, setCurrentVideo] = useState<CurrentVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePlan, setActivePlan] = useState("");
  const [previewItem, setPreviewItem] = useState<string | null>(null);
  const [videoItem, setVideoItem] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const imageId = useId();
  const planId = useRef<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStarted = useRef(false);
  const videoEnded = useRef(false);

  const [themeMode, setThemeMode] = useState("");

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  // Enhanced scroll animation with smoother spring physics
  const { scrollYProgress } = useScroll();
  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Create scroll-driven opacity and scale values
  const headerOpacity = useTransform(smoothScrollProgress, [0, 0.1], [1, 0.8]);
  const headerScale = useTransform(smoothScrollProgress, [0, 0.1], [1, 0.98]);

  const listSelectedEducationPlans = listEducationPlans.filter((item) =>
    selectedEducationPlans.includes(item.value),
  ) as EducationPlanItem[];

  const createEvent = async (
    name: "page_view" | "video_start" | "video_complete",
  ) => {
    if (!planId.current) {
      return;
    }
    try {
      await axios.post("/api/plans/create-event", {
        planId: planId.current,
        name,
      });
    } catch (error) {
      console.error("Error create event:", error);
    }
  };

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const responseVideo = await axios.get("/api/videos/get-detail-video", {
          params: {
            id: +id - videos?.length,
          },
        });
        const videoData = responseVideo?.data?.data;
        if (videoData) {
          setCurrentVideo((prev: any) => ({
            ...prev,
            id: videoData.id,
            title: videoData.title,
            videoUrl: videoData?.videoUrl || videoData?.synthesia?.download,
            clientColor: videoData?.clientColor || "#2B334C",
            logo: "",
            status: videoData?.synthesia?.status,
            companyName: "Waypoint Financial Advisors",
            advisorName: "Ty Rogers",
            advisorTitle: "Managing Partner",
            advisorImage: "/advisor-headshot.jpg",
          }));
        }
      } catch (error) {
        console.error("Error fetching video details:", error);
      }
    };

    const fetchVideo = async () => {
      setIsLoading(true);
      try {
        const responsePlan = await axios.get("/api/plans/get-detail-plan", {
          params: {
            id: +id - videos?.length,
          },
        });

        const plan: IPlan = responsePlan?.data?.data;
        const currentVideo = {
          resources: [
            {
              id: 1,
              title: "Plan Investment Advisor",
              subTitle: "Ty Rogers",
              email: "401ksupport@waypoint.com",
              phone: "(877) 757-3263",
              image: "/logo-2.png",
              icon: FileIcon,
            },
          ] as any[],
          companyName: "Waypoint Financial Advisors",
          advisorName: "Ty Rogers",
          advisorTitle: "Managing Partner",
          advisorImage: "/advisor-headshot.jpg",
        };

        const recordKeeper = recordKeepers?.find(
          (item) => +item?.id === +(plan?.recordkeeper || 0),
        );
        if (recordKeeper) {
          currentVideo.resources.push({
            title: "Account Access / Enroll",
            subTitle: recordKeeper.name,
            url: recordKeeper.website,
            phone: recordKeeper.phone,
            image: recordKeeper.image,
            icon: KeyIcon,
          });
        }

        if (plan?.companyContact === "Include") {
          currentVideo.resources.push({
            title: "Point of Contact",
            subTitle: plan?.companyName,
            email: plan?.email,
            phone: plan?.phoneNumber,
            image: "",
            icon: PersonIcon,
          });
        }

        planId.current = plan.id;

        setCurrentVideo((prev) => ({ ...prev, ...currentVideo }));
      } catch (error) {
        console.error("Error fetching video:", error);
      }
      setIsLoading(false);
    };

    const fetChStaticVideo = () => {
      setIsLoading(true);
      try {
        const videoData = videos.find((video) => video.videoId === id);
        if (videoData) {
          setCurrentVideo({
            id: videoData.videoId,
            title: videoData.items.title,
            videoUrl: videoData.videoUrl || "/test.mp4",
            clientColor: videoData.clientColor || "#2B334C",
            logo: videoData.items.image,
            status: "completed",
            companyName: "Waypoint Financial Advisors",
            advisorName: "Ty Rogers",
            advisorTitle: "Managing Partner",
            advisorImage: videoData.advisorImage || "/ty-rogers.jpg", // Use the advisorImage from the video data
            resources: videoData.items.data
              .filter((item) => item.email || item.website || item.phone)
              .map((item) => ({
                title: item.title,
                url: item.website || "#",
                subTitle: item.subTitle,
                email: item.email,
                phone: item.phone,
                image: item.image,
                icon: item.icon || FileIcon, // Provide default icon
              })),
          });
          setIsLoading(false);
          return true;
        }
      } catch (error) {
        console.error("Error fetching static video:", error);
      }
      setIsLoading(false);
      return false;
    };

    const handleGetPlanDetail = async () => {
      const hasStatic = fetChStaticVideo();
      if (!hasStatic) {
        await Promise.all([fetchVideo(), fetchPlan()]);
      }
      createEvent("page_view");
    };

    handleGetPlanDetail();
  }, [id]);

  // Force a refresh of the component when modal closes
  useEffect(() => {
    if (!isPreviewOpen) {
      // Small delay to ensure modal is fully closed
      const timer = setTimeout(() => {
        setForceRefresh((prev) => prev + 1);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isPreviewOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      if (!videoStarted.current) {
        videoStarted.current = true;
        createEvent("video_start");
      }
    };

    const handleEnded = () => {
      if (!videoEnded.current) {
        videoEnded.current = true;
        createEvent("video_complete");
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("ended", handleEnded);
    };
  }, [currentVideo?.videoUrl]);

  // FAQ data
  const faqItems = [
    {
      question: "When should I start planning for retirement?",
      answer:
        "It's best to start planning for retirement as early as possible. The sooner you begin saving, the more time your money has to grow through compound interest. However, it's never too late to start planning for retirement.",
    },
    {
      question: "How much should I save for retirement?",
      answer:
        "Financial experts often recommend saving 10-15% of your income for retirement. However, the exact amount depends on your age, current savings, expected retirement age, and desired lifestyle in retirement. Consider using a retirement calculator or consulting with a financial advisor.",
    },
    {
      question: "What's the difference between a 401(k) and an IRA?",
      answer:
        "A 401(k) is an employer-sponsored retirement plan where contributions are often matched by employers. An IRA (Individual Retirement Account) is opened by an individual without employer involvement. Both offer tax advantages but have different contribution limits and withdrawal rules.",
    },
    {
      question: "When can I withdraw from my retirement accounts?",
      answer:
        "For most retirement accounts, you can begin taking penalty-free withdrawals at age 59½. Required Minimum Distributions (RMDs) generally begin at age 72. Early withdrawals before age 59½ typically incur a 10% penalty plus income tax, though there are some exceptions.",
    },
    {
      question: "Should I pay off debt before saving for retirement?",
      answer:
        "It depends on the type of debt. High-interest debt (like credit cards) should typically be paid off before focusing heavily on retirement savings. However, if your employer offers a 401(k) match, consider contributing enough to get the full match while paying down debt, as the match is essentially free money.",
    },
  ];

  const handlePreview = (
    e: React.MouseEvent,
    imageSrc: string,
    videoSrc?: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setPreviewItem(imageSrc);

    // Set the video source if provided
    if (videoSrc) {
      setVideoItem(videoSrc);
    } else {
      setVideoItem(null);
    }

    setIsPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 mb-4 border-4 rounded-full border-primary border-t-transparent animate-spin"></div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Loading your plan..
          </p>
        </motion.div>
      </div>
    );
  }

  if (!currentVideo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="mb-6 text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold">Video Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            The requested video could not be located.
          </p>
        </motion.div>
      </div>
    );
  }

  // Select shape for stylized image
  const shapeIndex = 1; // Using the second shape
  const { width, height, path } = shapes[shapeIndex];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section - 2 Column Layout */}
      <div className="overflow-hidden bg-[#fbfbfb] dark:bg-[#121212] mt-[-20px]">
        <div className="container px-4 py-8 mx-auto md:px-6 md:py-24">
          <div className="container grid items-start grid-cols-1 gap-4 mx-auto md:grid-cols-2 md:gap-8">
            {/* Left Column - Text and Button */}
            <motion.div
              className="flex flex-col justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              >
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 md:mb-6 leading-tight text-[#2B334C] dark:text-white">
                  Welcome to your{" "}
                  <span className="text-primary">
                    {currentVideo.title || "401(k) Plan"}
                  </span>
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              >
                <p className="mb-6 md:mb-8 text-base md:text-lg leading-relaxed tracking-tight text-gray-600 dark:text-gray-300">
                  It is our privilege to have been selected by your company to
                  represent your 401(k) Profit Sharing Plan and Trust. Whether
                  you&apos;ve just started or have been participating for years,
                  we&apos;re here to help you make informed financial decisions.
                </p>
              </motion.div>

              <motion.div
                className="flex items-center mb-8 space-x-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
              >
                <div className="flex-shrink-0">
                  <img src="/sig.png" alt="Signature" className="h-16 mb-1" />
                </div>
                <div className="pl-6 border-l-2 border-primary/60">
                  <p className="font-medium text-lg text-[#2B334C] dark:text-white">
                    {currentVideo.advisorName || "Ty Rogers"}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {currentVideo.advisorTitle || "Managing Partner"}
                    <br />
                    {currentVideo.companyName || "Waypoint Financial Advisors"}
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="w-auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
              >
                <Link href="https://waypointfas.com" passHref legacyBehavior>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        size="lg"
                        variant="secondary"
                        className="relative px-8 py-8 mx-auto overflow-hidden font-medium text-md group"
                      >
                        <motion.span
                          className="absolute inset-0 w-full h-full translate-y-full bg-white/10"
                          initial={{ translateY: "100%" }}
                          whileHover={{
                            translateY: "0%",
                            transition: { duration: 0.4 },
                          }}
                        />
                        Schedule Appointment
                      </Button>
                    </motion.div>
                  </a>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right Column - Stylized Image */}
            <motion.div
              className="relative flex justify-center h-full md:justify-end"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            >
              <div className="relative flex aspect-[719/680] w-full max-w-md md:max-w-none md:scale-[100%] md:origin-left grayscale-[10%] hover:grayscale-0 transition-all duration-500 mt-[-40px]">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  fill="none"
                  className="h-full"
                >
                  <g clipPath={`url(#${imageId}-clip)`} className="group">
                    <motion.g
                      className="transition duration-500 origin-center scale-100 motion-safe:group-hover:scale-105"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.5 }}
                    >
                      <foreignObject width={width} height={height}>
                        <div
                          className="w-full h-full overflow-hidden bg-neutral-100"
                          style={{ aspectRatio: `${width} / ${height}` }}
                        >
                          <motion.img
                            src={
                              currentVideo.advisorImage ||
                              "/placeholder.svg?height=680&width=719"
                            }
                            alt="Financial Advisor"
                            className="object-cover object-top w-full h-full"
                            initial={{ scale: 1.05 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </foreignObject>
                    </motion.g>
                    <use
                      href={`#${imageId}-shape`}
                      strokeWidth="2"
                      className="stroke-neutral-950/10"
                    />
                  </g>
                  <defs>
                    <clipPath id={`${imageId}-clip`}>
                      <path
                        id={`${imageId}-shape`}
                        d={path}
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <main className="flex-grow">
        {/* Main Video Section */}
        <AnimatedSection
          className="py-16 bg-gray-50 dark:bg-gray-900"
          parallaxFactor={0.05}
          isModalOpen={isPreviewOpen}
        >
          <div className="container px-4 mx-auto md:px-6">
            <div className="max-w-5xl mx-auto">
              <RevealText className="text-3xl tracking-tight font-semibold text-center mb-10 text-[#2B334C] dark:text-white">
                {currentVideo.title || "401(k) Plan"}
              </RevealText>

              <motion.div
                className="overflow-hidden transition-all ease-linear bg-white rounded-lg shadow-xl dark:bg-gray-800"
                variants={scaleUp}
                // whileHover={{
                //   boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                //   transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                // }}
              >
                {currentVideo?.status === "in_progress" ? (
                  <div className="py-20 text-center">
                    <motion.img
                      className="max-w-[300px] block mx-auto"
                      src="/images/project_complete.svg"
                      alt="Video in progress"
                      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.p
                      className="mt-4 text-2xl text-[#2B334C] dark:text-white text-center"
                      initial={{ opacity: 0, filter: "blur(8px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      transition={{
                        duration: 0.8,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.2,
                      }}
                    >
                      Video In Progress
                    </motion.p>
                  </div>
                ) : (
                  <motion.video
                    ref={videoRef}
                    className="w-full h-full"
                    controls
                    autoPlay
                    muted
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <source src={currentVideo.videoUrl} type="video/mp4" />
                  </motion.video>
                )}
              </motion.div>

              <RevealText delay={0.2} className="mt-4 text-center">
                <Link href={"/"} target="_blank">
                  <motion.span
                    className="text-sm underline cursor-pointer text-muted-foreground"
                    whileHover={{ color: "#2B334C" }}
                    transition={{ duration: 0.3 }}
                  >
                    View in Spanish (En Español)
                  </motion.span>
                </Link>
              </RevealText>
            </div>
          </div>
        </AnimatedSection>

        {/* Resources Section */}
        <AnimatedSection
          className="py-8 md:py-16 bg-white dark:bg-gray-800"
          delay={0.1}
          parallaxFactor={0.08}
          isModalOpen={isPreviewOpen}
        >
          <div className="container px-4 mx-auto md:px-6">
            <div className="max-w-5xl mx-auto">
              <RevealText className="text-2xl md:text-3xl tracking-tight font-semibold text-center mb-6 md:mb-10 text-[#2B334C] dark:text-white">
                Participant Resources & Support
              </RevealText>

              <motion.div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
                variants={staggerContainer}
              >
                {(currentVideo.resources || []).map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={index}
                      className="h-full overflow-hidden transition-all border rounded-lg shadow-md"
                      variants={fadeInUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.3 }}
                      custom={index * 0.1}
                      whileHover={{
                        y: -8,
                        boxShadow:
                          "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                      }}
                    >
                      <div className="flex flex-col h-full">
                        <motion.div
                          className="flex items-center gap-2 px-4 py-2 text-white rounded-t-lg bg-primary"
                          whileHover={{
                            backgroundColor: "hsl(var(--primary)/0.9)",
                            transition: { duration: 0.2 },
                          }}
                        >
                          <motion.div
                            initial={{ rotate: 0 }}
                            whileHover={{
                              rotate: 15,
                              scale: 1.2,
                              transition: {
                                duration: 0.2,
                                type: "spring",
                                stiffness: 300,
                              },
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </motion.div>
                          <span className="font-medium text-md">
                            {item.title}
                          </span>
                        </motion.div>
                        <div className="flex flex-col flex-grow p-5">
                          <motion.span
                            className="text-base font-semibold text-foreground"
                            whileHover={{
                              color: currentVideo.clientColor,
                              transition: { duration: 0.2 },
                            }}
                          >
                            {item.subTitle}
                          </motion.span>
                          {item.email && (
                            <motion.div
                              className="flex items-center gap-2 mt-3"
                              whileHover={{
                                x: 5,
                                transition: {
                                  duration: 0.2,
                                  type: "spring",
                                  stiffness: 300,
                                },
                              }}
                            >
                              <ExternalLinkIcon className="text-left" />
                              <span className="text-sm truncate text-muted-foreground">
                                <a href={`mailto:${item.email}`}>
                                  {item.email}
                                </a>
                              </span>
                            </motion.div>
                          )}
                          {item.url && item.url !== "#" && (
                            <motion.div
                              className="flex items-center gap-2 mt-3"
                              whileHover={{
                                x: 5,
                                transition: {
                                  duration: 0.2,
                                  type: "spring",
                                  stiffness: 300,
                                },
                              }}
                            >
                              <ExternalLinkIcon className="text-left" />
                              <span className="text-sm truncate text-muted-foreground">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {item.url}
                                </a>
                              </span>
                            </motion.div>
                          )}
                          {item.phone && (
                            <motion.div
                              className="flex items-center gap-2 mt-3"
                              whileHover={{
                                x: 5,
                                transition: {
                                  duration: 0.2,
                                  type: "spring",
                                  stiffness: 300,
                                },
                              }}
                            >
                              <ExternalLinkIcon className="text-left" />
                              <span className="text-sm truncate text-muted-foreground">
                                {item.phone}
                              </span>
                            </motion.div>
                          )}
                          {item.image && (
                            <div className="flex items-center justify-center h-24 pt-4 mt-auto">
                              <motion.img
                                src={item.image || "/placeholder.svg"}
                                alt={item.title}
                                className="w-full h-auto max-w-[80%] object-contain"
                                whileHover={{
                                  scale: 1.08,
                                  transition: {
                                    duration: 0.5,
                                    ease: [0.22, 1, 0.36, 1],
                                  },
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </AnimatedSection>

        {/* Educational Videos Grid */}
        {listSelectedEducationPlans.length > 0 && (
          <AnimatedSection
            className="py-16 bg-gray-50 dark:bg-gray-900"
            delay={0.2}
            parallaxFactor={0.1}
            isModalOpen={isPreviewOpen}
            key={`educational-videos-${forceRefresh}`}
          >
            <div className="container px-4 mx-auto md:px-6">
              <div className="max-w-6xl mx-auto">
                <RevealText className="text-3xl tracking-tight font-semibold text-center mb-10 text-[#2B334C] dark:text-white">
                  Explore Educational Videos
                </RevealText>

                <motion.div
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
                  variants={staggerContainer}
                >
                  {listSelectedEducationPlans.map((item, index) => {
                    const Icon = (Icons as any)[item.icon || "arrowRight"];
                    return (
                      <motion.div
                        key={index}
                        className="flex flex-col h-full cursor-pointer group"
                        variants={fadeInUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                        custom={index * 0.1}
                        whileHover={{
                          scale: 1.05,
                          transition: {
                            duration: 0.2,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActivePlan(item.label)}
                      >
                        <div className="relative flex w-full overflow-hidden border rounded-md shadow-sm aspect-video">
                          <motion.img
                            src={item.image || "/placeholder.svg"}
                            alt={item.label}
                            className="absolute inset-0 object-cover w-full h-full transition-all duration-500"
                            whileHover={{
                              scale: 1.08,
                              filter: "blur(3px) brightness(0.8)",
                              transition: {
                                duration: 0.3,
                                ease: [0.22, 1, 0.36, 1],
                              },
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-500 opacity-0 group-hover:opacity-100">
                            <motion.div
                              whileHover="hover"
                              whileTap="tap"
                              initial="rest"
                              variants={buttonHover}
                            >
                              <Button
                                className="text-black bg-white rounded-full shadow-md hover:text-black"
                                onClick={(e) =>
                                  handlePreview(e, item.image, item.videoUrl)
                                }
                              >
                                Preview
                              </Button>
                            </motion.div>
                          </div>
                          {activePlan === item.label && (
                            <motion.div
                              className="absolute inset-0 border-2 rounded-md bg-primary/10 border-primary"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: 1,
                                transition: {
                                  duration: 0.3,
                                  ease: [0.22, 1, 0.36, 1],
                                },
                              }}
                            />
                          )}
                        </div>
                        <motion.div
                          className="mt-3 text-center"
                          initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
                          whileInView={{
                            opacity: 1,
                            y: 0,
                            filter: "blur(0px)",
                          }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 0.3,
                            delay: 0.1 + index * 0.05,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <p className="text-base truncate text-[#2B334C] dark:text-white font-semibold leading-tight">
                            {item.label}
                          </p>
                          {item.subLabel && (
                            <p className="text-sm text-muted-foreground">
                              {item.subLabel}
                            </p>
                          )}
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* FAQ Section */}
        <AnimatedSection
          className="py-16 bg-white dark:bg-gray-800"
          delay={0.3}
          parallaxFactor={0.12}
          isModalOpen={isPreviewOpen}
        >
          <div className="container px-4 mx-auto md:px-6">
            <div className="max-w-5xl mx-auto">
              <RevealText className="text-3xl tracking-tight font-semibold text-center mb-10 text-[#2B334C] dark:text-white">
                How can we help you today?
              </RevealText>

              <motion.div
                className="w-full max-w-5xl mx-auto rounded-t-lg"
                variants={scaleUp}
              >
                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((faq, index) => (
                    <motion.div
                      key={index}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.1 }}
                      variants={fadeInUp}
                      custom={index * 0.15}
                      transition={{ delay: index * 0.1 }}
                    >
                      <AccordionItem
                        value={`item-${index}`}
                        // className="overflow-hidden bg-[#28334E] px-4 rounded-lg border-white dark:border-gray-700 mb-3"
                        className="px-4 mb-3 overflow-hidden rounded-lg bg-primary dark:border-gray-700"
                      >
                        <motion.div
                          whileHover={{
                            backgroundColor: "rgba(255,255,255,0.05)",
                            transition: { duration: 0.3 },
                          }}
                        >
                          <AccordionTrigger className="py-4 font-medium tracking-widest text-left text-white uppercase [&[data-state=open]>svg]:text-white [&>svg]:text-white">
                            <motion.span
                              initial={{ opacity: 0, filter: "blur(5px)" }}
                              animate={{ opacity: 1, filter: "blur(0px)" }}
                              transition={{
                                duration: 0.5,
                                delay: index * 0.1,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              {faq.question}
                            </motion.span>
                          </AccordionTrigger>
                        </motion.div>
                        <AccordionContent className="pb-4 text-gray-200 dark:text-gray-300">
                          <motion.div
                            initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{
                              duration: 0.5,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            {faq.answer}
                          </motion.div>
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  ))}
                </Accordion>
              </motion.div>
            </div>
          </div>
        </AnimatedSection>

        {/* CTA Section */}
        <AnimatedSection
          className="relative max-w-5xl py-16 mx-auto mb-12"
          delay={0.4}
          parallaxFactor={0.15}
          isModalOpen={isPreviewOpen}
        >
          <div className="absolute inset-0 z-0">
            {/* Background with subtle parallax effect */}
            <motion.div
              className="absolute inset-0 rounded-lg"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="container relative z-10 px-4 py-8 md:py-16 mx-auto md:px-6">
            <div className="max-w-3xl mx-auto text-center">
              <div className="">
                <Link href={"#"} target="_blank">
                  <div className="relative z-20 mx-auto mb-3 max-w-[200px]">
                    <img
                      src={
                        themeMode === "dark" || themeMode === "system"
                          ? "/plantelligence-logos/pt_web_dark.png"
                          : "/plantelligence-logos/pt_web_light.png"
                      }
                      className="w-[200px]"
                      alt="PlanTelligence"
                    />
                  </div>
                </Link>
              </div>
              <RevealText className="mb-4 text-2xl md:text-3xl tracking-tight font-bold text-[#2B334C] dark:text-white">
                Need assistance navigating your finances?
              </RevealText>
              <RevealText
                delay={0.2}
                className="max-w-md mx-auto mb-4 text-sm md:text-md text-[#959595]"
              >
                We&apos;re here to offer guidance and support. Talk to our team
                of financial advisors who align with your financial goals.
              </RevealText>
              <RevealText delay={0.4}>
                <Link href="https://waypointfas.com" passHref legacyBehavior>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        size="lg"
                        variant="secondary"
                        className="relative px-8 py-8 mx-auto overflow-hidden font-medium text-md group"
                      >
                        <motion.span
                          className="absolute inset-0 w-full h-full translate-y-full bg-white/10"
                          initial={{ translateY: "100%" }}
                          whileHover={{
                            translateY: "0%",
                            transition: { duration: 0.4 },
                          }}
                        />
                        Schedule Appointment
                      </Button>
                    </motion.div>
                  </a>
                </Link>
              </RevealText>
            </div>
          </div>
        </AnimatedSection>
      </main>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
      >
        <Separator className="mt-8" />
        <div className="w-full max-w-5xl px-4 mx-auto mt-6 mb-0 text-muted-foreground md:px-6">
          <RevealText delay={0.6} className="text-xs">
            This material was created for educational and informational purposes
            only and is not intended as ERISA, tax, legal or investment advice.
            If you are seeking investment advice specific to your needs, such
            advice services must be obtained on your own separate from this
            educational material. Information has been obtained from sources
            believed to be reliable but is not guaranteed as to accuracy. Please
            refer to the Summary Plan Description for more information.
          </RevealText>
          <RevealText delay={0.7} className="mt-2 text-xs">
            Securities and advisory services offered through LPL Financial, a
            registered investment advisor, Member
            <a
              href="https://www.finra.org"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-[#2B334C] dark:text-white"
            >
              FINRA/SIPC
            </a>
            .
          </RevealText>
        </div>
      </motion.div>

      {/* Preview Dialog */}
      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) {
            // Only reset the video and preview states when dialog closes
            setVideoItem(null);
            setPreviewItem(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {videoItem ? (
              <div className="relative w-full pt-[56.25%] bg-black">
                <video
                  key={`video-${Date.now()}`}
                  className="absolute top-0 left-0 w-full h-full"
                  controls
                  autoPlay
                  playsInline
                  src={videoItem}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : previewItem ? (
              <motion.img
                src={previewItem || "/placeholder.png"}
                alt="Preview"
                className="w-full h-auto object-contain max-h-[80vh]"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
            <DialogClose className="absolute p-2 text-black transition-colors bg-white rounded-full focus:outline-none top-2 right-2 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400">
              <motion.div
                whileHover={{
                  rotate: 90,
                  transition: { duration: 0.3 },
                }}
              >
                <X className="w-5 h-5" />
              </motion.div>
              <span className="sr-only">Close</span>
            </DialogClose>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
