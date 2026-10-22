"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  useBenefitsWizardStore,
  HelpCardData,
} from "@/lib/benefits-wizard-store";
import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import {
  BENEFIT_CATEGORY_GALLERY,
  toCategoryGalleryKey,
} from "@/lib/benefit-category-gallery";
import { ModalGallery } from "@/components/ui/modalGallery";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ImageIcon,
  ImagePlus,
  Layout,
  Link2,
  Mail,
  HelpCircle,
  CheckCircle2,
  Circle,
  Pencil,
  Search,
  ChevronsUpDown,
  Trash2,
  GripVertical,
  Settings,
  Video,
  Upload,
} from "lucide-react";
import { compressImage } from "@/lib/image-compression";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  SupportContact,
  FAQItem,
  BenefitsStep1Data,
  BenefitsStep3Data,
} from "@/lib/benefits-wizard-store";
import {
  KeyContact,
  BrandImageData,
  CompanyLogoData,
  MobileHeroPosition,
} from "@/types/new-client-wizard";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from "uuid";
import { BannerOverlaySettingsCard } from "@/components/wizard/new-client-steps/sections/components/banner-overlay-settings-card";
import { TypographySection } from "@/components/wizard/new-client-steps/sections/typography-section";
import {
  HeroBackgroundCard,
  type HeroSegmentMode,
} from "@/components/wizard/new-client-steps/sections/components/hero-background-card";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { toast } from "sonner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";

export const DEFAULT_HELP_CARDS: HelpCardData[] = [
  {
    id: "access-account",
    title: "Access My Retirement Account",
    paragraphs: [
      "View your balances, plan documents, and investment details all in one place.",
      "Take charge of your retirement plan and stay on top of your progress anytime.",
    ],
    cta: "",
  },
  {
    id: "financial-planning",
    title: "Financial Planning",
    paragraphs: [
      "Exclusive Benefits for [Company Name] Plan Participants",
      "Elevate your financial journey with personalized planning through [Advisor Name]—a comprehensive service seamlessly integrated with your retirement benefits.",
    ],
    cta: "",
  },
  {
    id: "rollovers",
    title: "Rollovers & Distributions",
    introBold: "Transitioning to a new employer?",
    paragraphs: [
      "Understand your options for managing the savings you've built. The decision you make now can have a lasting impact on your retirement lifestyle.",
    ],
    cta: "",
  },
];

interface BenefitsEditorPanelProps {
  isOpen: boolean;
  isAnimating: boolean;
  onClose: () => void;
  activeSection?: string | null;
  editorScrollContainerRef?: React.RefObject<HTMLDivElement>;
  /** Called when the user switches between Edit / Desktop / Mobile in Hero Background */
  onHeroSegmentModeChange?: (mode: HeroSegmentMode) => void;
  /** Layout variant passed through to EditorPanelWrapper */
  variant?: "fixed" | "inline";
  /**
   * Left offset for the fixed variant, passed through to EditorPanelWrapper so the
   * panel can sit *beside* the sidebar instead of painting over it. Step 2 supplies
   * `var(--sidebar-width, 16rem)`; the other steps omit it and keep `left-0`.
   */
  leftOffset?: string;
  /** Plan/company name shown next to the benefit category badge in the header */
  planCompanyName?: string;
  /** The plan's company website — analysis target for the AI typography suggestion */
  companyWebsite?: string;
  /** Fields flagged by the last failed step validation (renders red borders) */
  errorFields?: string[];
  /** Lenis-backed scroll for the editor panel (falls back to native scroll) */
  onScrollEditorTo?: (top: number) => void;
}

