"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image-compression";
import {
  DEFAULT_WEBINAR_PLACEMENT,
  WEBINAR_PLACEMENTS,
  type WebinarPlacementKey,
} from "@/lib/webinar-placements";
import {
  formatRuntimeBadge,
  measureVideoRuntime,
} from "@/lib/webinars/video-runtime";

/**
 * Create a webinar from anywhere — the Communications → Webinars page and the
 * portal's News & Events panel use this one form.
 *
 * It is the portal-facing half of that page's creator: title, description,
 * category, the pages the video lives on, its event date, and either an uploaded
 * file (≤10 MB, stored as base64 for the row) or a URL, plus the thumbnail the
 * card shows. Editing an existing row, bulk delete and the hover teaser stay on
 * the dashboard page.
 */

/** Field caps, matching the Webinars page. */
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 200;
/** Longest edge, in px, for the stored thumbnail. */
const THUMBNAIL_MAX_EDGE = 640;
/** The list request omits the video payload, so uploads stay small. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Categories a video can be filed under — narrower than the contact taxonomy. */
const CATEGORIES = ["Retirement", "Health", "Life", "Other", "All"] as const;

export interface WebinarCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan's database id, as `POST /api/webinars` expects it. */
  planId: string;
  /** The plan's company name — the API identifies the plan by name. */
  planName: string;
  /** Called after a successful save, so the host can re-read its lists. */
  onCreated?: () => void;
}

