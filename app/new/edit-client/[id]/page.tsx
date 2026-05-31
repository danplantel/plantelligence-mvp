"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import {
  ActionsSection,
  EditClientHeader,
  EditClientPreview,
  EditClientLoading,
  EditClientError,
} from "@/components/pages/edit-client";
import { SaveButton } from "@/components/pages/edit-client/save-button";
import { useEditClient } from "@/hooks/useEditClient";
// Import components from new-client-steps
import { WelcomeMissionSection } from "@/components/wizard/new-client-steps/sections/welcome-mission-section";
import { CompanyLogoSection } from "@/components/wizard/new-client-steps/sections/company-logo-section";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { KeyContactsSection } from "@/components/wizard/new-client-steps/sections/key-contacts-section";
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import {
  RetirementDocumentsAccordion,
  type RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { PlanMeetingsSection } from "@/components/pages/edit-client/plan-meetings-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Building2, Palette, Globe, FileText, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  WELCOME_BODY_PRESETS,
  MISSION_STATEMENT_PRESETS,
} from "@/components/wizard/new-client-steps/constants/welcome-statements";
import { BrandingPreview } from "@/components/wizard/steps/sections/branding-preview/branding-preview";
import { PortalHero } from "@/components/pages/client-portal/sections/portal-hero";
import type {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImagesData,
  WelcomeStatementData,
  KeyContact,
  ComplianceDocumentsData,
} from "@/types/new-client-wizard";
import { BannerPreviewSection } from "@/components/wizard/new-client-steps/sections/banner-preview-section";
import { MissionStatementFields } from "@/components/wizard/new-client-steps/sections/mission-statement-fields";
import { CardSelectionModal } from "@/components/wizard/new-client-steps/card-selection-modal";
import { uploadBrandingToR2 } from "@/lib/branding-r2";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";

// Edit Welcome Mission Section wrapper
function EditWelcomeMissionSection({
  welcomeData,
  companyData,
  onWelcomeChange,
  onCompanyNameChange,
  isOpen,
  onToggle,
  validationErrors = {},
}: {
  welcomeData: { headline: string; bodyText: string; isAIGenerated: boolean };
  companyData: CompanyBasicsData;
  onWelcomeChange: (
    field: "headline" | "bodyText" | "isAIGenerated",
    value: any,
  ) => void;
  onCompanyNameChange?: (value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
}) {
  const defaultWelcomeBody = WELCOME_BODY_PRESETS[0]?.bodyText || "";
  const [useDefaultBody, setUseDefaultBody] = useState(
    !welcomeData.bodyText || welcomeData.bodyText === defaultWelcomeBody,
  );

  // Initialize default body text if empty
  useEffect(() => {
    if (!welcomeData.bodyText && defaultWelcomeBody) {
      onWelcomeChange("bodyText", defaultWelcomeBody);
      setUseDefaultBody(true);
    }
  }, []);

  // Sync bodyText with defaultWelcomeBody when useDefaultBody is true
  useEffect(() => {
    if (
      useDefaultBody &&
      defaultWelcomeBody &&
      welcomeData.bodyText !== defaultWelcomeBody
    ) {
      onWelcomeChange("bodyText", defaultWelcomeBody);
    }
  }, [useDefaultBody, defaultWelcomeBody]);

  const headlineCharCount = welcomeData.headline?.length || 0;
  const bodyCharCount = welcomeData.bodyText?.length || 0;
  const isHeadlineValid = headlineCharCount <= 60;
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 500;

  const handleWelcomeDescriptionChange = (value: string) => {
    if (useDefaultBody) {
      setUseDefaultBody(false);
    }
    onWelcomeChange("bodyText", value);
  };

  const handleMissionFieldChange = (
    field: "missionHeadline" | "missionBody",
    value: string,
  ) => {
    if (field === "missionHeadline") {
      onWelcomeChange("headline", value);
    } else {
      onWelcomeChange("bodyText", value);
    }
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      onWelcomeChange("bodyText", defaultWelcomeBody);
      onWelcomeChange("isAIGenerated", false);
    }
  };

  const handleGenerateNewStatement = () => {
    const availableIndexes = WELCOME_BODY_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const statement = WELCOME_BODY_PRESETS[randomIndex];
    if (statement) {
      onWelcomeChange("bodyText", statement.bodyText);
      onWelcomeChange("isAIGenerated", true);
      setUseDefaultBody(false);
    }
  };

  const getAutoWelcomeHeadline = () => {
    if (companyData.companyName.trim().length > 0) {
      return `Welcome to the ${companyData.companyName} Benefits Hub!`;
    }
    return "Welcome to the <Company Name> Benefits Hub!";
  };

  // Auto-update headline based on company name
  useEffect(() => {
    const autoHeadline = getAutoWelcomeHeadline();
    // Only update if headline is empty or matches the auto-generated pattern
    if (
      !welcomeData.headline ||
      welcomeData.headline.includes("<Company Name>")
    ) {
      onWelcomeChange("headline", autoHeadline);
    }
  }, [companyData.companyName]);

  const handleGenerateMissionHeadline = () => {
    const availableIndexes = MISSION_STATEMENT_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const preset = MISSION_STATEMENT_PRESETS[randomIndex];
    if (preset) {
      onWelcomeChange("headline", preset.headline);
    }
  };

  const handleGenerateMissionBody = () => {
    const availableIndexes = MISSION_STATEMENT_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const preset = MISSION_STATEMENT_PRESETS[randomIndex];
    if (preset) {
      onWelcomeChange("bodyText", preset.bodyText);
    }
  };

  const missionData = useMemo(
    () => ({
      missionHeadline: welcomeData.headline || "",
      missionBody: welcomeData.bodyText || "",
    }),
    [welcomeData.headline, welcomeData.bodyText],
  );

  const errorFields = useMemo(() => {
    const fields: string[] = [];
    if (validationErrors.headline) fields.push("headline");
    if (validationErrors.bodyText) fields.push("bodyText");
    if (validationErrors.missionHeadline) fields.push("missionHeadline");
    if (validationErrors.missionBody) fields.push("missionBody");
    return fields;
  }, [validationErrors]);

  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Step 2</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <WelcomeMissionSection
            welcomeData={{
              headline: welcomeData.headline,
              bodyText: welcomeData.bodyText,
              isAIGenerated: welcomeData.isAIGenerated || false,
              advisorName: "",
              advisorAvatar: null,
            }}
            companyData={missionData}
            companyName={companyData.companyName}
            onCompanyNameChange={onCompanyNameChange}
            onWelcomeDescriptionChange={handleWelcomeDescriptionChange}
            onMissionFieldChange={handleMissionFieldChange}
            onGenerateStatement={handleGenerateNewStatement}
            useDefaultBody={useDefaultBody}
            onToggleDefaultBody={handleUseDefaultBody}
            defaultBodyText={defaultWelcomeBody}
            headlineCharCount={headlineCharCount}
            bodyCharCount={bodyCharCount}
            isHeadlineValid={isHeadlineValid}
            isBodyValid={isBodyValid}
            onGenerateMissionHeadline={handleGenerateMissionHeadline}
            onGenerateMissionBody={handleGenerateMissionBody}
            errorFields={errorFields}
          />
        </CardContent>
      )}
    </Card>
  );
}

