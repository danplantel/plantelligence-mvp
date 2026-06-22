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
import { X, Eye, Calendar, Clock, MapPin } from "lucide-react";
import { formatUsDate } from "@/lib/date";

export type AssetType = "flyer" | "portal-notice" | "pop-up" | "news-post";

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

export default function MarketingAssetModal({
  open,
  onOpenChange,
  assetType,
  planName,
  planId,
  onSave,
}: MarketingAssetModalProps) {
  const meta = ASSET_META[assetType];

  // ── Fetch meetings for flyer creation ──
  const { data: meetingsData } = useSWR(
    assetType === "flyer" && planId ? `/api/meetings?clientId=${planId}` : null,
    jsonFetcher,
    { dedupingInterval: 30_000, revalidateOnFocus: false },
  );
  const meetings: Meeting[] = useMemo(() => meetingsData?.data ?? [], [meetingsData]);

  // ── Fetch plan branding data (logo) ──
  const { data: planData } = useSWR(
    planId ? `/api/clients/${planId}` : null,
    jsonFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const planLogo: string | undefined = useMemo(
    () => (planData?.data as { companyLogo?: string })?.companyLogo,
    [planData],
  );

  // ── Shared form fields ──
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flyerPreviewRef = useRef<HTMLDivElement>(null);
  const [assetStatus, setAssetStatus] = useState<MarketingAssetStatus>("Draft");
  const [flyerCategory, setFlyerCategory] = useState("");

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

  // Flyer inputs are locked until a base meeting is selected
  const isFlyerLocked = assetType === "flyer" && !selectedMeetingId;

  // When a meeting is selected, populate flyer fields from it
  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId),
    [meetings, selectedMeetingId],
  );

  // Reset fields when modal opens/closes or asset type changes
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
    setFlyerCategory("");
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
      setFlyerSubtitle(`Join us for this important session`);
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

  // Preview defaults for the right column when flyer has no meeting selected
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

  const handleSave = async () => {
    console.log(`[MarketingAssetModal] Save ${assetType} for ${planName}`, {
      headline, body, startDate, endDate, bgColor, flyerQrUrl,
    });

    // Build type-specific data payload
    const data: Record<string, unknown> = {};
    if (assetType === "flyer") {
      data.flyerSubtitle = flyerSubtitle;
      data.meetingTime = meetingTime;
      data.meetingLocation = meetingLocation;
      data.flyerImage = flyerImage;
      data.flyerQrUrl = flyerQrUrl;
      data.flyerCategory = flyerCategory || null;
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
        console.error("Failed to save asset:", err);
        return;
      }

      onSave?.();
    } catch (error) {
      console.error("Failed to save asset:", error);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 flex flex-col max-h-[95vh] [&>button.absolute]:hidden">
        {/* ── Fixed header ── */}
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

        {/* ── Two-column body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ═══ Left Column — Form ═══ */}
          <div className="w-1/2 overflow-y-auto border-r p-6 space-y-5">
            {/* ── Flyer: Meeting selector ── */}
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
                          <span className="text-[10px] text-muted-foreground">
                            {formatUsDate(m.date)}
                          </span>
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

            {/* Locked notice when no meeting selected */}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isFlyerLocked}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {flyerImage ? "Change Image" : "Upload Image"}
                  </Button>
                  {flyerImage && !isFlyerLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setFlyerImage("")}
                    >
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

            {/* Portal-notice specific — at the top of inputs */}
            {assetType === "portal-notice" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Notice type</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        noticeType === "text"
                          ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                      onClick={() => setNoticeType("text")}
                    >
                      Text Banner
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        noticeType === "countdown"
                          ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                      onClick={() => setNoticeType("countdown")}
                    >
                      Countdown Banner
                    </button>
                  </div>
                </div>
                {noticeType === "countdown" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="countdownTarget">Countdown target date/time</Label>
                    <Input id="countdownTarget" type="datetime-local" value={countdownTarget} onChange={(e) => setCountdownTarget(e.target.value)} />
                  </div>
                )}
                {/* CTA button / link */}
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

            {/* Pop-up specific — at the top of inputs */}
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
                            if (next.includes(page.id)) {
                              setPopupPages(next.filter((p) => p !== page.id));
                            } else {
                              setPopupPages([...next, page.id]);
                            }
                          }
                        }}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span>{page.label}</span>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer pt-1 border-t border-gray-100 dark:border-gray-800">
                  <input
                    type="checkbox"
                    checked={showEveryVisit}
                    onChange={(e) => setShowEveryVisit(e.target.checked)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
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
                <Input
                  id="headline"
                  placeholder="Enter a headline…"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
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
                  <Input
                    id="subtitle"
                    placeholder="A short promotional tagline…"
                    value={flyerSubtitle}
                    onChange={(e) => setFlyerSubtitle(e.target.value)}
                  />
                </div>
              )
            )}

            {/* Body / Description — hidden for portal-notice (uses banner text only) */}
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
                    <span className="text-[11px] text-muted-foreground tabular-nums">{body.length}/{assetType === "flyer" ? 680 : 300}</span>
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
              </div>
            ))}

            {/* QR code URL (replaces CTA — flyers are print-only, no clickable buttons) */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="flyerQrUrl">
                  QR code link (optional)
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(scannable link for the flyer)</span>
                </Label>
                <Input
                  id="flyerQrUrl"
                  placeholder="https://example.com/registration"
                  value={flyerQrUrl}
                  onChange={(e) => setFlyerQrUrl(e.target.value)}
                  disabled={isFlyerLocked}
                />
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

            {/* Date range — only for non-flyer assets (flyer date comes from the meeting) */}
            {assetType !== "flyer" && !(assetType === "portal-notice" && noticeType === "countdown") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">End date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Background color */}
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

            {/* News post — CTA text */}
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
                  <Input
                    id="ctaText"
                    placeholder="Learn More"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ═══ Right Column — Live Preview ═══ */}
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
                ctaUrl=""
                bgColor={bgColor}
                startDate={startDate}
                endDate={endDate}
                planName={planName}
                planLogo={planLogo}
                flyerImage={flyerImage}
                flyerQrUrl={flyerQrUrl}
                meetingTime={meetingTime}
                meetingLocation={meetingLocation}
                flyerSubtitle={flyerSubtitle}
                noticeType={noticeType}
                countdownTarget={countdownTarget}
                portalCtaUrl={portalCtaUrl}
              />
            </div>
          </div>
        </div>

        {/* ── Fixed footer ── */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            {assetType === "flyer" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isFlyerLocked}
                className="gap-1.5"
              >
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
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
            <Button onClick={handleSave}>
              Save {meta.label}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview pane — renders a live mockup of the asset ──

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
  meetingTime,
  meetingLocation,
  flyerSubtitle,
  noticeType,
  countdownTarget,
  portalCtaUrl,
}: {
  assetType: AssetType;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  bgColor: string;
  startDate: string;
  endDate: string;
  planName: string;
  planLogo?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  flyerSubtitle?: string;
  noticeType?: "text" | "countdown";
  countdownTarget?: string;
  portalCtaUrl?: string;
}) {
  switch (assetType) {
    case "flyer":
      return <FlyerPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} startDate={startDate} planName={planName} planLogo={planLogo} flyerImage={flyerImage} flyerQrUrl={flyerQrUrl} meetingTime={meetingTime} meetingLocation={meetingLocation} flyerSubtitle={flyerSubtitle} />;
    case "portal-notice":
      return <NoticePreview headline={headline} body={body} bgColor={bgColor} startDate={startDate} endDate={endDate} planName={planName} noticeType={noticeType} countdownTarget={countdownTarget} ctaText={ctaText} portalCtaUrl={portalCtaUrl} />;
    case "pop-up":
      return <PopUpPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} planName={planName} planLogo={planLogo} />;
    case "news-post":
      return <NewsPostPreview headline={headline} body={body} planName={planName} ctaText={ctaText} />;
  }
}