export function WebinarCreateDialog({
  open,
  onOpenChange,
  planId,
  planName,
  onCreated,
}: WebinarCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [placements, setPlacements] = useState<WebinarPlacementKey[]>([
    DEFAULT_WEBINAR_PLACEMENT,
  ]);
  const [eventDate, setEventDate] = useState("");
  const [sourceType, setSourceType] = useState<"upload" | "url" | "">("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState<"upload" | "frame">(
    "upload",
  );
  const [frameTime, setFrameTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const thumbnailVideoRef = useRef<HTMLVideoElement | null>(null);
  /**
   * The picked file's runtime, measured in the background.
   *
   * A ref, not state: it is read once when the form is submitted, and
   * re-rendering for it would be noise. Measuring on pick (rather than awaiting
   * at submit) means saving never waits for the browser to decode the video.
   */
  const measuredRuntimeRef = useRef(0);

  // A fresh form every time the dialog opens: half a webinar left over from a
  // previous attempt must never be saved against a different plan.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCategory("All");
    setPlacements([DEFAULT_WEBINAR_PLACEMENT]);
    setEventDate("");
    setSourceType("");
    setVideoFile(null);
    setVideoUrl("");
    setThumbnail("");
    setThumbnailMode("upload");
    setFrameTime(0);
    setVideoDuration(0);
    measuredRuntimeRef.current = 0;
    setError(null);
  }, [open]);

  // Object URL for the picked file, so the frame picker has something to scrub.
  const previewUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : null),
    [videoFile],
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const applyThumbnail = useCallback(async (dataUrl: string) => {
    try {
      const compressed = await compressImage(dataUrl, {
        maxWidth: THUMBNAIL_MAX_EDGE,
        maxHeight: THUMBNAIL_MAX_EDGE,
        quality: 0.8,
        mimeType: "image/jpeg",
      });
      setThumbnail(compressed);
    } catch {
      const message = "That image could not be processed.";
      setError(message);
      toast.error(message);
    }
  }, []);

  const handleThumbnailFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const message = "The thumbnail must be an image.";
      setError(message);
      toast.error(message);
      return;
    }
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl) {
      const message = "That image could not be read.";
      setError(message);
      toast.error(message);
      return;
    }
    await applyThumbnail(dataUrl);
  };

  /** Draw the frame under the playhead and use it as the card's thumbnail. */
  const captureFrame = async () => {
    const video = thumbnailVideoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, THUMBNAIL_MAX_EDGE / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    await applyThumbnail(canvas.toDataURL("image/jpeg", 0.85));
  };

  const handleVideoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      const message =
        "That file is over 10 MB. Upload it to YouTube or Vimeo and use the URL option instead.";
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setVideoFile(file);
    setThumbnailMode("frame");
    measuredRuntimeRef.current = 0;
    void measureVideoRuntime(file).then((seconds) => {
      measuredRuntimeRef.current = seconds;
    });
  };

  const togglePlacement = (key: WebinarPlacementKey, checked: boolean) => {
    setPlacements((previous) =>
      checked
        ? Array.from(new Set([...previous, key]))
        : previous.filter((entry) => entry !== key),
    );
  };

  const save = async () => {
    const problems: string[] = [];
    if (!title.trim()) problems.push("a title");
    if (!eventDate) problems.push("an event date");
    if (!thumbnail) problems.push("a thumbnail");
    if (!sourceType) problems.push("a video source");
    if (sourceType === "upload" && !videoFile) problems.push("a video file");
    if (sourceType === "url" && !videoUrl.trim()) problems.push("a video URL");
    if (placements.length === 0) problems.push("at least one page");
    if (problems.length > 0) {
      const message = `This webinar still needs ${problems.join(", ")}.`;
      setError(message);
      toast.error(message);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      let base64: string | null = null;
      if (sourceType === "upload" && videoFile) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(videoFile);
        });
      }

      const response = await fetch("/api/webinars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: planName,
          clientId: planId,
          sourceType: {
            upload: sourceType === "upload",
            url: sourceType === "url",
          },
          webinarTitle: title.trim(),
          description,
          thumbnail: thumbnail || null,
          benefitsCategory: category || null,
          placements,
          eventDate: eventDate ? `${eventDate}T12:00:00` : null,
          videoFile: base64,
          // The badge on the portal card. A URL-sourced video has no runtime to
          // measure, so the field is cleared rather than left stale.
          duration:
            sourceType === "upload"
              ? formatRuntimeBadge(measuredRuntimeRef.current) ?? null
              : null,
          videoUrl: sourceType === "url" ? videoUrl.trim() : "",
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not save this webinar.");
      }

      toast.success("Webinar added", { description: planName });
      onOpenChange(false);
      onCreated?.();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Could not save this webinar.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `z-[110]` clears the portal's Editing Panel (`z-[51]`) and the
          published pop-up (`z-[100]`) — an action the advisor asked for must sit
          above both. */}
      <DialogContent
        overlayClassName="z-[110]"
        className="max-w-2xl max-h-[90vh] overflow-y-auto z-[110]"
      >
        <DialogHeader>
          <DialogTitle>Add a webinar</DialogTitle>
          <DialogDescription>
            A video for {planName}. It appears on News & Events by default;
            tick any benefits page it should also appear on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="webinar-title">Title</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {title.length}/{MAX_TITLE}
              </span>
            </div>
            <Input
              id="webinar-title"
              value={title}
              maxLength={MAX_TITLE}
              placeholder="Open enrollment walkthrough"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="webinar-description">Description</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {description.length}/{MAX_DESCRIPTION}
              </span>
            </div>
            <Textarea
              id="webinar-description"
              rows={3}
              value={description}
              maxLength={MAX_DESCRIPTION}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Benefit category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="webinar-date">Event date</Label>
              <Input
                id="webinar-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Where this video will live</Label>
            {WEBINAR_PLACEMENTS.map(({ key, label, hint }) => (
              <label
                key={key}
                htmlFor={`webinar-placement-${key}`}
                className="flex cursor-pointer items-start gap-2.5"
              >
                <Checkbox
                  id={`webinar-placement-${key}`}
                  checked={placements.includes(key)}
                  onCheckedChange={(checked) =>
                    togglePlacement(key, checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Video source</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={sourceType === "upload"}
                onClick={() => setSourceType("upload")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  sourceType === "upload"
                    ? "border-accent-blue bg-accent-blue/5"
                    : "hover:bg-muted/50"
                }`}
              >
                Upload a file
                <span className="mt-1 block text-xs text-muted-foreground">
                  10 MB maximum. Larger videos need a URL.
                </span>
              </button>
              <button
                type="button"
                aria-pressed={sourceType === "url"}
                onClick={() => setSourceType("url")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  sourceType === "url"
                    ? "border-accent-blue bg-accent-blue/5"
                    : "hover:bg-muted/50"
                }`}
              >
                Link a video
                <span className="mt-1 block text-xs text-muted-foreground">
                  YouTube, Vimeo, or a direct file URL.
                </span>
              </button>
            </div>
          </div>

          {sourceType === "upload" && (
            <div className="space-y-2">
              <Label htmlFor="webinar-file">Video file</Label>
              <Input
                id="webinar-file"
                type="file"
                accept="video/*"
                onChange={handleVideoFile}
              />
              {videoFile && (
                <p className="text-xs text-muted-foreground">
                  {videoFile.name}
                </p>
              )}
            </div>
          )}

          {sourceType === "url" && (
            <div className="space-y-2">
              <Label htmlFor="webinar-url">Video URL</Label>
              <Input
                id="webinar-url"
                type="url"
                placeholder="https://youtube.com/watch?v=…"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <p className="text-xs text-muted-foreground">
              What the card shows. Upload an image, or grab a frame from the
              video you picked.
            </p>
            {thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt="Thumbnail preview"
                className="h-20 w-32 rounded-md border object-cover"
              />
            )}
            <div className="inline-flex overflow-hidden rounded-md border">
              <button
                type="button"
                aria-pressed={thumbnailMode === "upload"}
                onClick={() => setThumbnailMode("upload")}
                className={`h-9 px-3 text-sm ${
                  thumbnailMode === "upload"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                Upload image
              </button>
              <button
                type="button"
                aria-pressed={thumbnailMode === "frame"}
                disabled={!previewUrl}
                title={previewUrl ? undefined : "Pick a video file first"}
                onClick={() => setThumbnailMode("frame")}
                className={`h-9 border-l px-3 text-sm ${
                  thumbnailMode === "frame"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Use video frame
              </button>
            </div>

            {thumbnailMode === "upload" ? (
              <Input
                type="file"
                accept="image/*"
                onChange={handleThumbnailFile}
              />
            ) : previewUrl ? (
              <div className="space-y-2">
                <video
                  ref={thumbnailVideoRef}
                  src={previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full rounded-md bg-black aspect-video"
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    setVideoDuration(video.duration || 0);
                    const start = Math.min(1, (video.duration || 0) / 2);
                    setFrameTime(start);
                    video.currentTime = start;
                  }}
                  onSeeked={() => void captureFrame()}
                />
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 0}
                  step={0.05}
                  value={frameTime}
                  aria-label="Choose the video frame to use"
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setFrameTime(next);
                    if (thumbnailVideoRef.current) {
                      thumbnailVideoRef.current.currentTime = next;
                    }
                  }}
                  className="w-full accent-primary"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a video file above to capture a frame from it.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => void save()}>
            {isSaving ? "Adding…" : "Add video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
