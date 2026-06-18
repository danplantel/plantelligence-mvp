"use client";

import { useState, useMemo } from "react";
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
import { X, Eye, EyeOff } from "lucide-react";

export type AssetType = "flyer" | "portal-notice" | "pop-up" | "news-post";

interface MarketingAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetType: AssetType;
  planName: string;
}

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
}: MarketingAssetModalProps) {
  const meta = ASSET_META[assetType];

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

  // Pop-up specific
  const [showEveryVisit, setShowEveryVisit] = useState(false);

  // News post specific
  const [postCategory, setPostCategory] = useState("Announcement");

  const handleSave = () => {
    // TODO: persist the asset
    console.log(`[MarketingAssetModal] Save ${assetType} for ${planName}`, {
      headline, body, ctaText, ctaUrl, startDate, endDate, bgColor,
    });
    onOpenChange(false);
  };

  const previewHeadline = headline || meta.label;
  const previewBody = body || "Your content will appear here…";
  const previewCta = ctaText || "Learn More";

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
                  placeholder="A short subtitle…"
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
}) {
  switch (assetType) {
    case "flyer":
      return <FlyerPreview headline={headline} body={body} ctaText={ctaText} bgColor={bgColor} />;
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
}: {
  headline: string;
  body: string;
  ctaText: string;
  bgColor: string;
}) {
  return (
    <div className="w-full max-w-[420px] rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="h-2" style={{ background: bgColor }} />
      <div className="p-6 space-y-4">
        <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
          {headline}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
        <div className="pt-2">
          <span
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: bgColor }}
          >
            {ctaText}
          </span>
        </div>
      </div>
      <div className="h-1.5" style={{ background: bgColor, opacity: 0.3 }} />
    </div>
  );
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
