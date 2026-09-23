"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_WEBINAR_PLACEMENT,
  WEBINAR_PLACEMENTS,
} from "@/lib/webinar-placements";
import { compressImage } from "@/lib/image-compression";
import { PlanSearchBar } from "@/components/plan-selector/plan-search-bar";
import { isActiveClientStatus } from "@/lib/active-client-status";
import {
  getLastPlanId,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isValid } from "date-fns";
import {
  Calendar,
  Check,
  Video,
  Upload,
  Link as LinkIcon,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Clock,
  Play,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useWebinarHoverPreview,
  type HoverPreviewSubject,
} from "@/hooks/useWebinarHoverPreview";
import { WebinarHoverPreviewLayer } from "@/components/webinars/webinar-hover-preview";

interface WebinarFormData {
  client: string;
  sourceType: "upload" | "url" | "";
  webinarTitle: string;
  description: string;
  thumbnail: string;
  benefitsCategory: string;
  placements: string[];
  eventDate: Date | undefined;
  videoFile: File | null;
  videoUrl: string;
}

interface Webinar {
  id: string;
  clientId: string;
  clientName: string;
  sourceType: {
    upload: boolean;
    url: boolean;
  };
  webinarTitle: string;
  description?: string | null;
  thumbnail?: string | null;
  benefitsCategory?: string | null;
  /** Portal pages the video is published on (see `lib/webinar-placements`). */
  placements?: string[] | null;
  eventDate: Date;
  videoFileUrl: string | null;
  /** Set when a video exists but its payload was omitted from the list request. */
  hasVideoFile?: boolean;
  /** Length of the stored base64 video, sent in place of the payload itself. */
  videoSize?: number;
  videoUrl: string | null;
  createdAt: Date;
}

interface Client {
  id: string;
  companyName: string;
  status?: string;
}

// Helper function to convert YouTube/Vimeo URL to embed URL
function getEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube URL patterns
  const youtubeRegex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo URL patterns
  const vimeoRegex = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // If it's already an embed URL, return as is
  if (url.includes("youtube.com/embed") || url.includes("vimeo.com/video")) {
    return url;
  }

  // If it's a direct video URL (mp4, etc.), return null to use video element
  if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
    return null;
  }

  return null;
}

// Field limits for the Upload/Edit Video form, kept in one place so the input
// caps and the counters can never drift apart.
const MAX_VIDEO_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;
// Longest edge, in px, for the stored thumbnail (uploaded image or video frame).
const THUMBNAIL_MAX_EDGE = 640;
// Benefit categories a video can be filed under. Kept as its own short list —
// narrower than the contact/meeting taxonomies — so "All" is a real choice.
const BENEFITS_CATEGORIES = [
  "Retirement",
  "Health",
  "Life",
  "Other",
  "All",
] as const;

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Endpoint returning one row's stored video. Defined at module scope so its identity
 * is stable — the teaser's preloader is keyed on it, so a fresh function on every
 * render would re-run the preload effect for nothing.
 */
const webinarVideoFileEndpoint = (subject: HoverPreviewSubject) =>
  `/api/webinars/${subject.id}`;