function FlyerPreview({
  headline,
  body,
  ctaText,
  bgColor,
  startDate,
  planName,
  planLogo,
  flyerImage,
  flyerQrUrl,
  meetingTime,
  meetingLocation,
  flyerSubtitle,
}: {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  startDate: string;
  planName: string;
  planLogo?: string;
  flyerImage?: string;
  flyerQrUrl?: string;
  meetingTime?: string;
  meetingLocation?: string;
  flyerSubtitle?: string;
}) {
  // Resolve R2 branding key to a proxy URL that <image> in SVG can display
  const { url: resolvedPlanLogo } = useBrandingImageUrl(planLogo);

  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      const clean = d.split("T")[0].split(" ")[0];
      const parsed = new Date(clean + "T12:00:00");
      if (isNaN(parsed.getTime())) return d;
      return parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch { return d; }
  };

  const formatTime12h = (t: string) => {
    if (!t) return "";
    try {
      const [h, m] = t.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return t;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    } catch { return t; }
  };

  const formattedDate = formatDate(startDate);

  // Split body text into lines that fit within the flyer (≈85 chars per line for 14px text at 512px width)
  const wrapText = (text: string, maxChars: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > maxChars) {
        lines.push(current.trim());
        current = word;
      } else {
        current += " " + word;
      }
    }
    if (current.trim()) lines.push(current.trim());
    return lines.length ? lines : [text];
  };
  const bodyLines = body ? wrapText(body, 85) : [];

  return (
    <svg viewBox="0 0 612 792" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto max-w-[420px] rounded-xl shadow-sm border" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <defs>
        <linearGradient id="flyerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={adjustColor(bgColor, -40)} />
          <stop offset="100%" stopColor={bgColor} />
        </linearGradient>
        <linearGradient id="imgOverlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        <clipPath id="roundedTop">
          <rect width="612" height="200" rx="8" />
        </clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="792" fill="white" rx="8" />

      {/* ═══ Hero Image Slot (compact) ═══ */}
      <g clipPath="url(#roundedTop)">
        {flyerImage ? (
          <image href={flyerImage} width="612" height="200" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect width="612" height="200" fill={bgColor} opacity="0.08" />
            <circle cx="460" cy="100" r="120" fill={bgColor} opacity="0.06" />
            <circle cx="510" cy="140" r="70" fill={bgColor} opacity="0.04" />
            <g transform="translate(180, 50)" opacity="0.12">
              <rect x="0" y="40" width="30" height="25" rx="2" fill={bgColor} />
              <rect x="35" y="25" width="30" height="40" rx="2" fill={bgColor} />
              <rect x="70" y="10" width="30" height="55" rx="2" fill={bgColor} />
              <rect x="105" y="35" width="30" height="30" rx="2" fill={bgColor} />
            </g>
            <text x="306" y="110" textAnchor="middle" fill={bgColor} fontSize="16" fontWeight="600" opacity="0.25">
              Upload an image above
            </text>
          </>
        )}
        <rect y="130" width="612" height="70" fill="url(#imgOverlay)" />
        <rect width="612" height="200" fill="none" stroke={bgColor} strokeWidth="2" opacity="0.15" />
      </g>

      {/* ═══ Headline & Subtitle (overlaid on image area) ═══ */}
      <text x="50" y="165" fill="white" fontSize="34" fontWeight="800" letterSpacing="-0.5">
        {truncateText(headline, 30)}
      </text>
      {flyerSubtitle ? (
        <text x="50" y="190" fill="white" fontSize="16" fontWeight="500" opacity="0.85">
          {truncateText(flyerSubtitle, 45)}
        </text>
      ) : headline.length > 22 ? (
        <text x="50" y="185" fill="white" fontSize="26" fontWeight="700" opacity="0.95">
          {headline.slice(0, 22)}{headline.length > 22 ? headline.slice(22, 44) : ""}
        </text>
      ) : null}

      {/* ═══ Event Info Card ═══ */}
      <rect x="40" y="240" width="532" height="130" rx="12" fill={bgColor} opacity="0.04" />
      <rect x="40" y="240" width="532" height="130" rx="12" stroke={bgColor} strokeWidth="1" strokeOpacity="0.12" fill="none" />

      {/* Date */}
      <g transform="translate(60, 275)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.1" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="15" fontWeight="600">📅</text>
        <text x="44" y="19" fill="#333" fontSize="16" fontWeight="700">{formattedDate || "Date TBD"}</text>
      </g>

      {/* Time */}
      <g transform="translate(60, 315)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.1" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="15" fontWeight="600">🕐</text>
        <text x="44" y="19" fill="#555" fontSize="15">{formatTime12h(meetingTime || "") || "Time TBD"}</text>
      </g>

      {/* Vertical divider in card */}
      <line x1="330" y1="255" x2="330" y2="355" stroke={bgColor} strokeOpacity="0.1" strokeWidth="1" />

      {/* Location / format */}
      <g transform="translate(350, 275)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.1" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="15" fontWeight="600">📍</text>
        <text x="44" y="19" fill="#333" fontSize="15" fontWeight="600">{meetingLocation || "Format TBD"}</text>
        <text x="44" y="36" fill="#888" fontSize="12">{meetingLocation ? "Check-in details provided" : "Details to be announced"}</text>
      </g>

      {/* ═══ Description Section ═══ */}
      <g transform="translate(50, 420)">
        <text x="0" y="0" fill={bgColor} fontSize="18" fontWeight="700" letterSpacing="0.5">ABOUT THIS EVENT</text>
        <rect x="0" y="10" width="50" height="3.5" rx="1.75" fill={bgColor} />
      </g>
      {bodyLines.length > 0 ? (
        bodyLines.slice(0, 8).map((line, i) => (
          <text key={i} x="50" y={455 + i * 22} fill="#444" fontSize="13">
            {line}
          </text>
        ))
      ) : (
        <text x="50" y="465" fill="#444" fontSize="14">
          Join us for this important event. Details will be shared with registered attendees.
        </text>
      )}

      {/* ═══ Bottom Footer (with brand logo, text, and QR code) ═══ */}
      <rect y="640" width="612" height="152" fill={bgColor} opacity="0.06" />

      {/* Brand Logo — compact, left side, aligned with text */}
      {resolvedPlanLogo ? (
        <g transform="translate(48, 668)">
          <rect x="0" y="0" width="100" height="36" rx="4" fill="white" opacity="0.95" />
          <image href={resolvedPlanLogo} x="5" y="5" width="90" height="26" preserveAspectRatio="xMidYMid contain" />
        </g>
      ) : null}

      {/* Text block — consistent vertical rhythm, centered in footer */}
      <text x="50" y="724" fill={bgColor} fontSize="16" fontWeight="600" opacity="0.7">
        Presented by {planName} · Benefits Team
      </text>
      <text x="50" y="748" fill="#999" fontSize="14">
        Questions? Contact your plan administrator
      </text>

      {/* QR code — 112×112 rendered via QR.io API */}
      <g transform="translate(448, 652)">
        <rect x="0" y="0" width="112" height="112" rx="4" fill="white" stroke={bgColor} strokeWidth="1" strokeOpacity="0.25" />
        {flyerQrUrl ? (
          <image
            href={`https://api.qrserver.com/v1/create-qr-code/?size=112x112&data=${encodeURIComponent(flyerQrUrl)}`}
            x="4" y="4" width="104" height="104"
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <rect x="14" y="14" width="84" height="84" rx="2" fill="none" stroke={bgColor} strokeWidth="0.6" strokeDasharray="4,4" opacity="0.2" />
        )}
      </g>
    </svg>
  );
}

