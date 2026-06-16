"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { UploadFileResponse } from "uploadthing/client";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { MarketingMeetingPreviewPanel } from "./preview-panel";
import type {
  MeetingFlyerFields,
  GroupSession,
  OneOnOneConsultation,
} from "../shared/types";
import { Plus, X, Save, Loader2 } from "lucide-react";
import { SavedPdfsSection } from "../saved-pdfs-section";
import { useMarketingPdfStore } from "@/lib/marketing-pdf-store";

type Client = {
  id: string;
  companyName: string;
  status?: string;
  companyLogo?: string;
};

type Plan = {
  id: string;
  clientName?: string;
  clientLogo?: string;
  videoBackgroundImage?: string;
  video?: {
    thumbnail?: string;
    image?: string;
  } | null;
  providerLogo?: string;
  providerName?: string;
  planAdvisor?: string;
  companyName?: string;
};

const initialMeetingFlyerState: MeetingFlyerFields = {
  planId: "",
  planName: "",
  heroHeadline: "Transform Your Tomorrow:",
  heroSubheadline: "Unlock the Full Potential",
  heroSubheadline2: "of Your 401(k)!",
  mainCallToAction:
    "Join Our Retirement Plan Advisory Team To Discover How To Maximize Your Retirement Benefits",
  groupSessions: [
    {
      id: "gs-1",
      date: "September 9th, 2025",
      time: "4:00 pm",
      language: "English",
    },
    {
      id: "gs-2",
      date: "September 10th, 2025",
      time: "9:15 am",
      language: "English",
    },
    {
      id: "gs-3",
      date: "September 10th, 2025",
      time: "10:15 am",
      language: "Spanish",
    },
  ],
  oneOnOneConsultations: [
    {
      id: "ooo-1",
      date: "September 9th, 2025",
      startTime: "9:00 am",
      endTime: "3:00 pm",
    },
    {
      id: "ooo-2",
      date: "September 10th, 2025",
      startTime: "11:45 am",
      endTime: "3:00 pm",
    },
  ],
  locationText: "Virtual via Zoom",
  qrHeadline: "Scan this QR code to reserve your spot & learn more!",
  qrUrl: "https://waypointfas.com/",
  qrCta: "https://waypointfas.com/",
  heroBanner: [],
  sponsorLogo: [],
  advisorLogo: [],
};

