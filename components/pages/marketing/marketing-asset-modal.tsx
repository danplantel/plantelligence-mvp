"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { downloadFlyerPdf } from "@/lib/marketing/flyer-pdf";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Eye, Calendar, Clock, MapPin, QrCode, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatUsDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { FlyerPreview, type FlyerTemplateId } from "./flyer-templates";

export type AssetType = "flyer" | "portal-notice" | "pop-up" | "news-post";

export type PortalNoticeElement = "top-banner" | "pop-up" | "news-post";

/** Four available background images for News Post assets — each can only be used once per client. */
export const NEWS_POST_BG_IMAGES = [
  { id: "bg_01", src: "/news-post-bg-images/news_post_bg_image_01.webp", alt: "Background 1" },
  { id: "bg_02", src: "/news-post-bg-images/news_post_bg_image_02.webp", alt: "Background 2" },
  { id: "bg_03", src: "/news-post-bg-images/news_post_bg_image_03.webp", alt: "Background 3" },
  { id: "bg_04", src: "/news-post-bg-images/news_post_bg_image_04.webp", alt: "Background 4" },
] as const;

export interface QrCodeResult {
  dataUrl: string;
  source: "qrio" | "local";
  qrIoId?: string;
  name?: string;
}

export type MarketingAssetStatus =
  | "Draft"
  | "Ready for Review"
  | "Published"
  | "Scheduled"
  | "Hidden"
  | "Archived";

export interface FlyerSaveData {
  headline: string;
  body: string;
  startDate: string;
  bgColor: string;
  planName: string;
  planLogo?: string;
  flyerSubtitle?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  disclaimerText?: string;
  meetingTime?: string;
  meetingLocation?: string;
  status: MarketingAssetStatus;
}

interface MarketingAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetType: AssetType;
  planName: string;
  planId: string;
  onSave?: () => void;
  /** When editing an existing flyer, start at the template/details step */
  initialFlyerStep?: number;
  /** When editing an existing portal-notice (top banner), skip the element picker */
  initialPortalElement?: PortalNoticeElement | null;
  /** When editing an existing asset, pass its full data to pre-populate the form */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editingAsset?: any;
  /** When true, shows only the preview pane — hides the form and save controls */
  previewOnly?: boolean;
  /** Called when the Edit button is clicked in preview-only mode */
  onEditFromPreview?: () => void;
}

interface Meeting {
  id: string;
  meeting: string;
  meetingType: string;
  client: string;
  clientId?: string | null;
  date: string;
  time: string;
  timezone?: string;
  duration: string;
  format: string;
  platform?: string;
  address?: string;
  city?: string;
  state?: string;
  description?: string;
}

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const ASSET_META: Record<AssetType, { label: string; icon: string }> = {
  "flyer": { label: "Flyer", icon: "📄" },
  "portal-notice": { label: "Portal Notice", icon: "📢" },
  "pop-up": { label: "Pop-Up Message", icon: "💬" },
  "news-post": { label: "News & Events Post", icon: "📰" },
};

interface FlyerTemplateDefaults {
  headline: string;
  subtitle: string;
  body: string;
}

const MEETING_TEMPLATE_DEFAULTS: Record<string, FlyerTemplateDefaults> = {
  "MeetingTemplate1": { headline: "MISSING", subtitle: "Retirement Savings From Your Former Employer", body: "Whether you've moved to a new job or are between opportunities, how you manage your savings now will shape your future retirement. /n **PLEASE CONTACT US TO BE RE-UNITED WITH YOUR MONEY**" },
  "MeetingTemplate2": { headline: "MISSING", subtitle: "Important Update",     body: "We have important information to share about your benefits." },
  "MeetingTemplate3": { headline: "MISSING", subtitle: "Benefits Summary",     body: "Here is a summary of the key benefits and what they mean for you." },
  "MeetingTemplate4": { headline: "MISSING", subtitle: "Save the Date",        body: "Mark your calendar for this upcoming benefits event." },
};

const TOPICAL_TEMPLATE_DEFAULTS: Record<string, FlyerTemplateDefaults> = {
  "TopicalTemplate1": { headline: "MISSING", subtitle: "Learn more about this topic", body: "Explore this topic to understand how it fits into your overall benefits strategy." },
};

