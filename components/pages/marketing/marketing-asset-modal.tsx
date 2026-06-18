"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import useSWR from "swr";
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

interface MarketingAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetType: AssetType;
  planName: string;
  planId: string;
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
}: MarketingAssetModalProps) {
  const meta = ASSET_META[assetType];

  // ── Fetch meetings for flyer creation ──
  const { data: meetingsData } = useSWR(
    assetType === "flyer" && planId ? `/api/meetings?clientId=${planId}` : null,
    jsonFetcher,
    { dedupingInterval: 30_000, revalidateOnFocus: false },
  );
  const meetings: Meeting[] = useMemo(() => meetingsData?.data ?? [], [meetingsData]);

  // ── Shared form fields ──
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bgColor, setBgColor] = useState("#23919c");

  // Flyer-specific
  const [flyerSubtitle, setFlyerSubtitle] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [flyerImage, setFlyerImage] = useState<string>("");
  const [flyerImageLoading, setFlyerImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pop-up specific
  const [showEveryVisit, setShowEveryVisit] = useState(false);

  // News post specific
  const [postCategory, setPostCategory] = useState("Announcement");

  // When a meeting is selected, populate flyer fields from it
  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId),
    [meetings, selectedMeetingId],
  );

  // Reset fields when modal opens/closes or asset type changes
  useEffect(() => {
    setHeadline("");
    setBody("");
    setCtaText("");
    setCtaUrl("");
    setStartDate("");
    setEndDate("");
    setBgColor("#23919c");
    setFlyerSubtitle("");
    setSelectedMeetingId("");
    setFlyerImage("");
    setShowEveryVisit(false);
    setPostCategory("Announcement");
  }, [open, assetType]);

  const handleMeetingSelect = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    const m = meetings.find((x) => x.id === meetingId);
    if (m) {
      setHeadline(m.meeting);
      setBody(m.description || "");
      setFlyerSubtitle(`${m.meetingType} — ${formatUsDate(m.date)}`);
      setStartDate(m.date);
      setCtaText("Learn More & Register");
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
  const previewCta = ctaText || "Learn More";

  const handleSave = () => {
    // TODO: persist the asset
    console.log(`[MarketingAssetModal] Save ${assetType} for ${planName}`, {
      headline, body, ctaText, ctaUrl, startDate, endDate, bgColor,
    });
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
                      {selectedMeeting.time}
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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {flyerImage ? "Change Image" : "Upload Image"}
                  </Button>
                  {flyerImage && (
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

            {/* Headline */}
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                placeholder="Enter a headline…"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>

            {/* Flyer subtitle */}
            {assetType === "flyer" && (
              <div className="space-y-1.5">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  placeholder="Meeting type — date"
                  value={flyerSubtitle}
                  onChange={(e) => setFlyerSubtitle(e.target.value)}
                />
              </div>
            )}

            {/* Body / Description */}
            <div className="space-y-1.5">
              <Label htmlFor="body">Body text</Label>
              <Textarea
                id="body"
                rows={4}
                placeholder="Write your message…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {/* CTA text */}
            <div className="space-y-1.5">
              <Label htmlFor="ctaText">CTA button text</Label>
              <Input
                id="ctaText"
                placeholder='e.g. "Learn More", "Register Now"'
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
              />
            </div>

            {/* CTA URL */}
            <div className="space-y-1.5">
              <Label htmlFor="ctaUrl">CTA link (optional)</Label>
              <Input
                id="ctaUrl"
                placeholder="https://…"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
              />
            </div>

            {/* Date range */}
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

            {/* Background color */}
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

            {/* Pop-up specific */}
            {assetType === "pop-up" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEveryVisit}
                  onChange={(e) => setShowEveryVisit(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show on every visit
              </label>
            )}

            {/* News post category */}
            {assetType === "news-post" && (
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
            <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
              <PreviewPane
                assetType={assetType}
                headline={previewHeadline}
                body={previewBody}
                ctaText={previewCta}
                ctaUrl={ctaUrl}
                bgColor={bgColor}
                startDate={startDate}
                endDate={endDate}
                planName={planName}
                flyerImage={flyerImage}
              />
            </div>
          </div>
        </div>

        {/* ── Fixed footer ── */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save {meta.label}
          </Button>
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
  flyerImage,
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
  flyerImage?: string;
}) {
  switch (assetType) {
    case "flyer":
      return <FlyerPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} startDate={startDate} planName={planName} flyerImage={flyerImage} />;
    case "portal-notice":
      return <NoticePreview headline={headline} body={body} bgColor={bgColor} startDate={startDate} endDate={endDate} />;
    case "pop-up":
      return <PopUpPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} />;
    case "news-post":
      return <NewsPostPreview headline={headline} body={body} planName={planName} />;
  }
}

function FlyerPreview({
  headline,
  body,
  ctaText,
  bgColor,
  startDate,
  planName,
  flyerImage,
}: {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
  startDate: string;
  planName: string;
  flyerImage?: string;
}) {
  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch { return d; }
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
          <rect width="612" height="320" rx="8" />
        </clipPath>
      </defs>

      {/* White background */}
      <rect width="612" height="792" fill="white" rx="8" />

      {/* ═══ Hero Image Slot ═══ */}
      <g clipPath="url(#roundedTop)">
        {flyerImage ? (
          <image href={flyerImage} width="612" height="320" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect width="612" height="320" fill={bgColor} opacity="0.08" />
            <circle cx="460" cy="160" r="180" fill={bgColor} opacity="0.06" />
            <circle cx="510" cy="220" r="100" fill={bgColor} opacity="0.04" />
            <g transform="translate(140, 80)" opacity="0.12">
              <rect x="0" y="60" width="40" height="40" rx="2" fill={bgColor} />
              <rect x="40" y="40" width="40" height="60" rx="2" fill={bgColor} />
              <rect x="80" y="20" width="40" height="80" rx="2" fill={bgColor} />
              <rect x="120" y="50" width="40" height="50" rx="2" fill={bgColor} />
              <rect x="160" y="70" width="40" height="30" rx="2" fill={bgColor} />
            </g>
            <text x="306" y="170" textAnchor="middle" fill={bgColor} fontSize="16" fontWeight="600" opacity="0.25">
              Upload an image above
            </text>
          </>
        )}
        <rect y="200" width="612" height="120" fill="url(#imgOverlay)" />
        <rect width="612" height="320" fill="none" stroke={bgColor} strokeWidth="2" opacity="0.15" />
      </g>

      {/* ═══ Headline (overlaid on image area) ═══ */}
      <text x="50" y="250" fill="white" fontSize="34" fontWeight="800" letterSpacing="-0.5">
        {truncateText(headline, 30)}
      </text>
      {headline.length > 22 && (
        <text x="50" y="290" fill="white" fontSize="26" fontWeight="700" opacity="0.95">
          {headline.slice(0, 22)}{headline.length > 22 ? headline.slice(22, 44) : ""}
        </text>
      )}

      {/* ═══ Event Info Card ═══ */}
      <rect x="40" y="340" width="532" height="130" rx="12" fill={bgColor} opacity="0.04" />
      <rect x="40" y="340" width="532" height="130" rx="12" stroke={bgColor} strokeWidth="1" strokeOpacity="0.12" fill="none" />

      {/* Date */}
      <g transform="translate(60, 375)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.1" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="15" fontWeight="600">📅</text>
        <text x="44" y="19" fill="#333" fontSize="16" fontWeight="700">{formattedDate || "Date TBD"}</text>
      </g>

      {/* Time */}
      <g transform="translate(60, 415)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.1" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="15" fontWeight="600">🕐</text>
        <text x="44" y="19" fill="#555" fontSize="15">Time to be announced</text>
      </g>

      {/* Vertical divider in card */}
      <line x1="330" y1="355" x2="330" y2="455" stroke={bgColor} strokeOpacity="0.1" strokeWidth="1" />

      {/* Location / format */}
      <g transform="translate(350, 375)">
        <circle cx="14" cy="14" r="14" fill={bgColor} opacity="0.1" />
        <text x="14" y="19" textAnchor="middle" fill={bgColor} fontSize="15" fontWeight="600">📍</text>
        <text x="44" y="19" fill="#333" fontSize="15" fontWeight="600">Format TBD</text>
        <text x="44" y="36" fill="#888" fontSize="12">Details to be announced</text>
      </g>

      {/* ═══ Description Section ═══ */}
      <g transform="translate(50, 510)">
        <text x="0" y="0" fill={bgColor} fontSize="18" fontWeight="700" letterSpacing="0.5">ABOUT THIS EVENT</text>
        <rect x="0" y="10" width="50" height="3.5" rx="1.75" fill={bgColor} />
      </g>
      {bodyLines.length > 0 ? (
        bodyLines.slice(0, 8).map((line, i) => (
          <text key={i} x="50" y={555 + i * 22} fill="#444" fontSize="14">
            {line}
          </text>
        ))
      ) : (
        <text x="50" y="555" fill="#444" fontSize="14">
          Join us for this important event. Details will be shared with registered attendees.
        </text>
      )}

      {/* ═══ CTA Section ═══ */}
      <rect x="50" y="610" width="512" height="70" rx="12" fill={bgColor} opacity="0.07" />
      <rect x="50" y="610" width="512" height="70" rx="12" stroke={bgColor} strokeWidth="1.5" strokeOpacity="0.2" fill="none" />
      <text x="306" y="640" textAnchor="middle" fill={bgColor} fontSize="20" fontWeight="800" letterSpacing="0.5">
        {ctaText}
      </text>
      <text x="306" y="662" textAnchor="middle" fill="#777" fontSize="13">
        Scan to register · Space is limited
      </text>

      {/* ═══ Bottom Footer ═══ */}
      <rect y="720" width="612" height="72" fill={bgColor} opacity="0.06" />
      <text x="306" y="750" textAnchor="middle" fill={bgColor} fontSize="13" fontWeight="600" opacity="0.7">
        Presented by {planName} · Benefits Team
      </text>
      <text x="306" y="770" textAnchor="middle" fill="#999" fontSize="11">
        Questions? Contact your plan administrator
      </text>
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

function NoticePreview({
  headline,
  body,
  bgColor,
  startDate,
  endDate,
}: {
  headline: string;
  body: string;
  bgColor: string;
  startDate: string;
  endDate: string;
}) {
  return (
    <div className="w-full max-w-[520px] rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-b">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 h-5 rounded bg-gray-200" />
      </div>
      {/* Notice banner */}
      <div className="px-4 py-3 text-center text-sm font-medium text-white" style={{ background: bgColor }}>
        ⚡ {headline}
      </div>
      {/* Page content */}
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
        <div className="h-20 rounded bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
          <span className="text-xs text-gray-400">Page content</span>
        </div>
      </div>
      {/* Date badge */}
      {(startDate || endDate) && (
        <div className="px-4 pb-3 flex items-center gap-2 text-[11px] text-gray-500">
          {startDate && <span>From: {startDate}</span>}
          {endDate && <span>To: {endDate}</span>}
        </div>
      )}
    </div>
  );
}

function PopUpPreview({
  headline,
  body,
  ctaText,
  bgColor,
}: {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
}) {
  return (
    <div className="w-full max-w-[420px] relative">
      {/* Page background (dimmed) */}
      <div className="rounded-xl border bg-gray-100 p-4 space-y-3 opacity-40">
        <div className="h-4 w-3/4 rounded bg-gray-300" />
        <div className="h-3 w-1/2 rounded bg-gray-200" />
        <div className="h-16 rounded bg-gray-200" />
      </div>
      {/* Modal overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="w-full rounded-xl border-2 bg-white shadow-xl p-5 space-y-3" style={{ borderColor: bgColor }}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">{headline}</h3>
            <div className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-xs cursor-default">✕</div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
          <div className="pt-1">
            <span
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: bgColor }}
            >
              {ctaText}
            </span>
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
}: {
  headline: string;
  body: string;
  planName: string;
}) {
  return (
    <div className="w-full max-w-[520px] rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50/50">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Latest Updates</h4>
      </div>
      <div className="divide-y">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-4">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: i === 1 ? "#23919c" : i === 2 ? "#5a9eae" : "#8fbcc8" }}
            >
              {planName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {i === 1 ? headline : i === 2 ? "Upcoming Events" : "Plan Reminder"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                {i === 1 ? body : i === 2 ? "Check out our upcoming events this quarter." : "Don't forget to review your plan details."}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {i === 1 ? "2 hours ago" : i === 2 ? "1 day ago" : "3 days ago"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
