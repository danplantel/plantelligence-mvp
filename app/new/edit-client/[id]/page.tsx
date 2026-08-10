"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  Shield,
  Heart,
  Gift,
  Monitor,
  Smartphone,
  Image as ImageIcon,
} from "lucide-react";
import {
  EditClientHeader,
  EditClientPreview,
  EditClientLoading,
  EditClientError,
} from "@/components/pages/edit-client";
import { SaveButton } from "@/components/pages/edit-client/save-button";
import { useEditClient } from "@/hooks/useEditClient";
// Import components from new-client-steps
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { KeyContactsSection } from "@/components/wizard/new-client-steps/sections/key-contacts-section";
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import { AddMoreContactsModal } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/add-more-contacts-modal";
import { BrandingImage } from "@/components/ui/branding-image";
import {
  RetirementDocumentsAccordion,
  type RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { PlanMeetingsSection } from "@/components/pages/edit-client/plan-meetings-section";
import { Input } from "@/components/ui/input";
import { ContactCardLayoutPreviewModal } from "@/components/pages/edit-client/contact-card-layout-preview-modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Globe, FileText, Eye, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  WELCOME_BODY_PRESETS,
  MISSION_STATEMENT_PRESETS,
} from "@/components/wizard/new-client-steps/constants/welcome-statements";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImagesData,
  KeyContact,
  ComplianceDocumentsData,
  BenefitsCategory,
} from "@/types/new-client-wizard";
import { EditPlanPreviewSection } from "@/components/wizard/new-client-steps/sections/edit-plan-preview-section";
import { BrandColorsSection } from "@/components/wizard/new-client-steps/sections/brand-colors-section";
import { CardSelectionModal } from "@/components/wizard/new-client-steps/card-selection-modal";
import { PortalDisclaimers } from "@/components/pages/client-portal/sections/portal-disclaimers";
import { uploadBrandingToR2 } from "@/lib/branding-r2";
import { resolveDefaultDisclosuresText } from "@/lib/disclaimer-constants";
import { DisclaimerUpdateConfirmDialog } from "@/components/pages/settings/disclaimer-update-confirm-dialog";

// ============================================================================
// Helper Components
// ============================================================================

