"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import {
  FlyerPreview,
  type FlyerTemplateId,
} from "./flyer-templates";

export type AssetType = "flyer" | "portal-notice" | "pop-up" | "news-post";

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

const FLYER_TEMPLATES: { id: FlyerTemplateId; label: string }[] = [
  { id: "classic", label: "Template 1" },
  { id: "bold",    label: "Template 2" },
  { id: "clean",   label: "Template 3" },
  { id: "event",   label: "Template 4" },
];

export default function MarketingAssetModal({
  open,
  onOpenChange,
  assetType,
  planName,
  planId,
  onSave,
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
  const planLogo: string | undefined = useMemo(
    () => (planData?.data as { companyLogo?: string })?.companyLogo,
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
  const [flyerTemplate, setFlyerTemplate] = useState<FlyerTemplateId>("classic");

  // Portal-notice specific
  const [noticeType, setNoticeType] = useState<"text" | "countdown">("text");
  const [countdownTarget, setCountdownTarget] = useState("");
  const [portalCtaUrl, setPortalCtaUrl] = useState("");

  // Pop-up specific
  const [showEveryVisit, setShowEveryVisit] = useState(false);
  const POPUP_PAGES = [
    { id: "all", label: "All Pages" },
    { id: "home", label: "Home Page" },
    { id: "benefits", label: "Benefits" },
    { id: "news-events", label: "News & Events" },
    { id: "my-benefits-team", label: "My Benefits Team" },
  ] as const;
  const [popupPages, setPopupPages] = useState<string[]>(["all"]);

  // News post specific
  const [postCategory, setPostCategory] = useState("Announcement");

  const isFlyerLocked = assetType === "flyer" && !selectedMeetingId;

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId),
    [meetings, selectedMeetingId],
  );

  useEffect(() => {
    setHeadline("");
    setBody("");
    setStartDate("");
    setEndDate("");
    setBgColor("#23919c");
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
    setFlyerTemplate("classic");
    setShowEveryVisit(false);
    setPopupPages(["all"]);
    setAssetStatus("Draft");
    setNoticeType("text");
    setCountdownTarget("");
    setPortalCtaUrl("");
    setCtaText("");
    setPostCategory("Announcement");
  }, [open, assetType]);

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
    assetType === "flyer" && !selectedMeeting
      ? "Select a meeting below"
      : headline || meta.label;
  const previewBody =
    assetType === "flyer" && !selectedMeeting
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
    setIsSaving(true);

    let resolvedQrDataUrl = flyerQrDataUrl;
    let resolvedQrResult = qrResult;
    if (assetType === "flyer" && flyerQrUrl.trim() && !flyerQrDataUrl) {
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
    if (assetType === "flyer") {
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
    }
    if (assetType === "portal-notice") {
      data.noticeType = noticeType;
      data.countdownTarget = countdownTarget || null;
      data.portalCtaUrl = portalCtaUrl || null;
    }
    if (assetType === "pop-up") {
      data.showEveryVisit = showEveryVisit;
      data.popupPages = popupPages;
    }
    if (assetType === "news-post") {
      data.category = postCategory;
    }

    try {
      const res = await fetch("/api/marketing/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: planId,
          type: assetType,
          status: assetStatus,
          headline: headline || meta.label,
          body,
          ctaText: ctaText || "",
          startDate: startDate || null,
          endDate: endDate || null,
          bgColor,
          data,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Failed to save asset", description: err.error || `Server returned ${res.status}`, variant: "destructive" });
        setIsSaving(false);
        return;
      }

      onSave?.();
      toast({
        title: `${meta.label} saved`,
        description: `"${headline || meta.label}" has been created as ${assetStatus}.`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 flex flex-col max-h-[95vh] [&>button.absolute]:hidden">
        {/* Fixed header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <span>{meta.icon}</span>
              Create {meta.label}
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

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column — Form */}
          <div className="w-1/2 overflow-y-auto border-r p-6 space-y-5">

            {/* Flyer: Design Template selector */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="flyer-template">Design Template</Label>
                <Select value={flyerTemplate} onValueChange={(v) => setFlyerTemplate(v as FlyerTemplateId)}>
                  <SelectTrigger id="flyer-template" className="w-full">
                    <SelectValue placeholder="Select a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLYER_TEMPLATES.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Flyer: Meeting selector */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="meeting-select">
                  Base meeting <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedMeetingId} onValueChange={handleMeetingSelect}>
                  <SelectTrigger id="meeting-select" className="w-full">
                    <SelectValue placeholder="Select a meeting…" />
                  </SelectTrigger>
                  <SelectContent>
                    {meetings.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No meetings found for this plan.
                      </div>
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
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1 mt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {formatUsDate(selectedMeeting.date)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {selectedMeeting.time
                        ? (() => {
                            const [h, m] = selectedMeeting.time.split(":").map(Number);
                            if (!isNaN(h) && !isNaN(m)) {
                              const ampm = h >= 12 ? "PM" : "AM";
                              const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                              return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                            }
                            return selectedMeeting.time;
                          })()
                        : ""}
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
              </div>
            )}

            {/* Locked notice */}
            {assetType === "flyer" && isFlyerLocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                Select a base meeting above to unlock the flyer form fields.
              </div>
            )}

            {/* Flyer image upload */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="flyer-image">
                  Flyer image (optional)
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(recommended: 1200×630px or similar landscape)</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" disabled={isFlyerLocked} onClick={() => fileInputRef.current?.click()}>
                    {flyerImage ? "Change Image" : "Upload Image"}
                  </Button>
                  {flyerImage && !isFlyerLocked && (
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setFlyerImage("")}>
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFlyerImageLoading(true);
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setFlyerImage(ev.target?.result as string);
                        setFlyerImageLoading(false);
                      };
                      reader.onerror = () => setFlyerImageLoading(false);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {(flyerImage || flyerImageLoading) && (
                  <div className="mt-1 rounded-lg overflow-hidden border w-32 h-20 relative">
                    {flyerImageLoading ? (
                      <div className="flex items-center justify-center w-full h-full bg-muted">
                        <svg className="animate-spin h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : (
                      <img src={flyerImage} alt="Flyer preview" className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Portal-notice specific */}
            {assetType === "portal-notice" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Notice type</Label>
                  <div className="flex gap-2">
                    {(["text", "countdown"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          noticeType === t
                            ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
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
                    <Label htmlFor="countdownTarget">Countdown target date/time</Label>
                    <Input id="countdownTarget" type="datetime-local" value={countdownTarget} onChange={(e) => setCountdownTarget(e.target.value)} />
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
              </div>
            )}

            {/* Pop-up specific */}
            {assetType === "pop-up" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Show on pages</Label>
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
              </div>
            )}

            {/* Headline */}
            {assetType === "flyer" && isFlyerLocked ? (
              <div className="space-y-1.5 opacity-50 pointer-events-none">
                <Label htmlFor="headline">Headline</Label>
                <Input id="headline" placeholder="Select a meeting first…" disabled />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="headline">Headline</Label>
                <Input id="headline" placeholder="Enter a headline…" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </div>
            )}

            {/* Flyer subtitle */}
            {assetType === "flyer" && (
              isFlyerLocked ? (
                <div className="space-y-1.5 opacity-50 pointer-events-none">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input id="subtitle" placeholder="Select a meeting first…" disabled />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input id="subtitle" placeholder="A short promotional tagline…" value={flyerSubtitle} onChange={(e) => setFlyerSubtitle(e.target.value)} />
                </div>
              )
            )}

            {/* Body */}
            {assetType !== "portal-notice" && (assetType === "flyer" && isFlyerLocked ? (
              <div className="space-y-1.5 opacity-50 pointer-events-none">
                <Label htmlFor="body">Body text</Label>
                <Textarea id="body" rows={4} placeholder="Select a meeting first…" disabled />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Body text</Label>
                  {(assetType === "flyer" || assetType === "pop-up") && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {body.length}/{assetType === "flyer" ? 680 : 300}
                    </span>
                  )}
                </div>
                <Textarea
                  id="body"
                  rows={4}
                  placeholder="Write your message…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={assetType === "flyer" ? 680 : assetType === "pop-up" ? 300 : undefined}
                />
                {assetType === "flyer" && (
                  <p className="text-[11px] text-muted-foreground">
                    Tip: start a line with <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">-</kbd> or <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">*</kbd> to create a bullet point
                  </p>
                )}
              </div>
            ))}

            {/* QR code URL + Generate button */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="flyerQrUrl">
                  QR code link (optional)
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
                    disabled={isFlyerLocked}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isFlyerLocked || !flyerQrUrl.trim() || qrGenerating}
                    onClick={handleGenerateQr}
                    className="gap-1.5 shrink-0"
                  >
                    {qrGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                    {qrGenerating ? "Generating…" : "Generate QR"}
                  </Button>
                </div>
                {qrResult && (
                  <p className="text-[11px] text-muted-foreground">
                    QR generated via {qrResult.source === "qrio" ? "QR.io" : "local"}
                    {qrResult.qrIoId && (
                      <span className="ml-1 font-mono text-[10px] text-green-600">(ID: {qrResult.qrIoId})</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Flyer benefit category */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="flyer-category">Benefit category</Label>
                <select
                  id="flyer-category"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={flyerCategory}
                  onChange={(e) => setFlyerCategory(e.target.value)}
                  disabled={isFlyerLocked}
                >
                  <option value="">All Benefits</option>
                  <option value="Retirement">Retirement</option>
                  <option value="Group Health">Group Health</option>
                  <option value="Group Life">Group Life</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}

            {/* Date range — only for non-flyer assets */}
            {assetType !== "flyer" && !(assetType === "portal-notice" && noticeType === "countdown") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">End date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}

            {/* Accent color */}
            {assetType === "flyer" && isFlyerLocked ? (
              <div className="space-y-1.5 opacity-50 pointer-events-none">
                <Label htmlFor="bgColor">Accent color</Label>
                <div className="flex items-center gap-3">
                  <Input id="bgColor" type="color" className="w-12 h-9 p-1 cursor-pointer" disabled />
                  <span className="text-xs text-muted-foreground font-mono">#23919c</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="bgColor">Accent color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="bgColor"
                    type="color"
                    className="w-12 h-9 p-1 cursor-pointer"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground font-mono">{bgColor}</span>
                </div>
              </div>
            )}

            {/* News post fields */}
            {assetType === "news-post" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                  >
                    <option value="Announcement">Announcement</option>
                    <option value="News">News</option>
                    <option value="Event">Event</option>
                    <option value="Reminder">Reminder</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ctaText">Button text</Label>
                  <Input id="ctaText" placeholder="Learn More" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column — Live Preview */}
          <div className="w-1/2 flex flex-col bg-muted/30">
            <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Eye className="h-4 w-4" />
                Preview
              </div>
            </div>
            <div ref={flyerPreviewRef} className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
              <PreviewPane
                assetType={assetType}
                headline={previewHeadline}
                body={previewBody}
                ctaText={ctaText}
                bgColor={bgColor}
                startDate={startDate}
                endDate={endDate}
                planName={planName}
                planLogo={planLogo}
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
              />
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            {assetType === "flyer" && (
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <div className="h-9 w-px bg-border" />
            <select
              value={assetStatus}
              onChange={(e) => setAssetStatus(e.target.value as MarketingAssetStatus)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : (
                `Save ${meta.label}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview pane ──────────────────────────────────────────────

function PreviewPane({
  assetType,
  headline,
  body,
  ctaText,
  bgColor,
  startDate,
  endDate,
  planName,
  planLogo,
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
}: {
  assetType: AssetType;
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  startDate: string;
  endDate: string;
  planName: string;
  planLogo?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  flyerQrDataUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  flyerSubtitle?: string;
  flyerTemplate?: FlyerTemplateId;
  noticeType?: "text" | "countdown";
  countdownTarget?: string;
  portalCtaUrl?: string;
}) {
  switch (assetType) {
    case "flyer":
      return (
        <FlyerPreview
          headline={headline}
          body={body}
          ctaText={ctaText}
          bgColor={bgColor}
          startDate={startDate}
          planName={planName}
          planLogo={planLogo}
          flyerImage={flyerImage}
          flyerQrUrl={flyerQrUrl}
          flyerQrDataUrl={flyerQrDataUrl}
          meetingTime={meetingTime}
          meetingLocation={meetingLocation}
          flyerSubtitle={flyerSubtitle}
          flyerTemplate={flyerTemplate ?? "classic"}
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
        />
      );
    case "pop-up":
      return <PopUpPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} planName={planName} planLogo={planLogo} />;
    case "news-post":
      return <NewsPostPreview headline={headline} body={body} planName={planName} ctaText={ctaText} />;
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

  return (
    <div className="relative w-full max-w-[600px] overflow-hidden rounded-lg shadow-sm" style={{ background: bgColor }}>
      <div className="relative flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {noticeType === "countdown" && countdownTarget ? (
            <>
              <span className="text-sm font-medium whitespace-nowrap">{headline || "Countdown"}</span>
              {countdown.expired ? (
                <span className="text-base font-bold whitespace-nowrap">Expired</span>
              ) : (
                <div className="flex items-center gap-1.5 text-base font-bold tabular-nums tracking-wider whitespace-nowrap">
                  {countdown.d > 0 && <><span>{countdown.d}</span><span className="text-sm opacity-70">d</span></>}
                  <span>{pad(countdown.h)}</span>
                  <span className="opacity-60">:</span>
                  <span>{pad(countdown.m)}</span>
                  <span className="opacity-60">:</span>
                  <span>{pad(countdown.s)}</span>
                </div>
              )}
            </>
          ) : (
            <span className="text-sm font-medium truncate">{headline || "Portal Notice"}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ctaText && (
            <span
              className="inline-flex items-center rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
              style={{ background: adjustColor(bgColor, -30) }}
            >
              {ctaText}
            </span>
          )}
          {portalCtaUrl && (
            <span className="text-[11px] text-white/70 underline underline-offset-2 truncate max-w-[100px] hidden sm:inline">
              {portalCtaUrl}
            </span>
          )}
          <button type="button" className="rounded-full p-1 transition-colors hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
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
}: {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  planName?: string;
  planLogo?: string;
}) {
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);

  return (
    <div className="w-full max-w-[420px] relative">
      <div className="rounded-xl border bg-gray-100 p-5 space-y-3 opacity-30">
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
              {planName && <p className="text-xs text-gray-500 mt-0.5">{planName}</p>}
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
            <span className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ background: bgColor }}>
              {ctaText || "Learn More"}
            </span>
            <span className="text-xs text-gray-400">Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── News Post Preview ─────────────────────────────────────────

function NewsPostPreview({
  headline,
  body,
  planName,
  ctaText,
}: {
  headline: string;
  body: string;
  planName: string;
  ctaText?: string;
}) {
  return (
    <div className="w-full max-w-[520px] group transition-all duration-300 hover:-translate-y-1">
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{headline || "Announcement Title"}</h3>
            {planName && <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">{planName}</p>}
          </div>
          {body ? (
            <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
          ) : (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="h-3 w-4/6 rounded bg-gray-100" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
            </div>
          )}
          <div className="pt-1">
            <span className="inline-flex items-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm cursor-default">
              {ctaText || "Learn more"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
