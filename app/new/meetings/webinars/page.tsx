"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export default function WebinarsPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();

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

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "size">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const hasClients = clients.length > 0;

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

      // Reset form
      setFormData({
        client: "",
        sourceType: "",
        webinarTitle: "",
        eventDate: undefined,
        videoFile: null,
        videoUrl: "",
      });
      setEditingWebinarId(null);
      setErrors({});

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
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webinar?")) return;

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Add New Webinar Form */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              {editingWebinarId ? "Edit Webinar" : "Add New Webinar"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {editingWebinarId
                ? "Make your changes below and submit to update the webinar"
                : "Fill out the details below to add a webinar or replay"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Plan */}
              <div className="space-y-2">
                <Label htmlFor="client">
                  Select Plan <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.client}
                  onValueChange={(value) => handleInputChange("client", value)}
                  disabled={!hasClients || isLoadingClients}
                >
                  <SelectTrigger
                    className={errors.client ? "border-red-500" : ""}
                  >
                    <SelectValue>
                      {formData.client ||
                        (isLoadingClients
                          ? "Loading plans..."
                          : "Choose a plan...")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.companyName}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.client && (
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
                    disabled={!formData.client}
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
                    disabled={!formData.client}
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
                  disabled={!formData.client}
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
                      setFormData({
                        client: "",
                        sourceType: "",
                        webinarTitle: "",
                        eventDate: undefined,
                        videoFile: null,
                        videoUrl: "",
                      });
                      setEditingWebinarId(null);
                      setErrors({});
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!formData.client}
                  className="flex-1 bg-accent-blue hover:bg-accent-blue/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingWebinarId ? "Update Webinar" : "Add Webinar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Panel: Webinars List */}
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
                      : "Add your first webinar using the form on the left"}
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
                                onClick={() => handleDelete(webinar.id)}
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
    </div>
  );
}