// Edit Key Contacts Section (no accordion wrapper - controlled by parent tab)
function EditKeyContactsSection({
  contacts,
  companyData,
  documentsData,
  onContactsChange,
  onHeadshotUpload,
  onHeadshotRemove,
  validationErrors = {},
  onAddContactForCategory,
}: {
  contacts: KeyContact[];
  companyData: CompanyBasicsData;
  documentsData: ComplianceDocumentsData;
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload?: (index: number, file: File) => void;
  onHeadshotRemove?: (index: number) => void;
  validationErrors?: Record<string, string[]>;
  onAddContactForCategory: (category: BenefitsCategory) => void;
}) {
  // Count contacts per benefit category (for the grid summary)
  const companyContactCount = contacts.filter((c) =>
    c.benefitsCategories?.includes("Company / Plan Sponsor") ||
    c.benefitsCategory === "Company / Plan Sponsor"
  ).length;

  // Determine which contacts are external
  const isExternalContact = (c: KeyContact) =>
    c.contactType === "team_support" ||
    (c.role === "Other" && c.roleOther === "External HR / Administrator") ||
    (c.role as string) === "External HR / Administrator";

  const externalContacts = contacts.filter(isExternalContact);
  const nonExternalContacts = contacts.filter((c) => !isExternalContact(c));

  return (
    <div className="space-y-6">
      {/* Compact Company / Plan Sponsor section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-4">
          {companyData.companyLogo?.url && (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <BrandingImage
                src={companyData.companyLogo.url}
                alt="Company Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Company / Plan Sponsor
            </h3>
            <p className="text-xs text-muted-foreground">
              {companyContactCount === 0
                ? "Contact(s) needed"
                : `${companyContactCount} ${companyContactCount === 1 ? "contact" : "contacts"} added`}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddContactForCategory("Company / Plan Sponsor")}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Per-category accordion cards */}
      {([
        { id: "Retirement" as BenefitsCategory, label: "Retirement", icon: <Building2 className="w-5 h-5 text-accent-blue" /> },
        { id: "Group Health" as BenefitsCategory, label: "Group Health", icon: <Shield className="w-5 h-5 text-accent-blue" /> },
        { id: "Group Life" as BenefitsCategory, label: "Group Life", icon: <Heart className="w-5 h-5 text-accent-blue" /> },
        { id: "Other Benefits" as BenefitsCategory, label: "Other Benefits", icon: <Gift className="w-5 h-5 text-accent-blue" /> },
      ]).map((category) => {
        const categoryContacts = contacts.filter((c) =>
          c.benefitsCategories?.includes(category.id) ||
          c.benefitsCategory === category.id
        );
        return (
          <Card key={category.id} className="overflow-hidden border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50/80 dark:bg-gray-800/80 py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {category.icon}
                  <CardTitle className="text-base font-semibold">{category.label}</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {categoryContacts.length}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAddContactForCategory(category.id)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {categoryContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No contacts assigned to {category.label}. Click &ldquo;Add&rdquo; to create one.
                </p>
              ) : (
                <KeyContactsSection
                  contacts={categoryContacts}
                  onContactsChange={(updatedContacts) => {
                    const otherContacts = contacts.filter((c) =>
                      !(c.benefitsCategories?.includes(category.id) ||
                        c.benefitsCategory === category.id)
                    );
                    onContactsChange([...otherContacts, ...updatedContacts]);
                  }}
                  onHeadshotUpload={onHeadshotUpload}
                  onHeadshotRemove={onHeadshotRemove}
                  organizationName={companyData.companyName}
                  companyLogo={companyData.companyLogo?.url}
                  recordkeeperFromStep4={documentsData.recordkeeper}
                  errorFields={validationErrors.keyContacts || []}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* External HR / Administrator section */}
      <Card className="overflow-hidden border-gray-200 dark:border-gray-700">
        <CardHeader className="bg-gray-50/80 dark:bg-gray-800/80 py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-base font-semibold">External HR / Administrator</CardTitle>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                {externalContacts.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const newContact: KeyContact = {
                  id: `contact-${Date.now()}`,
                  contactType: "team_support",
                  benefitsCategories: [],
                  benefitsCategory: undefined,
                  role: "Other",
                  roleOther: "External HR / Administrator",
                  isPrimaryForCategory: false,
                  companyName: "",
                  companyLogo: undefined,
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
                  orgType: "Advisor Firm",
                  description: "External HR or administrator contact for benefits support.",
                };
                onContactsChange([...contacts, newContact]);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        {externalContacts.length > 0 ? (
          <CardContent className="p-4">
            <KeyContactsSection
              contacts={externalContacts}
              onContactsChange={(updatedContacts) => {
                onContactsChange([...nonExternalContacts, ...updatedContacts]);
              }}
              onHeadshotUpload={onHeadshotUpload}
              onHeadshotRemove={onHeadshotRemove}
              organizationName={companyData.companyName}
              companyLogo={companyData.companyLogo?.url}
              recordkeeperFromStep4={documentsData.recordkeeper}
              errorFields={validationErrors.keyContacts || []}
            />
          </CardContent>
        ) : (
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center py-4">
              No external HR contacts. Click &ldquo;Add&rdquo; to create one.
            </p>
          </CardContent>
        )}
      </Card>

    </div>
  );
}

// Edit Compliance Documents Section (no accordion wrapper - controlled by parent tab)
function EditComplianceDocumentsSection({
  documentsData,
  companyData,
  onDocumentsChange,
  validationErrors = {},
  clientId,
}: {
  documentsData: ComplianceDocumentsData;
  companyData: CompanyBasicsData;
  onDocumentsChange: (field: keyof ComplianceDocumentsData, value: any) => void;
  validationErrors?: Record<string, string[]>;
  clientId?: string;
}) {
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const editSectionRef = useState<HTMLDivElement | null>(null)[0];
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

  const documentsPreview = useMemo(() => {
    const preview = retirementPlanDocuments.map((doc) => {
      const originalLanguage = (doc as any).language;
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
        showQrCode: false,
        meta: {
          id: doc.id,
          fileName: doc.originalFileName || doc.name,
          language: language,
        },
      };
    });

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

  return (
    <div className="space-y-4">
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
          <CardContent className="space-y-4">
            {/* Language Switcher */}
            {documentsPreview.filter((doc) => doc.language === "EN").length > 0 &&
              documentsPreview.filter((doc) => doc.language === "ES").length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(["EN", "ES"] as const).map((lang) => {
                    const hasDocs = documentsPreview.some((doc) => doc.language === lang);
                    if (!hasDocs) return null;
                    const isActive = activeLanguage === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveLanguage(lang)}
                        className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${
                          isActive
                            ? "bg-[#002B5B] text-white border-[#002B5B]"
                            : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50 dark:bg-gray-700 dark:text-accent-blue-light dark:border-gray-600 dark:hover:bg-gray-600"
                        }`}
                      >
                        {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                      </button>
                    );
                  })}
                </div>
              )}

            <RetirementDocumentsAccordion
              mode="editable"
              retirementDocs={documentsPreview}
              brandColor={primaryColor}
              accentColor={secondaryColor}
              language={activeLanguage}
              onLanguageChange={setActiveLanguage}
              onEdit={handleEditPreviewDoc}
              hideHeader
              showMetadata
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
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

const EDIT_TABS = [
  { id: "company", label: "Branding" },
  { id: "preview", label: "Preview" },
  { id: "contacts", label: "Key Contacts" },
  { id: "documents", label: "Documents" },
  { id: "disclaimers", label: "Disclaimers" },
] as const;

type EditTabId = (typeof EDIT_TABS)[number]["id"];

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
    keyContacts,
    keyContactsDisplayStyle,
    keyContactsMobileDisplayStyle,
    welcomeData,
    documentsData,
    disclaimers,
    setShowPreview,
    setClientStatus,
    setKeyContacts,
    setKeyContactsDisplayStyle,
    setKeyContactsMobileDisplayStyle,
    setDisclaimers,
    handleInputChange,
    handleWelcomeChange,
    handleDocumentsChange,
    handleHeadshotUpload,
    handleHeadshotRemove,
    handleFileUpload,
    handleFileRemove,
    handleSave,
    isFormValid,
    getValidationErrors,
    categoryPortalVisibility,
    setCategoryPortalVisibility,
  } = useEditClient();

  const [activeTab, setActiveTab] = useState<EditTabId>("company");
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isPreviewLayoutModalOpen, setIsPreviewLayoutModalOpen] =
    useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);

  const handleAddContactForCategory = useCallback(
    (category: BenefitsCategory) => {
      const planOrganizationType =
        (companyData.organizationType as
          | "Advisor Firm"
          | "Client"
          | "Recordkeeper"
          | "Partner/Custom") || "Advisor Firm";

      const getDefaultDescription = (orgType?: string): string => {
        switch (orgType) {
          case "Advisor Firm":
            return `Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.`;
          case "Client":
            return "Your primary contact for enrollment questions, plan changes, and general benefits support.";
          case "Recordkeeper":
            return `For account access, contributions, or transaction assistance, please contact ${documentsData.recordkeeper || "[Recordkeeper Name]"} directly.`;
          case "Partner/Custom":
            return `For questions about additional benefits such as insurance, wellness, or supplemental programs, please contact ${companyData.companyName || "[Company Name]"}.`;
          default:
            return `Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.`;
        }
      };

      const newContact: KeyContact = {
        id: `contact-${Date.now()}`,
        contactType: "individual",
        benefitsCategories: [category],
        benefitsCategory: category,
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
        description: getDefaultDescription(planOrganizationType),
      };
      setKeyContacts([...keyContacts, newContact]);
    },
    [companyData, documentsData, keyContacts, setKeyContacts],
  );

  // Portal target for the tabs bar – the Header renders <div id="header-tabs-portal" />
  // and we portal the TabsList into it so it appears inside the fixed header while
  // staying within the <Tabs> React context.
  const [headerPortalTarget, setHeaderPortalTarget] =
    useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderPortalTarget(document.getElementById("header-tabs-portal"));
  }, []);

  // ── Footer background color state ──
  const storedFooterBg =
    ((companyData as any)?.footerBackground as
      | { mode?: string; customColor?: string }
      | undefined) ?? {};
  const [footerBgMode, setFooterBgMode] = useState<
    "primary" | "secondary" | "custom"
  >(storedFooterBg.mode === "secondary" || storedFooterBg.mode === "custom"
    ? storedFooterBg.mode
    : "primary");
  const [footerBgCustomColor, setFooterBgCustomColor] = useState(
    storedFooterBg.customColor || "",
  );
  const [isFooterPreviewOpen, setIsFooterPreviewOpen] = useState(false);
  const resolvedFooterBgColor =
    footerBgMode === "secondary"
      ? companyData.secondaryColor
      : footerBgMode === "custom" && footerBgCustomColor.trim()
        ? footerBgCustomColor.trim()
        : companyData.primaryColor;

  const persistFooterBg = useCallback(
    (mode: string, customColor: string) => {
      const payload = { mode, customColor };
      (handleInputChange as any)("footerBackground", payload);
    },
    [handleInputChange],
  );

  // Mission Statement fields
  const missionHeadline = (companyData as any).missionHeadline || "";
  const missionBody = (companyData as any).missionBody || "";

  const defaultWelcomeMessage =
    WELCOME_BODY_PRESETS[0]?.bodyText ||
    "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] = useState(
    !(companyData as any).heroDescription ||
    (companyData as any).heroDescription === defaultWelcomeMessage,
  );

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

  // Current user's identity — used to show the user's Organization Name on
  // their own contact card in the Contact Card Layout Preview, and to populate
  // the [Organization Name] placeholder in the disclaimer text.
  const [userEmail, setUserEmail] = useState<string>("");
  const [userOrgName, setUserOrgName] = useState<string>("");

  // Tracks whether the user has edited the disclaimer so the editor Textarea
  // uses the editable state (including an intentionally cleared value) instead
  // of re-deriving from the stored client disclaimers on every keystroke.
  const disclaimerEditedRef = useRef(false);

  // Disclaimer update confirmation dialog state (mirrors the Settings page flow).
  const [showDisclaimerConfirmDialog, setShowDisclaimerConfirmDialog] =
    useState(false);
  const [isSavingDisclaimer, setIsSavingDisclaimer] = useState(false);

  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);

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
    if (useDefaultHeadline && value !== defaultHeadline) {
      setUseDefaultHeadline(false);
    }
  };

  const handleBodyChange = (value: string) => {
    handleInputChange("missionBody", value);
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

  // Fetch the current user's email + organization name. Used to show the
  // user's Organization Name on their own contact card in the Contact Card
  // Layout Preview (same behavior as step-3d), and to populate the
  // [Organization Name] placeholder in the disclaimer text.
  useEffect(() => {
    let cancelled = false;
    const loadUserOrgName = async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const profile = await res.json();
        const orgName =
          profile?.organizationName ||
          profile?.wizardSessions?.[0]?.branding?.organizationName ||
          profile?.company ||
          "";
        const email =
          profile?.email || profile?.advisorEmail || "";
        if (!cancelled) {
          setUserOrgName(orgName);
          setUserEmail(email);
        }
      } catch {
        // Silent — best-effort fetch for the organization name.
      }
    };
    loadUserOrgName();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveClick = () => {
    // If the disclaimer was edited, require confirmation before saving so the
    // user can confirm the Client/Plan disclaimer will be updated.
    if (disclaimerEditedRef.current) {
      setShowDisclaimerConfirmDialog(true);
      return;
    }
    handleSave();
  };

  const handleConfirmDisclaimerSave = async () => {
    setIsSavingDisclaimer(true);
    try {
      const ok = await handleSave();
      // Only close the dialog once the save succeeds (the success toast is
      // shown by handleSave). On failure it stays open so the user can retry.
      if (ok) {
        setShowDisclaimerConfirmDialog(false);
      }
    } finally {
      setIsSavingDisclaimer(false);
    }
  };

  // ── Disclaimer text resolution ──
  // Resolve [Organization Name] with the current user's organization name and
  // [Company Name] with the client's company name so placeholders never render
  // literally in the editor or the footer preview.
  const disclaimerOrgName =
    userOrgName || companyData.companyName || "[Organization Name]";
  const disclaimerCompName = companyData.companyName || "[Company Name]";

  // Once the user has edited the disclaimer, use the editable `disclaimers`
  // state as the source of truth so the Textarea reflects keystrokes (and can
  // be cleared). Otherwise fall back to the stored client disclaimers.
  const getRawDisclaimerText = (): string => {
    const raw = disclaimerEditedRef.current
      ? disclaimers
      : (client as any)?.disclaimers ?? disclaimers;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw))
      return raw
        .map((item: any) => item?.text || item || "")
        .filter(Boolean)
        .join("\n\n");
    if (raw && typeof raw === "object") {
      if (Array.isArray((raw as any).disclaimers))
        return (raw as any)
          .disclaimers.map((d: any) => d?.text || "")
          .filter(Boolean)
          .join("\n\n");
      if (raw.text) return raw.text;
    }
    return "";
  };

  // Editor text: falls back to the default disclosures (org name resolved) when
  // no disclaimer text exists yet.
  const getResolvedDisclaimerText = (): string => {
    const rawText = getRawDisclaimerText();
    const base = rawText
      ? rawText
      : resolveDefaultDisclosuresText(disclaimerOrgName);
    return base
      .replace(/\[Organization Name\]/g, disclaimerOrgName)
      .replace(/\[Company Name\]/g, disclaimerCompName);
  };

  // Footer preview text: resolves the placeholders but keeps the previous empty
  // fallback (so PortalDisclaimers renders its built-in text when empty).
  const getResolvedDisclaimerPreviewText = (): string =>
    getRawDisclaimerText()
      .replace(/\[Organization Name\]/g, disclaimerOrgName)
      .replace(/\[Company Name\]/g, disclaimerCompName);

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
        {/* EditClientHeader - hidden on Preview tab */}
        {activeTab !== "preview" && (
          <EditClientHeader
            clientStatus={clientStatus}
            onStatusChange={setClientStatus}
            onBackClick={() => router.push("/new/clients")}
            hasClient={!!client}
            isFormValid={isFormValid()}
            clientId={clientId}
            slug={(client as any)?.slug}
          />
        )}

        <div className="mx-auto max-w-5xl px-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as EditTabId)}
          >
            {/* Tab bar renders inside the fixed header via portal so it stays
                visible when scrolling. The portal target <div id="header-tabs-portal" />
                is rendered by the Header component. */}
            {headerPortalTarget &&
              createPortal(
                <TabsList className="w-full justify-center gap-1 bg-transparent p-0 border-b rounded-none flex-nowrap h-auto min-h-fit overflow-x-auto">
                  {EDIT_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-accent-blue data-[state=active]:text-accent-blue rounded-none px-4 py-3 text-sm font-medium whitespace-nowrap"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>,
                headerPortalTarget,
              )}

            {/* ── Tab 1: Company Basics & Branding ── */}
            <TabsContent value="company" className="space-y-6 mt-0">
              {/* Plan Type */}
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-accent-blue" />
                    Plan Type <span className="text-red-500">*</span>
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
              <Card className="dark:bg-gray-800">
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
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-accent-blue" />
                    Company Logo <span className="text-red-500">*</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Upload your company logo. Recommended size: 300×250px.
                    Accepted formats: PNG, JPG, WebP, SVG. Max file size: 15 MB.
                  </p>
                </CardHeader>
                <CardContent>
                  <UniversalImageEditorModal
                    type="logo"
                    icon={<ImageIcon className="w-4 h-4" />}
                    value={companyData.companyLogo?.url || ""}
                    fileName={companyData.companyLogo?.fileName || ""}
                    isOpen={isLogoModalOpen}
                    onClose={() => setIsLogoModalOpen(false)}
                    onChange={async (value, fileName) => {
                      let url = value;
                      if (clientId && value.startsWith("data:")) {
                        try {
                          const key = await uploadBrandingToR2({
                            dataUrlOrFile: value,
                            fileName: fileName || "logo.png",
                            clientId,
                            slot: "logo",
                          });
                          if (key) url = key;
                        } catch (_) {
                          // keep data URL
                        }
                      }
                      const logoData: CompanyLogoData = {
                        url,
                        fileName,
                        fileSize: 0,
                        width: 0,
                        height: 0,
                        hasTransparency:
                          value.includes("data:image/png") ||
                          value.includes("data:image/svg"),
                        warnings: [],
                      };
                      handleLogoChange(logoData);
                      setIsLogoModalOpen(false);
                    }}
                    onRemove={async () => {
                      const currentLogoUrl = companyData.companyLogo?.url;
                      if (
                        typeof currentLogoUrl === "string" &&
                        currentLogoUrl.startsWith("org/")
                      ) {
                        const { deleteFromR2 } = await import(
                          "@/lib/upload-to-r2"
                        );
                        await deleteFromR2(currentLogoUrl);
                      }
                      handleLogoChange(null);
                      setIsLogoModalOpen(false);
                    }}
                    placeholder="Upload Logo"
                    destructive={
                      getValidationErrors().companyLogo?.length > 0
                    }
                  />
                </CardContent>
              </Card>

              {/* Brand Colors */}
              <BrandColorsSection
                primaryColor={companyData.primaryColor}
                secondaryColor={companyData.secondaryColor}
                onPrimaryChange={(color) =>
                  handleInputChange("primaryColor", color)
                }
                onSecondaryChange={(color) =>
                  handleInputChange("secondaryColor", color)
                }
                isPrimaryPickerOpen={
                  companyData.isPrimaryColorPickerOpen || false
                }
                isSecondaryPickerOpen={
                  companyData.isSecondaryColorPickerOpen || false
                }
                onPrimaryPickerOpenChange={(open) =>
                  handleInputChange(
                    "isPrimaryColorPickerOpen",
                    open || false,
                  )
                }
                onSecondaryPickerOpenChange={(open) =>
                  handleInputChange(
                    "isSecondaryColorPickerOpen",
                    open || false,
                  )
                }
                logoDataUrl={
                  companyData.companyLogo?.url?.startsWith("data:")
                    ? companyData.companyLogo.url
                    : undefined
                }
                websiteUrl={companyData.companyWebsite}
              />

              {/* Brand Images */}
              <BrandImagesSection
                brandImages={companyData.brandImages}
                onBrandImagesChange={handleBrandImagesChange}
                errorFields={[]}
              />
            </TabsContent>

            {/* ── Tab 2: Preview ── */}
            <TabsContent value="preview" className="mt-0">
              <EditPlanPreviewSection
                companyData={companyData}
                onCompanyDataChange={handleInputChange}
                onWelcomeChange={handleWelcomeChange}
                welcomeData={welcomeData}
                onHeadshotChange={handleHeadshotChange}
                onBackgroundChange={handleBackgroundChange}
                onLogoChange={handleLogoChange}
                defaultWelcomeMessage={defaultWelcomeMessage}
                useDefaultWelcomeMessage={useDefaultWelcomeMessage}
                setUseDefaultWelcomeMessage={setUseDefaultWelcomeMessage}
                clientId={clientId}
                missionHeadline={missionHeadline}
                missionBody={missionBody}
                defaultHeadline={defaultHeadline}
                defaultBodyText={defaultBodyText}
                useDefaultHeadline={useDefaultHeadline}
                useDefaultBody={useDefaultBody}
                headlineRef={headlineRef}
                bodyTextRef={bodyTextRef}
                handleHeadlineChange={handleHeadlineChange}
                handleBodyChange={handleBodyChange}
                handleUseDefaultHeadline={handleUseDefaultHeadline}
                handleUseDefaultBody={handleUseDefaultBody}
                handleGenerateMissionHeadline={handleGenerateMissionHeadline}
                handleGenerateMissionBody={handleGenerateMissionBody}
                headlineCharCount={headlineCharCount}
                bodyCharCount={bodyCharCount}
                isHeadlineValid={isHeadlineValid}
                isBodyValid={isBodyValid}
                errorFields={errorFields}
              />
            </TabsContent>

            {/* ── Tab 3: Key Contacts ── */}
            <TabsContent value="contacts" className="mt-0">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">Key Contacts</CardTitle>
                      <Button
                        onClick={() => setIsAddContactModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Contact ({keyContacts.length})
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Layout Indicator */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-gray-700">
                        <span className="flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {keyContactsDisplayStyle === 0
                              ? "Default"
                              : keyContactsDisplayStyle === 2
                                ? "Layout 2"
                                : keyContactsDisplayStyle === 3
                                  ? "Layout 3"
                                  : keyContactsDisplayStyle === 4
                                    ? "Layout 4"
                                    : "None"}
                          </span>
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {keyContactsMobileDisplayStyle === 0
                              ? "Stacked"
                              : keyContactsMobileDisplayStyle === 1
                                ? "2-Col"
                                : keyContactsMobileDisplayStyle === 2
                                  ? "Hero"
                                  : "None"}
                          </span>
                        </span>
                      </div>
                      <Button
                        onClick={() => setIsPreviewLayoutModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        Preview / Modify Card Layout
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EditKeyContactsSection
                    contacts={keyContacts}
                    companyData={companyData}
                    documentsData={documentsData}
                    onContactsChange={setKeyContacts}
                    onHeadshotUpload={handleHeadshotUpload}
                    onHeadshotRemove={handleHeadshotRemove}
                    validationErrors={getValidationErrors()}
                    onAddContactForCategory={handleAddContactForCategory}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab 4: Documents ── */}
            <TabsContent value="documents" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Compliance Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditComplianceDocumentsSection
                    documentsData={documentsData}
                    companyData={companyData}
                    onDocumentsChange={handleDocumentsChange}
                    validationErrors={getValidationErrors()}
                    clientId={clientId}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab 5: Disclaimers ── */}
            <TabsContent value="disclaimers" className="mt-0">
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl dark:text-gray-100">
                        Disclaimers
                      </CardTitle>
                      <p className="text-sm text-muted-foreground dark:text-gray-400 font-normal mt-1">
                        Manage disclaimer text displayed in the employee portal
                        footer.
                      </p>
                    </div>

                    {/* Footer Background Color + Preview — inline in header */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-1">
                      {(["primary", "secondary", "custom"] as const).map(
                        (mode) => {
                          const label =
                            mode === "primary"
                              ? "Primary"
                              : mode === "secondary"
                                ? "Secondary"
                                : "Custom";
                          const colorVal =
                            mode === "primary"
                              ? companyData.primaryColor
                              : mode === "secondary"
                                ? companyData.secondaryColor
                                : footerBgCustomColor || "#888888";
                          const isActive = footerBgMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                setFooterBgMode(mode);
                                persistFooterBg(mode, footerBgCustomColor);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all whitespace-nowrap ${
                                isActive
                                  ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10"
                                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                style={{ background: colorVal }}
                              />
                              {label}
                            </button>
                          );
                        },
                      )}
                      {footerBgMode === "custom" && (
                        <>
                          <input
                            type="color"
                            value={
                              footerBgCustomColor || companyData.primaryColor
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setFooterBgCustomColor(v);
                              persistFooterBg("custom", v);
                            }}
                            className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0.5"
                          />
                          <input
                            type="text"
                            value={footerBgCustomColor}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFooterBgCustomColor(v);
                              persistFooterBg("custom", v);
                            }}
                            placeholder="#HEX"
                            className="w-20 text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-1 bg-transparent dark:text-gray-200"
                          />
                        </>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFooterPreviewOpen(true)}
                        className="inline-flex items-center gap-1.5 ml-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Disclaimer Text */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="disclaimers-text"
                      className="dark:text-gray-300"
                    >
                      Disclaimer Text
                    </Label>
                    <Textarea
                      id="disclaimers-text"
                      value={getResolvedDisclaimerText()}
                      onChange={(e) => {
                        disclaimerEditedRef.current = true;
                        setDisclaimers(e.target.value);
                      }}
                      placeholder="Enter legal disclaimers to display in the portal footer..."
                      rows={8}
                      className="min-h-[200px] dark:bg-gray-900 dark:text-gray-200"
                    />
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      This text will appear in the footer of the employee
                      benefits portal.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* ── Footer Preview Modal ── */}
              {isFooterPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl">
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Footer Preview
                          </h3>
                          <p className="text-sm text-muted-foreground dark:text-gray-400">
                            How the disclaimer will appear on the{" "}
                            <strong className="text-gray-600 dark:text-gray-300">
                              Home Page
                            </strong>
                          </p>
                        </div>
                        {/* Footer Color selector in header */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-1">
                            Footer Color:
                          </span>
                          {(["primary", "secondary", "custom"] as const).map(
                            (mode) => {
                              const label =
                                mode === "primary"
                                  ? "Primary"
                                  : mode === "secondary"
                                    ? "Secondary"
                                    : "Custom";
                              const colorVal =
                                mode === "primary"
                                  ? companyData.primaryColor
                                  : mode === "secondary"
                                    ? companyData.secondaryColor
                                    : footerBgCustomColor || "#888888";
                              const isActive = footerBgMode === mode;
                              return (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => {
                                    setFooterBgMode(mode);
                                    persistFooterBg(mode, footerBgCustomColor);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                                    isActive
                                      ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue/5"
                                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                  }`}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                    style={{ background: colorVal }}
                                  />
                                  {label}
                                </button>
                              );
                            },
                          )}
                          {footerBgMode === "custom" && (
                            <>
                              <input
                                type="color"
                                value={
                                  footerBgCustomColor || companyData.primaryColor
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setFooterBgCustomColor(v);
                                  persistFooterBg("custom", v);
                                }}
                                className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0.5"
                              />
                              <input
                                type="text"
                                value={footerBgCustomColor}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setFooterBgCustomColor(v);
                                  persistFooterBg("custom", v);
                                }}
                                placeholder="#HEX"
                                className="w-20 text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-1 bg-transparent dark:text-gray-200"
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFooterPreviewOpen(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Preview content */}
                    <div className="p-0">
                      <div className="bg-black min-h-[200px]">
                        {/* Home page content mock */}
                        <div className="px-8 py-12 text-center">
                          <h2 className="text-2xl font-bold text-white mb-2">
                            Welcome to the Benefits Hub!
                          </h2>
                          <p className="text-gray-400 text-sm max-w-xl mx-auto">
                            This is where the home page content would appear.
                            Scroll down to see the Footer with your disclaimer.
                          </p>
                        </div>

                        {/* PortalDisclaimers with disclaimer text */}
                        <PortalDisclaimers
                          companyData={{
                            disclaimers: getResolvedDisclaimerPreviewText(),
                            brandColor: resolvedFooterBgColor,
                            companyName: companyData.companyName,
                          }}
                          brandColor={resolvedFooterBgColor}
                        />
                      </div>
                    </div>

                    {/* Close button */}
                    <div className="flex justify-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <Button
                        onClick={() => setIsFooterPreviewOpen(false)}
                        variant="outline"
                      >
                        Close Preview
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Add Contact Modal */}
        <AddMoreContactsModal
          open={isAddContactModalOpen}
          onOpenChange={setIsAddContactModalOpen}
          onSkip={() => setIsAddContactModalOpen(false)}
          onAddContactForCategory={handleAddContactForCategory}
          contacts={keyContacts}
        />

        {/* Card Selection Modal */}
        <CardSelectionModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onConfirm={(selectedIndex) => {
            setKeyContactsDisplayStyle(selectedIndex);
          }}
          initialSelectedIndex={keyContactsDisplayStyle ?? null}
        />

        {/* Contact Card Layout Preview Modal */}
        <ContactCardLayoutPreviewModal
          isOpen={isPreviewLayoutModalOpen}
          onClose={() => setIsPreviewLayoutModalOpen(false)}
          currentDisplayStyle={keyContactsDisplayStyle}
          mobileDisplayStyle={keyContactsMobileDisplayStyle}
          onConfirm={(displayStyle, mobileDisplayStyle) => {
            setKeyContactsDisplayStyle(displayStyle);
            setKeyContactsMobileDisplayStyle(mobileDisplayStyle);
          }}
          contacts={keyContacts}
          brandColor={companyData.primaryColor}
          secondaryColor={companyData.secondaryColor}
          companyName={companyData.companyName}
          currentUserEmail={userEmail || null}
          currentUserOrgName={userOrgName || null}
        />

        {/* Disclaimer Update Confirmation Dialog */}
        <DisclaimerUpdateConfirmDialog
          open={showDisclaimerConfirmDialog}
          onOpenChange={setShowDisclaimerConfirmDialog}
          onConfirm={handleConfirmDisclaimerSave}
          submitting={isSavingDisclaimer}
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
