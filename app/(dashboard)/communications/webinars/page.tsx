"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { format } from "date-fns";
import {
  Calendar,
  Video,
  Upload,
  Link as LinkIcon,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Clock,
  Building2,
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
  eventDate: Date;
  videoFileUrl: string | null;
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

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "size">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selected plan — the flow's entry point, mirroring the Meetings page. The
  // search bar at the top sets it; the form targets it and the replays list is
  // filtered to it (the list's own filter can still be widened to All Plans).
  const [selectedPlan, setSelectedPlan] = useState("");

  // Filter webinars by search and plan
  const filteredWebinars = webinars.filter((webinar) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      webinar.webinarTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webinar.clientName.toLowerCase().includes(searchTerm.toLowerCase());

    // Client filter
    const matchesClient =
      clientFilter === "all" || webinar.clientName === clientFilter;

    return matchesSearch && matchesClient;
  });

  // Sort webinars
  const sortedWebinars = [...filteredWebinars].sort((a, b) => {
    if (sortBy === "date") {
      const aDate = new Date(a.eventDate).getTime();
      const bDate = new Date(b.eventDate).getTime();
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
    } else if (sortBy === "size") {
      // Sort by file size (for uploaded videos) or URL length
      const aSize = a.videoFileUrl
        ? a.videoFileUrl.length
        : a.videoUrl
        ? a.videoUrl.length
        : 0;
      const bSize = b.videoFileUrl
        ? b.videoFileUrl.length
        : b.videoUrl
        ? b.videoUrl.length
        : 0;
      return sortDirection === "asc" ? aSize - bSize : bSize - aSize;
    }
    return 0;
  });

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
      const response = await fetch("/api/webinars");
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
  const stickyPlanInitRef = useRef(false);
  useEffect(() => {
    if (clients.length === 0 || stickyPlanInitRef.current) return;
    stickyPlanInitRef.current = true;
    if (!getLastPlanId("communications")) return;
    const resolved = resolveStickyPlanId(clients, "communications", null);
    if (!resolved) return;
    const plan = clients.find((c) => c.id === resolved);
    if (!plan) return;
    setSelectedPlan(resolved);
    setFormData((prev) =>
      prev.client ? prev : { ...prev, client: plan.companyName },
    );
    setClientFilter(plan.companyName);
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
    setClientFilter(plan?.companyName || "all");
    // Reset any half-finished edit: it belonged to the previously selected plan,
    // so submitting it now would file that webinar under the new plan.
    setFormData({
      client: plan?.companyName || "",
      sourceType: "",
      webinarTitle: "",
      eventDate: undefined,
      videoFile: null,
      videoUrl: "",
    });
    setEditingWebinarId(null);
    setErrors({});
    setWebinarModalOpen(false);
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

  // The plan the form saves under — whatever the search bar selected.
  const selectedPlanClientName =
    clients.find((c) => c.id === selectedPlan)?.companyName || "";

  const blankWebinarForm = (): WebinarFormData => ({
    client: selectedPlanClientName,
    sourceType: "",
    webinarTitle: "",
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

        {!selectedPlan && (
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

      {/* Add / Edit Webinar — the form that used to sit inline beside the list. */}
      <Dialog open={webinarModalOpen} onOpenChange={handleWebinarModalOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle>
              {editingWebinarId ? "Edit Webinar" : "Add New Webinar"}
            </DialogTitle>
            <DialogDescription>
              {editingWebinarId
                ? "Make your changes below and submit to update the webinar."
                : "Fill out the details below to add a webinar or replay."}
            </DialogDescription>
          </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {/* Webinar Title */}
              <div className="space-y-2">
                <Label htmlFor="webinarTitle">
                  Webinar Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="webinarTitle"
                  type="text"
                  placeholder="Enter webinar title"
                  value={formData.webinarTitle}
                  onChange={(e) =>
                    handleInputChange("webinarTitle", e.target.value)
                  }
                  className={errors.webinarTitle ? "border-red-500" : ""}
                />
                {errors.webinarTitle && (
                  <p className="text-sm text-red-500">This field is required</p>
                )}
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

              {/* Submit Button */}
              <div className="flex gap-2 pt-4">
                {editingWebinarId && (
                  <Button
                    type="button"
                    variant="outline"
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
                  className="flex-1 bg-accent-blue hover:bg-accent-blue/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingWebinarId ? "Update Webinar" : "Add Webinar"}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* Replays list. It keeps the page width; the form it used to share the row
          with now lives in the dialog above. */}
      <div
        className={cn("w-full max-w-4xl mx-auto", selectedPlan ? "" : "hidden")}
      >
        <div className="flex items-center justify-end mb-4">
          <Button
            onClick={openAddWebinar}
            className="gap-1.5 shrink-0 bg-accent-blue text-white hover:bg-accent-blue/90"
          >
            <Plus className="h-4 w-4" />
            Add Webinar
          </Button>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-lg font-semibold">Replays</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchWebinars}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search, Filter and Sort */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search webinars..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8"
                  />
                </div>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue placeholder="All Plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.companyName}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">none</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
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
              </div>

              {/* Webinars List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading webinars...</p>
                </div>
              ) : sortedWebinars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || clientFilter !== "all"
                      ? "No webinars found"
                      : "No webinars added yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || clientFilter !== "all"
                      ? "Try adjusting your filters or search terms"
                      : "Add your first webinar with the Add Webinar button above"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedWebinars.map((webinar) => {
                    const webinarDate = format(
                      new Date(webinar.eventDate),
                      "MM/dd/yyyy",
                    );
                    const hasVideo = webinar.videoUrl || webinar.videoFileUrl;

                    return (
                      <div
                        key={webinar.id}
                        className="p-4 border rounded-lg hover:shadow-md transition-all bg-card"
                      >
                        {/* Header with Title and Source Badge */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-semibold text-base truncate">
                                {webinar.webinarTitle}
                              </h4>
                              <div className="flex gap-2">
                                {webinar.sourceType.upload && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-blue-200 bg-blue-50 text-blue-700"
                                  >
                                    <Upload className="w-3 h-3 mr-1" />
                                    Upload
                                  </Badge>
                                )}
                                {webinar.sourceType.url && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-green-200 bg-green-50 text-green-700"
                                  >
                                    <LinkIcon className="w-3 h-3 mr-1" />
                                    URL
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
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

                        {/* Video Preview */}
                        {hasVideo && (
                          <div className="mb-3 rounded-lg overflow-hidden border bg-black/5">
                            <div className="relative w-full aspect-video">
                              {webinar.videoUrl ? (
                                (() => {
                                  const embedUrl = getEmbedUrl(
                                    webinar.videoUrl,
                                  );
                                  if (embedUrl) {
                                    // YouTube or Vimeo embed
                                    return (
                                      <iframe
                                        src={embedUrl}
                                        className="absolute top-0 left-0 w-full h-full"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={webinar.webinarTitle}
                                      />
                                    );
                                  } else {
                                    // Direct video URL
                                    return (
                                      <video
                                        className="absolute top-0 left-0 w-full h-full"
                                        controls
                                        src={webinar.videoUrl}
                                      >
                                        Your browser does not support the video
                                        tag.
                                      </video>
                                    );
                                  }
                                })()
                              ) : webinar.videoFileUrl ? (
                                // Base64 uploaded video
                                <video
                                  className="absolute top-0 left-0 w-full h-full"
                                  controls
                                  src={`data:video/mp4;base64,${webinar.videoFileUrl}`}
                                >
                                  Your browser does not support the video tag.
                                </video>
                              ) : null}
                            </div>
                          </div>
                        )}

                        {/* Webinar Details Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {/* Event Date */}
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span className="font-medium">Event Date</span>
                            </div>
                            <div className="text-sm font-medium pl-5">
                              {webinarDate}
                            </div>
                          </div>

                          {/* Source Type */}
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                              <Video className="h-3.5 w-3.5" />
                              <span className="font-medium">Source</span>
                            </div>
                            <div className="text-sm font-medium pl-5">
                              {webinar.sourceType.upload
                                ? "Uploaded File"
                                : webinar.sourceType.url
                                ? "External URL"
                                : "No source"}
                            </div>
                          </div>
                        </div>

                        {/* Client */}
                        <div className="flex items-center space-x-2 pt-2 border-t">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Plan:
                          </span>
                          <span className="text-sm font-semibold">
                            {webinar.clientName}
                          </span>
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
    </div>
  );
}