export default function WebinarsPage() {
  const router = useRouter();
  const { setTitle, setSubtitle } = usePageTitleContext();
  // Set page title
  useEffect(() => {
    setTitle("Webinars & Replays");
  }, [setTitle]);

  // Form state
  const [formData, setFormData] = useState<WebinarFormData>({
    client: "",
    sourceType: "",
    webinarTitle: "",
    description: "",
    thumbnail: "",
    benefitsCategory: "All",
    placements: [DEFAULT_WEBINAR_PLACEMENT],
    eventDate: undefined,
    videoFile: null,
    videoUrl: "",
  });

  // List state
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [editingWebinarId, setEditingWebinarId] = useState<string | null>(null);
  // Whether the row being edited already carries an uploaded video. An edit keeps
  // that file unless a new one is sent, so treating the file input as always
  // required meant re-uploading a multi-MB video just to fix a typo in the title.
  const [editingHasStoredFile, setEditingHasStoredFile] = useState(false);
  // Preview of the stored video, tagged with the row it came from so a preview can
  // never leak onto the next webinar the modal opens for.
  const [editVideoPreview, setEditVideoPreview] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const [isLoadingEditVideo, setIsLoadingEditVideo] = useState(false);
  const editVideoPreviewUrl =
    editVideoPreview && editVideoPreview.id === editingWebinarId
      ? editVideoPreview.url
      : null;
  // Add/Edit Webinar dialog — the form that used to sit inline on the page.
  const [webinarModalOpen, setWebinarModalOpen] = useState(false);
  // Webinar awaiting delete confirmation
  const [webinarPendingDelete, setWebinarPendingDelete] =
    useState<Webinar | null>(null);
  // In-flight add/update — drives the submit button's spinner.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-select for the replays list.
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Rows captured when the bulk confirmation is opened (see `openBulkDelete`).
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Row being watched in the lazy video dialog (see `openVideoPreview`).
  const [videoPreview, setVideoPreview] = useState<{
    title: string;
    videoUrl: string | null;
    videoFileUrl: string | null;
    isLoading: boolean;
  } | null>(null);

  // Hover teaser — hovering a card plays the opening seconds of its video, the way
  // YouTube previews a thumbnail. Suspended while a dialog or select mode owns the
  // page, because the pointer may never leave the card it is resting on. The
  // teaser's timing, caching and lazy fetch all live in the hook, shared with the
  // portal's webinar grid.
  const { previewFor, hoveredId, getHoverProps, preloadHoverPreviews } =
    useWebinarHoverPreview({
      videoFileEndpoint: webinarVideoFileEndpoint,
      suspended: isSelectMode || Boolean(videoPreview) || webinarModalOpen,
    });

  // Sort state — the list is scoped by plan, so there is no search field.
  const [sortBy, setSortBy] = useState<"date" | "size">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selected plan — the flow's entry point, mirroring the Meetings page. The
  // search bar at the top sets it; the form targets it and the replays list
  // shows only its webinars.
  const [selectedPlan, setSelectedPlan] = useState("");
  const selectedPlanClientName =
    clients.find((c) => c.id === selectedPlan)?.companyName || "";

  // Scoped to the plan chosen in the search bar — the only filter the list has.
  const filteredWebinars = webinars.filter(
    (webinar) =>
      !selectedPlanClientName || webinar.clientName === selectedPlanClientName,
  );

  // Sort webinars
  const sortedWebinars = [...filteredWebinars].sort((a, b) => {
    if (sortBy === "date") {
      const aDate = new Date(a.eventDate).getTime();
      const bDate = new Date(b.eventDate).getTime();
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
    } else if (sortBy === "size") {
      // The list omits the base64 payload, so compare the size the API reports;
      // URL-sourced rows fall back to their URL length.
      const sizeOf = (w: Webinar) =>
        w.videoSize && w.videoSize > 0 ? w.videoSize : w.videoUrl?.length ?? 0;
      const aSize = sizeOf(a);
      const bSize = sizeOf(b);
      return sortDirection === "asc" ? aSize - bSize : bSize - aSize;
    }
    return 0;
  });

  // A teaser that has to download first is not really a teaser, so every card's
  // video is warmed as soon as the list is in — that is what makes the first hover
  // play immediately instead of waiting on a multi-MB fetch. The hook serialises the
  // requests and caps how many it keeps, so this stays a background trickle rather
  // than a burst. Re-running is free: anything already warm, in flight or queued is
  // skipped.
  const preloadKey = sortedWebinars.map((w) => w.id).join("|");
  const preloadSubjects = useMemo(
    () =>
      sortedWebinars.map((w) => ({
        id: w.id,
        videoUrl: w.videoUrl,
        videoFileUrl: w.videoFileUrl,
        hasVideoFile: w.hasVideoFile,
      })),
    // Keyed on the row ids rather than the array, which is rebuilt on every render.
    [preloadKey],
  );
  useEffect(() => {
    preloadHoverPreviews(preloadSubjects);
  }, [preloadSubjects, preloadHoverPreviews]);

  // Only rows currently on screen can be acted on: a selection made before the
  // plan changed must never delete something the user cannot see.
  const selectedWebinars = sortedWebinars.filter((w) => selectedIds.has(w.id));
  const allVisibleSelected =
    sortedWebinars.length > 0 &&
    selectedWebinars.length === sortedWebinars.length;

  // Fetch clients (plans)
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setIsLoadingClients(true);
        const response = await fetch("/api/clients");
        const result = await response.json();

        if (result.success) {
          // Only active plans are selectable here. `isActiveClientStatus` accepts
          // both the "Active" and legacy "active" spellings of the status.
          const activeClients = (result.data || []).filter((client: Client) =>
            isActiveClientStatus(client.status),
          );
          setClients(activeClients);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
        toast.error("Failed to load plans");
      } finally {
        setIsLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  // Fetch webinars
  const fetchWebinars = async () => {
    try {
      setIsLoading(true);
      // `includeVideoFiles=0` keeps the multi-MB base64 videos out of the list
      // payload: the cards only need the thumbnail, and playback fetches the one
      // video it needs on demand.
      const response = await fetch("/api/webinars?includeVideoFiles=0");
      const result = await response.json();

      if (result.success) {
        setWebinars(result.data);
      } else {
        toast.error("Failed to load webinars");
      }
    } catch (error) {
      console.error("Error fetching webinars:", error);
      toast.error("Failed to load webinars");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWebinars();
  }, []);

  // Restore the last-used plan once the plans load — but only when one was
  // actually stored before, so a first-time visitor searches for a plan instead
  // of being handed one.
  const [planSelectionSettled, setPlanSelectionSettled] = useState(false);
  const stickyPlanInitRef = useRef(false);
  useEffect(() => {
    if (clients.length === 0 || stickyPlanInitRef.current) return;
    stickyPlanInitRef.current = true;

    // The restore runs in an effect, i.e. one render after the plans arrive, so
    // "nothing selected" isn't a real answer until it has run. `planSelectionSettled`
    // is what lets the empty state tell the two apart instead of flashing.
    const stored = getLastPlanId("communications");
    const resolved = stored
      ? resolveStickyPlanId(clients, "communications", null)
      : null;
    const plan = resolved ? clients.find((c) => c.id === resolved) : undefined;

    if (plan && resolved) {
      setSelectedPlan(resolved);
      setFormData((prev) =>
        prev.client ? prev : { ...prev, client: plan.companyName },
      );
    }

    setPlanSelectionSettled(true);
  }, [clients]);

  // Surface the selected plan next to the page title, as the Meetings page does,
  // so the scoping stays visible outside the search bar.
  useEffect(() => {
    const c = clients.find((x) => x.id === selectedPlan);
    setSubtitle(c?.companyName ?? "");
  }, [clients, selectedPlan, setSubtitle]);

  const handlePlanChange = (planId: string) => {
    if (planId === selectedPlan) return;
    const plan = clients.find((c) => c.id === planId);
    setSelectedPlan(planId);
    // Reset any half-finished edit: it belonged to the previously selected plan,
    // so submitting it now would file that webinar under the new plan.
    setFormData({
      client: plan?.companyName || "",
      sourceType: "",
      webinarTitle: "",
      description: "",
      thumbnail: "",
      benefitsCategory: "All",
      placements: [DEFAULT_WEBINAR_PLACEMENT],
      eventDate: undefined,
      videoFile: null,
      videoUrl: "",
    });
    setEditingWebinarId(null);
    setEditingHasStoredFile(false);
    setErrors({});
    setWebinarModalOpen(false);
    // The list changes wholesale with the plan — a selection made against the
    // previous one must not survive it.
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleInputChange = (field: keyof WebinarFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: false,
      }));
    }
  };

  /** Tick/untick one portal page for this video. */
  const togglePlacement = (key: string, checked: boolean) => {
    handleInputChange(
      "placements",
      checked
        ? Array.from(new Set([...formData.placements, key]))
        : formData.placements.filter((p) => p !== key),
    );
  };

  const handleSourceTypeChange = (value: "upload" | "url") => {
    setFormData((prev) => ({
      ...prev,
      sourceType: value,
      // Clear the other field when switching
      videoFile: value === "upload" ? prev.videoFile : null,
      videoUrl: value === "url" ? prev.videoUrl : "",
    }));
    // Clear error when user selects
    if (errors.sourceType) {
      setErrors((prev) => ({
        ...prev,
        sourceType: false,
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB to avoid MongoDB 16MB document limit)
      // Base64 encoding increases size by ~33%, so 10MB file = ~13.3MB base64
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        toast.error(
          `File size exceeds 10MB limit. Please use a smaller file or upload to YouTube/Vimeo and use URL instead.`,
        );
        e.target.value = ""; // Clear the input
        return;
      }
      handleInputChange("videoFile", file);
      // A new file supersedes the stored one, so the old preview no longer applies.
      setEditVideoPreview(null);
    }
  };

  // A file input can never be pre-filled (the browser refuses to let script set its
  // value), which is why opening an edit looked like the video had gone missing.
  // The payload is fetched only when the user asks to see it: pulling the base64
  // whenever the modal opens would stall every edit by a minute.
  const loadCurrentVideoPreview = async () => {
    if (!editingWebinarId) return;
    setIsLoadingEditVideo(true);
    try {
      const response = await fetch(`/api/webinars/${editingWebinarId}`);
      const result = await response.json();
      const base64 = result?.data?.videoFileUrl;
      if (!response.ok || !result.success || !base64) {
        throw new Error(result.error || "Failed to load video");
      }
      setEditVideoPreview({
        id: editingWebinarId,
        url: `data:video/mp4;base64,${base64}`,
      });
    } catch (error) {
      console.error("Error loading video preview:", error);
      toast.error("Failed to load that video");
    } finally {
      setIsLoadingEditVideo(false);
    }
  };

  // ── Thumbnail picker ───────────────────────────────────────────────────────
  // The thumbnail is either an uploaded image or a frame grabbed from the video
  // the user selected. Both paths funnel through `applyThumbnail`, which
  // downscales to `THUMBNAIL_MAX_EDGE` so the stored data URL stays small
  // alongside the base64 video.
  const [thumbnailMode, setThumbnailMode] = useState<"upload" | "frame">(
    "upload",
  );
  const [frameTime, setFrameTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const thumbnailVideoRef = useRef<HTMLVideoElement | null>(null);

  // Object URL for the picked file — only ever created in the browser, since
  // there is no file during the server render.
  const thumbnailVideoUrl = useMemo(
    () => (formData.videoFile ? URL.createObjectURL(formData.videoFile) : null),
    [formData.videoFile],
  );
  useEffect(() => {
    if (!thumbnailVideoUrl) return;
    return () => URL.revokeObjectURL(thumbnailVideoUrl);
  }, [thumbnailVideoUrl]);

  const applyThumbnail = async (dataUrl: string) => {
    try {
      const compressed = await compressImage(dataUrl, {
        maxWidth: THUMBNAIL_MAX_EDGE,
        maxHeight: THUMBNAIL_MAX_EDGE,
        quality: 0.8,
        mimeType: "image/jpeg",
      });
      handleInputChange("thumbnail", compressed);
    } catch (error) {
      console.error("Error processing thumbnail:", error);
      toast.error("Failed to process that image");
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
    e.target.value = ""; // Allow re-picking the same file
  };

  // Draw the frame under the playhead onto a canvas and use it as the thumbnail.
  const captureFrameFromVideo = async () => {
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

  const handleFrameScrub = (time: number) => {
    setFrameTime(time);
    const video = thumbnailVideoRef.current;
    if (video) video.currentTime = time; // onSeeked captures the frame
  };

  const blankWebinarForm = (): WebinarFormData => ({
    client: selectedPlanClientName,
    sourceType: "",
    webinarTitle: "",
    description: "",
    thumbnail: "",
    // "All" is the catch-all choice, so a new video always has a category.
    benefitsCategory: "All",
    // Every video starts on News & Events; benefits pages are opt-in.
    placements: [DEFAULT_WEBINAR_PLACEMENT],
    eventDate: undefined,
    videoFile: null,
    videoUrl: "",
  });

  const openAddWebinar = () => {
    setFormData(blankWebinarForm());
    setEditingWebinarId(null);
    setEditingHasStoredFile(false);
    setErrors({});
    setDatePickerOpen(false);
    setWebinarModalOpen(true);
  };

  // Closing the dialog abandons an in-progress edit — the form is blanked when
  // the dialog is next opened.
  const handleWebinarModalOpenChange = (open: boolean) => {
    setWebinarModalOpen(open);
    if (!open) {
      setEditingWebinarId(null);
      setEditingHasStoredFile(false);
      setErrors({});
      setDatePickerOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against double submits — the button is disabled while in flight,
    // but Enter inside a field can still re-fire the form.
    if (isSubmitting) return;

    // Validation
    const newErrors: Record<string, boolean> = {};
    if (!formData.client) newErrors.client = true;
    if (!formData.sourceType) newErrors.sourceType = true;
    if (!formData.webinarTitle) newErrors.webinarTitle = true;
    if (!formData.eventDate) newErrors.eventDate = true;
    if (!formData.thumbnail) newErrors.thumbnail = true;
    // Unchecking every page would hide the video from the whole portal.
    if (formData.placements.length === 0) newErrors.placements = true;
    // Only required when there is no stored video to fall back on: while creating,
    // or when editing a row whose video came from a file that was never uploaded.
    if (
      formData.sourceType === "upload" &&
      !formData.videoFile &&
      !editingHasStoredFile
    )
      newErrors.videoFile = true;
    if (formData.sourceType === "url" && !formData.videoUrl)
      newErrors.videoUrl = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Flipped before the base64 read below: encoding a large video is the
      // slowest part of this handler, so the spinner must cover it too.
      setIsSubmitting(true);

      // Convert video file to base64 if uploaded
      let videoFileBase64 = null;
      if (formData.sourceType === "upload" && formData.videoFile) {
        

        videoFileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            // Extract base64 part (remove "data:video/...;base64," prefix)
            const base64String = dataUrl.split(",")[1];
            
            resolve(base64String);
          };
          reader.onerror = (error) => {
            console.error("Error reading video file:", error);
            reject(error);
          };
          reader.readAsDataURL(formData.videoFile!);
        });
      }

      const url = editingWebinarId
        ? `/api/webinars/${editingWebinarId}`
        : "/api/webinars";

      const response = await fetch(url, {
        method: editingWebinarId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: formData.client,
          sourceType: {
            upload: formData.sourceType === "upload",
            url: formData.sourceType === "url",
          },
          webinarTitle: formData.webinarTitle,
          description: formData.description,
          thumbnail: formData.thumbnail || null,
          benefitsCategory: formData.benefitsCategory || null,
          placements: formData.placements,
          eventDate: formData.eventDate?.toISOString(),
          videoFile: videoFileBase64,
          videoUrl: formData.videoUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save webinar");
      }

      toast.success(
        editingWebinarId
          ? "Webinar updated successfully"
          : "Webinar added successfully",
      );

      // Reset the form and close the dialog.
      setFormData(blankWebinarForm());
      setEditingWebinarId(null);
      setEditingHasStoredFile(false);
      setErrors({});
      setWebinarModalOpen(false);

      // Refresh webinars list
      await fetchWebinars();
    } catch (error) {
      console.error("Error saving webinar:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save webinar",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (webinar: Webinar) => {
    setFormData({
      client: webinar.clientName,
      sourceType: webinar.sourceType.upload
        ? "upload"
        : webinar.sourceType.url
        ? "url"
        : "",
      webinarTitle: webinar.webinarTitle,
      description: webinar.description ?? "",
      thumbnail: webinar.thumbnail ?? "",
      benefitsCategory: webinar.benefitsCategory ?? "All",
      placements: webinar.placements ?? [DEFAULT_WEBINAR_PLACEMENT],
      eventDate: new Date(webinar.eventDate),
      videoFile: null, // Don't reload file on edit
      videoUrl: webinar.videoUrl || "",
    });
    setEditingWebinarId(webinar.id);
    // The stored video is kept unless a replacement is chosen (see the PUT
    // handler), so the form must not demand a file just to save a change to the
    // title, description, thumbnail, date or placements.
    // `sourceType.upload` is included because the list response reports the file
    // through `hasVideoFile`/`videoFileUrl`, which are only populated when the
    // stored size is known — a row that says it was an upload must never ask for
    // the file again.
    setEditingHasStoredFile(
      Boolean(
        webinar.hasVideoFile || webinar.videoFileUrl || webinar.sourceType.upload,
      ),
    );
    setErrors({});
    setDatePickerOpen(false);
    setWebinarModalOpen(true);
  };

  const handleDelete = async () => {
    const id = webinarPendingDelete?.id;
    if (!id) return;

    try {
      const response = await fetch(`/api/webinars/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete webinar");
      }

      toast.success("Webinar deleted successfully");
      // Refresh webinars list
      await fetchWebinars();
    } catch (error) {
      console.error("Error deleting webinar:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete webinar",
      );
    }
  };

  // ── Multi-select ───────────────────────────────────────────────────────────
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (sortedWebinars.every((w) => prev.has(w.id))) {
        // Clear only what is on screen; anything filtered out stays selected.
        sortedWebinars.forEach((w) => next.delete(w.id));
      } else {
        sortedWebinars.forEach((w) => next.add(w.id));
      }
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const openBulkDelete = () => {
    // Freeze the target list: the rows being deleted must not change under the
    // user while the confirmation is open.
    setBulkDeleteIds(selectedWebinars.map((w) => w.id));
    setBulkDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0) return;

    try {
      setIsBulkDeleting(true);
      const response = await fetch("/api/webinars/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bulkDeleteIds }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete webinars");
      }

      toast.success(
        bulkDeleteIds.length === 1
          ? "Webinar deleted successfully"
          : `${bulkDeleteIds.length} webinars deleted successfully`,
      );

      // `bulkDeleteIds` is deliberately left alone: the dialog is still closing,
      // and clearing it here would rewrite its own text to "0 webinars" mid-exit.
      // The next `openBulkDelete` overwrites it.
      exitSelectMode();
      // Refresh webinars list
      await fetchWebinars();
    } catch (error) {
      console.error("Error deleting webinars:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete webinars",
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ── Lazy video preview ─────────────────────────────────────────────────────
  // The list response omits the base64 videos, so a click fetches just the one
  // row about to play. URL-sourced webinars already have what they need.
  const openVideoPreview = async (webinar: Webinar) => {
    const needsFetch =
      !webinar.videoUrl &&
      !webinar.videoFileUrl &&
      Boolean(webinar.hasVideoFile);

    setVideoPreview({
      title: webinar.webinarTitle,
      videoUrl: webinar.videoUrl,
      videoFileUrl: webinar.videoFileUrl,
      isLoading: needsFetch,
    });

    if (!needsFetch) return;

    try {
      const response = await fetch(`/api/webinars/${webinar.id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load video");
      }

      setVideoPreview((prev) =>
        prev
          ? {
              ...prev,
              videoFileUrl: result.data?.videoFileUrl ?? null,
              isLoading: false,
            }
          : prev,
      );
    } catch (error) {
      console.error("Error loading video:", error);
      toast.error("Failed to load that video");
      setVideoPreview(null);
    }
  };

  return (
    <div className="p-6 bg-background">
      {/* The plan search starts the flow — the same section the Meetings page
          uses — and everything below is scoped to the chosen plan. Both blocks
          share the reduced width so the page reads as a single column. */}
      <div className="w-full max-w-4xl mx-auto space-y-6 mb-6">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {isLoadingClients ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="relative">
                  <Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            ) : (
              <PlanSearchBar
                plans={clients}
                value={selectedPlan}
                onChange={handlePlanChange}
                title="Webinars & Replays"
                disabled={clients.length === 0}
              />
            )}
          </CardContent>
        </Card>

        {/* Hidden while the plan list is still loading: showing "Select a plan to
            get started" next to the search skeleton reads as if the list were
            already empty. */}
        {!isLoadingClients && planSelectionSettled && !selectedPlan && (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                <Video className="h-7 w-7 text-muted-foreground/70" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">
                Select a plan to get started
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Search for a plan above to add webinars and manage its replays.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add / Edit Video */}
      <Dialog open={webinarModalOpen} onOpenChange={handleWebinarModalOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle>
              {editingWebinarId ? "Edit Video" : "Upload Video"}
            </DialogTitle>
            <DialogDescription>
              {editingWebinarId
                ? "Make your changes below and submit to update the webinar. The video currently on it is kept unless you choose a new file."
                : "Fill out the details below to add a webinar replay, podcast, or other custom video."}
            </DialogDescription>
          </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Webinar Title */}
              <div className="space-y-2">
                <Label htmlFor="webinarTitle">
                  Video Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="webinarTitle"
                  type="text"
                  placeholder="Enter webinar title"
                  value={formData.webinarTitle}
                  maxLength={MAX_VIDEO_TITLE_LENGTH}
                  onChange={(e) =>
                    handleInputChange("webinarTitle", e.target.value)
                  }
                  className={errors.webinarTitle ? "border-red-500" : ""}
                />
                {errors.webinarTitle && (
                  <p className="text-sm text-red-500">This field is required</p>
                )}
                <p
                  className={cn(
                    "text-xs text-right",
                    (formData.webinarTitle?.length ?? 0) >
                      MAX_VIDEO_TITLE_LENGTH
                      ? "text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  {formData.webinarTitle?.length ?? 0}/{MAX_VIDEO_TITLE_LENGTH}
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Add a short description of this video..."
                  value={formData.description}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                />
                <p
                  className={cn(
                    "text-xs text-right",
                    (formData.description?.length ?? 0) >
                      MAX_DESCRIPTION_LENGTH
                      ? "text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  {formData.description?.length ?? 0}/{MAX_DESCRIPTION_LENGTH}
                </p>
              </div>
              
              {/* Benefit Category */}
              <div className="space-y-2">
                <Label>Benefit Category</Label>
                <Select
                  value={formData.benefitsCategory || "All"}
                  onValueChange={(v) => handleInputChange("benefitsCategory", v)}
                >
                  <SelectTrigger className="dark:bg-gray-800">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BENEFITS_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Where this video will live */}
              <div className="space-y-2">
                <Label>Where this video will live</Label>
                <p className="text-xs text-muted-foreground">
                  A video can appear on more than one page.
                </p>
                {errors.placements && (
                  <p className="text-sm text-red-500">
                    Choose at least one page
                  </p>
                )}
                <div className="space-y-2.5">
                  {WEBINAR_PLACEMENTS.map(({ key, label, hint }) => (
                    <label
                      key={key}
                      htmlFor={`placement-${key}`}
                      className="flex cursor-pointer items-start gap-2.5"
                    >
                      <Checkbox
                        id={`placement-${key}`}
                        checked={formData.placements.includes(key)}
                        onCheckedChange={(checked) =>
                          togglePlacement(key, checked === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Event Date */}
              <div className="space-y-2">
                <Label>
                  Event Date <span className="text-red-500">*</span>
                </Label>
                <Popover
                  open={datePickerOpen && !!formData.client}
                  onOpenChange={(open) => {
                    if (formData.client) {
                      setDatePickerOpen(open);
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!formData.client}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.eventDate && "text-muted-foreground",
                        errors.eventDate && "border-red-500",
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formData.eventDate ? (
                        format(formData.eventDate, "MM/dd/yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.eventDate}
                      onSelect={(date) => {
                        if (formData.client) {
                          handleInputChange("eventDate", date);
                          setDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.eventDate && (
                  <p className="text-sm text-red-500">This field is required</p>
                )}
              </div>

              {/* Source Type */}
              <div className="space-y-3">
                <Label>
                  Source Type <span className="text-red-500">*</span>
                </Label>
                {errors.sourceType && (
                  <p className="text-sm text-red-500">This field is required</p>
                )}
                <div className="space-y-3">
                  {/* Upload Option */}
                  <div
                    className={`relative p-3 border rounded-lg transition-colors cursor-pointer ${
                      !formData.client
                        ? "opacity-50 cursor-not-allowed bg-gray-100"
                        : formData.sourceType === "upload"
                        ? "border-primary bg-primary/5"
                        : errors.sourceType
                        ? "border-red-500 hover:bg-muted/50"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      !formData.client ? null : handleSourceTypeChange("upload")
                    }
                  >
                    <div className="flex items-start space-x-2">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.sourceType === "upload"
                            ? "border-primary bg-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {formData.sourceType === "upload" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-medium">
                          <Upload className="w-4 h-4" />
                          Upload
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Upload a video file directly from your device
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* URL Option */}
                  <div
                    className={`relative p-3 border rounded-lg transition-colors cursor-pointer ${
                      !formData.client
                        ? "opacity-50 cursor-not-allowed bg-gray-100"
                        : formData.sourceType === "url"
                        ? "border-primary bg-primary/5"
                        : errors.sourceType
                        ? "border-red-500 hover:bg-muted/50"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      !formData.client ? null : handleSourceTypeChange("url")
                    }
                  >
                    <div className="flex items-start space-x-2">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.sourceType === "url"
                            ? "border-primary bg-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {formData.sourceType === "url" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-medium">
                          <LinkIcon className="w-4 h-4" />
                          URL
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Enter a link to a video hosted on YouTube, Vimeo, or
                          another platform
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Upload (if Upload is selected) */}
              {formData.sourceType === "upload" && (
                <div className="space-y-3">
                  <Label htmlFor="videoFile">
                    Video File{" "}
                    {!editingHasStoredFile && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>

                  {/* A file input can never be pre-filled — the browser refuses to
                      let script set its value — which is exactly why editing looked
                      like the video had gone missing ("Choose File / No file
                      chosen"). The stored video is shown here instead: its
                      thumbnail for identification, and the file itself only if the
                      user asks for it, since the base64 payload lives in MongoDB
                      and pulling it on open would stall every edit. */}
                  {editingHasStoredFile && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center gap-4">
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                          {formData.thumbnail ? (
                            <img
                              src={formData.thumbnail}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Video className="h-4 w-4 text-muted-foreground/60" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium">
                            {formData.videoFile
                              ? "Replacing this video"
                              : "Current video"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formData.videoFile
                              ? `Saving swaps it for ${formData.videoFile.name}.`
                              : "Stays on this webinar unless you replace it."}
                          </p>
                        </div>
                        {!formData.videoFile && !editVideoPreviewUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="ml-auto shrink-0"
                            disabled={isLoadingEditVideo}
                            onClick={loadCurrentVideoPreview}
                          >
                            {isLoadingEditVideo ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Preview
                          </Button>
                        )}
                      </div>
                      {editVideoPreviewUrl && !formData.videoFile && (
                        <video
                          src={editVideoPreviewUrl}
                          controls
                          className="w-full aspect-video rounded-md bg-black"
                        />
                      )}
                    </div>
                  )}

                  {/* File inputs bring their own cramped control, so the box gets
                      padding and the native "Choose File" button is styled — it is
                      the one row in the form that can't use our Button component. */}
                  <Input
                    id="videoFile"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className={cn(
                      "h-auto cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80",
                      errors.videoFile && "border-red-500",
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingHasStoredFile && !formData.videoFile
                      ? "Choose a file here only if you want to replace the current video."
                      : "Maximum file size: 10MB. For larger files, use YouTube/Vimeo URL."}
                  </p>
                  {formData.videoFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {formData.videoFile.name}
                    </p>
                  )}
                  {errors.videoFile && (
                    <p className="text-sm text-red-500">
                      Please select a video file
                    </p>
                  )}
                </div>
              )}

              {/* Video URL (if URL is selected) */}
              {formData.sourceType === "url" && (
                <div className="space-y-3">
                  <Label htmlFor="videoUrl">
                    Video URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="videoUrl"
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={formData.videoUrl}
                    onChange={(e) =>
                      handleInputChange("videoUrl", e.target.value)
                    }
                    className={errors.videoUrl ? "border-red-500" : ""}
                  />
                  {errors.videoUrl && (
                    <p className="text-sm text-red-500">
                      Please enter a valid video URL
                    </p>
                  )}
                </div>
              )}

              {/* Thumbnail — an uploaded image, or a frame captured from the
                  selected video. Required: it is what the video card displays. */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>
                    Thumbnail <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    What the video card shows in the portal — an uploaded image, or
                    a frame captured from the video itself.
                  </p>
                  {errors.thumbnail && (
                    <p className="text-sm text-red-500">This field is required</p>
                  )}
                </div>
                {formData.thumbnail && (
                  <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
                    <img
                      src={formData.thumbnail}
                      alt="Thumbnail preview"
                      className="h-20 w-32 shrink-0 rounded-md border object-cover"
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">Current thumbnail</p>
                      <p className="text-xs text-muted-foreground">
                        This is the image the video card shows.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleInputChange("thumbnail", "")}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                )}
                {/* Segmented toggle: the two sources are alternatives, so the
                    active one reads as pressed rather than as a second button. */}
                <div className="inline-flex overflow-hidden rounded-md border">
                  <button
                    type="button"
                    aria-pressed={thumbnailMode === "upload"}
                    onClick={() => setThumbnailMode("upload")}
                    className={cn(
                      "flex h-9 items-center gap-1.5 px-3 text-sm transition-colors",
                      thumbnailMode === "upload"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Image
                  </button>
                  <button
                    type="button"
                    aria-pressed={thumbnailMode === "frame"}
                    disabled={!thumbnailVideoUrl}
                    title={
                      thumbnailVideoUrl ? undefined : "Select a video file first"
                    }
                    onClick={() => setThumbnailMode("frame")}
                    className={cn(
                      "flex h-9 items-center gap-1.5 border-l px-3 text-sm transition-colors",
                      thumbnailMode === "frame"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                      !thumbnailVideoUrl &&
                        "cursor-not-allowed opacity-50 hover:bg-background",
                    )}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Use Video Frame
                  </button>
                </div>

                {thumbnailMode === "upload" ? (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <Input
                      id="thumbnailFile"
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailFileChange}
                      className="h-auto cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
                    />
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or WebP. Large images are resized automatically.
                    </p>
                  </div>
                ) : thumbnailVideoUrl ? (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <video
                      ref={thumbnailVideoRef}
                      src={thumbnailVideoUrl}
                      className="w-full aspect-video rounded-md bg-black"
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget;
                        setVideoDuration(video.duration || 0);
                        // Land on a frame near the start so there is something to
                        // look at before the user scrubs.
                        const start = Math.min(1, (video.duration || 0) / 2);
                        setFrameTime(start);
                        video.currentTime = start;
                      }}
                      onSeeked={captureFrameFromVideo}
                    />
                    <input
                      type="range"
                      min={0}
                      max={videoDuration || 0}
                      step={0.05}
                      value={frameTime}
                      onChange={(e) => handleFrameScrub(Number(e.target.value))}
                      aria-label="Choose the video frame to use"
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Scrub to the frame you want — it is captured automatically.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Select a video file above to capture a frame from it.
                  </p>
                )}

              </div>

              {/* Actions — Cancel sits at the bottom of the dialog alongside the
                  primary action, and is available whether adding or editing, so
                  the modal is never escape-only (the X, or clicking backdrop). */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => {
                    setFormData(blankWebinarForm());
                    setEditingWebinarId(null);
                    setEditingHasStoredFile(false);
                    setErrors({});
                    setWebinarModalOpen(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-accent-blue hover:bg-accent-blue/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingWebinarId ? "Updating..." : "Adding..."}
                    </>
                  ) : editingWebinarId ? (
                    "Update Webinar"
                  ) : (
                    "Add Video"
                  )}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* Videos list. It keeps the page width; the form it used to share the row
          with now lives in the dialog above. */}
      <div
        className={cn("w-full max-w-4xl mx-auto", selectedPlan ? "" : "hidden")}
      >
        <Card className="shadow-sm">
          {/* Title and actions share the card header — the title on the left, the
              controls pinned to the opposite end. */}
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg font-semibold">Videos</CardTitle>
              {/* Actions sit at the opposite end of the row from the title;
                  `ml-auto` absorbs the free space so the group stays together
                  even when the row wraps. */}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Select
                  value={sortBy}
                  onValueChange={(v: "date" | "size") => setSortBy(v)}
                >
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  onClick={() =>
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                  }
                  title={
                    sortDirection === "asc"
                      ? "Sort ascending"
                      : "Sort descending"
                  }
                >
                  {sortDirection === "asc" ? "↑" : "↓"}
                </Button>
                <Button
                  variant={isSelectMode ? "default" : "outline"}
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() =>
                    isSelectMode ? exitSelectMode() : setIsSelectMode(true)
                  }
                >
                  {isSelectMode ? "Done" : "Select"}
                </Button>
                <Button
                  onClick={openAddWebinar}
                  className="gap-1.5 shrink-0 h-9 bg-accent-blue text-white hover:bg-accent-blue/90"
                >
                  <Plus className="h-4 w-4" />
                  Add Video
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">

              {/* Bulk selection bar — only shown once the user opts into
                  selecting, so the default list stays uncluttered. */}
              {isSelectMode && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={toggleSelectAll}
                  >
                    {allVisibleSelected ? "Clear all" : "Select all"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedWebinars.length} selected
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={selectedWebinars.length === 0}
                      onClick={openBulkDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete selected
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={exitSelectMode}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Webinars List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading webinars...</p>
                </div>
              ) : sortedWebinars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    No videos added yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add your first video with the Add Video button above
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedWebinars.map((webinar) => {
                    // Guarded: date-fns `format` throws "Invalid time value" on a
                    // bad date, and one malformed row would blank the entire list.
                    const parsedEventDate = new Date(webinar.eventDate);
                    const webinarDate = isValid(parsedEventDate)
                      ? format(parsedEventDate, "MM/dd/yyyy")
                      : "—";
                    // `hasVideoFile` stands in for `videoFileUrl`, which the list
                    // request deliberately omits to keep the payload small.
                    const hasVideo = Boolean(
                      webinar.videoUrl ||
                        webinar.videoFileUrl ||
                        webinar.hasVideoFile,
                    );
                    // Drives the play badge's fade. It follows the pointer rather
                    // than the teaser, so the badge is already on its way out as the
                    // video arrives instead of vanishing in a flicker once it starts.
                    const isPreviewing = hoveredId === webinar.id && hasVideo;

                    return (
                      <div
                        key={webinar.id}
                        {...getHoverProps({
                          id: webinar.id,
                          videoUrl: webinar.videoUrl,
                          videoFileUrl: webinar.videoFileUrl,
                          hasVideoFile: webinar.hasVideoFile,
                        })}
                        className={cn(
                          "p-4 border rounded-lg hover:shadow-md transition-all bg-card flex flex-col h-full",
                          isSelectMode &&
                            selectedIds.has(webinar.id) &&
                            "ring-2 ring-primary border-primary",
                        )}
                      >
                        {/* Header with Title and Source Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isSelectMode && (
                              <button
                                type="button"
                                onClick={() => toggleSelected(webinar.id)}
                                aria-pressed={selectedIds.has(webinar.id)}
                                aria-label={`Select ${webinar.webinarTitle}`}
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                  selectedIds.has(webinar.id)
                                    ? "border-primary bg-primary text-white"
                                    : "border-gray-300 hover:border-primary",
                                )}
                              >
                                {selectedIds.has(webinar.id) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </button>
                            )}
                            <h4 className="font-semibold text-sm leading-tight truncate">
                              {webinar.webinarTitle}
                            </h4>
                            <div className="flex gap-1.5 shrink-0">
                              {webinar.sourceType.upload && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-blue-200 bg-blue-50 text-blue-700"
                                >
                                  <Upload className="w-2.5 h-2.5 mr-1" />
                                  Upload
                                </Badge>
                              )}
                              {webinar.sourceType.url && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-green-200 bg-green-50 text-green-700"
                                >
                                  <LinkIcon className="w-2.5 h-2.5 mr-1" />
                                  URL
                                </Badge>
                              )}
                              {webinar.benefitsCategory && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground"
                                >
                                  {webinar.benefitsCategory}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 shrink-0"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEdit(webinar)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setWebinarPendingDelete(webinar)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Thumbnail — the list is image-only so it never has to
                            pull the base64 videos; playback loads on demand. */}
                        <div className="relative mb-2 w-full aspect-video overflow-hidden rounded-lg border bg-muted/40">
                          {webinar.thumbnail ? (
                            <img
                              src={webinar.thumbnail}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Video className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                          {/* Hover teaser — a muted few seconds over the thumbnail,
                              the way YouTube previews a card. It renders above the
                              thumbnail but below the play button (`z-[2]`), so the
                              button can fade out over the video and the card stays
                              one click from the full video while it plays. */}
                          <WebinarHoverPreviewLayer
                            preview={previewFor(webinar.id)}
                            title={webinar.webinarTitle}
                            className="z-[1]"
                          />
                          {hasVideo && (
                            <button
                              type="button"
                              onClick={() => openVideoPreview(webinar)}
                              aria-label={`Play ${webinar.webinarTitle}`}
                              className={cn(
                                "absolute inset-0 z-[2] flex items-center justify-center bg-black/20 transition-all duration-300 hover:bg-black/35",
                                isPreviewing && "opacity-0",
                              )}
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow">
                                <Play className="h-4 w-4 translate-x-[1px] text-gray-900" />
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Description — the advisor's copy from the Upload Video
                            modal. Always rendered, at a fixed three lines: three is
                            what the 200-character maximum takes at this column
                            width, and reserving the box even when there is no copy
                            is what makes every card in the grid the same height. */}
                        <p className="mb-2 h-12 text-xs leading-4 text-muted-foreground line-clamp-3">
                          {webinar.description}
                        </p>

                        {/* Webinar Details — Event Date and Source are built from
                            an identical tile so labels and values line up across
                            both columns. `mt-auto` pins the row to the card
                            bottom so cards without a video still align. */}
                        <div className="mt-auto grid grid-cols-2 gap-2">
                          {/* Event Date */}
                          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 min-w-0">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide leading-none text-muted-foreground">
                                Event Date
                              </p>
                              <p className="text-xs font-medium leading-tight mt-1 truncate">
                                {webinarDate}
                              </p>
                            </div>
                          </div>

                          {/* Source Type */}
                          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 min-w-0">
                            <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide leading-none text-muted-foreground">
                                Source
                              </p>
                              <p className="text-xs font-medium leading-tight mt-1 truncate">
                                {webinar.sourceType.upload
                                  ? "Uploaded File"
                                  : webinar.sourceType.url
                                  ? "External URL"
                                  : "No source"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Video preview — the list only carries thumbnails, so the heavy base64
          payload is fetched here, for the single row the user wants to watch. */}
      <Dialog
        open={!!videoPreview}
        onOpenChange={(open) => {
          if (!open) setVideoPreview(null);
        }}
      >
        <DialogContent className="max-w-3xl dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="truncate">{videoPreview?.title}</DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-black/5">
            {videoPreview?.isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : videoPreview?.videoUrl ? (
              (() => {
                const embedUrl = getEmbedUrl(videoPreview.videoUrl);
                return embedUrl ? (
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 h-full w-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={videoPreview.title}
                  />
                ) : (
                  <video
                    className="absolute inset-0 h-full w-full"
                    controls
                    src={videoPreview.videoUrl}
                  />
                );
              })()
            ) : videoPreview?.videoFileUrl ? (
              <video
                className="absolute inset-0 h-full w-full"
                controls
                src={`data:video/mp4;base64,${videoPreview.videoFileUrl}`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                No video available for this webinar.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete webinar confirmation dialog */}
      <ConfirmDialog
        open={!!webinarPendingDelete}
        onOpenChange={(open) => {
          if (!open) setWebinarPendingDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Webinar"
        description={
          webinarPendingDelete
            ? `Are you sure you want to delete "${webinarPendingDelete.webinarTitle}"?`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Bulk delete confirmation — covers the multi-select delete above. The
          targets are frozen when the dialog opens, so the count and the ids being
          removed can't drift apart. */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteOpen(false);
        }}
        onConfirm={handleBulkDelete}
        title={bulkDeleteIds.length === 1 ? "Delete Webinar" : "Delete Webinars"}
        description={
          bulkDeleteIds.length === 1
            ? `Are you sure you want to delete "${
                webinars.find((w) => w.id === bulkDeleteIds[0])?.webinarTitle ??
                ""
              }"?`
            : `Are you sure you want to delete ${bulkDeleteIds.length} webinars? This cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
