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
import { compressImage } from "@/lib/image-compression";
import { PlanSearchBar } from "@/components/plan-selector/plan-search-bar";
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

interface WebinarFormData {
  client: string;
  sourceType: "upload" | "url" | "";
  webinarTitle: string;
  description: string;
  thumbnail: string;
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

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

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
          const activeClients = (result.data || []).filter(
            (client: Client) => client.status === "Active",
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
      eventDate: undefined,
      videoFile: null,
      videoUrl: "",
    });
    setEditingWebinarId(null);
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
    eventDate: undefined,
    videoFile: null,
    videoUrl: "",
  });

  const openAddWebinar = () => {
    setFormData(blankWebinarForm());
    setEditingWebinarId(null);
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
    if (formData.sourceType === "upload" && !formData.videoFile)
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
      eventDate: new Date(webinar.eventDate),
      videoFile: null, // Don't reload file on edit
      videoUrl: webinar.videoUrl || "",
    });
    setEditingWebinarId(webinar.id);
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
                ? "Make your changes below and submit to update the webinar."
                : "Fill out the details below to add a webinar replay, podcast, or other custom video."}
            </DialogDescription>
          </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">

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
              <div className="space-y-2">
                <Label>
                  Source Type <span className="text-red-500">*</span>
                </Label>
                {errors.sourceType && (
                  <p className="text-sm text-red-500">This field is required</p>
                )}
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="videoFile">
                    Video File <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="videoFile"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className={errors.videoFile ? "border-red-500" : ""}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum file size: 10MB. For larger files, use YouTube/Vimeo
                    URL.
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
                <div className="space-y-2">
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
                  selected video. Optional; the replay card falls back to its
                  default treatment when it's empty. */}
              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={thumbnailMode === "upload" ? "default" : "outline"}
                    onClick={() => setThumbnailMode("upload")}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Upload image
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={thumbnailMode === "frame" ? "default" : "outline"}
                    disabled={!thumbnailVideoUrl}
                    onClick={() => setThumbnailMode("frame")}
                  >
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    Use video frame
                  </Button>
                </div>

                {thumbnailMode === "upload" ? (
                  <>
                    <Input
                      id="thumbnailFile"
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailFileChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or WebP. Large images are resized automatically.
                    </p>
                  </>
                ) : thumbnailVideoUrl ? (
                  <div className="space-y-2 rounded-lg border p-3">
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

                {formData.thumbnail && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={formData.thumbnail}
                      alt="Thumbnail preview"
                      className="h-16 w-28 rounded-md border object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleInputChange("thumbnail", "")}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove thumbnail
                    </Button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex gap-2 pt-4">
                {editingWebinarId && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => {
                      setFormData(blankWebinarForm());
                      setEditingWebinarId(null);
                      setErrors({});
                      setWebinarModalOpen(false);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
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

                    return (
                      <div
                        key={webinar.id}
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
                          {hasVideo && (
                            <button
                              type="button"
                              onClick={() => openVideoPreview(webinar)}
                              aria-label={`Play ${webinar.webinarTitle}`}
                              className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/35"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow">
                                <Play className="h-4 w-4 translate-x-[1px] text-gray-900" />
                              </span>
                            </button>
                          )}
                        </div>

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