export function BenefitsEditorPanel({
  isOpen,
  isAnimating,
  onClose,
  activeSection,
  highlightedField,
  planCompanyName,
  companyWebsite,
  errorFields = [],
  onScrollEditorTo,
  editorScrollContainerRef: externalScrollRef,
  variant,
  leftOffset,
  onHeroSegmentModeChange,
}: BenefitsEditorPanelProps & { highlightedField?: string | null }) {
  const { stepData, saveStepData } = useBenefitsWizardStore();
  const step1Data = (stepData.step1 || {}) as BenefitsStep1Data;
  const step3Data = (stepData.step3 || {
    faqs: [],
    supportContacts: [],
  }) as BenefitsStep3Data;

  /**
   * Default backgrounds for the Header Background's "Choose Default Image" gallery,
   * matched to the benefit category (Retirement / Group Health / Group Life /
   * Custom→Wellness).
   *
   * The same set Step 1's Branding accordion offers for this slot, from the shared
   * module — the two screens edit one `brandImages.header`, so a different gallery on
   * each would be a difference the advisor cannot explain.
   */
  const heroGalleryKey = toCategoryGalleryKey(step1Data.benefitCategory);
  const heroGalleryImages = heroGalleryKey
    ? BENEFIT_CATEGORY_GALLERY[heroGalleryKey] || undefined
    : undefined;

  // Resolve R2 keys (org/...) to the same-origin proxy so a header background that was
  // pre-populated from the User profile in Step 1 displays correctly in the editor.
  const resolvedHeaderUrl = step1Data.brandImages?.header?.url
    ? toNextImageSrc(
        step1Data.brandImages.header.url,
        step1Data.brandImages.header.url,
      )
    : null;

  // ── Hero Background segment mode & position state ──
  const [heroSegmentMode, setHeroSegmentMode] =
    useState<HeroSegmentMode>("edit");
  const desktopHeroPosition: MobileHeroPosition = (step1Data as any)
    ?.desktopHeroBackgroundPosition ?? { x: 50, y: 50 };
  const mobileHeroPosition: MobileHeroPosition = (step1Data as any)
    ?.mobileHeroBackgroundPosition ?? { x: 50, y: 50 };
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const editorScrollContainerRef = externalScrollRef || internalScrollRef;

  /** Default-photo gallery for the Branding section's Header Background. */
  const [heroGalleryOpen, setHeroGalleryOpen] = useState(false);

  // Refs for scrolling
  const sectionsRef = {
    typography: useRef<HTMLDivElement>(null),
    branding: useRef<HTMLDivElement>(null),
    messaging: useRef<HTMLDivElement>(null),
    planVideo: useRef<HTMLDivElement>(null),
    helpCards: useRef<HTMLDivElement>(null),
    insurance: useRef<HTMLDivElement>(null),
  };

  // Field-level refs so a validation error (e.g. the required Login URL) can
  // scroll the editor straight to the offending input instead of just the
  // top of its section.
  const insuranceLoginUrlRef = useRef<HTMLDivElement>(null);
  const companyLogoRef = useRef<HTMLDivElement>(null);
  const brandImagesHeaderRef = useRef<HTMLDivElement>(null);
  const benefitTitleRef = useRef<HTMLDivElement>(null);
  const shortDescriptionRef = useRef<HTMLDivElement>(null);
  const fieldRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    companyLogo: companyLogoRef,
    "brandImages.header": brandImagesHeaderRef,
    benefitTitle: benefitTitleRef,
    shortDescription: shortDescriptionRef,
    insuranceLoginUrl: insuranceLoginUrlRef,
  };

  // Red-border helper: a field is invalid when flagged by validation and its
  // value is still empty (so the border clears as soon as it's filled).
  const isFieldInvalid = (field: string): boolean => {
    if (!errorFields.includes(field)) return false;
    switch (field) {
      case "companyLogo":
        return !(step1Data.companyLogo?.url || "").trim();
      case "brandImages.header":
        return !(step1Data.brandImages?.header?.url || "").trim();
      case "benefitTitle":
        return !(step1Data.benefitTitle || "").trim();
      case "shortDescription":
        return !(step1Data.shortDescription || "").trim();
      case "insuranceLoginUrl":
        return !(step1Data.insuranceLoginUrl || "").trim();
      default:
        return false;
    }
  };

  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  // ── Section 4: Video Source ──
  const [videoSourceMode, setVideoSourceMode] = useState<"upload" | "url">(
    "upload",
  );
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [isVideoDragOver, setIsVideoDragOver] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Section 4: Thumbnail ──
  const [thumbnailMode, setThumbnailMode] = useState<"upload" | "frame">(
    "upload",
  );
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailFrameTime, setThumbnailFrameTime] = useState(0);
  const [thumbnailDuration, setThumbnailDuration] = useState(0);
  const thumbnailVideoRef = useRef<HTMLVideoElement | null>(null);

  const VIDEO_LABELS = [
    "Advisor Intro",
    "This benefit",
    "Our Services",
  ] as const;
  const THUMBNAIL_MAX_EDGE = 640;

  /** R2 keys load through the authed proxy; absolute URLs load as-is. */
  const resolvedPlanVideoUrl = step1Data.planVideo
    ? step1Data.planVideo.startsWith("http") ||
      step1Data.planVideo.startsWith("/api/")
      ? step1Data.planVideo
      : `/api/r2/object?key=${encodeURIComponent(step1Data.planVideo)}`
    : "";
  const resolvedThumbnailUrl = step1Data.planVideoThumbnail
    ? step1Data.planVideoThumbnail.startsWith("data:") ||
      step1Data.planVideoThumbnail.startsWith("http")
      ? step1Data.planVideoThumbnail
      : `/api/r2/object?key=${encodeURIComponent(step1Data.planVideoThumbnail)}`
    : "";

  const [highlightedSection, setHighlightedSection] = React.useState<
    string | null
  >(null);

  // When an editor input is focused, ask the preview to scroll to the
  // corresponding element. Maps editor field keys → preview data-preview-field.
  const focusPreviewField = (field: string) => {
    window.dispatchEvent(
      new CustomEvent("benefitsPreviewScrollTo", { detail: { field } }),
    );
  };

  // Scroll to the requested section — or, when the event carries a field id
  // (e.g. the required Login URL validation), to that specific input.
  useEffect(() => {
    if (!activeSection || !isOpen) return;
    setHighlightedSection(activeSection);

    let attempts = 0;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    const scrollToTarget = () => {
      const fieldElement = highlightedField
        ? fieldRefs[highlightedField]?.current
        : null;
      const sectionElement =
        sectionsRef[activeSection as keyof typeof sectionsRef]?.current;
      const element = fieldElement || sectionElement;
      const container = editorScrollContainerRef.current;

      // The section/field may not be mounted yet (accordion animating in),
      // so retry briefly before giving up.
      if (!element || !container) {
        if (attempts < 15) {
          attempts += 1;
          scrollTimer = setTimeout(scrollToTarget, 100);
        }
        return;
      }

      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const targetScroll = Math.max(
        0,
        container.scrollTop + (rect.top - containerRect.top) - 20,
      );
      // The editor scroller is driven by Lenis, which would override a raw
      // scrollTo — so go through the Lenis-backed helper when provided.
      if (onScrollEditorTo) {
        onScrollEditorTo(targetScroll);
      } else {
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      }

      // Focus the first input/textarea inside so the user can type at once.
      const focusable = element.querySelector(
        "input, textarea",
      ) as HTMLElement | null;
      if (focusable) focusable.focus({ preventScroll: true });
    };

    scrollTimer = setTimeout(scrollToTarget, 350);
    const clearHighlightTimer = setTimeout(
      () => setHighlightedSection(null),
      2000,
    );

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      clearTimeout(clearHighlightTimer);
    };
  }, [activeSection, isOpen, highlightedField]);

  // --- Logic from Step 1 ---
  const handleLogoChange = (imageData: BrandImageData) => {
    saveStepData(1, {
      ...step1Data,
      companyLogo: {
        url: imageData.url,
        fileName: imageData.fileName,
        fileSize: imageData.fileSize,
        width: imageData.width,
        height: imageData.height,
        hasTransparency: false,
        warnings: [],
      } as CompanyLogoData,
    });
  };

  const handleBackgroundImageChange = (imageData: BrandImageData) => {
    saveStepData(1, {
      ...step1Data,
      brandImages: {
        ...step1Data.brandImages,
        header: imageData,
      },
    });
  };

  // ── Plan Video upload (shared by the file picker and the dropzone) ──
  const uploadPlanVideoFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a valid video file.");
      return;
    }

    setVideoUploading(true);
    setVideoUploadProgress(0);

    try {
      const clientId = step1Data?.planId || undefined;
      const key = await uploadFileToR2({
        file,
        purpose: "upload",
        clientId,
        fileName: file.name,
        subPath: "plan-videos",
        onProgress: (loaded, total) => {
          setVideoUploadProgress(Math.round((loaded / total) * 100));
        },
      });

      if (key) {
        // Store the raw R2 key — the GET handler will generate a presigned URL for portal viewers
        saveStepData(1, {
          ...step1Data,
          planVideo: key,
          planVideoFileName: file.name,
          planVideoRemoved: false,
        });
      } else {
        toast.error("Failed to upload video. Please try again.");
      }
    } catch (err) {
      console.error("Video upload error:", err);
      toast.error("An error occurred while uploading the video.");
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
    }
  };

  const handlePlanVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadPlanVideoFile(file);
    e.target.value = "";
  };

  const handleVideoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragOver(true);
  };

  const handleVideoDragLeave = () => setIsVideoDragOver(false);

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadPlanVideoFile(file);
  };

  /** Pasted URLs save directly as the video source (no upload). */
  const handleApplyVideoUrl = () => {
    const url = videoUrlDraft.trim();
    if (!url) {
      toast.error("Paste a video URL first.");
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
      toast.error("Enter a valid video URL (https://…).");
      return;
    }
    const fileName =
      decodeURIComponent(url.split("?")[0].split("/").pop() || "") ||
      "External video";
    saveStepData(1, {
      ...step1Data,
      planVideo: url,
      planVideoFileName: fileName,
      planVideoRemoved: false,
    });
    setVideoUrlDraft("");
  };

  const handleVideoLabelChange = (label: string) => {
    saveStepData(1, { ...step1Data, planVideoLabel: label });
  };

  /**
   * "Show on page" — whether the video section appears on the portal at all.
   *
   * Stored on the Benefit row (`planVideoVisible`) and read by the hub pages, which
   * skip the whole section when it is false. Absent means visible, so rows saved
   * before this toggle existed keep their video.
   */
  const handlePlanVideoVisibilityChange = (visible: boolean) => {
    saveStepData(1, { ...step1Data, planVideoVisible: visible });
  };

  // ── Thumbnail (uploaded image or a captured video frame) ──
  const applyThumbnail = async (dataUrl: string) => {
    try {
      setThumbnailBusy(true);
      const compressed = await compressImage(dataUrl, {
        maxWidth: THUMBNAIL_MAX_EDGE,
        maxHeight: THUMBNAIL_MAX_EDGE,
        quality: 0.8,
        mimeType: "image/jpeg",
      });
      saveStepData(1, { ...step1Data, planVideoThumbnail: compressed });
    } catch (error) {
      console.error("Error processing thumbnail:", error);
      toast.error("Failed to process that image");
    } finally {
      setThumbnailBusy(false);
    }
  };

  const handleThumbnailFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl) {
      toast.error("Failed to read that image");
      e.target.value = "";
      return;
    }
    await applyThumbnail(dataUrl);
    e.target.value = "";
  };

  const handleThumbnailScrub = (time: number) => {
    setThumbnailFrameTime(time);
    const video = thumbnailVideoRef.current;
    if (video) video.currentTime = time;
  };

  const captureThumbnailFrame = async () => {
    const video = thumbnailVideoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, THUMBNAIL_MAX_EDGE / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    await applyThumbnail(canvas.toDataURL("image/jpeg", 0.85));
  };

  const handleRemoveThumbnail = () => {
    saveStepData(1, { ...step1Data, planVideoThumbnail: undefined });
  };

  const handleRemovePlanVideo = () => {
    saveStepData(1, {
      ...step1Data,
      planVideo: undefined,
      planVideoFileName: undefined,
      planVideoThumbnail: undefined,
      planVideoRemoved: true,
    });
  };

  // Hero overlay settings handler
  const handleOverlaySettingsChange = (settings: {
    backgroundOpacity?: number;
    containerBlockOpacity?: number;
    containerInverted?: boolean;
    backgroundInverted?: boolean;
    useGradient?: boolean;
  }) => {
    const updated: any = { ...step1Data };
    if (settings.backgroundOpacity !== undefined) {
      updated.heroBackgroundOpacity = settings.backgroundOpacity;
    }
    if (settings.containerBlockOpacity !== undefined) {
      updated.heroContainerBlockOpacity = settings.containerBlockOpacity;
    }
    if (settings.containerInverted !== undefined) {
      updated.heroContainerInverted = settings.containerInverted;
    }
    if (settings.backgroundInverted !== undefined) {
      updated.heroBackgroundInverted = settings.backgroundInverted;
    }
    if (settings.useGradient !== undefined) {
      updated.heroUseGradient = settings.useGradient;
    }
    saveStepData(1, updated);
  };

  const SectionHeader = ({
    number,
    title,
  }: {
    number: number;
    title: string;
  }) => (
    <div className="mb-6">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
        Section {number}: {title}
      </h3>
      <div className="h-px w-12 bg-border mt-2" />
    </div>
  );

  return (
    <EditorPanelWrapper
      isOpen={isOpen}
      isAnimating={isAnimating}
      onClose={onClose}
      editorScrollContainerRef={editorScrollContainerRef}
      variant={variant}
      leftOffset={leftOffset}
      headerBadge={
        planCompanyName || step1Data?.benefitCategory ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-blue/10 px-2 py-0.5 text-xs font-semibold text-accent-blue">
            {planCompanyName ? (
              <span className="max-w-[180px] truncate">{planCompanyName}</span>
            ) : null}
            {planCompanyName && step1Data?.benefitCategory ? (
              <span className="opacity-60">-</span>
            ) : null}
            {step1Data?.benefitCategory ? (
              <span>{step1Data.benefitCategory}</span>
            ) : null}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-12 p-6 pb-20">
        {/* Typography Section */}
        <div
          ref={sectionsRef.typography}
          className="transition-all duration-500 rounded-xl"
        >
          <SectionHeader number={1} title="Typography" />
          <TypographySection
            value={step1Data?.typographyTheme}
            onChange={(id) =>
              saveStepData(1, { ...step1Data, typographyTheme: id })
            }
            title="Typography"
            compact
            className="border-none shadow-none bg-transparent dark:bg-transparent"
            // Same AI suggestion as Create Plan, using the selected
            // plan's company website.
            enableAiSuggestion
            websiteUrl={companyWebsite}
            companyName={planCompanyName}
          />
        </div>

        {/* Branding Section */}
        <div
          ref={sectionsRef.branding}
          className={cn(
            "transition-all duration-500 rounded-xl",
            highlightedSection === "branding"
              ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800"
              : "",
          )}
        >
          <SectionHeader number={2} title="Branding" />
          <div className="space-y-8">
            <div
              className={cn(
                "space-y-4 rounded-xl transition-all duration-300",
                isFieldInvalid("companyLogo") &&
                  "ring-2 ring-red-500 ring-offset-2 ring-offset-background p-2 -m-2",
              )}
              data-field="companyLogo"
              ref={companyLogoRef}
              onMouseDown={() => focusPreviewField("companyLogo")}
            >
              <Label className="text-xs font-bold text-foreground">
                Benefit Logo <span className="text-red-500">*</span>
              </Label>
              <BrandImageUpload
                slotKey="companyLogo"
                slot={{
                  title: "",
                  description:
                    "This logo identifies the benefit provider (e.g. Waypoint, Integrity).",
                  recommendedSize: "900×900 px",
                  accept: ".svg,.png,.jpg,.jpeg",
                  required: true,
                  previewAspectRatio: 1,
                  previewLabel: "Logo Preview",
                }}
                currentImage={
                  step1Data.companyLogo
                    ? ({
                        url: step1Data.companyLogo.url,
                        fileName: step1Data.companyLogo.fileName,
                        fileSize: step1Data.companyLogo.fileSize || 0,
                        width: step1Data.companyLogo.width || 0,
                        height: step1Data.companyLogo.height || 0,
                        recommendedSize: "900x900",
                        status: "ok",
                        warnings: [],
                      } as BrandImageData)
                    : undefined
                }
                onImageChange={handleLogoChange}
                onImageRemove={() =>
                  saveStepData(1, { ...step1Data, companyLogo: null })
                }
                hideButtons={true}
                useUniversalModal={true}
                universalModalType="normalizer"
                // Provider logo — a real logo, so opt in explicitly.
                universalModalAllowBackgroundRemoval={true}
                universalModalNormalizeLogoForHeader={true}
                universalModalCustomConfig={{
                  modalTitle: "Benefit Logo",
                  modalDescription:
                    "This logo identifies the benefit provider (e.g. Waypoint, Integrity).",
                }}
              />
            </div>
            <div
              className={cn(
                "space-y-4 rounded-xl transition-all duration-300",
                isFieldInvalid("brandImages.header") &&
                  "ring-2 ring-red-500 ring-offset-2 ring-offset-background p-2 -m-2",
              )}
              data-field="brandImages.header"
              ref={brandImagesHeaderRef}
              onMouseDownCapture={() => focusPreviewField("brandImagesHeader")}
            >
              <Label className="text-xs font-bold text-foreground">
                Header Background <span className="text-red-500">*</span>
              </Label>
              <HeroBackgroundCard
                heroImageData={
                  step1Data.brandImages?.header
                    ? {
                        ...step1Data.brandImages.header,
                        previewUrl: resolvedHeaderUrl ?? undefined,
                        url:
                          resolvedHeaderUrl ?? step1Data.brandImages.header.url,
                      }
                    : null
                }
                onImageChange={handleBackgroundImageChange}
                onImageRemove={() =>
                  saveStepData(1, {
                    ...step1Data,
                    brandImages: { ...step1Data.brandImages, header: null },
                  })
                }
                onEditClick={() => {}}
                onFileSelect={handleBackgroundImageChange}
                // Was a no-op, so the card's "Choose Default Image" button did
                // nothing at all. It now opens the per-category gallery.
                onDefaultPhotoClick={() => setHeroGalleryOpen(true)}
                segmentMode={heroSegmentMode}
                onSegmentModeChange={(mode) => {
                  setHeroSegmentMode(mode);
                  if (onHeroSegmentModeChange) {
                    onHeroSegmentModeChange(mode);
                  }
                }}
                desktopPosition={desktopHeroPosition}
                onDesktopPositionChange={(pos) => {
                  saveStepData(1, {
                    ...step1Data,
                    desktopHeroBackgroundPosition: pos,
                  } as any);
                }}
                mobilePosition={mobileHeroPosition}
                onMobilePositionChange={(pos) => {
                  saveStepData(1, {
                    ...step1Data,
                    mobileHeroBackgroundPosition: pos,
                  } as any);
                }}
              />
            </div>
            {/* Hero Overlay Settings */}
            <div className="space-y-4">
              <Label className="text-xs font-bold text-foreground">
                Hero Overlay Settings
              </Label>
              <BannerOverlaySettingsCard
                backgroundOpacity={step1Data.heroBackgroundOpacity ?? 1.0}
                containerBlockOpacity={
                  step1Data.heroContainerBlockOpacity ?? 0.67
                }
                containerInverted={step1Data.heroContainerInverted ?? false}
                backgroundInverted={step1Data.heroBackgroundInverted ?? false}
                useGradient={step1Data.heroUseGradient ?? false}
                onSettingsChange={handleOverlaySettingsChange}
              />
            </div>
          </div>
        </div>

        {/* Messaging Section */}
        <div
          ref={sectionsRef.messaging}
          className={cn(
            "transition-all duration-500 rounded-xl",
            highlightedSection === "messaging"
              ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800"
              : "",
          )}
        >
          <SectionHeader number={3} title="Benefit Messaging" />
          <div className="space-y-6">
            <div
              className="space-y-2"
              data-field="benefitTitle"
              ref={benefitTitleRef}
            >
              <Label className="text-xs font-bold text-foreground">
                Intro Headline <span className="text-red-500">*</span>
              </Label>
              <Input
                value={step1Data.benefitTitle || ""}
                onChange={(e) =>
                  saveStepData(1, {
                    ...step1Data,
                    benefitTitle: e.target.value,
                  })
                }
                onFocus={() => focusPreviewField("benefitTitle")}
                destructive={isFieldInvalid("benefitTitle")}
                placeholder="e.g. 401(k) Retirement Plan"
                className={cn(
                  "h-11 shadow-sm border-muted",
                  isFieldInvalid("benefitTitle") &&
                    "border-red-500 dark:border-red-500",
                )}
                maxLength={35}
              />
              <div className="flex justify-end">
                <span
                  className={`text-[11px] tabular-nums ${
                    (step1Data.benefitTitle || "").length >= 33
                      ? "text-red-500"
                      : (step1Data.benefitTitle || "").length < 10
                      ? "text-amber-500"
                      : "text-green-600"
                  }`}
                >
                  {(step1Data.benefitTitle || "").length}/35
                </span>
              </div>
            </div>
            <div
              className="space-y-2"
              data-field="shortDescription"
              ref={shortDescriptionRef}
            >
              <Label className="text-xs font-bold text-foreground">
                Intro Message <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={step1Data.shortDescription || ""}
                onChange={(e) =>
                  saveStepData(1, {
                    ...step1Data,
                    shortDescription: e.target.value,
                  })
                }
                onFocus={() => focusPreviewField("shortDescription")}
                destructive={isFieldInvalid("shortDescription")}
                placeholder="Provide a helpful overview for employees..."
                className={cn(
                  "min-h-[120px] shadow-sm border-muted leading-relaxed",
                  isFieldInvalid("shortDescription") &&
                    "border-red-500 dark:border-red-500",
                )}
                maxLength={450}
              />
              <div className="flex justify-end">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {(step1Data.shortDescription || "").length}/450
                </span>
              </div>
            </div>

            {/* Closing & Signature */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-xs font-bold text-foreground">
                Closing & Signature
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="emsig-user"
                    name="signatureMode"
                    checked={(step1Data.signatureMode || "user") === "user"}
                    onFocus={() => focusPreviewField("messaging")}
                    onChange={() =>
                      saveStepData(1, { ...step1Data, signatureMode: "user" })
                    }
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor="emsig-user"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Use Contact&rsquo;s Name & Title
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="emsig-custom"
                    name="signatureMode"
                    checked={(step1Data.signatureMode || "user") === "custom"}
                    onFocus={() => focusPreviewField("messaging")}
                    onChange={() =>
                      saveStepData(1, { ...step1Data, signatureMode: "custom" })
                    }
                    className="h-4 w-4"
                  />
                  <Label
                    htmlFor="emsig-custom"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Custom Signature
                  </Label>
                </div>
              </div>

              {(step1Data.signatureMode || "user") === "custom" && (
                <div className="space-y-3 pl-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={step1Data.customClosing || ""}
                        onChange={(e) =>
                          saveStepData(1, {
                            ...step1Data,
                            customClosing: e.target.value,
                          })
                        }
                        onFocus={() => focusPreviewField("messaging")}
                        placeholder='Closing text e.g. "We hope to inspire you to save!"'
                        className="h-9 shadow-sm border-muted text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          saveStepData(1, {
                            ...step1Data,
                            customClosingBold: !(
                              step1Data.customClosingBold ?? true
                            ),
                          })
                        }
                        className={`h-9 w-9 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                          step1Data.customClosingBold ?? true
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveStepData(1, {
                            ...step1Data,
                            customClosingItalic: !step1Data.customClosingItalic,
                          })
                        }
                        className={`h-9 w-9 flex items-center justify-center rounded text-xs italic transition-colors ${
                          step1Data.customClosingItalic
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Italic"
                      >
                        I
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={step1Data.customSignatureName || ""}
                        onChange={(e) =>
                          saveStepData(1, {
                            ...step1Data,
                            customSignatureName: e.target.value,
                          })
                        }
                        onFocus={() => focusPreviewField("messaging")}
                        placeholder='Signature name e.g. "[Name] - [Position]"'
                        className="h-9 shadow-sm border-muted text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          saveStepData(1, {
                            ...step1Data,
                            customSignatureNameBold:
                              !step1Data.customSignatureNameBold,
                          })
                        }
                        className={`h-9 w-9 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                          step1Data.customSignatureNameBold
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveStepData(1, {
                            ...step1Data,
                            customSignatureNameItalic:
                              !step1Data.customSignatureNameItalic,
                          })
                        }
                        className={`h-9 w-9 flex items-center justify-center rounded text-xs italic transition-colors ${
                          step1Data.customSignatureNameItalic
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Italic"
                      >
                        I
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={step1Data.customSignatureCompany || ""}
                        onChange={(e) =>
                          saveStepData(1, {
                            ...step1Data,
                            customSignatureCompany: e.target.value,
                          })
                        }
                        onFocus={() => focusPreviewField("messaging")}
                        placeholder="Company Name"
                        className="h-9 shadow-sm border-muted text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          saveStepData(1, {
                            ...step1Data,
                            customSignatureCompanyBold:
                              !step1Data.customSignatureCompanyBold,
                          })
                        }
                        className={`h-9 w-9 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                          step1Data.customSignatureCompanyBold
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveStepData(1, {
                            ...step1Data,
                            customSignatureCompanyItalic: !(
                              step1Data.customSignatureCompanyItalic ?? true
                            ),
                          })
                        }
                        className={`h-9 w-9 flex items-center justify-center rounded text-xs italic transition-colors ${
                          step1Data.customSignatureCompanyItalic ?? true
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        title="Italic"
                      >
                        I
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-line style controls for "Use Contact's Name & Title" mode */}
              {(step1Data.signatureMode || "user") === "user" && (
                <div className="space-y-2 pl-4">
                  <Label className="text-[11px] text-muted-foreground">
                    Text Style
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Closing
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            saveStepData(1, {
                              ...step1Data,
                              customClosingBold: !(
                                step1Data.customClosingBold ?? true
                              ),
                            })
                          }
                          className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${
                            step1Data.customClosingBold ?? true
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveStepData(1, {
                              ...step1Data,
                              customClosingItalic:
                                !step1Data.customClosingItalic,
                            })
                          }
                          className={`h-7 w-7 flex items-center justify-center rounded text-[11px] italic transition-colors ${
                            step1Data.customClosingItalic
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Italic"
                        >
                          I
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Signature Name
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            saveStepData(1, {
                              ...step1Data,
                              customSignatureNameBold:
                                !step1Data.customSignatureNameBold,
                            })
                          }
                          className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${
                            step1Data.customSignatureNameBold
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveStepData(1, {
                              ...step1Data,
                              customSignatureNameItalic:
                                !step1Data.customSignatureNameItalic,
                            })
                          }
                          className={`h-7 w-7 flex items-center justify-center rounded text-[11px] italic transition-colors ${
                            step1Data.customSignatureNameItalic
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Italic"
                        >
                          I
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Company Name
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            saveStepData(1, {
                              ...step1Data,
                              customSignatureCompanyBold:
                                !step1Data.customSignatureCompanyBold,
                            })
                          }
                          className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${
                            step1Data.customSignatureCompanyBold
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveStepData(1, {
                              ...step1Data,
                              customSignatureCompanyItalic: !(
                                step1Data.customSignatureCompanyItalic ?? true
                              ),
                            })
                          }
                          className={`h-7 w-7 flex items-center justify-center rounded text-[11px] italic transition-colors ${
                            step1Data.customSignatureCompanyItalic ?? true
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Italic"
                        >
                          I
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Help Cards Section — content removed for the redesign.
            Section 4 now, ahead of the Video section, so the editor's order matches
            the portal (the cards follow the welcome banner, before the video). The
            numbered shell and its scroll/highlight target stay so the new editor can
            be dropped in here, with the Step 2 preview and the portal section rebuilt
            together rather than one side at a time. */}
        <div
          ref={sectionsRef.helpCards}
          className={cn(
            "transition-all duration-500 rounded-xl",
            highlightedSection === "helpCards"
              ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800"
              : "",
          )}
        >
          <SectionHeader number={4} title="How Can We Help You Today?" />
        </div>

        {/* Plan Video Section */}
        <div
          ref={sectionsRef.planVideo}
          className={cn(
            "transition-all duration-500 rounded-xl",
            highlightedSection === "planVideo"
              ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800"
              : "",
          )}
        >
          <SectionHeader number={5} title="Video Source" />
          <p className="text-[13px] text-muted-foreground mb-6">
            Add the video shown in the journey section, say what it covers, and
            choose a poster image. Without a video, the category image is shown.
          </p>

          {/* 4a — Video Source: upload a file or paste a URL. */}
          <div className="space-y-4 mb-6 p-4 border border-muted rounded-lg bg-white dark:bg-gray-800">
            {/* Show on page — hides the whole video section on the portal when off. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="plan-video-visible"
                  checked={step1Data.planVideoVisible !== false}
                  onCheckedChange={handlePlanVideoVisibilityChange}
                />
                <Label
                  htmlFor="plan-video-visible"
                  className="cursor-pointer text-xs font-bold text-foreground"
                >
                  Show on page
                </Label>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {step1Data.planVideoVisible !== false
                  ? "The video section is visible on the portal."
                  : "The video section is hidden on the portal."}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="text-xs font-bold text-foreground">
                Video Source
              </Label>
              <div className="inline-flex overflow-hidden rounded-lg border border-muted">
                <button
                  type="button"
                  aria-pressed={videoSourceMode === "upload"}
                  onClick={() => setVideoSourceMode("upload")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                    videoSourceMode === "upload"
                      ? "bg-[#23919C] text-white"
                      : "bg-white text-muted-foreground hover:bg-muted dark:bg-gray-800",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  aria-pressed={videoSourceMode === "url"}
                  onClick={() => setVideoSourceMode("url")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 border-l border-muted px-3 text-xs font-medium transition-colors",
                    videoSourceMode === "url"
                      ? "bg-[#23919C] text-white"
                      : "bg-white text-muted-foreground hover:bg-muted dark:bg-gray-800",
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Paste URL
                </button>
              </div>
            </div>

            {videoSourceMode === "upload" ? (
              <div className="space-y-3">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag a video here or choose a file"
                  onClick={() => videoFileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      videoFileInputRef.current?.click();
                    }
                  }}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  onDrop={handleVideoDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                    isVideoDragOver
                      ? "border-[#23919C] bg-teal-50/60 dark:bg-teal-900/20"
                      : "border-muted hover:border-[#23919C]/60 hover:bg-muted/40",
                    videoUploading && "pointer-events-none opacity-60",
                  )}
                >
                  <Upload className="h-6 w-6 text-[#23919C]" />
                  <p className="text-sm font-medium">
                    Drag a video or file here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to choose a file · MP4, WebM, OGG
                  </p>
                  {videoUploading && (
                    <div className="mt-2 w-full max-w-xs">
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-[#23919C] transition-all duration-300"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Uploading… {videoUploadProgress}%
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/*,.mp4,.webm,.ogg"
                  onChange={handlePlanVideoUpload}
                  onFocus={() => focusPreviewField("planVideo")}
                  className="hidden"
                  disabled={videoUploading}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={videoUrlDraft}
                  onChange={(e) => setVideoUrlDraft(e.target.value)}
                  placeholder="https://…/video.mp4"
                  className="h-9 flex-1 text-sm"
                />
                <Button type="button" size="sm" onClick={handleApplyVideoUrl}>
                  Use URL
                </Button>
              </div>
            )}

            {step1Data.planVideo && (
              <Card className="border border-muted shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {step1Data.planVideoFileName || "External video"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current video source
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemovePlanVideo}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                  <div className="aspect-video overflow-hidden rounded-lg bg-black">
                    <video
                      src={resolvedPlanVideoUrl}
                      poster={resolvedThumbnailUrl || undefined}
                      controls
                      className="h-full w-full object-contain"
                      playsInline
                      preload="metadata"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 4b — What's the video about? */}
          <div className="space-y-3 mb-6 p-4 border border-muted rounded-lg bg-white dark:bg-gray-800">
            <Label className="text-xs font-bold text-foreground">
              {"What's the video about?"}
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {VIDEO_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={step1Data.planVideoLabel === label}
                  onClick={() => handleVideoLabelChange(label)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    step1Data.planVideoLabel === label
                      ? "border-[#23919C] bg-[#23919C] text-white"
                      : "border-muted bg-white text-muted-foreground hover:border-[#23919C]/60 hover:text-foreground dark:bg-gray-800",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 4c — Thumbnail: uploaded image or a captured video frame. */}
          <div className="space-y-3 mb-6 p-4 border border-muted rounded-lg bg-white dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="text-xs font-bold text-foreground">
                Thumbnail
              </Label>
              <div className="inline-flex overflow-hidden rounded-lg border border-muted">
                <button
                  type="button"
                  aria-pressed={thumbnailMode === "upload"}
                  onClick={() => setThumbnailMode("upload")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                    thumbnailMode === "upload"
                      ? "bg-[#23919C] text-white"
                      : "bg-white text-muted-foreground hover:bg-muted dark:bg-gray-800",
                  )}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload Image
                </button>
                <button
                  type="button"
                  aria-pressed={thumbnailMode === "frame"}
                  disabled={!resolvedPlanVideoUrl}
                  title={
                    resolvedPlanVideoUrl
                      ? undefined
                      : "Add a video source first"
                  }
                  onClick={() => setThumbnailMode("frame")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 border-l border-muted px-3 text-xs font-medium transition-colors",
                    thumbnailMode === "frame"
                      ? "bg-[#23919C] text-white"
                      : "bg-white text-muted-foreground hover:bg-muted dark:bg-gray-800",
                    !resolvedPlanVideoUrl &&
                      "cursor-not-allowed opacity-50 hover:bg-white dark:hover:bg-gray-800",
                  )}
                >
                  <Video className="h-3.5 w-3.5" />
                  From Video
                </button>
              </div>
            </div>

            {thumbnailMode === "upload" ? (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailFileChange}
                  disabled={thumbnailBusy}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG, or WebP. Downscaled to {THUMBNAIL_MAX_EDGE} px.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <video
                  ref={thumbnailVideoRef}
                  src={resolvedPlanVideoUrl || undefined}
                  className="aspect-video w-full rounded-md bg-black"
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) =>
                    setThumbnailDuration(e.currentTarget.duration || 0)
                  }
                />
                <input
                  type="range"
                  min={0}
                  max={thumbnailDuration || 0}
                  step={0.1}
                  value={Math.min(thumbnailFrameTime, thumbnailDuration || 0)}
                  onChange={(e) => handleThumbnailScrub(Number(e.target.value))}
                  aria-label="Choose the video frame to use"
                  className="w-full accent-[#23919C]"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void captureThumbnailFrame()}
                  disabled={thumbnailBusy || !resolvedPlanVideoUrl}
                >
                  Use This Frame
                </Button>
              </div>
            )}

            {resolvedThumbnailUrl && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedThumbnailUrl}
                  alt="Current video thumbnail"
                  className="h-16 w-28 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Current thumbnail</p>
                  <p className="text-xs text-muted-foreground">
                    Shown before the video plays.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveThumbnail}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Video Section Overrides */}
          <div className="space-y-4 mb-6 p-4 border border-muted rounded-lg bg-white dark:bg-gray-800">
            <Label className="text-xs font-bold text-foreground">
              Video Section Text
            </Label>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Customize the header, subtitle, and body text shown in the
              Retirement Journey section below the welcome banner.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Header
                </Label>
                <Input
                  value={step1Data.journeyHeader || ""}
                  onChange={(e) =>
                    saveStepData(1, {
                      ...step1Data,
                      journeyHeader: e.target.value,
                    })
                  }
                  onFocus={() => focusPreviewField("journeyHeader")}
                  placeholder="Section Header"
                  className="h-9 shadow-sm border-muted text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Subtitle
                </Label>
                <Input
                  value={step1Data.journeySubtitle || ""}
                  onChange={(e) =>
                    saveStepData(1, {
                      ...step1Data,
                      journeySubtitle: e.target.value,
                    })
                  }
                  onFocus={() => focusPreviewField("journeySubtitle")}
                  placeholder="e.g. Build your future with confidence."
                  className="h-9 shadow-sm border-muted text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Body Text
                </Label>
                <Textarea
                  value={step1Data.journeyBodyText || ""}
                  onChange={(e) =>
                    saveStepData(1, {
                      ...step1Data,
                      journeyBodyText: e.target.value,
                    })
                  }
                  onFocus={() => focusPreviewField("journeyBodyText")}
                  placeholder="Preview of the featured video."
                  className="min-h-[80px] shadow-sm border-muted text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Benefit Access & Materials Section */}
        <div
          ref={sectionsRef.insurance}
          className={cn(
            "transition-all duration-500 rounded-xl",
            highlightedSection === "insurance"
              ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800"
              : "",
          )}
        >
          <SectionHeader number={6} title="Benefit Access & Materials" />
          <p className="text-[13px] text-muted-foreground mb-6">
            Configure the plan ID and login button shown in the Insurance
            Benefits Access & Materials section.
          </p>
          <div className="space-y-6">
            <div
              className="space-y-4"
              onMouseDown={() => focusPreviewField("insuranceBackgroundImage")}
            >
              <Label className="text-xs font-bold text-foreground">
                Background Image
              </Label>
              <BrandImageUpload
                slotKey="insuranceBg"
                slot={{
                  title: "",
                  description:
                    "This image displays behind the Insurance Benefits Access & Materials section heading.",
                  recommendedSize: "1920×1080 px",
                  accept: ".png,.jpg,.jpeg",
                  required: false,
                  previewAspectRatio: 2.75,
                  previewLabel: "Insurance Background Preview",
                  defaultPhoteButton: true,
                }}
                currentImage={
                  step1Data.insuranceBackgroundImage
                    ? ({
                        url: step1Data.insuranceBackgroundImage,
                        fileName: "insurance-bg.png",
                        fileSize: 0,
                        width: 0,
                        height: 0,
                        recommendedSize: "1920×1080",
                        status: "ok",
                        warnings: [],
                      } as BrandImageData)
                    : undefined
                }
                onImageChange={(imageData) =>
                  saveStepData(1, {
                    ...step1Data,
                    insuranceBackgroundImage: imageData.url,
                  })
                }
                onImageRemove={() =>
                  saveStepData(1, {
                    ...step1Data,
                    insuranceBackgroundImage: undefined,
                  })
                }
                onDefaultPhotoClick={() => {
                  const defaultBgs: Record<string, string> = {
                    Retirement:
                      "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1920&q=80",
                    "Group Health":
                      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&q=80",
                    "Group Life":
                      "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1920&q=80",
                    "Company / Plan Sponsor":
                      "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1920&q=80",
                  };
                  const defaultBg =
                    defaultBgs[step1Data?.benefitCategory || "Retirement"];
                  saveStepData(1, {
                    ...step1Data,
                    insuranceBackgroundImage: defaultBg,
                  });
                }}
                hideButtons={true}
                useUniversalModal={true}
                universalModalType="normalizer"
                // 1920×1080 section background, not a logo.
                universalModalAllowBackgroundRemoval={false}
                universalModalCustomConfig={{
                  modalTitle: "Background Image",
                  modalDescription:
                    "This image displays behind the Insurance Benefits Access & Materials section heading.",
                  // Not a logo — keep the size-based hint instead of
                  // the logo guidance inherited from `normalizer`.
                  recommendedText: undefined,
                }}
              />
            </div>

            {/* Insurance Overlay Settings — only Container Opacity */}
            <div className="space-y-4">
              <Label className="text-xs font-bold text-foreground">
                Overlay Darkness
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(
                      (step1Data.insuranceContainerBlockOpacity ?? 0.8) * 100,
                    )}
                    % opacity
                  </span>
                </div>
                <Slider
                  value={[step1Data.insuranceContainerBlockOpacity ?? 0.8]}
                  onValueChange={([value]) =>
                    saveStepData(1, {
                      ...step1Data,
                      insuranceContainerBlockOpacity: value,
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Controls how dark the overlay is over the background image.
                Higher values = darker overlay.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Plan / Group ID
              </Label>
              <Input
                value={step1Data.insurancePlanId || ""}
                onMouseDown={() => focusPreviewField("insurancePlanId")}
                onFocus={() => focusPreviewField("insurancePlanId")}
                onChange={(e) => {
                  // Auto-format to xxxx-xxxx-xxxx pattern
                  const raw = e.target.value
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .toUpperCase()
                    .slice(0, 12);
                  const groups = [];
                  for (let i = 0; i < raw.length; i += 4) {
                    groups.push(raw.slice(i, i + 4));
                  }
                  const formatted = groups.join("-");
                  saveStepData(1, { ...step1Data, insurancePlanId: formatted });
                }}
                placeholder="xxxx-xxxx-xxxx"
                className="h-11 shadow-sm border-muted font-mono tracking-wider"
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  This appears as &ldquo;PLAN / GROUP ID: [value]&rdquo; on the
                  Insurance Benefits card.
                </p>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {(step1Data.insurancePlanId || "").replace(/-/g, "").length}
                  /12
                </span>
              </div>
            </div>
            <div
              className="space-y-2"
              ref={insuranceLoginUrlRef}
              data-field="insuranceLoginUrl"
            >
              <Label className="text-xs font-bold text-foreground">
                Register or Login Here Button URL{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                value={step1Data.insuranceLoginUrl || ""}
                onChange={(e) =>
                  saveStepData(1, {
                    ...step1Data,
                    insuranceLoginUrl: e.target.value,
                  })
                }
                onMouseDown={() => focusPreviewField("insuranceLoginUrl")}
                onFocus={() => focusPreviewField("insuranceLoginUrl")}
                placeholder="e.g. https://portal.empower.com/auth/login"
                destructive={isFieldInvalid("insuranceLoginUrl")}
                data-field="insuranceLoginUrl"
                className={cn(
                  "h-11 shadow-sm border-muted",
                  isFieldInvalid("insuranceLoginUrl") &&
                    "border-red-500 dark:border-red-500",
                )}
                type="url"
              />
              <p className="text-[11px] text-muted-foreground">
                Full URL for the &ldquo;REGISTER OR LOGIN HERE&rdquo; button.
              </p>
            </div>

            {/* Provider / Recordkeeper — the company that administers this
                            benefit. Shown beside the REGISTER OR LOGIN button on the
                            portal; its logo is the Benefit Logo above (`partnerLogo`). */}
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="text-xs font-bold text-foreground">
                  Provider / Recordkeeper
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  The company that administers this benefit — for example a
                  retirement recordkeeper or an insurance carrier. It is shown
                  next to the &ldquo;REGISTER OR LOGIN HERE&rdquo; button.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">
                  Provider name
                </Label>
                {/* Free text — the `list`/`<datalist>` pair that used to
                                    be here rendered a suggestion dropdown, which read as
                                    a fixed picker. Any recordkeeper or carrier name can
                                    be typed; the examples live in the placeholder only. */}
                <Input
                  value={step1Data.providerContact?.companyName || ""}
                  onChange={(e) =>
                    saveStepData(1, {
                      ...step1Data,
                      providerContact: {
                        ...(step1Data.providerContact || {}),
                        companyName: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Voya, Empower, Principal, Fidelity"
                  className="h-11 shadow-sm border-muted"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">
                    Provider contact (optional)
                  </Label>
                  <Input
                    value={step1Data.providerContact?.contactName || ""}
                    onChange={(e) =>
                      saveStepData(1, {
                        ...step1Data,
                        providerContact: {
                          ...(step1Data.providerContact || {}),
                          contactName: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Jane Doe"
                    className="h-11 shadow-sm border-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">
                    Provider phone (optional)
                  </Label>
                  <Input
                    type="tel"
                    // "(800) 555-1212" is exactly 14 characters, so
                    // this caps the field at a formatted 10-digit US
                    // number — the same limit the handler below stores.
                    maxLength={14}
                    // Digits are stored; the value is formatted on the
                    // way in so the advisor sees (800) 555-1212 rather
                    // than a raw 8005551212 (and existing saved values
                    // with punctuation render formatted too).
                    value={formatPhoneNumber(
                      step1Data.providerContact?.phone || "",
                    )}
                    onChange={(e) => {
                      const digits = normalizePhoneNumber(e.target.value);
                      // Ignore an 11th digit instead of silently
                      // dropping it at display time.
                      if (digits.length > 10) return;
                      saveStepData(1, {
                        ...step1Data,
                        providerContact: {
                          ...(step1Data.providerContact || {}),
                          phone: digits,
                        },
                      });
                    }}
                    placeholder="e.g. (800) 555-1212"
                    className="h-11 shadow-sm border-muted"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Default-photo gallery for the Header Background. Its trigger lives inside
                the upload card's empty state, so the dialog is mounted with the panel. */}
      <ModalGallery
        open={heroGalleryOpen}
        onOpenChange={setHeroGalleryOpen}
        images={heroGalleryImages}
        onSelect={(url) => {
          // Applied as chosen, uncropped — the banner paints this with
          // `background-size: cover`, so any framing is preserved rather than
          // lost to a crop the advisor did not ask for. Their own upload path
          // goes through the card's "New Image" control.
          handleBackgroundImageChange({
            url,
            fileName: "default-header.jpg",
            fileSize: 0,
            width: 0,
            height: 0,
            recommendedSize: "1920×1080 px",
            status: "ok",
            warnings: [],
          });
        }}
      />
    </EditorPanelWrapper>
  );
}