export default function MarketingAssetModal({
  open,
  onOpenChange,
  assetType,
  planName,
  planId,
  onSave,
  initialFlyerStep,
  initialPortalElement,
  editingAsset,
  previewOnly,
  onEditFromPreview,
}: MarketingAssetModalProps) {
  const { toast } = useToast();
  const meta = ASSET_META[assetType];

  const { data: meetingsData } = useSWR(
    assetType === "flyer" && planId ? `/api/meetings?clientId=${planId}` : null,
    jsonFetcher,
    { dedupingInterval: 30_000, revalidateOnFocus: false },
  );
  const meetings: Meeting[] = useMemo(() => meetingsData?.data ?? [], [meetingsData]);

  const { data: planData } = useSWR(
    planId ? `/api/clients/${planId}` : null,
    jsonFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const { data: profileData } = useSWR(
    "/api/profile",
    jsonFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const planLogo: string | undefined = useMemo(
    () => (planData?.data as { companyLogo?: string })?.companyLogo,
    [planData],
  );
  const organizationLogo: string | undefined = useMemo(
    () => (profileData as { advisorLogoUrl?: string })?.advisorLogoUrl,
    [profileData],
  );
  const planBrandColor: string | undefined = useMemo(
    () => (planData?.data as { brandColor?: string })?.brandColor,
    [planData],
  );
  const planSecondaryColor: string | undefined = useMemo(
    () => (planData?.data as { secondaryColor?: string })?.secondaryColor,
    [planData],
  );

  // Shared fields
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bgColor, setBgColor] = useState("#23919c");
  const [ctaText, setCtaText] = useState("");

  // Flyer-specific
  const [flyerStep, setFlyerStep] = useState(0);
  const [flyerMode, setFlyerMode] = useState<"meeting" | "topical" | null>(null);
  const [flyerTopic, setFlyerTopic] = useState("");
  const [flyerSubtitle, setFlyerSubtitle] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingPlatform, setMeetingPlatform] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [flyerImage, setFlyerImage] = useState<string>("");
  const [flyerImageLoading, setFlyerImageLoading] = useState(false);
  const [flyerQrUrl, setFlyerQrUrl] = useState("");
  const [flyerQrDataUrl, setFlyerQrDataUrl] = useState<string>("");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrResult, setQrResult] = useState<QrCodeResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flyerPreviewRef = useRef<HTMLDivElement>(null);
  const [assetStatus, setAssetStatus] = useState<MarketingAssetStatus>("Draft");
  const [flyerCategory, setFlyerCategory] = useState("");
  const [flyerTemplate, setFlyerTemplate] = useState<string>("MeetingTemplate1");
  const DEFAULT_DISCLAIMER = "Securities and advisory services offered through LPL Financial, a registered investment advisor, Member FINRA/SIPC.";
  const [disclaimerText, setDisclaimerText] = useState(DEFAULT_DISCLAIMER);

  // Portal-notice specific
  const [portalElement, setPortalElement] = useState<PortalNoticeElement | null>(null);
  const [noticeType, setNoticeType] = useState<"text" | "countdown">("text");
  const [countdownTarget, setCountdownTarget] = useState("");
  const [portalCtaUrl, setPortalCtaUrl] = useState("");
  const [buttonColor, setButtonColor] = useState("#ffffff");

  // Pop-up specific
  const [showEveryVisit, setShowEveryVisit] = useState(false);
  const [popupCtaUrl, setPopupCtaUrl] = useState("");
  const POPUP_PAGES = [
    { id: "all", label: "All Pages" },
    { id: "home", label: "Home Page" },
    { id: "benefits", label: "Benefits" },
    { id: "news-events", label: "News & Events" },
    { id: "my-benefits-team", label: "My Benefits Team" },
  ] as const;
  const [popupPages, setPopupPages] = useState<string[]>(["all"]);

  // Preview mode toggle
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // News post specific
  const [postCategory, setPostCategory] = useState("Retirement");
  const [selectedBgImage, setSelectedBgImage] = useState<string>("");
  const [existingNewsPosts, setExistingNewsPosts] = useState<any[]>([]);
  const [newsPostLimitReached, setNewsPostLimitReached] = useState(false);
  const [newsPostCtaUrl, setNewsPostCtaUrl] = useState("");

  // Fetch existing news-post assets to enforce max 4 and unique images per client
  useEffect(() => {
    if (!planId) return;
    // Only fetch when the news-post form is visible (either direct or via portal-notice sub-element)
    if (assetType !== "news-post" && !(assetType === "portal-notice" && portalElement === "news-post")) return;
    fetch(`/api/marketing/assets/public?clientId=${planId}&type=news-post`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setExistingNewsPosts(res.data);
          // If creating (not editing) and already have 4, block creation
          if (!editingAsset && res.data.length >= 4) {
            setNewsPostLimitReached(true);
          }
        }
      })
      .catch(() => {});
  }, [planId, editingAsset, assetType, portalElement]);

  /** IDs of background images already used by other news posts for this client */
  const usedBgImageIds: string[] = useMemo(() => {
    return existingNewsPosts
      .filter((p: any) => p.id !== editingAsset?.id) // exclude current asset when editing
      .map((p: any) => {
        const d = (p.data as Record<string, unknown>) ?? {};
        return d.bgImage as string;
      })
      .filter(Boolean);
  }, [existingNewsPosts, editingAsset]);

  /** Resolve the effective asset type — when Portal Notice picks a sub-element,
   *  "pop-up" and "news-post" map to their own types, while "top-banner" stays as "portal-notice". */
  const resolvedType: AssetType = useMemo(() => {
    if (assetType !== "portal-notice" || !portalElement) return assetType;
    if (portalElement === "top-banner") return "portal-notice";
    return portalElement; // "pop-up" | "news-post"
  }, [assetType, portalElement]);

  const isFlyerLocked = resolvedType === "flyer" && flyerMode === "meeting" && !selectedMeetingId;

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId),
    [meetings, selectedMeetingId],
  );

  // When in topical mode, force template to TopicalTemplate1
  useEffect(() => {
    if (resolvedType !== "flyer" || flyerStep < 3) return;
    if (flyerMode === "topical" && flyerTemplate !== "TopicalTemplate1") {
      setFlyerTemplate("TopicalTemplate1");
    }
  }, [flyerMode, flyerStep, resolvedType, flyerTemplate]);

  // Apply template defaults whenever user enters step 3 (template) or changes template
  useEffect(() => {
    if (resolvedType !== "flyer" || flyerStep < 3) return;
    const defaults = flyerMode === "meeting"
      ? MEETING_TEMPLATE_DEFAULTS[flyerTemplate]
      : TOPICAL_TEMPLATE_DEFAULTS[flyerTemplate];
    if (!defaults) return;
    setHeadline(defaults.headline);
    setFlyerSubtitle(defaults.subtitle);
    // Convert /n to actual newlines so defaults can define line breaks
    setBody(defaults.body.replace(/\/n/g, "\n"));
  }, [flyerTemplate, flyerStep, flyerMode, resolvedType]);

  useEffect(() => {
    if (editingAsset) {
      // ── Editing mode: populate from existing asset ──
      const d = (editingAsset.data as Record<string, unknown>) ?? {};
      setHeadline((editingAsset.headline as string) || "");
      setBody((editingAsset.body as string) || "");
      setStartDate((editingAsset.startDate as string) || "");
      setEndDate((editingAsset.endDate as string) || "");
      setBgColor((editingAsset.bgColor as string) || "#23919c");
      setCtaText((editingAsset.ctaText as string) || (d.ctaText as string) || "");
      setAssetStatus((editingAsset.status as MarketingAssetStatus) || "Draft");

      // Portal-notice specific
      if (assetType === "portal-notice") {
        setNoticeType((d.noticeType as "text" | "countdown") || "text");
        setCountdownTarget((d.countdownTarget as string) || "");
        setPortalCtaUrl((d.portalCtaUrl as string) || "");
        setPortalElement((editingAsset.portalElement as PortalNoticeElement) || "top-banner");
        setButtonColor((d.buttonColor as string) || "#ffffff");
      }

      // Pop-up specific
      if (assetType === "pop-up" || editingAsset.type === "pop-up") {
        setShowEveryVisit(!!d.showEveryVisit);
        setPopupPages((d.popupPages as string[]) || ["all"]);
        setFlyerSubtitle((editingAsset.flyerSubtitle as string) || (d.flyerSubtitle as string) || "");
        setPopupCtaUrl((d.ctaUrl as string) || "");
      }

      // News post specific
      if (assetType === "news-post" || editingAsset.type === "news-post") {
        setFlyerSubtitle((editingAsset.flyerSubtitle as string) || (d.flyerSubtitle as string) || "");
        setPostCategory((d.category as string) || "Retirement");
        setCtaText((editingAsset.ctaText as string) || (d.ctaText as string) || "");
        setSelectedBgImage((d.bgImage as string) || "");
        setNewsPostCtaUrl((d.ctaUrl as string) || "");
      }

      // Flyer specific
      if (assetType === "flyer" || editingAsset.type === "flyer") {
        setFlyerStep(3);
        setFlyerMode("meeting");
        setFlyerSubtitle((editingAsset.flyerSubtitle as string) || (d.flyerSubtitle as string) || "");
        setFlyerTemplate((d.flyerTemplate as string) || "MeetingTemplate1");
        setFlyerCategory((d.flyerCategory as string) || "");
        setMeetingTime((d.meetingTime as string) || "");
        setMeetingLocation((d.meetingLocation as string) || "");
        setFlyerImage((editingAsset.flyerImage as string) || (d.flyerImage as string) || "");
        setFlyerQrUrl((d.flyerQrUrl as string) || "");
        setFlyerQrDataUrl((d.flyerQrDataUrl as string) || "");
        setDisclaimerText((d.disclaimerText as string) || DEFAULT_DISCLAIMER);
      }
    } else {
      // ── Create mode: reset all fields ──
      setHeadline("");
      setBody("");
      setStartDate("");
      setEndDate("");
      setBgColor(planBrandColor || "#23919c");
      setFlyerStep(0);
      setFlyerMode(null);
      setFlyerTopic("");
      setFlyerSubtitle("");
      setMeetingTime("");
      setMeetingPlatform("");
      setMeetingLocation("");
      setSelectedMeetingId("");
      setFlyerImage("");
      setFlyerQrUrl("");
      setFlyerQrDataUrl("");
      setQrGenerating(false);
      setQrResult(null);
      setFlyerCategory("");
      setFlyerTemplate("MeetingTemplate1");
      setDisclaimerText(DEFAULT_DISCLAIMER);
      setShowEveryVisit(false);
      setPopupPages(["all"]);
      setPopupCtaUrl("");
      setAssetStatus("Draft");
      setNoticeType("text");
      setCountdownTarget("");
      setPortalCtaUrl("");
      setButtonColor("#ffffff");
      setCtaText("");
      setPostCategory("Retirement");
      setSelectedBgImage("");
      setNewsPostCtaUrl("");
      setNewsPostLimitReached(false);
      setExistingNewsPosts([]);
      setPortalElement(null);
    }
  }, [open, assetType, editingAsset]);

  // Apply initial values when opening for edit (after reset above)
  useEffect(() => {
    if (!open) return;
    if (initialFlyerStep !== undefined && assetType === "flyer") {
      setFlyerStep(initialFlyerStep);
      setFlyerMode("meeting");
    }
    if (initialPortalElement !== undefined && assetType === "portal-notice") {
      setPortalElement(initialPortalElement);
    }
  }, [open]); // only when modal opens, not on every re-render

  const handleMeetingSelect = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    const m = meetings.find((x) => x.id === meetingId);
    if (m) {
      setHeadline(m.meeting);
      setBody(m.description || "");
      setFlyerSubtitle("Join us for this important session");
      setStartDate(m.date);
      setMeetingTime(m.time || "");
      setMeetingPlatform(m.platform || "");
      setMeetingLocation(
        m.format === "In-Person"
          ? [m.city, m.state].filter(Boolean).join(", ") || "In-Person"
          : m.platform || m.format || "Virtual"
      );
    }
  };

  const previewHeadline =
    resolvedType === "flyer" && flyerMode === "meeting" && !selectedMeeting
      ? "Select a meeting below"
      : headline || (resolvedType === "news-post" ? "Post Headline" : "Flyer Preview");
  const previewBody =
    resolvedType === "flyer" && flyerMode === "meeting" && !selectedMeeting
      ? "Choose a meeting to populate the flyer content automatically."
      : body || "Your content will appear here…";

  const handleDownloadPdf = useCallback(async () => {
    const svgEl = flyerPreviewRef.current?.querySelector("svg");
    if (!svgEl) return;
    const safeName = planName.replace(/[^a-zA-Z0-9_-]/g, "_");
    await downloadFlyerPdf(svgEl, `${safeName}_flyer.pdf`);
  }, [planName]);

  const handleGenerateQr = useCallback(async () => {
    if (!flyerQrUrl.trim()) return;
    setQrGenerating(true);
    try {
      const res = await fetch("/api/marketing/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: flyerQrUrl.trim(),
          size: 320,
          name: headline ? `Flyer: ${headline} - ${planName}` : `Flyer - ${planName}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "QR generation failed");
      const result = json.data as QrCodeResult;
      setFlyerQrDataUrl(result.dataUrl);
      setQrResult(result);
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      setFlyerQrDataUrl("");
      setQrResult(null);
    } finally {
      setQrGenerating(false);
    }
  }, [flyerQrUrl, headline, planName]);

  const handleSave = async () => {
    if (isSaving) return;

    // Validate Top Banner required fields
    if (resolvedType === "portal-notice") {
      if (!headline.trim()) {
        toast({ title: "Validation error", description: "Headline is required for Top Banner.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!startDate) {
        toast({ title: "Validation error", description: "Start date is required for Top Banner.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!endDate) {
        toast({ title: "Validation error", description: "End date is required for Top Banner.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
    }

    // Validate Pop-Up required fields
    if (resolvedType === "pop-up") {
      if (!headline.trim()) {
        toast({ title: "Validation error", description: "Headline is required for Pop-Up.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!body.trim()) {
        toast({ title: "Validation error", description: "Body text is required for Pop-Up.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (popupPages.length === 0) {
        toast({ title: "Validation error", description: "At least one page must be selected for Pop-Up.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!startDate) {
        toast({ title: "Validation error", description: "Start date is required for Pop-Up.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!endDate) {
        toast({ title: "Validation error", description: "End date is required for Pop-Up.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
    }

    // Validate News Post required fields
    if (resolvedType === "news-post") {
      if (!headline.trim()) {
        toast({ title: "Validation error", description: "Headline is required for News Post.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!body.trim()) {
        toast({ title: "Validation error", description: "Body text is required for News Post.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!postCategory) {
        toast({ title: "Validation error", description: "Category is required for News Post.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!selectedBgImage) {
        toast({ title: "Validation error", description: "Background image is required for News Post.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!startDate) {
        toast({ title: "Validation error", description: "Start date is required for News Post.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
      if (!endDate) {
        toast({ title: "Validation error", description: "End date is required for News Post.", variant: "destructive", className: "z-[9999]" });
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);

    let resolvedQrDataUrl = flyerQrDataUrl;
    let resolvedQrResult = qrResult;
    if (resolvedType === "flyer" && flyerQrUrl.trim() && !flyerQrDataUrl) {
      try {
        const res = await fetch("/api/marketing/qr/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: flyerQrUrl.trim(),
            size: 320,
            name: headline ? `Flyer: ${headline} - ${planName}` : `Flyer - ${planName}`,
          }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const result = json.data as QrCodeResult;
          resolvedQrDataUrl = result.dataUrl;
          resolvedQrResult = result;
          setFlyerQrDataUrl(result.dataUrl);
          setQrResult(result);
        }
      } catch (err) {
        console.warn("Auto QR generation failed at save time:", err);
      }
    }

    const data: Record<string, unknown> = {};
    if (resolvedType === "flyer") {
      data.flyerSubtitle = flyerSubtitle;
      data.meetingTime = meetingTime;
      data.meetingLocation = meetingLocation;
      data.flyerImage = flyerImage;
      data.flyerQrUrl = flyerQrUrl;
      data.flyerQrDataUrl = resolvedQrDataUrl || null;
      data.flyerQrSource = resolvedQrResult?.source || null;
      data.flyerQrIoId = resolvedQrResult?.qrIoId || null;
      data.flyerCategory = flyerCategory || null;
      data.flyerTemplate = flyerTemplate;
      data.disclaimerText = disclaimerText || null;
    }
    if (resolvedType === "portal-notice") {
      data.noticeType = noticeType;
      data.countdownTarget = countdownTarget || null;
      data.portalCtaUrl = portalCtaUrl || null;
      data.buttonColor = buttonColor || null;
    }
    if (resolvedType === "pop-up") {
      data.showEveryVisit = showEveryVisit;
      data.popupPages = popupPages;
      data.flyerSubtitle = flyerSubtitle || null;
      data.ctaUrl = popupCtaUrl || null;
    }
    if (resolvedType === "news-post") {
      data.category = postCategory;
      data.flyerSubtitle = flyerSubtitle || null;
      data.bgImage = selectedBgImage || null;
      data.ctaUrl = newsPostCtaUrl || null;
    }

    const isEditing = !!editingAsset;
    const url = isEditing
      ? `/api/marketing/assets/${editingAsset.id}`
      : "/api/marketing/assets";
    const method = isEditing ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? {
                status: assetStatus,
                headline: headline || meta.label,
                body,
                ctaText: ctaText || "",
                startDate: startDate || null,
                endDate: endDate || null,
                bgColor,
                data,
              }
            : {
                clientId: planId,
                type: resolvedType,
                status: assetStatus,
                headline: headline || meta.label,
                body,
                ctaText: ctaText || "",
                startDate: startDate || null,
                endDate: endDate || null,
                bgColor,
                data,
              }
        ),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Failed to save asset", description: err.error || `Server returned ${res.status}`, variant: "destructive" });
        setIsSaving(false);
        return;
      }

      const saveLabel =
        assetType === "portal-notice" && portalElement
          ? portalElement === "top-banner"
            ? ASSET_META["portal-notice"].label
            : ASSET_META[portalElement as AssetType].label
          : meta.label;
      onSave?.();
      toast({
        title: `${saveLabel} ${isEditing ? "updated" : "saved"}`,
        description: `"${headline || saveLabel}" has been ${isEditing ? "updated" : "created"} as ${assetStatus}.`,
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100 dark:border-green-800",
      });
    } catch (error) {
      toast({
        title: "Failed to save asset",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }

    setIsSaving(false);
    onOpenChange(false);
  };

  // ── Shared form sections used by both the normal view and Portal Notice Slide 2 ──
  const formSections = (
    <>
      {/* ── Flyer: Typeform-style step flow ── */}
      {resolvedType === "flyer" && (
        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    flyerStep === step
                      ? "bg-accent-blue text-white"
                      : flyerStep > step
                        ? "bg-accent-blue text-white"
                        : "bg-gray-200 text-gray-400 dark:bg-gray-700"
                  )}
                >
                  {flyerStep > step ? "✓" : step + 1}
                </div>
                {step < 3 && (
                  <div
                    className={cn(
                      "h-0.5 w-6 transition-colors",
                      flyerStep > step ? "bg-accent-blue" : "bg-gray-200 dark:bg-gray-700"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Meeting Based or Topical */}
          {flyerStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">What kind of flyer?</Label>
                <p className="text-xs text-muted-foreground mt-1">Choose how you&rsquo;d like to create your flyer.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
                    flyerMode === "meeting"
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/5"
                      : "border-transparent bg-white dark:bg-gray-900 shadow-sm hover:shadow-md hover:border-[var(--accent-blue)]/40"
                  )}
                  onClick={() => { setFlyerMode("meeting"); setFlyerStep(1); }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg">📅</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Meeting Based</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Auto-populate from an existing meeting.</p>
                  </div>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
                    flyerMode === "topical"
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/5"
                      : "border-transparent bg-white dark:bg-gray-900 shadow-sm hover:shadow-md hover:border-[var(--accent-blue)]/40"
                  )}
                  onClick={() => { setFlyerMode("topical"); setFlyerStep(1); }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-lg">📝</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Topical Flyer</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Create a flyer around a specific topic.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Benefit Category */}
          {flyerStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Select a benefit category</Label>
                <p className="text-xs text-muted-foreground mt-1">Choose which category this flyer relates to.</p>
              </div>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={flyerCategory}
                onChange={(e) => setFlyerCategory(e.target.value)}
              >
                <option value="">All Benefits</option>
                <option value="Retirement">Retirement</option>
                <option value="Group Health">Group Health</option>
                <option value="Group Life">Group Life</option>
                <option value="Other">Other</option>
              </select>
              <div className="flex items-center gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setFlyerStep(0)}>Back</Button>
                <Button type="button" size="sm" onClick={() => setFlyerStep(2)}>Next</Button>
              </div>
            </div>
          )}

          {/* Step 2: Meeting or Topic input */}
          {flyerStep === 2 && flyerMode === "meeting" && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Select a meeting</Label>
                <p className="text-xs text-muted-foreground mt-1">Choose the meeting to base your flyer on.</p>
              </div>
              <Select value={selectedMeetingId} onValueChange={(v) => { handleMeetingSelect(v); }}>
                <SelectTrigger id="meeting-select" className="w-full">
                  <SelectValue placeholder="Select Meeting" />
                </SelectTrigger>
                <SelectContent>
                  {meetings.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">No meetings found for this plan.</div>
                  )}
                  {meetings.length > 0 && (
                    <SelectItem value="">Select Meeting</SelectItem>
                  )}
                  {meetings.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span>{m.meeting}</span>
                        <span className="text-[10px] text-muted-foreground">{formatUsDate(m.date)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMeeting && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {formatUsDate(selectedMeeting.date)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {selectedMeeting.time ? (() => {
                      const [h, m] = selectedMeeting.time.split(":").map(Number);
                      if (!isNaN(h) && !isNaN(m)) {
                        const ampm = h >= 12 ? "PM" : "AM";
                        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                      }
                      return selectedMeeting.time;
                    })() : ""}
                    {selectedMeeting.timezone && ` (${selectedMeeting.timezone})`}
                  </div>
                  {selectedMeeting.format === "In-Person" && selectedMeeting.city && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {selectedMeeting.city}, {selectedMeeting.state}
                    </div>
                  )}
                  <div className="text-[11px] opacity-70">{selectedMeeting.duration}</div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setFlyerStep(1)}>Back</Button>
                <Button type="button" size="sm" disabled={!selectedMeetingId} onClick={() => setFlyerStep(3)}>Next</Button>
              </div>
            </div>
          )}

          {flyerStep === 2 && flyerMode === "topical" && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Enter a topic</Label>
                <p className="text-xs text-muted-foreground mt-1">What is this flyer about?</p>
              </div>
              <Input
                placeholder="e.g. Open Enrollment, Retirement Planning, Health Benefits…"
                value={flyerTopic}
                onChange={(e) => {
                  setFlyerTopic(e.target.value);
                  setHeadline(e.target.value);
                  setFlyerSubtitle(`Learn more about ${e.target.value}`);
                }}
              />
              <div className="flex items-center gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setFlyerStep(1)}>Back</Button>
                <Button type="button" size="sm" disabled={!flyerTopic.trim()} onClick={() => setFlyerStep(3)}>Next</Button>
              </div>
            </div>
          )}

          {/* Step 3: Template */}
          {flyerStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Choose a template</Label>
                <p className="text-xs text-muted-foreground mt-1">Select the design for your flyer.</p>
              </div>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={flyerTemplate}
                onChange={(e) => setFlyerTemplate(e.target.value)}
              >
                {(flyerMode === "meeting"
                  ? Object.keys(MEETING_TEMPLATE_DEFAULTS)
                  : Object.keys(TOPICAL_TEMPLATE_DEFAULTS)
                ).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setFlyerStep(2)}>Back</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flyer: Headline (auto-populated from meeting/topic) */}
      {resolvedType === "flyer" && (
        flyerStep < 3 ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" placeholder="Enter a headline…" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
        )
      )}

      {/* Flyer subtitle */}
      {resolvedType === "flyer" && flyerStep >= 3 && (
        <div className="space-y-1.5">
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input id="subtitle" placeholder="A short promotional tagline…" value={flyerSubtitle} onChange={(e) => setFlyerSubtitle(e.target.value)} />
        </div>
      )}

      {/* Flyer body */}
      {resolvedType === "flyer" && flyerStep >= 3 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="body">Body text</Label>
            <span className="text-[11px] text-muted-foreground tabular-nums">{body.length}/680</span>
          </div>
          <Textarea
            id="body"
            rows={4}
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={680}
            className="dark:bg-gray-800"
          />
          <p className="text-[11px] text-muted-foreground">
            Tip: start a line with <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">-</kbd> or <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">*</kbd> to create a bullet point
          </p>
          <p className="text-[11px] text-muted-foreground">
            Tip: wrap text with <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">**</kbd> to make it <strong>bold</strong>
          </p>
        </div>
      )}

      {/* Flyer: QR code */}
      {resolvedType === "flyer" && flyerStep >= 3 && (
        <div className="space-y-1.5">
          <Label htmlFor="flyerQrUrl">
            QR code link
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(scannable link for the flyer)</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="flyerQrUrl"
              placeholder="https://example.com/registration"
              value={flyerQrUrl}
              onChange={(e) => {
                setFlyerQrUrl(e.target.value);
                setFlyerQrDataUrl("");
                setQrResult(null);
              }}
              className="flex-1"
            />
          </div>
          {qrResult && (
            <p className="text-[11px] text-muted-foreground">
              QR generated via {qrResult.source === "qrio" ? "QR.io" : "local"}
              {qrResult.qrIoId && <span className="ml-1 font-mono text-[10px] text-green-600">(ID: {qrResult.qrIoId})</span>}
            </p>
          )}
        </div>
      )}

      {/* Flyer: Footer Color */}
      {resolvedType === "flyer" && flyerStep >= 3 && (
        <div className="space-y-1.5">
          <Label>Footer color</Label>
          <div className="flex gap-2">
            {[
              { label: "Black", value: "#111111" },
              { label: "Light", value: "#f3f3f3" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setBgColor(option.value)}
                className={cn(
                  "flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all",
                  bgColor === option.value
                    ? "border-gray-900 ring-2 ring-gray-900/20 dark:border-white dark:ring-white/30"
                    : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
                )}
              >
                <span
                  className="block h-5 w-full rounded mb-1"
                  style={{ background: option.value }}
                />
                <span className="text-xs">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flyer: Disclaimer text */}
      {resolvedType === "flyer" && flyerStep >= 3 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="disclaimer">Disclaimer text</Label>
            <span className="text-[11px] text-muted-foreground tabular-nums">{disclaimerText.length}/120</span>
          </div>
          <Textarea
            id="disclaimer"
            rows={2}
            value={disclaimerText}
            onChange={(e) => setDisclaimerText(e.target.value)}
            maxLength={120}
            className="dark:bg-gray-800"
          />
          <p className="text-[11px] text-muted-foreground">Leave empty for default disclaimer</p>
        </div>
      )}

      {/* Portal-notice specific — Top Banner */}
      {resolvedType === "portal-notice" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pn-headline">
              Headline
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input id="pn-headline" placeholder="Enter headline…" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">{headline.length}/80</p>
          </div>
          <div className="space-y-1.5">
            <Label>Notice type</Label>
            <div className="flex gap-2">
              {(["text", "countdown"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    noticeType === t
                      ? "border-gray-900 bg-gray-900 text-white dark:bg-accent-blue dark:text-gray-900"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                  onClick={() => setNoticeType(t)}
                >
                  {t === "text" ? "Text Banner" : "Countdown Banner"}
                </button>
              ))}
            </div>
          </div>
          {noticeType === "countdown" && (
            <div className="space-y-1.5">
              <Label>Countdown target date/time</Label>
              <DateTimePickerPopup
                value={countdownTarget}
                onChange={setCountdownTarget}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="portalCtaText">Button text (optional)</Label>
            <Input id="portalCtaText" placeholder="Learn More" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="portalCtaUrl">Button link (optional)</Label>
            <Input id="portalCtaUrl" placeholder="https://example.com" value={portalCtaUrl} onChange={(e) => setPortalCtaUrl(e.target.value)} />
          </div>
          {/* Background color */}
          <PlanColorSelector
            label="Background color"
            value={bgColor}
            onChange={setBgColor}
            planPrimaryColor={planBrandColor}
            planSecondaryColor={planSecondaryColor}
          />
          {/* Button color */}
          <PlanColorSelector
            label="Button color"
            value={buttonColor}
            onChange={setButtonColor}
            planPrimaryColor={planBrandColor}
            planSecondaryColor={planSecondaryColor}
          />
        </div>
      )}
      
      {/* Pop-up specific */}
      {resolvedType === "pop-up" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pu-headline">
              Headline
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input id="pu-headline" placeholder="Enter headline…" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pu-subtitle">Subtitle</Label>
            <Input id="pu-subtitle" placeholder="A short description…" value={flyerSubtitle} onChange={(e) => setFlyerSubtitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">
                Body text
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">{body.length}/300</span>
            </div>
            <Textarea id="body" rows={4} placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} className="dark:bg-gray-800" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pu-cta-text">Button text</Label>
            <Input id="pu-cta-text" placeholder="Learn More" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pu-cta-url">Button link (optional)</Label>
            <Input id="pu-cta-url" placeholder="https://example.com" value={popupCtaUrl} onChange={(e) => setPopupCtaUrl(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium">
              Show on pages
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Select which pages this pop-up will appear on.</p>
          </div>
          <div className="space-y-2">
            {POPUP_PAGES.map((page) => (
              <label key={page.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={popupPages.includes(page.id)}
                  onChange={() => {
                    if (page.id === "all") {
                      setPopupPages(popupPages.includes("all") ? [] : ["all"]);
                    } else {
                      const next = popupPages.filter((p) => p !== "all");
                      setPopupPages(next.includes(page.id) ? next.filter((p) => p !== page.id) : [...next, page.id]);
                    }
                  }}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span>{page.label}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer pt-1 border-t border-gray-100 dark:border-gray-800">
            <input type="checkbox" checked={showEveryVisit} onChange={(e) => setShowEveryVisit(e.target.checked)} className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
            Show on every visit
          </label>
          {/* Button color */}
          <PlanColorSelector
            label="Button color"
            value={bgColor}
            onChange={setBgColor}
            planPrimaryColor={planBrandColor}
            planSecondaryColor={planSecondaryColor}
          />
        </div>
      )}


      {/* News post fields */}
      {resolvedType === "news-post" && (
        <div className="space-y-4">
          {/* Max limit warning */}
          {!editingAsset && newsPostLimitReached && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Limit reached.</strong> You can create a maximum of 4 News Posts per plan. Archive or delete an existing post to create a new one.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="np-headline">
              Headline
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Input id="np-headline" placeholder="Enter headline…" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-subtitle">Subtitle</Label>
            <Input id="np-subtitle" placeholder="A short description…" value={flyerSubtitle} onChange={(e) => setFlyerSubtitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="np-body">
                Body text
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">{body.length}/300</span>
            </div>
            <Textarea id="np-body" rows={4} placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} className="dark:bg-gray-800" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">
              Category
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <select
              id="category"
              className="flex h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={postCategory}
              onChange={(e) => setPostCategory(e.target.value)}
            >
              <option value="Retirement">Retirement</option>
              <option value="Group Health">Group Health</option>
              <option value="Group Life">Group Life</option>
              <option value="Other Benefits">Other Benefits</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Background Image Selector */}
          <div className="space-y-2">
            <Label>
              Background image
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">Select a background photo for this post. Each image can only be used once per plan.</p>
            <div className="grid grid-cols-2 gap-2">
              {NEWS_POST_BG_IMAGES.map((img) => {
                const isUsed = usedBgImageIds.includes(img.id);
                const isSelected = selectedBgImage === img.id;
                return (
                  <button
                    key={img.id}
                    type="button"
                    disabled={isUsed && !isSelected}
                    onClick={() => setSelectedBgImage(img.id)}
                    className={cn(
                      "relative aspect-[16/9] rounded-lg overflow-hidden border-2 transition-all duration-200",
                      isSelected
                        ? "border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]/30"
                        : "border-gray-200 hover:border-gray-400",
                      isUsed && !isSelected && "opacity-40 cursor-not-allowed grayscale",
                    )}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-[var(--accent-blue)] flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    {isUsed && !isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Used</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ctaText">Button text</Label>
            <Input id="ctaText" placeholder="Learn More" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-cta-url">Button link (optional)</Label>
            <Input id="np-cta-url" placeholder="https://example.com" value={newsPostCtaUrl} onChange={(e) => setNewsPostCtaUrl(e.target.value)} />
          </div>
          {/* Button color */}
          <PlanColorSelector
            label="Button color"
            value={bgColor}
            onChange={setBgColor}
            planPrimaryColor={planBrandColor}
            planSecondaryColor={planSecondaryColor}
          />
        </div>
      )}

      {/* Date range — always shown for Top Banner; hidden for other countdown types */}
      {resolvedType !== "flyer" && !(resolvedType !== "portal-notice" && noticeType === "countdown") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">
              Start date
              {(resolvedType === "portal-notice" || resolvedType === "pop-up" || resolvedType === "news-post") && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">
              End date
              {(resolvedType === "portal-notice" || resolvedType === "pop-up" || resolvedType === "news-post") && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-6xl p-0 flex flex-col max-h-[95vh] [&>button.absolute]:hidden", previewOnly && "max-w-3xl")}>
        {/* Fixed header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              {(() => {
                const action = previewOnly ? "Preview" : editingAsset ? "Edit" : "Create";
                if (assetType !== "portal-notice" || !portalElement) {
                  return <><span>{meta.icon}</span>{action} {meta.label}</>;
                }
                const elMeta = portalElement === "top-banner"
                  ? ASSET_META["portal-notice"]
                  : ASSET_META[portalElement as AssetType];
                return <><span>{elMeta.icon}</span>{action} {elMeta.label}</>;
              })()}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Plan: <span className="font-medium text-foreground">{planName}</span>
            </p>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        {/* Metadata card — shown only in preview mode */}
        {previewOnly && editingAsset && (
          <div className="border-b bg-muted/20 px-6 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{
                background: editingAsset.status === "Published" ? "#dcfce7" :
                            editingAsset.status === "Draft" ? "#f3f4f6" :
                            editingAsset.status === "Ready for Review" ? "#fef3c7" :
                            editingAsset.status === "Scheduled" ? "#dbeafe" :
                            editingAsset.status === "Archived" ? "#fce4ec" :
                            editingAsset.status === "Hidden" ? "#fef9c3" : "#f3f4f6",
                color: editingAsset.status === "Published" ? "#166534" :
                        editingAsset.status === "Draft" ? "#374151" :
                        editingAsset.status === "Ready for Review" ? "#92400e" :
                        editingAsset.status === "Scheduled" ? "#1e40af" :
                        editingAsset.status === "Archived" ? "#9b1c1c" :
                        editingAsset.status === "Hidden" ? "#854d0e" : "#374151",
                borderColor: editingAsset.status === "Published" ? "#86efac" :
                            editingAsset.status === "Draft" ? "#d1d5db" :
                            editingAsset.status === "Ready for Review" ? "#fcd34d" :
                            editingAsset.status === "Scheduled" ? "#93c5fd" :
                            editingAsset.status === "Archived" ? "#fecaca" :
                            editingAsset.status === "Hidden" ? "#fde68a" : "#d1d5db",
              }}>
                {editingAsset.status}
              </span>
              <span className="text-muted-foreground text-xs">
                Created {new Date(editingAsset.createdAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </span>
              <span className="text-muted-foreground text-xs">
                Headline: <span className="font-medium text-foreground">{headline || editingAsset.headline}</span>
              </span>
              {startDate && (
                <span className="text-muted-foreground text-xs">
                  Start: <span className="font-medium text-foreground">{new Date(startDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </span>
              )}
              {endDate && (
                <span className="text-muted-foreground text-xs">
                  End: <span className="font-medium text-foreground">{new Date(endDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </span>
              )}
              {(resolvedType === "pop-up" || resolvedType === "news-post") && flyerSubtitle && (
                <span className="text-muted-foreground text-xs">
                  Subtitle: <span className="font-medium text-foreground">{flyerSubtitle}</span>
                </span>
              )}
              {resolvedType === "portal-notice" && noticeType && (
                <span className="text-muted-foreground text-xs">
                  Type: <span className="font-medium text-foreground">{noticeType === "countdown" ? "Countdown Banner" : "Text Banner"}</span>
                </span>
              )}
              {resolvedType === "news-post" && postCategory && (
                <span className="text-muted-foreground text-xs">
                  Category: <span className="font-medium text-foreground">{postCategory}</span>
                </span>
              )}
              {resolvedType === "portal-notice" && ctaText && (
                <span className="text-muted-foreground text-xs">
                  CTA: <span className="font-medium text-foreground">{ctaText}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column — Form (hidden in preview-only mode) */}
          {!previewOnly && (
            <div className="w-1/2 border-r overflow-hidden flex flex-col">
              {assetType === "portal-notice" ? (
                <div className="relative flex-1 overflow-hidden">
                  <div
                    className="flex h-full transition-transform duration-300 ease-in-out"
                    style={{ transform: portalElement ? "translateX(-100%)" : "translateX(0%)" }}
                  >
                    {/* Slide 1: Sub-element picker */}
                    <div className="w-full shrink-0 overflow-y-auto p-6 space-y-5">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Portal Notice Element</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Choose the type of portal notice to create.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {([
                            { id: "top-banner" as PortalNoticeElement, label: "Top Banner", description: "A short announcement bar on the Benefits Hub.", icon: "📢" },
                            { id: "pop-up" as PortalNoticeElement, label: "Pop-Up", description: "A message that appears when visiting the Benefits Hub.", icon: "💬" },
                            { id: "news-post" as PortalNoticeElement, label: "News & Event Post", description: "Publish an update, announcement, or reminder.", icon: "📰" },
                          ]).map((el) => (
                            <button
                              key={el.id}
                              type="button"
                              className="flex items-center gap-3 rounded-xl border-2 border-transparent bg-white dark:bg-gray-900 p-4 text-left shadow-sm hover:shadow-md hover:border-[var(--accent-blue)]/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-blue)]"
                              onClick={() => setPortalElement(el.id)}
                            >
                              <span className="text-2xl">{el.icon}</span>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{el.label}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">{el.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Slide 2: Form */}
                    <div className="w-full shrink-0 overflow-y-auto p-6 space-y-5">
                      {/* Back button */}
                      <button
                        type="button"
                        onClick={() => setPortalElement(null)}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
                      </button>
                      {formSections}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto p-6 space-y-5">
                  {formSections}
                </div>
              )}
            </div>
          )}

          {/* Right Column — Live Preview */}
          <div className={cn("flex flex-col bg-muted/30", previewOnly ? "w-full" : "w-1/2")}>
            <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Eye className="h-4 w-4" />
                Preview
              </div>
              {resolvedType !== "flyer" && (
                <div className="flex items-center gap-1 rounded-lg border bg-white dark:bg-gray-800 p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      previewMode === "desktop"
                        ? "bg-gray-900 text-white dark:bg-accent-blue dark:text-white"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    )}
                  >
                    <svg className="h-3.5 w-3.5 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      previewMode === "mobile"
                        ? "bg-gray-900 text-white dark:bg-accent-blue dark:text-white"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    )}
                  >
                    <svg className="h-3.5 w-3.5 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    Mobile
                  </button>
                </div>
              )}
            </div>
            <div ref={flyerPreviewRef} className={cn("flex-1 overflow-y-auto p-6 flex items-start justify-center", previewMode === "mobile" && "bg-gray-100 dark:bg-gray-900")}>
              {previewMode === "mobile" && resolvedType !== "flyer" ? (
                <div className="relative shrink-0 transform scale-[0.65] origin-top">
                  {/* Phone body */}
                  <div className="w-[375px] h-[720px] rounded-[3rem] border-[3px] border-gray-800 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden relative flex flex-col">
                    {/* Left side buttons */}
                    <div className="absolute left-[-4px] top-24 w-[3px] h-8 rounded-r bg-gray-700 dark:bg-gray-500" />
                    <div className="absolute left-[-4px] top-[136px] w-[3px] h-12 rounded-r bg-gray-700 dark:bg-gray-500" />
                    <div className="absolute left-[-4px] top-[192px] w-[3px] h-8 rounded-r bg-gray-700 dark:bg-gray-500" />
                    {/* Right side button */}
                    <div className="absolute right-[-4px] top-32 w-[3px] h-10 rounded-l bg-gray-700 dark:bg-gray-500" />
                    {/* Top notch area */}
                    <div className="relative flex items-center justify-center pt-3 pb-1">
                      {/* Status bar */}
                      <div className="flex items-center justify-between w-full px-6 absolute top-1">
                        <span className="text-[9px] font-semibold text-gray-800 dark:text-gray-200">9:41</span>
                        <div className="flex items-center gap-0.5">
                          <div className="h-1.5 w-2.5 rounded-sm bg-gray-800 dark:bg-gray-200" />
                          <div className="h-1.5 w-2 rounded-sm bg-gray-800 dark:bg-gray-200" />
                          <div className="h-1.5 w-1.5 rounded-sm bg-gray-800 dark:bg-gray-200" />
                        </div>
                      </div>
                      {/* Notch */}
                      <div className="h-5 w-28 rounded-[18px] bg-gray-800 dark:bg-gray-600 flex items-center justify-center">
                        <div className="h-1.5 w-8 rounded-full bg-gray-700 dark:bg-gray-500" />
                      </div>
                    </div>
                    {/* Screen content — flex-1 fills remaining phone height */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <PreviewPane
                        assetType={assetType}
                        portalElement={portalElement}
                        flyerStep={flyerStep}
                        headline={previewHeadline}
                        body={previewBody}
                        ctaText={ctaText}
                        bgColor={bgColor}
                        startDate={startDate}
                        endDate={endDate}
                        planName={planName}
                        planLogo={planLogo}
                        organizationLogo={organizationLogo}
                        disclaimerText={disclaimerText}
                        flyerImage={flyerImage}
                        flyerQrUrl={flyerQrUrl}
                        flyerQrDataUrl={flyerQrDataUrl}
                        meetingTime={meetingTime}
                        meetingLocation={meetingLocation}
                        flyerSubtitle={flyerSubtitle}
                        flyerTemplate={flyerTemplate}
                        noticeType={noticeType}
                        countdownTarget={countdownTarget}
                        portalCtaUrl={portalCtaUrl}
                        buttonColor={buttonColor}
                        bgImage={resolvedType === "news-post" ? selectedBgImage : undefined}
                        postCategory={postCategory}
                        previewMode="mobile"
                      />
                    </div>
                    {/* Home indicator */}
                    <div className="flex items-center justify-center pb-3 pt-1.5">
                      <div className="h-1 w-28 rounded-full bg-gray-300 dark:bg-gray-600" />
                    </div>
                  </div>
                </div>
              ) : (
                <PreviewPane
                  assetType={assetType}
                  portalElement={portalElement}
                  flyerStep={flyerStep}
                  headline={previewHeadline}
                  body={previewBody}
                  ctaText={ctaText}
                  bgColor={bgColor}
                  startDate={startDate}
                  endDate={endDate}
                  planName={planName}
                  planLogo={planLogo}
                  organizationLogo={organizationLogo}
                  disclaimerText={disclaimerText}
                  flyerImage={flyerImage}
                  flyerQrUrl={flyerQrUrl}
                  flyerQrDataUrl={flyerQrDataUrl}
                  meetingTime={meetingTime}
                  meetingLocation={meetingLocation}
                  flyerSubtitle={flyerSubtitle}
                  flyerTemplate={flyerTemplate}
                  noticeType={noticeType}
                  countdownTarget={countdownTarget}
                  portalCtaUrl={portalCtaUrl}
                  buttonColor={buttonColor}
                  bgImage={resolvedType === "news-post" ? selectedBgImage : undefined}
                  postCategory={postCategory}
                  previewMode={previewMode}
                />
              )}
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            {resolvedType === "flyer" && !previewOnly && (
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isFlyerLocked} className="gap-1.5">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{previewOnly ? "Close" : "Cancel"}</Button>
            {previewOnly ? (
              <Button onClick={() => onEditFromPreview?.()} className="gap-1.5">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Edit
              </Button>
            ) : (
              <>
                <div className="h-9 w-px bg-border" />
                <select
                  value={assetStatus}
                  onChange={(e) => setAssetStatus(e.target.value as MarketingAssetStatus)}
                  className="h-9 rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Draft">Draft</option>
                  <option value="Ready for Review">Ready for Review</option>
                  <option value="Published">Published</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Hidden">Hidden</option>
                  <option value="Archived">Archived</option>
                </select>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editingAsset ? "Updating…" : "Saving…"}</>
                  ) : (
                    (() => {
                      const action = editingAsset ? "Update" : "Save";
                      if (assetType !== "portal-notice" || !portalElement) return `${action} ${meta.label}`;
                      const btnMeta = portalElement === "top-banner"
                        ? ASSET_META["portal-notice"]
                        : ASSET_META[portalElement as AssetType];
                      return `${action} ${btnMeta.label}`;
                    })()
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── DateTime Picker Popup ─────────────────────────────────────

function DateTimePickerPopup({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Parse existing value into date and time parts
  const parsed = (() => {
    if (!value) return { date: "", time: "" };
    // value is "YYYY-MM-DDTHH:mm" from datetime-local
    const [d, t] = value.split("T");
    return { date: d ?? "", time: t ?? "" };
  })();

  const [localDate, setLocalDate] = useState(parsed.date);
  const [localTime, setLocalTime] = useState(parsed.time);

  // Sync internal state when value prop changes from outside
  useEffect(() => {
    const p = (() => {
      if (!value) return { date: "", time: "" };
      const [d, t] = value.split("T");
      return { date: d ?? "", time: t ?? "" };
    })();
    setLocalDate(p.date);
    setLocalTime(p.time);
  }, [value]);

  const handleOk = () => {
    if (localDate && localTime) {
      onChange(`${localDate}T${localTime}`);
    } else if (localDate) {
      onChange(`${localDate}T00:00`);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset local state to current value
    const p = (() => {
      if (!value) return { date: "", time: "" };
      const [d, t] = value.split("T");
      return { date: d ?? "", time: t ?? "" };
    })();
    setLocalDate(p.date);
    setLocalTime(p.time);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalDate("");
    setLocalTime("");
    onChange("");
    setOpen(false);
  };

  // Format display value
  const displayValue = (() => {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  })();

  return (
    <>
      {/* Trigger input (read-only, opens popup on click/focus) */}
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          readOnly
          value={displayValue || ""}
          placeholder="Select date & time"
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          className={cn(
            "flex h-10 w-full rounded-lg border px-3 py-2 text-sm pl-9 cursor-pointer",
            "border-input bg-white dark:bg-gray-800",
            "text-foreground placeholder:text-muted-foreground",
            "hover:border-gray-400 dark:hover:border-gray-500",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            !value && "text-muted-foreground"
          )}
          aria-label="Select countdown date and time"
          aria-haspopup="dialog"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Clear date/time"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Popup overlay — rendered via portal to escape Dialog transform stacking context */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={handleCancel}
            />
            {/* Popup card */}
            <div
              className={cn(
                "relative w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden",
                "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent-blue" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Select Countdown Date & Time
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 px-5 py-4">
                {/* Date field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Date
                  </Label>
                  <input
                    type="date"
                    value={localDate}
                    onChange={(e) => setLocalDate(e.target.value)}
                    className={cn(
                      "flex h-10 w-full rounded-lg border px-3 py-2 text-sm",
                      "border-input bg-white dark:bg-gray-800",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "[color-scheme:light] dark:[color-scheme:dark]"
                    )}
                  />
                </div>

                {/* Time field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Time
                  </Label>
                  <input
                    type="time"
                    value={localTime}
                    onChange={(e) => setLocalTime(e.target.value)}
                    className={cn(
                      "flex h-10 w-full rounded-lg border px-3 py-2 text-sm",
                      "border-input bg-white dark:bg-gray-800",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "[color-scheme:light] dark:[color-scheme:dark]"
                    )}
                  />
                </div>
              </div>

              {/* Footer with Ok / Cancel */}
              <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 dark:border-gray-700">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleOk}
                    disabled={!localDate}
                  >
                    Ok
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// ── Plan Color Selector ───────────────────────────────────────

function PlanColorSelector({
  label,
  value,
  onChange,
  planPrimaryColor,
  planSecondaryColor,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  planPrimaryColor?: string;
  planSecondaryColor?: string;
}) {
  const planColors = useMemo(() => {
    const colors: { label: string; value: string }[] = [];
    if (planPrimaryColor) colors.push({ label: "Primary", value: planPrimaryColor });
    if (planSecondaryColor) colors.push({ label: "Secondary", value: planSecondaryColor });
    return colors;
  }, [planPrimaryColor, planSecondaryColor]);

  const isPlanColor = (color: string) =>
    planColors.some((pc) => pc.value.toLowerCase() === color.toLowerCase());

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {/* Plan color swatches */}
        {planColors.map((pc) => (
          <button
            key={pc.value}
            type="button"
            title={`${pc.label}: ${pc.value}`}
            onClick={() => onChange(pc.value)}
            className={cn(
              "relative h-9 w-9 shrink-0 rounded-lg border-2 transition-all",
              value.toLowerCase() === pc.value.toLowerCase()
                ? "border-gray-900 ring-2 ring-gray-900/20 dark:border-white dark:ring-white/30"
                : "border-gray-300 hover:border-gray-500 dark:border-gray-600 dark:hover:border-gray-400"
            )}
            style={{ background: pc.value }}
          >
            {value.toLowerCase() === pc.value.toLowerCase() && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                style={{ color: isLightColor(pc.value) ? "#000" : "#fff" }}
              >
                ✓
              </span>
            )}
          </button>
        ))}
        {/* Custom color picker */}
        <div className="relative flex items-center gap-2 flex-1">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "h-9 w-12 cursor-pointer rounded-lg border p-1",
              isPlanColor(value)
                ? "border-gray-200 dark:border-gray-700"
                : "border-gray-900 dark:border-white"
            )}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
            }}
            placeholder="#HEX"
            className={cn(
              "flex h-9 w-24 rounded-lg border px-2.5 py-1.5 text-xs font-mono",
              "border-input bg-white dark:bg-gray-800",
              "text-foreground placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            )}
          />
        </div>
      </div>
    </div>
  );
}

/** Quick luminance check to choose ✓ color */
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

// ── Preview pane ──────────────────────────────────────────────

function PreviewPane({
  assetType,
  portalElement,
  flyerStep,
  headline,
  body,
  ctaText,
  bgColor,
  startDate,
  endDate,
  planName,
  planLogo,
  organizationLogo,
  disclaimerText,
  flyerImage,
  flyerQrUrl,
  flyerQrDataUrl,
  meetingTime,
  meetingLocation,
  flyerSubtitle,
  flyerTemplate,
  noticeType,
  countdownTarget,
  portalCtaUrl,
  buttonColor,
  bgImage,
  postCategory,
  previewMode,
}: {
  assetType: AssetType;
  portalElement?: PortalNoticeElement | null;
  flyerStep?: number;
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  startDate: string;
  endDate: string;
  planName: string;
  planLogo?: string;
  organizationLogo?: string;
  disclaimerText?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  flyerSubtitle?: string;
  flyerTemplate?: string;
  noticeType?: "text" | "countdown";
  countdownTarget?: string;
  portalCtaUrl?: string;
  buttonColor?: string;
  bgImage?: string;
  postCategory?: string;
  previewMode?: "desktop" | "mobile";
}) {
  const isMobile = previewMode === "mobile";
  const effectiveType: AssetType =
    assetType !== "portal-notice" || !portalElement
      ? assetType
      : portalElement === "top-banner"
        ? "portal-notice"
        : portalElement;

  switch (effectiveType) {
    case "flyer":
      // Show placeholder flyer before template is selected (step 3)
      if (flyerStep !== undefined && flyerStep < 3) {
        return (
          <div className="w-full max-w-[400px] flex flex-col items-center justify-center text-center py-8">
            <div className="w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-8 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-blue)]/10">
                <svg className="h-10 w-10 text-[var(--accent-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Flyer Preview
              </h3>
              <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
                Complete the steps on the left to see your flyer preview here.
              </p>
            </div>
          </div>
        );
      }
      return (
        <FlyerPreview
          headline={headline}
          body={body}
          ctaText={ctaText}
          bgColor={bgColor}
          startDate={startDate}
          planName={planName}
          planLogo={planLogo}
          organizationLogo={organizationLogo}
          disclaimerText={disclaimerText}
          flyerImage={flyerImage}
          flyerQrUrl={flyerQrUrl}
          flyerQrDataUrl={flyerQrDataUrl}
          meetingTime={meetingTime}
          meetingLocation={meetingLocation}
          flyerSubtitle={flyerSubtitle}
          flyerTemplate={flyerTemplate as FlyerTemplateId}
        />
      );
    case "portal-notice":
      return (
        <NoticePreview
          headline={headline}
          body={body}
          bgColor={bgColor}
          startDate={startDate}
          endDate={endDate}
          planName={planName}
          noticeType={noticeType}
          countdownTarget={countdownTarget}
          ctaText={ctaText}
          portalCtaUrl={portalCtaUrl}
          buttonColor={buttonColor}
          isMobile={isMobile}
        />
      );
    case "pop-up":
      return <PopUpPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} planName={planName} planLogo={planLogo} subtitle={flyerSubtitle} isMobile={isMobile} />;
    case "news-post":
      return <NewsPostPreview headline={headline} body={body} planName={planName} ctaText={ctaText} subtitle={flyerSubtitle} bgImage={bgImage} postCategory={postCategory} startDate={startDate} isMobile={isMobile} bgColor={bgColor} />;
  }
}

// ── Helper: adjust hex color brightness ──────────────────────

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Portal Notice Preview ─────────────────────────────────────

function NoticePreview({
  headline,
  bgColor,
  noticeType,
  countdownTarget,
  ctaText,
  portalCtaUrl,
  buttonColor,
  isMobile,
}: {
  headline: string;
  body?: string;
  bgColor: string;
  startDate?: string;
  endDate?: string;
  planName?: string;
  noticeType?: "text" | "countdown";
  countdownTarget?: string;
  ctaText?: string;
  portalCtaUrl?: string;
  buttonColor?: string;
  isMobile?: boolean;
}) {
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0, expired: false });
  useEffect(() => {
    if (noticeType !== "countdown" || !countdownTarget) return;
    const target = new Date(countdownTarget).getTime();
    if (isNaN(target)) return;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown({ d: 0, h: 0, m: 0, s: 0, expired: true }); return; }
      const totalSec = Math.floor(diff / 1000);
      setCountdown({
        d: Math.floor(totalSec / 86400),
        h: Math.floor((totalSec % 86400) / 3600),
        m: Math.floor((totalSec % 3600) / 60),
        s: totalSec % 60,
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [noticeType, countdownTarget]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (isMobile) {
    return (
      <div className="w-full min-h-full relative bg-white flex flex-col">
        {/* Page background mock */}
        <div className="absolute inset-0 opacity-20 p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="h-6 w-6 rounded bg-gray-300" />
            <div className="h-3 w-24 rounded bg-gray-300" />
          </div>
          <div className="h-2 w-full rounded bg-gray-200" />
          <div className="h-2 w-5/6 rounded bg-gray-200" />
          <div className="h-2 w-4/6 rounded bg-gray-200" />
          <div className="h-12 rounded-lg bg-gray-200 mt-1" />
        </div>
        {/* Top banner — full width at the top */}
        <div className="relative w-full shrink-0" style={{ background: bgColor }}>
          <div className="flex items-center justify-between px-2 py-1.5 text-white">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {noticeType === "countdown" && countdownTarget ? (
                <>
                  <span className="text-[10px] font-medium whitespace-nowrap">{headline || "Countdown"}</span>
                  {countdown.expired ? (
                    <span className="text-[10px] font-bold whitespace-nowrap">Expired</span>
                  ) : (
                    <div className="flex items-center gap-0.5 text-[10px] font-bold tabular-nums tracking-wider whitespace-nowrap">
                      {countdown.d > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-black/25 px-0.5 py-0.5">
                          <span>{countdown.d}</span>
                          <span className="text-[8px] opacity-80">d</span>
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-md bg-black/25 px-0.5 py-0.5">{pad(countdown.h)}</span>
                      <span className="text-xs opacity-50">:</span>
                      <span className="inline-flex items-center rounded-md bg-black/25 px-0.5 py-0.5">{pad(countdown.m)}</span>
                      <span className="text-xs opacity-50">:</span>
                      <span className="inline-flex items-center rounded-md bg-black/25 px-0.5 py-0.5">{pad(countdown.s)}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[10px] font-medium truncate">{headline || "Portal Notice"}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1.5">
              {ctaText && (
                <span
                  className="inline-flex items-center rounded-lg px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm"
                  style={{ background: buttonColor || adjustColor(bgColor, -30) }}
                >
                  {ctaText}
                </span>
              )}
              <button type="button" className="rounded-full p-0.5 transition-colors hover:bg-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[300px] relative bg-white rounded-lg overflow-hidden">
      {/* Page background mock */}
      <div className="absolute inset-0 opacity-20 p-6 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
          <div className="h-8 w-8 rounded bg-gray-300" />
          <div className="h-4 w-32 rounded bg-gray-300" />
        </div>
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-5/6 rounded bg-gray-200" />
        <div className="h-3 w-4/6 rounded bg-gray-200" />
        <div className="h-16 rounded-lg bg-gray-200 mt-2" />
      </div>
      {/* Top banner — sits at the top of the preview, full width */}
      <div className="relative w-full" style={{ background: bgColor }}>
        <div className="relative flex items-center justify-center px-3 py-2 text-white">
          {/* Centered group: headline + countdown */}
          <div className="flex items-center justify-center gap-2 text-center flex-1 min-w-0">
            {noticeType === "countdown" && countdownTarget ? (
              <>
                <span className="text-[11px] font-medium whitespace-nowrap">{headline || "Countdown"}</span>
                {countdown.expired ? (
                  <span className="text-xs font-bold whitespace-nowrap">Expired</span>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-bold tabular-nums tracking-wider whitespace-nowrap">
                    {countdown.d > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-black/25 px-1 py-0.5">
                        <span>{countdown.d}</span>
                        <span className="text-[9px] opacity-80">d</span>
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-md bg-black/25 px-1 py-0.5">{pad(countdown.h)}</span>
                    <span className="text-sm opacity-50 -mx-0.5">:</span>
                    <span className="inline-flex items-center rounded-md bg-black/25 px-1 py-0.5">{pad(countdown.m)}</span>
                    <span className="text-sm opacity-50 -mx-0.5">:</span>
                    <span className="inline-flex items-center rounded-md bg-black/25 px-1 py-0.5">{pad(countdown.s)}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-[11px] font-medium truncate">{headline || "Portal Notice"}</span>
            )}
          </div>
          {/* Right side: CTA + dismiss, absolutely positioned */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {ctaText && (
              <span
                className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ background: buttonColor || adjustColor(bgColor, -30) }}
              >
                {ctaText}
              </span>
            )}
            <button type="button" className="rounded-full p-0.5 transition-colors hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pop-Up Preview ────────────────────────────────────────────

function PopUpPreview({
  headline,
  body,
  ctaText,
  bgColor,
  planName,
  planLogo,
  subtitle,
  isMobile,
}: {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  planName?: string;
  planLogo?: string;
  subtitle?: string;
  isMobile?: boolean;
}) {
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);

  // Desktop: full preview column background with popup card centered
  if (!isMobile) {
    return (
      <div className="w-full min-h-[400px] relative flex items-center justify-center bg-black/40 rounded-lg">
        {/* Page background mock */}
        <div className="absolute inset-0 rounded-lg overflow-hidden opacity-20">
          <div className="w-full h-full bg-gray-100 p-6 space-y-3">
            <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
              {resolvedPlanLogo ? (
                <img src={resolvedPlanLogo} alt="" className="h-8 w-8 object-contain rounded" />
              ) : (
                <div className="h-8 w-8 rounded bg-gray-300" />
              )}
              <div className="h-4 w-32 rounded bg-gray-300" />
            </div>
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-5/6 rounded bg-gray-200" />
            <div className="h-3 w-4/6 rounded bg-gray-200" />
            <div className="h-20 rounded-lg bg-gray-200 mt-2" />
          </div>
        </div>
        {/* Popup card */}
        <div className="relative w-full max-w-[400px] mx-4">
          <div className="rounded-2xl border-2 bg-white shadow-2xl p-6 space-y-4" style={{ borderColor: bgColor }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 leading-snug">{headline || "Announcement"}</h3>
                <p className={cn("text-xs mt-0.5", subtitle ? "text-gray-500" : "text-gray-300 italic")}>{subtitle || "A short description\u2026"}</p>
              </div>
              <div className="h-6 w-6 shrink-0 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-xs">✕</div>
            </div>
            {body ? (
              <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
            ) : (
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-5/6 rounded bg-gray-100" />
                <div className="h-3 w-4/6 rounded bg-gray-100" />
              </div>
            )}
            <div className="pt-1 flex items-center gap-3">
              {ctaText && (
                <span className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ background: bgColor }}>
                  {ctaText}
                </span>
              )}
              <span className="text-xs text-gray-400">Dismiss</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile: phone frame with popup overlay
  return (
    <div className={cn("w-full max-w-[420px] relative h-full")}>
      <div className="rounded-xl border bg-gray-100 p-5 space-y-3 opacity-30 h-full">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
          {resolvedPlanLogo ? (
            <img src={resolvedPlanLogo} alt="" className="h-8 w-8 object-contain rounded" />
          ) : (
            <div className="h-8 w-8 rounded bg-gray-300" />
          )}
          <div className="h-4 w-32 rounded bg-gray-300" />
        </div>
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-5/6 rounded bg-gray-200" />
        <div className="h-3 w-4/6 rounded bg-gray-200" />
        <div className="h-20 rounded-lg bg-gray-200 mt-2" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div className="w-full rounded-2xl border-2 bg-white shadow-2xl p-6 space-y-4" style={{ borderColor: bgColor }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 leading-snug">{headline || "Announcement"}</h3>
              <p className={cn("text-xs mt-0.5", subtitle ? "text-gray-500" : "text-gray-300 italic")}>{subtitle || "A short description\u2026"}</p>
            </div>
            <div className="h-6 w-6 shrink-0 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-xs">✕</div>
          </div>
          {body ? (
            <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
          ) : (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="h-3 w-4/6 rounded bg-gray-100" />
            </div>
          )}
          <div className="pt-1 flex items-center gap-3">
            {ctaText && (
              <span className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ background: bgColor }}>
                {ctaText}
              </span>
            )}
            <span className="text-xs text-gray-400">Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper: resolve bg image src by id ────────────────────────

function getBgImageSrc(bgImageId: string): string {
  const found = NEWS_POST_BG_IMAGES.find((img) => img.id === bgImageId);
  return found?.src ?? "";
}

// ── News Post Preview ─────────────────────────────────────────

function NewsPostPreview({
  headline,
  body,
  planName,
  ctaText,
  subtitle,
  bgImage,
  postCategory,
  startDate,
  isMobile,
  bgColor,
}: {
  headline: string;
  body: string;
  planName: string;
  ctaText?: string;
  subtitle?: string;
  bgImage?: string;
  postCategory?: string;
  startDate?: string;
  isMobile?: boolean;
  bgColor?: string;
}) {
  const bgSrc = bgImage ? getBgImageSrc(bgImage) : "";
  const hasBg = !!bgSrc;

  /** Display date: prefer startDate, fall back to today so the date UI is always visible in preview */
  const displayDate = startDate || new Date().toISOString().split("T")[0];

  const cardContent = (
    <>
      <div className="relative z-10 flex flex-col h-full p-6 sm:p-8 lg:p-10 max-w-[60%] sm:max-w-[55%]">
        {/* Category badge + Date */}
        <div className="flex flex-row flex-wrap items-center gap-1.5 mb-2 sm:mb-3">
          <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white self-start">
            {postCategory || "Retirement"}
          </span>
          <span className="text-[10px] sm:text-xs text-white/60 sm:text-white/70 flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {new Date(displayDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {/* Headline */}
        <h3 className="font-dm-serif text-xl font-bold leading-tight text-white sm:text-2xl lg:text-[28px]">
          {headline || "News Post Title"}
        </h3>
        <p className={cn("text-sm mt-1.5 font-red-hat", subtitle ? "text-white/80" : "text-white/40 italic")}>
          {subtitle || "A short description\u2026"}
        </p>
        {/* Body */}
        {body ? (
          <p className="text-sm text-gray-200 leading-relaxed mt-3 flex-1 line-clamp-3 font-red-hat">
            {body}
          </p>
        ) : (
          <div className="space-y-2 mt-3 flex-1">
            <div className="h-2 w-full rounded bg-white/20" />
            <div className="h-2 w-5/6 rounded bg-white/20" />
            <div className="h-2 w-4/6 rounded bg-white/20" />
          </div>
        )}
        {/* CTA */}
        <div className="mt-auto pt-4">
          {ctaText && (
            <span className="inline-flex items-center rounded-lg backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-white shadow-sm border border-white/30 hover:opacity-90 transition-all duration-200 cursor-default"
              style={{ background: bgColor || "rgba(255,255,255,0.2)" }}>
              {ctaText}
              <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="w-full h-full">
        <div
          className="relative h-full rounded-lg overflow-hidden shadow-sm"
          style={hasBg ? {} : { background: "linear-gradient(135deg, #1F3A60 0%, #2c4b80 100%)" }}
        >
          {hasBg && (
            <img src={bgSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Dark overlay — left-to-right gradient: dark on left for text, transparent on right for image */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/100 via-black/50 to-transparent" />
          {cardContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[520px] group transition-all duration-300 hover:-translate-y-1">
      <div
        className="relative rounded-xl overflow-hidden shadow-sm min-h-[300px]"
        style={hasBg ? {} : { background: "linear-gradient(135deg, #1F3A60 0%, #2c4b80 100%)" }}
      >
        {hasBg && (
          <img src={bgSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Dark overlay — left-to-right gradient: dark on left for text, transparent on right for image */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/100 via-black/50 to-transparent" />
        {cardContent}
      </div>
    </div>
  );
}