// Edit Key Contacts Section wrapper
function EditKeyContactsSection({
  contacts,
  companyData,
  documentsData,
  onContactsChange,
  onHeadshotUpload,
  onHeadshotRemove,
  isOpen,
  onToggle,
  validationErrors = {},
  setIsNewModalOpen,
}: {
  contacts: KeyContact[];
  companyData: CompanyBasicsData;
  documentsData: ComplianceDocumentsData;
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload?: (index: number, file: File) => void;
  onHeadshotRemove?: (index: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
  setIsNewModalOpen?: (isOpen: boolean) => void;
}) {
  const getDefaultDescription = (contact: {
    orgType?: string;
    recordkeeper?: string;
    organization?: string;
  }): string => {
    switch (contact.orgType) {
      case "Advisor Firm":
        return `Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.`;
      case "Client":
        return "Your primary contact for enrollment questions, plan changes, and general benefits support.";
      case "Recordkeeper":
        return `For account access, contributions, or transaction assistance, please contact ${contact.recordkeeper || "[Recordkeeper Name]"
          } directly.`;
      case "Partner/Custom":
        return `For questions about additional benefits such as insurance, wellness, or supplemental programs, please contact ${contact.organization || "[Company Name]"
          }.`;
      default:
        return `Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.`;
    }
  };

  const addContact = () => {
    const planOrganizationType =
      (companyData.organizationType as
        | "Advisor Firm"
        | "Client"
        | "Recordkeeper"
        | "Partner/Custom") || "Advisor Firm";

    const newContact: KeyContact = {
      id: `contact-${Date.now()}`,
      contactType: "individual",
      benefitsCategories: ["Retirement"],
      benefitsCategory: "Retirement",
      role: "Advisor / Specialist",
      isPrimaryForCategory: false,
      companyName: companyData.companyName || "",
      companyLogo: companyData.companyLogo?.url || undefined,
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      website: "",
      showOnPortal: true,
      enableContactButton: true,
      isPrimary: false,
      displayScope: "thisPortal",
      name: "",
      orgType: planOrganizationType,
      organization: companyData.companyName || "",
      description: getDefaultDescription({
        orgType: planOrganizationType,
        organization: companyData.companyName,
        recordkeeper: documentsData.recordkeeper,
      }),
    };
    onContactsChange([...contacts, newContact]);
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Key Contacts</CardTitle>
          <div className="flex items-center gap-2">
            {setIsNewModalOpen && (
              <div className="flex gap-2 mr-5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsNewModalOpen(true);
                  }}
                  className="flex items-center gap-2 border-2 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="font-medium">Select Display Style</span>
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </Button>
              </div>
            )}

            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-4">
          <KeyContactsSection
            contacts={contacts}
            onContactsChange={onContactsChange}
            onHeadshotUpload={onHeadshotUpload}
            onHeadshotRemove={onHeadshotRemove}
            organizationName={companyData.companyName}
            companyLogo={companyData.companyLogo?.url}
            recordkeeperFromStep4={documentsData.recordkeeper}
            errorFields={validationErrors.keyContacts || []}
          />
          <Button onClick={addContact} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact ({contacts.length})
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// Edit Compliance Documents Section wrapper
function EditComplianceDocumentsSection({
  documentsData,
  companyData,
  onDocumentsChange,
  isOpen,
  onToggle,
  validationErrors = {},
  clientId,
}: {
  documentsData: ComplianceDocumentsData;
  companyData: CompanyBasicsData;
  onDocumentsChange: (field: keyof ComplianceDocumentsData, value: any) => void;
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
  clientId?: string;
}) {
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const editSectionRef = useState<HTMLDivElement | null>(null)[0];
  // Store active language tab separately to preserve it during reorder
  const [activeLanguage, setActiveLanguage] = useState<"EN" | "ES">("EN");

  const retirementPlanDocuments = documentsData.retirementPlanDocuments || [];
  const primaryColor = companyData.primaryColor || "#002B5B";
  const secondaryColor = companyData.secondaryColor || "#E6C47A";

  const handleEditPreviewDoc = (docItem: RetirementDocumentItem) => {
    const docId = docItem.meta?.id || docItem.id;
    const doc = retirementPlanDocuments.find((d) => d.id === docId);
    if (doc) {
      setEditingDocument(doc);
    }
  };

  const handleSaveEditedDocument = (updatedDoc: any) => {
    if (!editingDocument) return;
    const updatedDocs = retirementPlanDocuments.map((doc) =>
      doc.id === updatedDoc.id ? updatedDoc : doc,
    );
    onDocumentsChange("retirementPlanDocuments", updatedDocs);
    setEditingDocument(null);
  };

  const handleCancelEdit = () => {
    setEditingDocument(null);
  };

  // Helper function to guess language from document (same as view page)
  const guessLanguageFromDocument = (doc: any): "EN" | "ES" => {
    const source = `${doc.name || doc.title || doc.fileName || ""} ${doc.shortDescription || doc.description || ""
      }`.toLowerCase();
    if (
      source.includes("[es]") ||
      source.includes("(es)") ||
      source.includes(" español") ||
      source.includes("spanish")
    ) {
      return "ES";
    }
    return "EN";
  };

  // Convert documents to preview format
  // Use language from doc if available, otherwise detect it (same logic as view page)
  // IMPORTANT: Always recalculate language here because buildDocumentFromApi may use async guessLanguageFromDocument
  const documentsPreview = useMemo(() => {
    const preview = retirementPlanDocuments.map((doc) => {
      // Get original language from doc
      const originalLanguage = (doc as any).language;

      // Only use originalLanguage if it's a valid string "ES" or "EN"
      // Ignore if it's undefined, null, Promise, or any other value
      const language =
        typeof originalLanguage === "string" &&
          (originalLanguage === "ES" || originalLanguage === "EN")
          ? (originalLanguage as "EN" | "ES")
          : guessLanguageFromDocument(doc);


      return {
        id: doc.id,
        title: doc.name,
        description: doc.shortDescription || "",
        href: doc.file,
        language: language,
        meta: {
          id: doc.id,
          fileName: doc.originalFileName || doc.name,
          language: language,
        },
      };
    });

    // Debug: Log all languages
    if (process.env.NODE_ENV === "development") {
      const languages = preview.map((d) => d.language);
      const uniqueLanguages = Array.from(new Set(languages));
    }

    return preview;
  }, [retirementPlanDocuments]);

  // Auto-switch to ES if all documents are ES and current tab is EN
  useEffect(() => {
    if (
      documentsPreview.length > 0 &&
      activeLanguage === "EN" &&
      documentsPreview.every((doc) => doc.language === "ES")
    ) {
      setActiveLanguage("ES");
    }
  }, [documentsPreview, activeLanguage]);

  // Debug: Log documents and active language


  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Compliance Documents</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-4">
          {editingDocument && (
            <div ref={editSectionRef as any}>
              <DocumentsUploadSection
                documents={retirementPlanDocuments}
                onDocumentsChange={(docs) =>
                  onDocumentsChange("retirementPlanDocuments", docs)
                }
                title="Edit Plan Document"
                description="Update the document name, description, or replace the file"
                editingDocument={editingDocument}
                onSaveEdit={handleSaveEditedDocument}
                onCancelEdit={handleCancelEdit}
                clientId={clientId}
              />
            </div>
          )}

          {!editingDocument && (
            <DocumentsUploadSection
              documents={retirementPlanDocuments}
              onDocumentsChange={(docs) =>
                onDocumentsChange("retirementPlanDocuments", docs)
              }
              title="Upload Plan Documents"
              description="Add as many plan documents or forms as you like. Employees will see them in the Benefits Hub."
              clientId={clientId}
            />
          )}

          {retirementPlanDocuments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-blue" />
                  Plan Documents Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RetirementDocumentsAccordion
                  mode="editable"
                  showInsuranceSection={false}
                  retirementDocs={documentsPreview}
                  insuranceDocs={[]}
                  brandColor={primaryColor}
                  accentColor={secondaryColor}
                  language={activeLanguage}
                  onLanguageChange={setActiveLanguage}
                  onEdit={handleEditPreviewDoc}
                  onOrderChange={(reorderedDocs) => {
                    const orderMap = new Map<string, number>();
                    reorderedDocs.forEach((doc, index) => {
                      const docId = doc.meta?.id || doc.id;
                      orderMap.set(docId, index);
                    });

                    const sortedDocs = [...retirementPlanDocuments].sort(
                      (a, b) => {
                        const orderA = orderMap.get(a.id) ?? Infinity;
                        const orderB = orderMap.get(b.id) ?? Infinity;
                        return orderA - orderB;
                      },
                    );

                    onDocumentsChange("retirementPlanDocuments", sortedDocs);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function EditClientPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();

  const {
    client,
    clientId,
    loading,
    saving,
    error,
    showPreview,
    companyData,
    clientStatus,
    openSections,
    keyContacts,
    keyContactsDisplayStyle,
    welcomeData,
    documentsData,
    setShowPreview,
    setClientStatus,
    setKeyContacts,
    setKeyContactsDisplayStyle,
    handleInputChange,
    handleWelcomeChange,
    handleDocumentsChange,
    handleHeadshotUpload,
    handleHeadshotRemove,
    handleFileUpload,
    handleFileRemove,
    toggleSection,
    handleSave,
    isFormValid,
    getValidationErrors,
    categoryPortalVisibility,
    setCategoryPortalVisibility,
  } = useEditClient();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const logoRaw =
    typeof companyData.companyLogo === "string"
      ? companyData.companyLogo
      : companyData.companyLogo?.url ?? null;
  const headerUrlRaw = companyData.brandImages?.header?.url ?? null;
  const thumbnailUrlRaw = companyData.brandImages?.thumbnail?.url ?? null;
  const { url: resolvedPreviewLogo } = useBrandingImageUrl(logoRaw);
  const { url: resolvedPreviewHeader } = useBrandingImageUrl(headerUrlRaw);
  const { url: resolvedPreviewThumbnail } = useBrandingImageUrl(thumbnailUrlRaw);

  // Mission Statement fields (separate from Banner/Welcome Message)
  const missionHeadline = (companyData as any).missionHeadline || "";
  const missionBody = (companyData as any).missionBody || "";

  // Banner (Hero) defaults (editable)
  const defaultWelcomeMessage =
    WELCOME_BODY_PRESETS[0]?.bodyText ||
    "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] = useState(
    !(companyData as any).heroDescription ||
    (companyData as any).heroDescription === defaultWelcomeMessage,
  );

  // Local state for welcome mission form
  const defaultHeadline = "Together, We Build a Stronger Future.";
  const defaultBodyText =
    WELCOME_BODY_PRESETS[0]?.bodyText ||
    "When people are supported, great things happen. This hub was created to help you understand and take advantage of the opportunities available to you as a team member. From everyday resources to long-term planning tools, everything you need is right here.";

  const [useDefaultHeadline, setUseDefaultHeadline] = useState(
    !missionHeadline || missionHeadline === defaultHeadline,
  );
  const [useDefaultBody, setUseDefaultBody] = useState(
    !missionBody || missionBody === defaultBodyText,
  );
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showMissionPreview, setShowMissionPreview] = useState(false);

  const previewLogoProp =
    toR2BrandingKey(logoRaw) != null
      ? (resolvedPreviewLogo ?? "/logo-2.png")
      : (resolvedPreviewLogo ?? logoRaw ?? "/logo-2.png");
  const previewBackgroundProp =
    toR2BrandingKey(headerUrlRaw) != null
      ? (resolvedPreviewHeader ?? "")
      : (resolvedPreviewHeader ?? headerUrlRaw ?? "");
  const previewThumbProp =
    toR2BrandingKey(thumbnailUrlRaw) != null
      ? (resolvedPreviewThumbnail ?? userAvatar ?? "/images/alicia.png")
      : (resolvedPreviewThumbnail ??
        thumbnailUrlRaw ??
        userAvatar ??
        "/images/alicia.png");

  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const headlineCharCount = missionHeadline?.length || 0;
  const bodyCharCount = missionBody?.length || 0;
  const isHeadlineValid = headlineCharCount <= 60;
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 2000;

  const errorFields = useMemo(() => {
    const errors = getValidationErrors();
    const fields: string[] = [];
    if (errors.heroTitle) fields.push("heroTitle");
    if (errors.heroDescription) fields.push("heroDescription");
    if (errors.missionHeadline) fields.push("missionHeadline");
    if (errors.missionBody) fields.push("missionBody");
    return fields;
  }, [getValidationErrors]);

  const updateField = (field: "headline" | "bodyText", value: string) => {
    handleWelcomeChange(field, value);
  };

  const handleUseDefaultHeadline = (checked: boolean) => {
    setUseDefaultHeadline(checked);
    if (checked) {
      handleInputChange("missionHeadline", defaultHeadline);
    }
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      handleInputChange("missionBody", defaultBodyText);
    }
  };

  const handleHeadshotChange = (newHeadshot: string) => {
    // Handle headshot change if needed
    setUserAvatar(newHeadshot);
  };

  const handleBackgroundChange = (newBackground: string) => {
    if (!newBackground) {
      handleInputChange("brandImages", {
        ...companyData.brandImages,
        header: null,
      });
      return;
    }
    handleInputChange("brandImages", {
      ...companyData.brandImages,
      header: companyData.brandImages?.header
        ? {
          ...companyData.brandImages.header,
          url: newBackground,
        }
        : { url: newBackground, fileName: "header", fileSize: 0, warnings: [] },
    });
  };

  const handleLogoChange = (logoData: CompanyLogoData | null) => {
    if (logoData === null) {
      handleInputChange("companyLogo", null);
      return;
    }
    // CompanyLogoSection with clientId uploads to R2 before calling onLogoChange, so url is already key or data URL
    handleInputChange("companyLogo", logoData);
  };

  const handleBrandImagesChange = (brandImages: BrandImagesData) => {
    if (!clientId) {
      handleInputChange("brandImages", brandImages);
      return;
    }
    const slots: { key: keyof BrandImagesData; r2Slot: "background" | "thumbnail" | "secondaryBanner" | "favicon" }[] = [
      { key: "header", r2Slot: "background" },
      { key: "thumbnail", r2Slot: "thumbnail" },
      { key: "secondaryBanner", r2Slot: "secondaryBanner" },
      { key: "favicon", r2Slot: "favicon" },
    ];
    const hasDataUrl = slots.some(({ key }) => brandImages[key]?.url?.startsWith?.("data:"));
    if (!hasDataUrl) {
      handleInputChange("brandImages", brandImages);
      return;
    }
    const updated = { ...brandImages };
    Promise.all(
      slots.map(async ({ key, r2Slot }) => {
        const img = updated[key];
        if (img?.url?.startsWith?.("data:")) {
          const keyResult = await uploadBrandingToR2({
            dataUrlOrFile: img.url,
            fileName: img.fileName || key,
            clientId,
            slot: r2Slot,
          });
          if (keyResult) {
            (updated as Record<string, unknown>)[key] = { ...img, url: keyResult };
          }
        }
      }),
    ).then(() => {
      handleInputChange("brandImages", updated);
    });
  };

  // Initialize hero defaults when missing (but keep editable)
  useEffect(() => {
    const currentHeroTitle = ((companyData as any).heroTitle || "") as string;
    const expectedHeroTitle =
      companyData.companyName?.trim().length > 0
        ? `Welcome to the ${companyData.companyName} Benefits Hub!`
        : "Welcome to the Company Name Benefits Hub!";

    if (!currentHeroTitle || currentHeroTitle.trim() === "") {
      handleInputChange("heroTitle", expectedHeroTitle);
    }

    const currentHeroDescription = ((companyData as any).heroDescription ||
      "") as string;
    if (!currentHeroDescription || currentHeroDescription.trim() === "") {
      handleInputChange("heroDescription", defaultWelcomeMessage);
      setUseDefaultWelcomeMessage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyData.companyName]);

  const handleHeadlineChange = (value: string) => {
    handleInputChange("missionHeadline", value);
    // If user starts typing, uncheck "use default"
    if (useDefaultHeadline && value !== defaultHeadline) {
      setUseDefaultHeadline(false);
    }
  };

  const handleBodyChange = (value: string) => {
    handleInputChange("missionBody", value);
    // If user starts typing, uncheck "use default"
    if (useDefaultBody && value !== defaultBodyText) {
      setUseDefaultBody(false);
    }
  };

  // AI Generation handlers for Mission Statement
  const handleGenerateMissionHeadline = () => {
    const availableIndexes = MISSION_STATEMENT_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const preset = MISSION_STATEMENT_PRESETS[randomIndex];
    if (preset) {
      handleInputChange("missionHeadline", preset.headline);
      if (useDefaultHeadline) {
        setUseDefaultHeadline(false);
      }
    }
  };

  const handleGenerateMissionBody = () => {
    const availableIndexes = MISSION_STATEMENT_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const preset = MISSION_STATEMENT_PRESETS[randomIndex];
    if (preset) {
      handleInputChange("missionBody", preset.bodyText);
      if (useDefaultBody) {
        setUseDefaultBody(false);
      }
    }
  };

  useEffect(() => {
    setTitle("Edit Plan");
  }, [setTitle]);

  // Auto-expand/scroll to sections with validation errors ONLY after user tries to save
  useEffect(() => {
    if (clientStatus !== "Active") return; // Only for Active status
    if (!hasAttemptedSave) return;

    const errors = getValidationErrors();
    const hasCompanyErrors =
      errors.companyName?.length > 0 || errors.companyLogo?.length > 0;
    const hasBannerErrors =
      errors.heroTitle?.length > 0 || errors.heroDescription?.length > 0;
    const hasMissionErrors =
      errors.missionHeadline?.length > 0 || errors.missionBody?.length > 0;
    const hasContactErrors = errors.keyContacts?.length > 0;

    // Only auto-expand if there are errors and section is closed
    if (hasCompanyErrors && !openSections.companyInfo) {
      toggleSection("companyInfo");
    }
    if (hasContactErrors && !openSections.contacts) {
      toggleSection("contacts");
    }

    // Scroll to banner section if it has errors
    if (hasBannerErrors || hasMissionErrors) {
      setTimeout(() => {
        const bannerSection = document.querySelector(
          '[data-section="bannerPreview"]',
        );
        if (bannerSection) {
          bannerSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [getValidationErrors, clientStatus, hasAttemptedSave, openSections]);

  const handleSaveClick = () => {
    setHasAttemptedSave(true);
    handleSave();
  };

  if (loading) {
    return (
      <EditClientLoading onBackClick={() => router.push("/new/clients")} />
    );
  }

  if (error || !client) {
    return (
      <EditClientError
        error={error || "Client not found"}
        onBackClick={() => router.push("/new/clients")}
      />
    );
  }

  if (showPreview && client) {
    return (
      <EditClientPreview
        client={client}
        companyData={companyData}
        welcomeData={welcomeData}
        keyContacts={keyContacts}
        onBackClick={() => setShowPreview(false)}
        onSave={handleSave}
        saving={saving}
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 space-y-6 py-4 pb-24">
        <EditClientHeader
          clientStatus={clientStatus}
          onStatusChange={setClientStatus}
          onPreviewClick={() => setShowPreview(true)}
          onBackClick={() => router.push("/new/clients")}
          hasClient={!!client}
          isFormValid={isFormValid()}
        />

        <div className="mx-auto max-w-5xl space-y-8 px-4">
          {/* Company Basics Section */}
          <Card className="shadow-none">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection("companyInfo")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  Company Basics & Branding
                </CardTitle>
                {openSections.companyInfo ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {openSections.companyInfo && (
              <CardContent className="space-y-6">
                {/* Plan Type */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-accent-blue" />
                      Plan Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={companyData.planType || "client"}
                      onValueChange={(value) =>
                        handleInputChange("planType", value)
                      }
                      className="grid gap-3"
                    >
                      <div
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "client" ||
                          !companyData.planType
                          ? "border-primary bg-[#23919C]/10"
                          : "hover:bg-muted/50"
                          }`}
                        onClick={() => handleInputChange("planType", "client")}
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="client" id="plan-client" />
                          <div>
                            <Label
                              htmlFor="plan-client"
                              className="cursor-pointer font-medium"
                            >
                              <p className="text-sm font-medium">Client</p>
                            </Label>
                            <div className="text-xs text-muted-foreground">
                              Active plan for real clients
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "prospect"
                          ? "border-primary bg-[#23919C]/10"
                          : "hover:bg-muted/50"
                          }`}
                        onClick={() =>
                          handleInputChange("planType", "prospect")
                        }
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="prospect" id="plan-prospect" />
                          <div>
                            <Label
                              htmlFor="plan-prospect"
                              className="cursor-pointer font-medium"
                            >
                              <p className="text-sm font-medium">Prospect</p>
                            </Label>
                            <div className="text-xs text-muted-foreground">
                              Draft plan for demos & presentations
                            </div>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Company Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-accent-blue" />
                      Company Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">
                          Company Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          icon={<Building2 className="h-4 w-4" />}
                          id="companyName"
                          value={companyData.companyName}
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 65);
                            handleInputChange("companyName", value);
                          }}
                          placeholder="Enter company name"
                          maxLength={65}
                          required
                          destructive={
                            getValidationErrors().companyName?.length > 0
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyWebsite">Company Website</Label>
                        <Input
                          icon={<Globe className="h-4 w-4" />}
                          id="companyWebsite"
                          value={companyData.companyWebsite || ""}
                          onChange={(e) =>
                            handleInputChange("companyWebsite", e.target.value)
                          }
                          placeholder="example.com"
                          type="url"
                          destructive={
                            getValidationErrors().companyWebsite?.length > 0
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Company Logo */}
                <CompanyLogoSection
                  logoData={companyData.companyLogo}
                  onLogoChange={handleLogoChange}
                  errorFields={getValidationErrors().companyLogo || []}
                  clientId={clientId}
                />

                {/* Brand Colors */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5 text-accent-blue" />
                      Brand Colors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3 relative">
                        <Label>Primary Color</Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleInputChange(
                                "isPrimaryColorPickerOpen",
                                !companyData.isPrimaryColorPickerOpen,
                              )
                            }
                            className="h-10 px-3"
                          >
                            <div
                              className="w-6 h-6 rounded border"
                              style={{
                                backgroundColor: companyData.primaryColor,
                              }}
                            />
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {companyData.primaryColor}
                          </span>
                        </div>
                        <ColorPicker
                          value={companyData.primaryColor}
                          onChange={(color) =>
                            handleInputChange("primaryColor", color)
                          }
                          isOpen={companyData.isPrimaryColorPickerOpen || false}
                          onOpenChange={(open) =>
                            handleInputChange(
                              "isPrimaryColorPickerOpen",
                              open || false,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-3 relative">
                        <Label>Secondary Color</Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleInputChange(
                                "isSecondaryColorPickerOpen",
                                !companyData.isSecondaryColorPickerOpen,
                              )
                            }
                            className="h-10 px-3"
                          >
                            <div
                              className="w-6 h-6 rounded border"
                              style={{ background: companyData.secondaryColor }}
                            />
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {companyData.secondaryColor}
                          </span>
                        </div>
                        <ColorPicker
                          value={companyData.secondaryColor}
                          onChange={(color) =>
                            handleInputChange("secondaryColor", color)
                          }
                          isOpen={
                            companyData.isSecondaryColorPickerOpen || false
                          }
                          onOpenChange={(open) =>
                            handleInputChange(
                              "isSecondaryColorPickerOpen",
                              open || false,
                            )
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Brand Images */}
                <BrandImagesSection
                  brandImages={companyData.brandImages}
                  onBrandImagesChange={handleBrandImagesChange}
                  errorFields={[]}
                />
              </CardContent>
            )}
          </Card>

          {/* Banner Preview Section */}
          <div data-section="bannerPreview">
            <BannerPreviewSection
              companyData={companyData}
              onCompanyDataChange={handleInputChange}
              onHeadshotChange={handleHeadshotChange}
              onBackgroundChange={handleBackgroundChange}
              validationErrors={getValidationErrors()}
              useDefaultBody={useDefaultWelcomeMessage}
              onToggleDefaultBody={(checked) => {
                setUseDefaultWelcomeMessage(checked);
                if (checked) {
                  handleInputChange("heroDescription", defaultWelcomeMessage);
                }
              }}
              defaultBodyText={defaultWelcomeMessage}
              wrapInCard
            />

            <Card>
              <CardHeader>
                <CardTitle>Company Mission Statement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MissionStatementFields
                  missionHeadline={missionHeadline}
                  missionBody={missionBody}
                  defaultHeadline={defaultHeadline}
                  defaultBodyText={defaultBodyText}
                  useDefaultHeadline={useDefaultHeadline}
                  useDefaultBody={useDefaultBody}
                  headlineCharCount={headlineCharCount}
                  bodyCharCount={bodyCharCount}
                  isHeadlineValid={isHeadlineValid}
                  isBodyValid={isBodyValid}
                  errorFields={errorFields}
                  headlineRef={headlineRef}
                  bodyTextRef={bodyTextRef}
                  onHeadlineChange={handleHeadlineChange}
                  onBodyChange={handleBodyChange}
                  onUseDefaultHeadlineChange={handleUseDefaultHeadline}
                  onUseDefaultBodyChange={handleUseDefaultBody}
                  onGenerateMissionHeadline={handleGenerateMissionHeadline}
                  onGenerateMissionBody={handleGenerateMissionBody}
                  showUseDefault={false}
                />

                {/* Preview Section */}
                <div ref={previewRef} data-preview="welcome">
                  <BrandingPreview
                    logo={previewLogoProp}
                    backgroundImage={previewBackgroundProp}
                    brandColor={companyData.primaryColor || "#1F3A60"}
                    aiAvatar={previewThumbProp}
                    missionStatement={`${missionHeadline || "Company Welcome Statement"
                      }\n\n${missionBody || "Your welcome message will appear here..."
                      }`}
                    headshot={previewThumbProp}
                    headshotData={null}
                    username={companyData.companyName || "Company Name"}
                    title="Advisor"
                    orgName={companyData.companyName || "Company Name"}
                    onWelcomeMessageChange={(newText) => {
                      const lines = newText.split("\n\n");
                      const headline = lines[0] || "";
                      const bodyText = lines.slice(1).join("\n") || "";
                      handleInputChange("missionHeadline", headline);
                      handleInputChange("missionBody", bodyText);
                    }}
                    onHeadshotChange={handleHeadshotChange}
                    onEditHeadshot={() => {
                      toggleSection("companyInfo");
                      setTimeout(() => {
                        const brandImagesSection = document.querySelector(
                          '[data-section="brandImages"]',
                        );
                        if (brandImagesSection) {
                          brandImagesSection.scrollIntoView({
                            behavior: "smooth",
                          });
                        }
                      }, 100);
                    }}
                    onEditBackground={() => {
                      toggleSection("companyInfo");
                      setTimeout(() => {
                        const brandImagesSection = document.querySelector(
                          '[data-section="brandImages"]',
                        );
                        if (brandImagesSection) {
                          brandImagesSection.scrollIntoView({
                            behavior: "smooth",
                          });
                        }
                      }, 100);
                    }}
                    onBackgroundChange={handleBackgroundChange}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Key Contacts Section */}
          <EditKeyContactsSection
            contacts={keyContacts}
            companyData={companyData}
            documentsData={documentsData}
            onContactsChange={setKeyContacts}
            onHeadshotUpload={handleHeadshotUpload}
            onHeadshotRemove={handleHeadshotRemove}
            isOpen={openSections.contacts}
            onToggle={() => toggleSection("contacts")}
            validationErrors={getValidationErrors()}
            setIsNewModalOpen={setIsNewModalOpen}
          />

          {/* Compliance Documents Section */}
          <EditComplianceDocumentsSection
            documentsData={documentsData}
            companyData={companyData}
            onDocumentsChange={handleDocumentsChange}
            isOpen={openSections.documents}
            onToggle={() => toggleSection("documents")}
            validationErrors={getValidationErrors()}
            clientId={clientId}
          />

          <PlanMeetingsSection
            clientId={clientId}
            companyName={companyData.companyName || ""}
            isOpen={openSections.meetings}
            onToggle={() => toggleSection("meetings")}
          />

          {/* Category Display (Portal Visibility) */}
          <Card className="shadow-none">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection("categoryDisplay")}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  Category Display (Portal Visibility)
                </CardTitle>
                {openSections.categoryDisplay ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Show or hide each category in the client portal (Navigation, Tiles, My Benefits Team, Documents). Admin data is unchanged.
              </p>
            </CardHeader>
            {openSections.categoryDisplay && (
              <CardContent className="space-y-4">
                {PRIMARY_SERVICE_CATEGORY_OPTIONS.map((category) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <span className="font-medium">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {categoryPortalVisibility[category] !== false ? "Show" : "Hide"}
                      </span>
                      <Switch
                        checked={categoryPortalVisibility[category] !== false}
                        onCheckedChange={(checked) => {
                          setCategoryPortalVisibility((prev) => ({
                            ...prev,
                            [category]: checked,
                          }));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Card Selection Modal */}
        <CardSelectionModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onConfirm={(selectedIndex) => {
            setKeyContactsDisplayStyle(selectedIndex);
          }}
          initialSelectedIndex={keyContactsDisplayStyle ?? null}
        />
      </div>

      {/* Fixed Save Button Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
        <div className="mx-auto max-w-5xl px-4 py-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/new/clients")}
            disabled={saving}
          >
            Cancel
          </Button>
          <SaveButton
            onSave={handleSaveClick}
            saving={saving}
            clientStatus={clientStatus}
            isFormValid={isFormValid()}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
