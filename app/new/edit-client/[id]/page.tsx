"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
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
import { CompanyLogoSection } from "@/components/wizard/new-client-steps/sections/company-logo-section";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { KeyContactsSection } from "@/components/wizard/new-client-steps/sections/key-contacts-section";
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import { AddMoreContactsModal } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/add-more-contacts-modal";
import { CategoryGrid } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/category-grid";
import {
  RetirementDocumentsAccordion,
  type RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { PlanMeetingsSection } from "@/components/pages/edit-client/plan-meetings-section";
import { Input } from "@/components/ui/input";
import { ContactCardLayoutPreviewModal } from "@/components/pages/edit-client/contact-card-layout-preview-modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ui/color-picker";
import { Building2, Palette, Globe, FileText } from "lucide-react";
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
import { CardSelectionModal } from "@/components/wizard/new-client-steps/card-selection-modal";
import { uploadBrandingToR2 } from "@/lib/branding-r2";

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
}: {
  contacts: KeyContact[];
  companyData: CompanyBasicsData;
  documentsData: ComplianceDocumentsData;
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload?: (index: number, file: File) => void;
  onHeadshotRemove?: (index: number) => void;
  validationErrors?: Record<string, string[]>;
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Count contacts per benefit category (for the grid summary)
  const companyContactCount = contacts.filter((c) =>
    c.benefitsCategories?.includes("Company / Plan Sponsor") ||
    c.benefitsCategory === "Company / Plan Sponsor"
  ).length;

  const handleAddContactForCategory = (category: BenefitsCategory) => {
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
    onContactsChange([...contacts, newContact]);
  };

  // All categories including Company/Plan Sponsor + External HR
  interface CategorySection {
    id: string;
    label: string;
    icon: React.ReactNode;
    isExternal?: boolean;
  }

  const categorySections: CategorySection[] = [
    { id: "Company / Plan Sponsor", label: "Company / Plan Sponsor", icon: <Users className="w-5 h-5 text-accent-blue" /> },
    { id: "Retirement", label: "Retirement", icon: <Building2 className="w-5 h-5 text-accent-blue" /> },
    { id: "Group Health", label: "Group Health", icon: <Shield className="w-5 h-5 text-accent-blue" /> },
    { id: "Group Life", label: "Group Life", icon: <Heart className="w-5 h-5 text-accent-blue" /> },
    { id: "Other Benefits", label: "Other Benefits", icon: <Gift className="w-5 h-5 text-accent-blue" /> },
    { id: "__external__", label: "External HR / Administrator", icon: <Users className="w-5 h-5 text-amber-500" />, isExternal: true },
  ];

  const allCategoryIds = categorySections.map((s) => s.id);

  // Group contacts by their benefit category
  const contactsByCategory = useMemo(() => {
    const grouped: Record<string, KeyContact[]> = {};
    for (const section of categorySections) {
      if (section.isExternal) {
        // External: contacts with role "External HR / Administrator" or contactType "team_support"
        // External: contacts with "External HR / Administrator" role or team_support contactType
        grouped[section.id] = contacts.filter((c) =>
          c.contactType === "team_support" ||
          (c.role === "Other" && c.roleOther === "External HR / Administrator") ||
          (c.role as string) === "External HR / Administrator"
        );
      } else {
        grouped[section.id] = contacts.filter((c) =>
          c.benefitsCategories?.includes(section.id as BenefitsCategory) ||
          c.benefitsCategory === section.id
        );
      }
    }
    return grouped;
  }, [contacts]);

  return (
    <div className="space-y-6">
      {/* Category grid showing contact counts per benefit category */}
      <CategoryGrid
        categories={["Retirement", "Group Health", "Group Life", "Other Benefits"]}
        selectedCategory={null}
        onCategorySelect={() => {}}
        contacts={contacts}
        companyContactCount={companyContactCount}
        lockCategoriesUntilSponsor={false}
        showPlanSponsorCard={true}
        planSponsorCompanyLogo={companyData.companyLogo?.url}
        showContactCounts={true}
        fromStep3b={false}
      />

      {/* Category-grouped contact sections */}
      {categorySections.map((section) => {
        const categoryContacts = contactsByCategory[section.id] || [];
        const matchField = section.isExternal ? "role" : "benefitsCategory";
        return (
          <Card key={section.id} className="overflow-hidden border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50/80 dark:bg-gray-800/80 py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <CardTitle className="text-base font-semibold">{section.label}</CardTitle>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {categoryContacts.length}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (section.isExternal) {
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
                    } else {
                      handleAddContactForCategory(section.id as BenefitsCategory);
                    }
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {categoryContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No contacts assigned to {section.label}. Click &ldquo;Add&rdquo; to create one.
                </p>
              ) : (
                <KeyContactsSection
                  contacts={categoryContacts}
                  onContactsChange={(updatedContacts) => {
                    const otherContacts = contacts.filter((c) => {
                      if (section.isExternal) {
                        const isExternal = c.contactType === "team_support" ||
                          (c.role === "Other" && c.roleOther === "External HR / Administrator") ||
                          (c.role as string) === "External HR / Administrator";
                        return !isExternal;
                      }
                      return !(c.benefitsCategories?.includes(section.id as BenefitsCategory) ||
                        c.benefitsCategory === section.id);
                    });
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

      {/* Add Contact button */}
      <Button
        onClick={() => setIsAddModalOpen(true)}
        variant="outline"
        className="w-full lg:w-[320px] lg:flex lg:items-center lg:justify-center lg:mx-auto bg-accent-blue text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Contact ({contacts.length})
      </Button>

      {/* Category-driven Add Contact Modal */}
      <AddMoreContactsModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSkip={() => setIsAddModalOpen(false)}
        onAddContactForCategory={handleAddContactForCategory}
        contacts={contacts}
      />
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
  { id: "company", label: "Company Basics & Branding" },
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
    welcomeData,
    documentsData,
    disclaimers,
    setShowPreview,
    setClientStatus,
    setKeyContacts,
    setKeyContactsDisplayStyle,
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
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [isPreviewLayoutModalOpen, setIsPreviewLayoutModalOpen] = useState(false);

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

  // Navigate to tab with validation errors after save attempt
  useEffect(() => {
    if (clientStatus !== "Active") return;
    if (!hasAttemptedSave) return;

    const errors = getValidationErrors();
    const hasCompanyErrors =
      errors.companyName?.length > 0 || errors.companyLogo?.length > 0;
    const hasBannerErrors =
      errors.heroTitle?.length > 0 || errors.heroDescription?.length > 0;
    const hasMissionErrors =
      errors.missionHeadline?.length > 0 || errors.missionBody?.length > 0;
    const hasContactErrors = errors.keyContacts?.length > 0;

    if (hasCompanyErrors) {
      setActiveTab("company");
    } else if (hasBannerErrors || hasMissionErrors) {
      setActiveTab("preview");
    } else if (hasContactErrors) {
      setActiveTab("contacts");
    }
  }, [getValidationErrors, clientStatus, hasAttemptedSave]);

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
          onBackClick={() => router.push("/new/clients")}
          hasClient={!!client}
          isFormValid={isFormValid()}
          clientId={clientId}
        />

        <div className="mx-auto max-w-5xl px-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as EditTabId)}
          >
            <TabsList className="w-full justify-start gap-1 bg-transparent p-0 border-b rounded-none mb-8 flex-wrap h-auto min-h-fit">
              {EDIT_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-accent-blue data-[state=active]:text-accent-blue rounded-none px-4 py-3 text-sm font-medium whitespace-nowrap"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Tab 1: Company Basics & Branding ── */}
            <TabsContent value="company" className="space-y-6 mt-0">
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
                    <CardTitle className="text-xl">Key Contacts</CardTitle>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Disclaimers</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    Manage disclaimer text displayed in the employee portal footer.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="disclaimers-text">
                      Disclaimer Text
                    </Label>
                    <Textarea
                      id="disclaimers-text"
                      value={(() => {
                        // Extract text from disclaimer data in various shapes:
                        // - "plain string", [{ text: "..." }], { text: "..." }, { disclaimers: [...] }
                        const raw = (client as any)?.disclaimers ?? disclaimers;
                        if (typeof raw === "string") return raw;
                        // Array of disclaimer objects
                        if (Array.isArray(raw))
                          return raw.map((item: any) => item?.text || item || "").filter(Boolean).join("\n\n");
                        // Object like { disclaimers: [...], text: "..." }
                        if (raw && typeof raw === "object") {
                          if (Array.isArray((raw as any).disclaimers))
                            return (raw as any).disclaimers.map((d: any) => d?.text || "").filter(Boolean).join("\n\n");
                          if (raw.text) return raw.text;
                        }
                        return "";
                      })()}
                      onChange={(e) => setDisclaimers(e.target.value)}
                      placeholder="Enter legal disclaimers to display in the portal footer..."
                      rows={8}
                      className="min-h-[200px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      This text will appear in the footer of the employee benefits portal.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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

        {/* Contact Card Layout Preview Modal */}
        <ContactCardLayoutPreviewModal
          isOpen={isPreviewLayoutModalOpen}
          onClose={() => setIsPreviewLayoutModalOpen(false)}
          currentDisplayStyle={keyContactsDisplayStyle}
          onConfirm={(displayStyle) => {
            setKeyContactsDisplayStyle(displayStyle);
          }}
          contacts={keyContacts}
          brandColor={companyData.primaryColor}
          companyName={companyData.companyName}
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