export function MarketingSpanishPdfBuilderPage() {
  const [form, setForm] = useState<MeetingFlyerFields>(
    initialMeetingFlyerState,
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [modalOpen, setModalOpen] = useState<{
    hero: boolean;
    sponsor: boolean;
    advisor: boolean;
  }>({
    hero: false,
    sponsor: false,
    advisor: false,
  });
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const { addDocument } = useMarketingPdfStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [titleError, setTitleError] = useState("");

  const fetchClients = useCallback(async () => {
    try {
      setIsLoadingClients(true);
      const response = await fetch("/api/clients");
      const result = await response.json();

      const clientsList = result.data ?? [];
      const activeClients = (Array.isArray(clientsList) ? clientsList : []).filter(
        (client: Client) =>
          client.status === "Active" ||
          client.status === "Draft" ||
          !client.status,
      );
      setClients(activeClients);
    } catch (error) {
      console.error("Failed to fetch plans", error);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const fetchPlans = useCallback(async () => {
    try {
      setIsLoadingPlans(true);
      const response = await fetch(
        "/api/plans/get-list-plan?videoStatus=completed",
      );
      const result = await response.json();
      if (Array.isArray(result.data)) {
        setPlans(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch plans", error);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const toUploadValue = (url?: string, key?: string): UploadFileResponse[] => {
    if (!url) return [];
    return [
      {
        key: key || `prefill-${Date.now()}`,
        name: key || "prefill",
        size: 0,
        url,
        fileUrl: url,
      } as UploadFileResponse,
    ];
  };

  const handleFieldChange = <K extends keyof MeetingFlyerFields>(
    key: K,
    value: MeetingFlyerFields[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePlanSelect = (clientId: string) => {
    const selectedClient = clients.find((client) => client.id === clientId);
    if (!selectedClient) {
      return;
    }
    const matchedPlan = selectedClient
      ? plans.find(
          (plan) =>
            plan.clientName?.toLowerCase() ===
              selectedClient.companyName.toLowerCase() ||
            plan.companyName?.toLowerCase() ===
              selectedClient.companyName.toLowerCase(),
        )
      : undefined;

    setForm((prev) => {
      const next = {
        ...prev,
        planId: clientId,
        planName:
          selectedClient?.companyName ||
          matchedPlan?.clientName ||
          matchedPlan?.companyName ||
          prev.planName,
      };

      const heroImage =
        matchedPlan?.videoBackgroundImage ||
        matchedPlan?.video?.thumbnail ||
        matchedPlan?.video?.image;
      const sponsorLogoUrl =
        matchedPlan?.clientLogo || selectedClient?.companyLogo;
      const advisorLogoUrl = matchedPlan?.providerLogo;

      if (heroImage) {
        next.heroBanner = toUploadValue(heroImage, `hero-${clientId}`);
      }
      if (sponsorLogoUrl) {
        next.sponsorLogo = toUploadValue(sponsorLogoUrl, `sponsor-${clientId}`);
      }
      if (advisorLogoUrl) {
        next.advisorLogo = toUploadValue(advisorLogoUrl, `advisor-${clientId}`);
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm(initialMeetingFlyerState);
    toast({
      title: "Template reset",
      description: "All fields were restored to their defaults.",
    });
  };

  const addGroupSession = () => {
    setForm((prev) => ({
      ...prev,
      groupSessions: [
        ...prev.groupSessions,
        {
          id: `gs-${Date.now()}`,
          date: "",
          time: "",
          language: "English",
        },
      ],
    }));
  };

  const removeGroupSession = (sessionId: string) => {
    setForm((prev) => ({
      ...prev,
      groupSessions: prev.groupSessions.filter((s) => s.id !== sessionId),
    }));
  };

  const updateGroupSession = (
    sessionId: string,
    field: keyof GroupSession,
    value: string | "English" | "Spanish",
  ) => {
    setForm((prev) => ({
      ...prev,
      groupSessions: prev.groupSessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    }));
  };

  const addOneOnOneConsultation = () => {
    setForm((prev) => ({
      ...prev,
      oneOnOneConsultations: [
        ...prev.oneOnOneConsultations,
        {
          id: `ooo-${Date.now()}`,
          date: "",
          startTime: "",
          endTime: "",
        },
      ],
    }));
  };

  const removeOneOnOneConsultation = (consultationId: string) => {
    setForm((prev) => ({
      ...prev,
      oneOnOneConsultations: prev.oneOnOneConsultations.filter(
        (c) => c.id !== consultationId,
      ),
    }));
  };

  const updateOneOnOneConsultation = (
    consultationId: string,
    field: keyof OneOnOneConsultation,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      oneOnOneConsultations: prev.oneOnOneConsultations.map((consultation) =>
        consultation.id === consultationId
          ? { ...consultation, [field]: value }
          : consultation,
      ),
    }));
  };

  const handleImageSave = (
    field: "heroBanner" | "sponsorLogo" | "advisorLogo",
    value: string,
    fileName: string,
  ) => {
    const uploadResponse: UploadFileResponse = {
      key: `${field}-${Date.now()}`,
      name: fileName,
      size: 0,
      url: value,
      fileUrl: value,
      fileName: fileName,
      fileSize: 0,
      fileKey: `${field}-${Date.now()}`,
    } as UploadFileResponse;
    handleFieldChange(field, [uploadResponse]);
    setModalOpen((prev) => ({
      ...prev,
      [field === "heroBanner"
        ? "hero"
        : field === "sponsorLogo"
        ? "sponsor"
        : "advisor"]: false,
    }));
  };

  const handleImageRemove = (
    field: "heroBanner" | "sponsorLogo" | "advisorLogo",
  ) => {
    handleFieldChange(field, []);
    setModalOpen((prev) => ({
      ...prev,
      [field === "heroBanner"
        ? "hero"
        : field === "sponsorLogo"
        ? "sponsor"
        : "advisor"]: false,
    }));
  };

  const generatePdfBlob = async (): Promise<{
    pdf: jsPDF;
    blob: Blob;
    base64: string;
  } | null> => {
    if (!previewRef.current) {
      return null;
    }

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("portrait", "pt", "letter");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const scaleX = pageWidth / canvas.width;
      const scaleY = pageHeight / canvas.height;
      const scale = Math.min(scaleX, scaleY);

      const imgWidth = canvas.width * scale;
      const imgHeight = canvas.height * scale;

      const xOffset = (pageWidth - imgWidth) / 2;
      const yOffset = (pageHeight - imgHeight) / 2;

      pdf.addImage(imgData, "PNG", xOffset, yOffset, imgWidth, imgHeight);

      // Get PDF as blob and base64
      const pdfBlob = pdf.output("blob");

      // Convert blob to base64 properly
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.includes(",")
            ? result.split(",")[1]
            : result.replace(/^data:application\/pdf;base64,/, "");
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      return { pdf, blob: pdfBlob, base64: pdfBase64 };
    } catch (error) {
      console.error("PDF generation failed", error);
      return null;
    }
  };

  const handleGeneratePdf = async () => {
    if (!previewRef.current) {
      toast({
        title: "Preview not ready",
        description: "Try again after the preview loads.",
        variant: "destructive",
      });
      return;
    }

    const result = await generatePdfBlob();
    if (!result) {
      toast({
        title: "Generation error",
        description: "Unable to build the PDF. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Use saveTitle if available, otherwise fallback to default
    const title =
      saveTitle.trim() || `${form.planName || "Marketing"} Meeting Flyer`;
    const fileName = `${title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}.pdf`;

    result.pdf.save(fileName);

    toast({
      title: "PDF ready",
      description: "Meeting flyer downloaded.",
    });
  };

  // Update default title when form changes
  useEffect(() => {
    const defaultTitle = `${form.planName || "Marketing"} Meeting Flyer`;
    if (
      !saveTitle ||
      saveTitle === `${form.planName || "Marketing"} Meeting Flyer`
    ) {
      setSaveTitle(defaultTitle);
    }
  }, [form.planName]);

  const handleSavePdfToClient = async () => {
    if (!form.planId) {
      toast({
        title: "No client selected",
        description: "Please select a client/plan first.",
        variant: "destructive",
      });
      return;
    }

    if (!previewRef.current) {
      toast({
        title: "Preview not ready",
        description: "Try again after the preview loads.",
        variant: "destructive",
      });
      return;
    }

    if (!saveTitle.trim()) {
      setTitleError("Please enter a title for the PDF.");
      return;
    }

    setTitleError("");
    setIsSaving(true);

    try {
      const result = await generatePdfBlob();
      if (!result) {
        toast({
          title: "Generation error",
          description: "Unable to build the PDF. Please try again.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const title =
        saveTitle.trim() || `${form.planName || "Marketing"} Meeting Flyer`;
      const fileName = `${title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")}.pdf`;

      // Save to client via API
      const response = await fetch("/api/marketing/save-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: form.planId,
          pdfBase64: result.base64,
          fileName: fileName,
          title: title,
          description: saveDescription.trim() || undefined,
          language: "EN",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save PDF");
      }

      // Add document to store for optimistic update
      if (data.document) {
        const newDocument = {
          id: data.document.id,
          title: title,
          fileName: fileName,
          fileUrl: `data:application/pdf;base64,${result.base64}`,
          language: "EN",
          uploadedAt: new Date().toISOString(),
        };
        // Add to store - this will automatically update the UI
        addDocument(newDocument, form.planId);
      } else {
        console.warn("No document in response:", data);
      }

      toast({
        title: "PDF saved",
        description: `PDF saved to ${
          form.planName || "client"
        } successfully. You can view it in the "Saved PDFs" section below.`,
      });
    } catch (error) {
      console.error("Error saving PDF to client:", error);
      toast({
        title: "Save error",
        description:
          error instanceof Error
            ? error.message
            : "Unable to save PDF to client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const heroImage = form.heroBanner[0]?.fileUrl;
  const sponsorLogoUrl = form.sponsorLogo[0]?.fileUrl;
  const advisorLogoUrl = form.advisorLogo[0]?.fileUrl;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Plan & Content</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose an existing plan and customize the messaging.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <RefreshCw className="mr-2 size-4" />
              Reset
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select
                value={form.planId}
                onValueChange={handlePlanSelect}
                disabled={isLoadingClients}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingClients ? "Loading plans..." : "Choose a plan..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.planId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="save-title">PDF Title *</Label>
                  <Input
                    id="save-title"
                    value={saveTitle}
                    onChange={(e) => {
                      setSaveTitle(e.target.value);
                      if (titleError && e.target.value.trim()) {
                        setTitleError("");
                      }
                    }}
                    placeholder="Enter PDF title"
                    className={titleError ? "border-red-500" : ""}
                    disabled={!form.planId}
                  />
                  {titleError && (
                    <p className="text-sm text-red-500 mt-1">{titleError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="save-description">
                    PDF Description (Optional)
                  </Label>
                  <Textarea
                    id="save-description"
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Enter description..."
                    rows={3}
                    disabled={!form.planId}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Hero image (Optional)</Label>
              <SimpleImageEditorModal
                value={form.heroBanner[0]?.fileUrl || ""}
                fileName={form.heroBanner[0]?.name || ""}
                onChange={(value, fileName) =>
                  handleImageSave("heroBanner", value, fileName)
                }
                onRemove={() => handleImageRemove("heroBanner")}
                isOpen={modalOpen.hero}
                onOpen={() => {
                  if (!form.planId) return;
                  setModalOpen((prev) => ({ ...prev, hero: true }));
                }}
                onClose={() =>
                  setModalOpen((prev) => ({ ...prev, hero: false }))
                }
                modalTitle="Hero Image"
                modalDescription="Upload and edit the hero banner image for the flyer."
                placeholder="Upload Hero Image"
                saveButtonText="Save Hero Image"
                canvasWidth={640}
                canvasHeight={400}
                showGuidelines={true}
                guidelineWidth={580}
                guidelineHeight={240}
                guidelinePadding={20}
                disabled={!form.planId}
              />
            </div>
            <div className="space-y-2">
              <Label>Sponsor logo (Optional)</Label>
              <SimpleImageEditorModal
                value={form.sponsorLogo[0]?.fileUrl || ""}
                fileName={form.sponsorLogo[0]?.name || ""}
                onChange={(value, fileName) =>
                  handleImageSave("sponsorLogo", value, fileName)
                }
                onRemove={() => handleImageRemove("sponsorLogo")}
                isOpen={modalOpen.sponsor}
                onOpen={() => {
                  if (!form.planId) return;
                  setModalOpen((prev) => ({ ...prev, sponsor: true }));
                }}
                onClose={() =>
                  setModalOpen((prev) => ({ ...prev, sponsor: false }))
                }
                modalTitle="Sponsor Logo"
                modalDescription="Upload and edit the sponsor company logo."
                placeholder="Upload Sponsor Logo"
                saveButtonText="Save Sponsor Logo"
                canvasWidth={600}
                canvasHeight={600}
                showGuidelines={true}
                guidelineWidth={400}
                guidelineHeight={400}
                guidelinePadding={20}
                disabled={!form.planId}
              />
            </div>
            <div className="space-y-2">
              <Label>Advisor logo (Optional)</Label>
              <SimpleImageEditorModal
                value={form.advisorLogo[0]?.fileUrl || ""}
                fileName={form.advisorLogo[0]?.name || ""}
                onChange={(value, fileName) =>
                  handleImageSave("advisorLogo", value, fileName)
                }
                onRemove={() => handleImageRemove("advisorLogo")}
                isOpen={modalOpen.advisor}
                onOpen={() => {
                  if (!form.planId) return;
                  setModalOpen((prev) => ({ ...prev, advisor: true }));
                }}
                onClose={() =>
                  setModalOpen((prev) => ({ ...prev, advisor: false }))
                }
                modalTitle="Advisor Logo"
                modalDescription="Upload and edit the advisor/waypoint logo."
                placeholder="Upload Advisor Logo"
                saveButtonText="Save Advisor Logo"
                canvasWidth={600}
                canvasHeight={600}
                showGuidelines={true}
                guidelineWidth={400}
                guidelineHeight={400}
                guidelinePadding={20}
                disabled={!form.planId}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Group sessions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addGroupSession}
                  disabled={!form.planId}
                >
                  <Plus className="mr-1 size-3" />
                  Add Session
                </Button>
              </div>
              <div className="space-y-2">
                {form.groupSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Session</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGroupSession(session.id)}
                        disabled={!form.planId}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          value={session.date}
                          onChange={(event) =>
                            updateGroupSession(
                              session.id,
                              "date",
                              event.target.value,
                            )
                          }
                          placeholder="e.g., September 9th, 2025"
                          disabled={!form.planId}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input
                          value={session.time}
                          onChange={(event) =>
                            updateGroupSession(
                              session.id,
                              "time",
                              event.target.value,
                            )
                          }
                          placeholder="e.g., 4:00 pm"
                          disabled={!form.planId}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Language</Label>
                        <Select
                          value={session.language}
                          onValueChange={(value: "English" | "Spanish") =>
                            updateGroupSession(session.id, "language", value)
                          }
                          disabled={!form.planId}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Spanish">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>One-on-One consultations</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOneOnOneConsultation}
                  disabled={!form.planId}
                >
                  <Plus className="mr-1 size-3" />
                  Add Consultation
                </Button>
              </div>
              <div className="space-y-2">
                {form.oneOnOneConsultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Consultation</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeOneOnOneConsultation(consultation.id)
                        }
                        disabled={!form.planId}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          value={consultation.date}
                          onChange={(event) =>
                            updateOneOnOneConsultation(
                              consultation.id,
                              "date",
                              event.target.value,
                            )
                          }
                          placeholder="e.g., September 9th, 2025"
                          disabled={!form.planId}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Start Time</Label>
                          <Input
                            value={consultation.startTime}
                            onChange={(event) =>
                              updateOneOnOneConsultation(
                                consultation.id,
                                "startTime",
                                event.target.value,
                              )
                            }
                            placeholder="e.g., 9:00 am"
                            disabled={!form.planId}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">End Time</Label>
                          <Input
                            value={consultation.endTime}
                            onChange={(event) =>
                              updateOneOnOneConsultation(
                                consultation.id,
                                "endTime",
                                event.target.value,
                              )
                            }
                            placeholder="e.g., 3:00 pm"
                            disabled={!form.planId}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input
                value={form.locationText}
                onChange={(event) =>
                  handleFieldChange("locationText", event.target.value)
                }
                disabled={!form.planId}
              />
            </div>
            <div className="space-y-1">
              <Label>URL / CTA</Label>
              <Input
                value={form.qrCta}
                onChange={(event) =>
                  handleFieldChange("qrCta", event.target.value)
                }
                disabled={!form.planId}
              />
            </div>
            <div className="space-y-1">
              <Label>QR link (used for QR code)</Label>
              <Input
                value={form.qrUrl}
                onChange={(event) =>
                  handleFieldChange("qrUrl", event.target.value)
                }
                placeholder="Defaults to CTA"
                disabled={!form.planId}
              />
            </div>
          </CardContent>
        </Card>

        <MarketingMeetingPreviewPanel
          form={form}
          previewRef={previewRef}
          heroImage={heroImage}
          sponsorLogoUrl={sponsorLogoUrl}
          advisorLogoUrl={advisorLogoUrl}
          onGeneratePdf={handleGeneratePdf}
          onSaveToClient={handleSavePdfToClient}
          isSaving={isSaving}
        />
      </div>
      <SavedPdfsSection selectedPlanId={form.planId} planName={form.planName} />
    </div>
  );
}
