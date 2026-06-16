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
import { MarketingPreviewPanel } from "./preview-panel";
import type { FlyerFields, BulletPoint } from "../shared/types";
import { useMarketingPdfStore } from "@/lib/marketing-pdf-store";
import { SavedPdfsSection } from "../saved-pdfs-section";

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

const defaultBulletPoints: BulletPoint[] = [
  {
    id: "bp-1",
    title: "It's Easy & Convenient.",
    body: "Your contribution is automatically deducted from your pay and deposited into your account.",
  },
  {
    id: "bp-2",
    title: "Employer Matching Contributions.",
    body: "Take advantage of potential matching contributions—it's like getting free money to boost your retirement savings even further.",
  },
  {
    id: "bp-3",
    title: "Tax-Deferred Savings.",
    body: "Money is put into your retirement account before federal (and most state) taxes. You don't pay taxes on it until you take the money out.",
  },
  {
    id: "bp-4",
    title: "You're in Control.",
    body: "Decide your contribution amount and investment strategy. Not sure how to invest? Our team at Waypoint Financial Advisors is here for you.",
  },
];

const initialFlyerState: FlyerFields = {
  planId: "",
  planName: "",
  language: "English",
  heroHeadline: "Invest in Yourself:",
  heroSubheadline: "Start Your Retirement Journey Today!",
  sponsorName: "air fayre",
  sponsorTagline: "Retirement Savings Program",
  introHeadline:
    "Whether you're just starting your journey or looking to enhance your existing retirement strategy, every contribution counts.",
  introParagraph:
    "Use the plan portal to review contribution options, updates, and key dates so you can make informed choices for the year ahead.",
  bulletPoints: defaultBulletPoints,
  contactParagraph:
    "If you have any questions regarding your retirement future or how to get started in the plan, visit us by scanning the QR code below or call us at 877-757-3263. Para ayuda en español acerca del plan 401k, por favor llame al 877-757-3263.",
  qrHeadline: "Scan this QR code to visit your participant website",
  qrSubheadline: "or visit the website below",
  qrCta: "https://waypointfas.com/air-fayre/",
  qrUrl: "https://waypointfas.com/air-fayre/",
  advisorName: "Waypoint Financial Advisors",
  advisorDescription: "Guidance for your plan sponsored retirement benefits.",
  disclaimer:
    "*Matching contributions from your employer may be subject to a vesting schedule. Please consult with your financial advisor for more information. 401(k) plans are long-term retirement savings vehicles. Withdrawal of pre-tax contributions and/or earnings will be subject to ordinary income tax and, if taken prior to age 59 1/2, may be subject to a 10% federal tax penalty.",
  advisoryDisclosure:
    "This material was created for educational and informational purposes only and is not intended as ERISA, tax, legal or investment advice. If you are seeking investment advice specific to your needs, such advice services must be obtained on your own separate from this educational material. Securities and advisory services offered through LPL Financial, a registered investment advisor, Member FINRA/SIPC.",
  heroBanner: [],
  sponsorLogo: [],
  advisorLogo: [],
};

export function MarketingPdfBuilderPage() {
  const [form, setForm] = useState<FlyerFields>(initialFlyerState);
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
  const { addDocument, clearCache, fetchDocuments } = useMarketingPdfStore();
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

  const handleFieldChange = <K extends keyof FlyerFields>(
    key: K,
    value: FlyerFields[K],
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
        sponsorName:
          selectedClient?.companyName ||
          matchedPlan?.clientName ||
          matchedPlan?.companyName ||
          prev.sponsorName,
        advisorName:
          matchedPlan?.planAdvisor ||
          matchedPlan?.providerName ||
          prev.advisorName,
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

  const updateBullet = (
    bulletId: string,
    key: "title" | "body",
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      bulletPoints: prev.bulletPoints.map((point) =>
        point.id === bulletId ? { ...point, [key]: value } : point,
      ),
    }));
  };

  const resetForm = () => {
    setForm(initialFlyerState);
    toast({
      title: "Template reset",
      description: "All fields were restored to their defaults.",
    });
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

      // Letter size: 8.5" x 11" = 612pt x 792pt
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate scale to fit content on one page
      const scaleX = pageWidth / canvas.width;
      const scaleY = pageHeight / canvas.height;
      const scale = Math.min(scaleX, scaleY);

      // Calculate dimensions to fit on one page
      const imgWidth = canvas.width * scale;
      const imgHeight = canvas.height * scale;

      // Center the image on the page
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
      saveTitle.trim() ||
      `${form.planName || "Marketing"} Poster${
        form.language === "Spanish" ? " (Español)" : ""
      }`;
    const fileName = `${title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}.pdf`;

    result.pdf.save(fileName);

    toast({
      title: "PDF ready",
      description: "Marketing poster downloaded.",
    });
  };

  // Update default title when form changes
  useEffect(() => {
    const defaultTitle = `${form.planName || "Marketing"} Poster${
      form.language === "Spanish" ? " (Español)" : ""
    }`;
    if (
      !saveTitle ||
      saveTitle === `${form.planName || "Marketing"} Poster` ||
      saveTitle === `${form.planName || "Marketing"} Poster (Español)`
    ) {
      setSaveTitle(defaultTitle);
    }
  }, [form.planName, form.language]);

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
        saveTitle.trim() ||
        `${form.planName || "Marketing"} Poster${
          form.language === "Spanish" ? " (Español)" : ""
        }`;
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
          language: form.language === "Spanish" ? "ES" : "EN",
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
          language: form.language === "Spanish" ? "ES" : "EN",
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

  const handleLanguageChange = (language: "English" | "Spanish") => {
    setForm((prev) => ({
      ...prev,
      language,
    }));
  };

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

        <MarketingPreviewPanel
          form={form}
          previewRef={previewRef}
          heroImage={heroImage}
          sponsorLogoUrl={sponsorLogoUrl}
          advisorLogoUrl={advisorLogoUrl}
          onGeneratePdf={handleGeneratePdf}
          onSaveToClient={handleSavePdfToClient}
          onLanguageChange={handleLanguageChange}
          isSaving={isSaving}
        />
      </div>
      <SavedPdfsSection selectedPlanId={form.planId} planName={form.planName} />
    </div>
  );
}