// ── Helpers ──

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function formatLocalDate(d: string): string {
  if (!d) return "";
  try {
    const clean = d.split("T")[0].split(" ")[0];
    const parsed = new Date(clean + "T12:00:00");
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch { return d; }
}

function NoticePreview({
  headline,
  body,
  bgColor,
  startDate,
  endDate,
  planName,
  noticeType,
  countdownTarget,
  ctaText,
  portalCtaUrl,
}: {
  headline: string;
  body: string;
  bgColor: string;
  startDate: string;
  endDate: string;
  planName?: string;
  noticeType?: "text" | "countdown";
  countdownTarget?: string;
  ctaText?: string;
  portalCtaUrl?: string;
}) {
  // ── Live countdown (days + HH:MM:SS) ──
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
    <div
      className="relative w-full max-w-[600px] overflow-hidden rounded-lg shadow-sm"
      style={{ background: bgColor }}
    >
      <div className="relative flex items-center justify-between gap-3 px-4 py-3 text-white">
        {/* Left: headline + countdown */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {noticeType === "countdown" && countdownTarget ? (
            <>
              <span className="text-sm font-medium whitespace-nowrap">{headline || "Countdown"}</span>
              {countdown.expired ? (
                <span className="text-base font-bold whitespace-nowrap">Expired</span>
              ) : (
                <div className="flex items-center gap-1.5 text-base font-bold tabular-nums tracking-wider whitespace-nowrap">
                  {countdown.d > 0 && (
                    <><span>{countdown.d}</span><span className="text-sm opacity-70">d</span></>
                  )}
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

        {/* Right: CTA button + URL + close button */}
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
          <button
            type="button"
            className="rounded-full p-1 transition-colors hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

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
      {/* Page background (dimmed) */}
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
        <div className="h-3 w-3/4 rounded bg-gray-200" />
        <div className="h-20 rounded-lg bg-gray-200 mt-2" />
      </div>

      {/* Modal overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div
          className="w-full rounded-2xl border-2 bg-white shadow-2xl p-6 space-y-4"
          style={{ borderColor: bgColor }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 leading-snug">
                {headline || "Announcement"}
              </h3>
              {planName && (
                <p className="text-xs text-gray-500 mt-0.5">{planName}</p>
              )}
            </div>
            <div className="h-6 w-6 shrink-0 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-xs cursor-default hover:bg-gray-100 transition-colors">
              ✕
            </div>
          </div>

          {/* Body */}
          {body ? (
            <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
          ) : (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="h-3 w-4/6 rounded bg-gray-100" />
            </div>
          )}

          {/* CTA */}
          <div className="pt-1 flex items-center gap-3">
            <span
              className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              style={{ background: bgColor }}
            >
              {ctaText || "Learn More"}
            </span>
            <span className="text-xs text-gray-400">Dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      {/* Announcement card — Elementor-style */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          {/* Heading */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-snug">
              {headline || "Announcement Title"}
            </h3>
            {planName && (
              <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">
                {planName}
              </p>
            )}
          </div>

          {/* Body text */}
          {body ? (
            <p className="text-sm text-gray-600 leading-relaxed">
              {body}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="h-3 w-4/6 rounded bg-gray-100" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
            </div>
          )}

          {/* CTA Button */}
          <div className="pt-1">
            <span className="inline-flex items-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-200 hover:scale-105 cursor-default">
              {ctaText || "Learn more"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
