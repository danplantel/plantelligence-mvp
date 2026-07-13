"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useNewClientWizardStore,
  focusFirstInvalidField,
} from "@/lib/new-client-wizard-store";
import {
  ComplianceDocumentsData,
  Document,
  BenefitsCategory,
} from "@/types/new-client-wizard";
import { ComplianceDocumentsUpload } from "@/components/pages/documents/components/compliance-documents-upload";
import { convertToDocumentFormat } from "@/lib/compliance-document-utils";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocumentPreviewTab } from "@/components/pages/documents/tabs/document-preview-tab";
import { DocumentListTab } from "@/components/pages/documents/tabs/document-list-tab";
import type {
  Document as DocumentsModuleDocument,
  SortColumn,
  SortDirection,
} from "@/components/pages/documents/types";
import { RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { DocumentPreviewModal } from "@/components/pages/documents/components/document-preview-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { deleteFromR2 } from "@/lib/upload-to-r2";

const normalizeComplianceDocumentsData = (
  data?: ComplianceDocumentsData | null,
): ComplianceDocumentsData => ({
  spdFile: data?.spdFile || null,
  retirementPlanDocuments: data?.retirementPlanDocuments || [],
  otherDocuments: data?.otherDocuments || [],
  recordkeeper: data?.recordkeeper || "",
});

const serializeDocument = (doc: Document | null) =>
  doc ? JSON.stringify(doc) : "";

const serializeDocumentArray = (docs: Document[] = []) => JSON.stringify(docs);

const areDocumentArraysEqual = (a: Document[] = [], b: Document[] = []) =>
  serializeDocumentArray(a) === serializeDocumentArray(b);

/** Remove duplicate documents by id (keep first occurrence). */
const dedupeDocumentsById = (docs: Document[]): Document[] =>
  docs.filter((doc, index, self) => index === self.findIndex((d) => d.id === doc.id));

const areComplianceDocumentsEqual = (
  a?: ComplianceDocumentsData | null,
  b?: ComplianceDocumentsData | null,
) => {
  if (!a || !b) return false;
  return (
    serializeDocument(a.spdFile || null) ===
    serializeDocument(b.spdFile || null) &&
    areDocumentArraysEqual(
      a.retirementPlanDocuments,
      b.retirementPlanDocuments,
    ) &&
    areDocumentArraysEqual(a.otherDocuments, b.otherDocuments) &&
    (a.recordkeeper || "") === (b.recordkeeper || "")
  );
};

interface NewClientStep4Props {
  errorFields?: string[];
}

export function NewClientStep4({
  errorFields: _errorFields = [],
}: NewClientStep4Props) {
  const {
    stepData,
    saveStepDataLocally,
    nextStep,
    clearErrorFields,
    completeStep,
    currentStep,
    draftClientId,
  } = useNewClientWizardStore();

  const normalizedInitialDocuments = normalizeComplianceDocumentsData(
    stepData.complianceDocuments,
  );
  const initialPlanDocuments = [
    ...(normalizedInitialDocuments.retirementPlanDocuments || []),
    ...(normalizedInitialDocuments.otherDocuments || []),
  ].filter(
    (doc, index, self) => index === self.findIndex((d) => d.id === doc.id),
  );
  const [documentsData, setDocumentsData] = useState<ComplianceDocumentsData>({
    ...normalizedInitialDocuments,
    retirementPlanDocuments: initialPlanDocuments,
    otherDocuments: [],
  });
  const lastPersistedDocumentsData = useRef<ComplianceDocumentsData>({
    ...normalizedInitialDocuments,
    retirementPlanDocuments: initialPlanDocuments,
    otherDocuments: [],
  });

  // Separate state for retirement plan documents section
  const [retirementPlanDocuments, setRetirementPlanDocuments] =
    useState<Document[]>(initialPlanDocuments);
  const [isInlineSkipLoading, setIsInlineSkipLoading] = useState(false);
  // Store selected language to persist during re-renders (controlled state)
  const [selectedLanguage, setSelectedLanguage] = useState<"EN" | "ES">("EN");

  // Tabs state
  const [activeTab, setActiveTab] = useState("upload");
  const [sortColumn, setSortColumn] = useState<SortColumn>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    title: string;
    blobUrl?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  // Language state for Document Preview
  const [previewLanguage, setPreviewLanguage] = useState<"EN" | "ES">("EN");
  const [activeCategory, setActiveCategory] = useState<BenefitsCategory>("Retirement");

  // Preview tab: only benefit categories (no "All Docs" - hub preview shows by category)
  const benefitCategories: BenefitsCategory[] = [
    "Retirement",
    "Group Life",
    "Group Health",
    "Other Benefits",
  ];

  const primaryColor = stepData.companyBasics?.primaryColor || "#002B5B";
  const secondaryColor = stepData.companyBasics?.secondaryColor || "#E6C47A";
  const companyName = stepData.companyBasics?.companyName || "Plan";

  const initialized = useRef(false);
  const retirementPlanDocumentsRef = useRef(retirementPlanDocuments);
  const documentsDataRef = useRef(documentsData);
  retirementPlanDocumentsRef.current = retirementPlanDocuments;
  documentsDataRef.current = documentsData;

  // Helper function to convert server data to Document format
  // Load compliance documents from server on mount
  useEffect(() => {
    const loadComplianceDocuments = async () => {
      if (initialized.current) return;

      // Check if this is a new plan - if stepData is empty or has no complianceDocuments, don't load from server
      const hasExistingData =
        stepData.complianceDocuments?.spdFile ||
        (stepData.complianceDocuments?.retirementPlanDocuments &&
          stepData.complianceDocuments.retirementPlanDocuments.length > 0) ||
        (stepData.complianceDocuments?.otherDocuments &&
          stepData.complianceDocuments.otherDocuments.length > 0);

      // If no existing data in stepData, skip loading from server (it's a new plan)
      if (!hasExistingData) {
        initialized.current = true;
        return;
      }

      try {
        // Load from both APIs
        const [complianceResponse, optionalResponse] = await Promise.all([
          fetch("/api/new-client-wizard/compliance-documents"),
          fetch("/api/new-client-wizard/optional-documents"),
        ]);

        const aggregatedDocuments: Document[] = [];

        // Load from compliance-documents API (old format)
        if (complianceResponse.ok) {
          const result = await complianceResponse.json();
          const serverData = result.data;

          if (serverData) {
            // Load SPD file if exists
            if (serverData.spdFile) {
              const spdDocument: Document = {
                ...serverData.spdFile,
                id:
                  serverData.spdFile.id ||
                  `plan-doc-${Date.now()}-${Math.random()}`,
                type: serverData.spdFile.type || "other",
                status: serverData.spdFile.status || "success",
              };
              aggregatedDocuments.push(spdDocument);
            }

            // Load other documents if exist (from old format - these are "other documents")
            if (
              serverData.otherDocuments &&
              Array.isArray(serverData.otherDocuments)
            ) {
              const convertedDocuments = await Promise.all(
                serverData.otherDocuments.map(
                  async (doc: any, index: number) => {
                    return await convertToDocumentFormat(doc, index);
                  },
                ),
              );

              aggregatedDocuments.push(...convertedDocuments);
            }

            // Load recordkeeper if exists
            if (serverData.recordkeeper) {
              setDocumentsData((prev) => ({
                ...prev,
                recordkeeper: serverData.recordkeeper,
              }));
            }
          }
        }

        // Load from optional-documents API (new format - retirement plan documents)
        if (optionalResponse.ok) {
          const result = await optionalResponse.json();
          const optionalData = result.optionalDocuments;

          if (optionalData && optionalData.retirementPlanDocuments) {
            const convertedDocuments = await Promise.all(
              optionalData.retirementPlanDocuments.map(
                async (doc: any, index: number) => {
                  return await convertToDocumentFormat(doc, index);
                },
              ),
            );

            aggregatedDocuments.push(...convertedDocuments);
          }
        }

        if (aggregatedDocuments.length > 0) {
          const uniqueDocuments = aggregatedDocuments.filter(
            (doc, index, self) =>
              index === self.findIndex((d) => d.id === doc.id),
          );
          setRetirementPlanDocuments(uniqueDocuments);
          setDocumentsData((prev) => ({
            ...prev,
            spdFile: null,
            otherDocuments: [],
            retirementPlanDocuments: uniqueDocuments,
          }));
        }
      } catch (error) {
        console.error("Error loading compliance documents from server:", error);
      } finally {
        initialized.current = true;
      }
    };

    loadComplianceDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save data when it changes (but not during sync from store)
  useEffect(() => {
    if (
      areComplianceDocumentsEqual(
        lastPersistedDocumentsData.current,
        documentsData,
      )
    ) {
      return;
    }

    lastPersistedDocumentsData.current = documentsData;

    saveStepDataLocally("complianceDocuments", documentsData);
  }, [documentsData, saveStepDataLocally]);

  // Save retirement plan documents when they change
  useEffect(() => {
    setDocumentsData((prev) => {
      if (
        areDocumentArraysEqual(
          prev.retirementPlanDocuments,
          retirementPlanDocuments,
        )
      ) {
        return prev;
      }

      return {
        ...prev,
        retirementPlanDocuments,
      };
    });
  }, [retirementPlanDocuments]);

  // Sync component state with store when stepData changes (e.g., after loading draft)
  useEffect(() => {
    const normalizedDocuments = normalizeComplianceDocumentsData(
      stepData.complianceDocuments,
    );
    const mergedDocuments = [
      ...(normalizedDocuments.retirementPlanDocuments || []),
      ...(normalizedDocuments.otherDocuments || []),
    ].filter(
      (doc, index, self) => index === self.findIndex((d) => d.id === doc.id),
    );
    const normalizedForState = {
      ...normalizedDocuments,
      retirementPlanDocuments: mergedDocuments,
      otherDocuments: [],
    };
    lastPersistedDocumentsData.current = normalizedForState;
    setDocumentsData((prev) =>
      areComplianceDocumentsEqual(prev, normalizedForState)
        ? prev
        : normalizedForState,
    );
    setRetirementPlanDocuments((prev) =>
      areDocumentArraysEqual(prev, mergedDocuments) ? prev : mergedDocuments,
    );
  }, [stepData.complianceDocuments]);

  const handleInlineSkip = async () => {
    if (isInlineSkipLoading) return;
    setIsInlineSkipLoading(true);
    const stepToComplete = currentStep;
    try {
      const result = await nextStep();
      if (!result.isValid) {
        toast.error("Please review the highlighted fields before continuing.");
        if (_errorFields.length > 0) {
          setTimeout(() => focusFirstInvalidField(_errorFields), 100);
        }
        return;
      }
      clearErrorFields();
      completeStep(stepToComplete);
      toast.success("You can return to Plan Documents anytime.");
    } catch (error) {
      console.error("Inline skip failed", error);
      toast.error("Unable to continue right now. Please try again.");
    } finally {
      setIsInlineSkipLoading(false);
    }
  };

  // Get available languages from documents
  const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
    const languages = new Set<"EN" | "ES">();
    retirementPlanDocuments.forEach((doc) => {
      const lang = (doc.language as "EN" | "ES") || "EN";
      languages.add(lang);
    });
    return Array.from(languages).sort((a, b) => {
      // EN first, then ES (preview toggle order)
      if (a === "EN" && b === "ES") return -1;
      if (a === "ES" && b === "EN") return 1;
      return 0;
    });
  }, [retirementPlanDocuments]);

  // Sync previewLanguage with available languages
  // If current language is not available, switch to first available language
  useEffect(() => {
    if (availableLanguages.length > 0) {
      // If current previewLanguage is not in availableLanguages, switch to first available
      if (!availableLanguages.includes(previewLanguage)) {
        setPreviewLanguage(availableLanguages[0]);
      }
    }
  }, [availableLanguages, previewLanguage]);

  // Convert documents to RetirementDocumentItem format for DocumentPreviewTab
  const retirementDocs = useMemo<RetirementDocumentItem[]>(() => {
    const mappedDocs = retirementPlanDocuments.map((doc) => {
      const isDatabaseId =
        typeof doc.id === "string" &&
        /^[0-9a-fA-F]{24}$/.test(doc.id) &&
        !doc.id.startsWith("doc-") &&
        !doc.id.startsWith("plan-doc-") &&
        !doc.id.startsWith("optional-doc-") &&
        !doc.id.startsWith("temp-");

      let href: string;
      if (isDatabaseId) {
        href = `/api/documents/${doc.id}/view`;
      } else if ((doc as any).storageKey) {
        href = `/api/r2/signed-url?key=${encodeURIComponent((doc as any).storageKey)}&redirect=1`;
      } else {
        href = doc.file || "";
      }

      return {
        id: doc.id,
        title: doc.name,
        description: doc.shortDescription || doc.name,
        href: href,
        language: (doc.language as "EN" | "ES") || "EN",
        category: doc.category,
        categorySuggested: doc.categorySuggested,
        categoryConfidence: doc.categoryConfidence,
        meta: {
          id: doc.id,
          type: "Document",
          uploadedAt: (doc as any).uploadedAt || new Date().toISOString(),
        },
        onDelete: () => {
          handleDeleteClick(doc.id, doc.name);
        },
        onDownload: () => {
          handleDownload(doc.id, doc.originalFileName || doc.name);
        },
      };
    });

    // Filter by current language (single language per preview; order EN before ES when both exist in data)
    const filteredByLang = mappedDocs
      .filter((doc) => doc.language === previewLanguage)
      .sort((a, b) => {
        if (a.language === "EN" && b.language === "ES") return -1;
        if (a.language === "ES" && b.language === "EN") return 1;
        return 0;
      });

    // Filter by active category (Preview mimics hub - no "All Docs")
    return filteredByLang.filter((doc) => {
      // Find the original doc to check its category
      const originalDoc = retirementPlanDocuments.find((d) => d.id === doc.id);
      return originalDoc?.category === activeCategory;
    });
  }, [retirementPlanDocuments, previewLanguage, activeCategory]);

  // Preview: only show categories that have documents; default Retirement or first with docs
  const previewCategories = useMemo<BenefitsCategory[]>(() => {
    const catsWithDocs = benefitCategories.filter((cat) =>
      retirementPlanDocuments.some((d) => d.category === cat)
    );
    return catsWithDocs.length > 0 ? catsWithDocs : benefitCategories;
  }, [retirementPlanDocuments]);

  // When switching to Preview tab: default to Retirement or first category with docs
  // Also reset if current category no longer has docs
  useEffect(() => {
    if (activeTab === "preview" && previewCategories.length > 0) {
      const defaultCat = previewCategories.includes("Retirement")
        ? "Retirement"
        : previewCategories[0];
      setActiveCategory((prev) =>
        previewCategories.includes(prev) ? prev : defaultCat
      );
    }
  }, [activeTab, previewCategories]);

  // Convert documents to DocumentsModuleDocument format for DocumentListTab
  const documentsForList = useMemo<DocumentsModuleDocument[]>(() => {
    return retirementPlanDocuments.map((doc) => ({
      id: doc.id,
      title: doc.name,
      fileName: doc.originalFileName || doc.name,
      type: "Document",
      uploadedAt: (doc as any).uploadedAt || new Date().toISOString(),
      client: {
        id: "current-plan",
        companyName: companyName,
      },
      category: doc.category,
      categorySuggested: doc.categorySuggested,
      categoryConfidence: doc.categoryConfidence,
      expirationDate: doc.expirationDate,
    }));
  }, [retirementPlanDocuments, companyName]);

  // Sort documents for list view
  const sortedDocuments = useMemo(() => {
    return [...documentsForList].sort((a, b) => {
      let aValue: any = a[sortColumn];
      let bValue: any = b[sortColumn];

      if (sortColumn === "uploadedAt" || sortColumn === "expirationDate") {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (sortColumn === "client") {
        aValue = a.client.companyName?.toLowerCase() || "";
        bValue = b.client.companyName?.toLowerCase() || "";
      } else {
        aValue = aValue?.toString().toLowerCase() || "";
        bValue = bValue?.toString().toLowerCase() || "";
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [documentsForList, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleDeleteClick = async (documentId: string, documentTitle: string) => {
    const doc = retirementPlanDocuments.find((d) => d.id === documentId);
    if (doc?.storageKey) {
      await deleteFromR2(doc.storageKey);
    }
    setRetirementPlanDocuments((prev) =>
      prev.filter((doc) => doc.id !== documentId),
    );
    toast.success(`"${documentTitle}" deleted`);
  };

  const handleSaveEdit = async (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => {
    // If file is provided, convert it to base64
    let fileData: string | undefined;
    let originalFileName: string | undefined;

    if (file) {
      try {
        const reader = new FileReader();
        fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            const result = e.target?.result as string;
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        originalFileName = file.name;
      } catch (error) {
        console.error("Error reading file:", error);
        toast.error("Failed to read file");
        return;
      }
    }

    // Use refs so we always apply to latest state (avoids stale closure when saving from Preview after tab switch)
    const currentDocs = retirementPlanDocumentsRef.current;
    const currentData = documentsDataRef.current;
    const updatedDocuments = currentDocs.map((doc) =>
      doc.id === docId
        ? {
          ...doc,
          name: title,
          shortDescription: description,
          ...(fileData && { file: fileData }),
          ...(originalFileName && { originalFileName: originalFileName }),
          ...(category !== undefined && { category: category as BenefitsCategory }),
        }
        : doc,
    );

    const updatedDocumentsData: ComplianceDocumentsData = {
      ...currentData,
      retirementPlanDocuments: updatedDocuments,
    };

    setRetirementPlanDocuments(updatedDocuments);
    setDocumentsData(updatedDocumentsData);
    saveStepDataLocally("complianceDocuments", updatedDocumentsData);

    toast.success("Document updated successfully");
    refreshDocuments();
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    const doc = retirementPlanDocuments.find((d) => d.id === documentId);
    if (!doc || !doc.file) {
      toast.error("Document not found or file is missing");
      return;
    }

    try {
      if (doc.file.startsWith("data:")) {
        const response = await fetch(doc.file);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (doc.file.startsWith("/api/")) {
        const response = await fetch(doc.file);
        if (!response.ok) {
          toast.error("Failed to download document");
          return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const link = document.createElement("a");
        link.href = doc.file;
        link.download =
          fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("An error occurred while downloading the document");
    }
  };

  const handlePreview = async (
    documentIdOrDoc: string | RetirementDocumentItem,
    title?: string,
  ) => {
    let documentId: string;
    let documentTitle: string;

    if (typeof documentIdOrDoc === "string") {
      documentId = documentIdOrDoc;
      documentTitle = title || "Document";
    } else {
      documentId = documentIdOrDoc.meta?.id || documentIdOrDoc.id;
      documentTitle = documentIdOrDoc.title;
    }

    setIsLoadingPreview(true);
    setPreviewOpen(true);

    try {
      const doc = retirementPlanDocuments.find((d) => d.id === documentId);
      if (!doc || !doc.file) {
        toast.error("Document not found");
        setPreviewOpen(false);
        return;
      }

      let blob: Blob;
      if (doc.file.startsWith("data:")) {
        const response = await fetch(doc.file);
        blob = await response.blob();
      } else if (doc.file.startsWith("/api/")) {
        const response = await fetch(doc.file);
        if (!response.ok) {
          toast.error("Failed to load document preview");
          setPreviewOpen(false);
          return;
        }
        blob = await response.blob();
      } else {
        const response = await fetch(doc.file);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      setPreviewDocument({ id: documentId, title: documentTitle, blobUrl });
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Failed to load document preview");
      setPreviewOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getDocumentType = (doc: DocumentsModuleDocument) => {
    return doc.type || "Document";
  };

  const refreshDocuments = () => {
    // Force re-render by updating state
    setRetirementPlanDocuments([...retirementPlanDocuments]);
  };

  const handleEditFromList = (documentId: string, title: string) => {
    // Switch to preview tab and trigger edit for the document
    setActiveTab("preview");
    // The edit will be triggered automatically when the document is rendered in preview mode
    // We can dispatch an event or use a ref to trigger edit
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editDocument", {
          detail: { documentId },
        }),
      );
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <DocumentListTab
            selectedPlan="current-plan"
            isLoading={false}
            documents={sortedDocuments}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onPreview={(id, title) => handleEditFromList(id, title)}
            getDocumentType={getDocumentType}
            onDelete={(id, name) => handleDeleteClick(id, name)}
            onDownload={(id, name) => handleDownload(id, name)}
            onEdit={(id, title, updates) => {
              if (updates?.category !== undefined) {
                const docIndex = retirementPlanDocuments.findIndex((d) => d.id === id);
                if (docIndex !== -1) {
                  const newDocs = [...retirementPlanDocuments];
                  newDocs[docIndex] = {
                    ...newDocs[docIndex],
                    category: updates.category as BenefitsCategory,
                  };
                  setRetirementPlanDocuments(newDocs);
                  const updatedData: ComplianceDocumentsData = {
                    ...documentsData,
                    retirementPlanDocuments: newDocs,
                  };
                  setDocumentsData(updatedData);
                  saveStepDataLocally("complianceDocuments", updatedData);
                  const isPersistedMongoId =
                    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
                  if (isPersistedMongoId && draftClientId) {
                    void fetch(`/api/documents/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ category: updates.category }),
                    }).then(async (res) => {
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        console.error("Failed to persist document category:", err);
                        toast.error("Could not save category to server");
                      }
                    });
                  }
                  toast.success("Category updated");
                }
              } else {
                handleEditFromList(id, title);
              }
            }}
            availableCategories={[
              "Retirement",
              "Group Health",
              "Group Life",
              "Other Benefits",
            ]}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          {/* Language Switcher */}
          {availableLanguages.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {availableLanguages.map((lang) => {
                const isActive = previewLanguage === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setPreviewLanguage(lang);
                    }}
                    className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${isActive
                      ? "bg-[#002B5B] text-white border-[#002B5B]"
                      : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                      }`}
                    style={
                      isActive
                        ? {
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                        }
                        : {}
                    }
                  >
                    {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                  </button>
                );
              })}
            </div>
          )}

          {/* All Docs: takes you back to document list (List tab) */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className="text-sm font-medium hover:underline text-[#002B5B] dark:text-gray-200"
            >
              ← All Docs
            </button>
          </div>

          {/* Category Filter Tabs - only benefit categories (no All Docs as category; Preview mimics hub) */}
          <div className="mb-8 flex flex-wrap gap-2 border-b pb-4">
            {previewCategories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 text-[14px] font-semibold transition-all relative ${isActive ? "text-[#002B5B] dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  {cat === "Other Benefits" ? "Other" : cat}
                  {isActive && (
                    <div
                      className="absolute bottom-[-17px] left-0 right-0 h-[3px] rounded-t-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {retirementDocs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-600 text-lg dark:text-gray-400">
                No documents found in{" "}
                {previewLanguage === "EN" ? "English" : "Spanish"}.
              </p>
            </div>
          ) : (
            <DocumentPreviewTab
              selectedPlan="current-plan"
              isLoading={false}
              documents={retirementDocs}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
              onDocumentsChange={refreshDocuments}
              showWizardNextHint={true}
              onSaveEdit={handleSaveEdit}
              brandColor={primaryColor}
              accentColor={secondaryColor}
            />
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <ComplianceDocumentsUpload
            clientId={draftClientId}
            initialDocuments={retirementPlanDocuments}
            onDocumentsChange={(docs) => {
              const deduped = dedupeDocumentsById(docs);
              if (
                initialized.current &&
                deduped.length > retirementPlanDocuments.length
              ) {
                setActiveTab("list");
              }
              setRetirementPlanDocuments(deduped);
            }}
            brandColor={primaryColor}
            accentColor={secondaryColor}
            showPreview={false}
            showInfoCard={true}
            language={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            compact={true}
            secondaryAction={{
              label: isInlineSkipLoading ? "Skipping..." : "Skip for now",
              onClick: handleInlineSkip,
              disabled: isInlineSkipLoading,
            }}
          />

          {/* Document Preview with Language Switcher */}
          {retirementPlanDocuments.length > 0 && (
            <div className="mt-4">
              {/* Language Switcher */}
              {availableLanguages.length > 1 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {availableLanguages.map((lang) => {
                    const isActive = previewLanguage === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setPreviewLanguage(lang);
                        }}
                        className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${isActive
                          ? "bg-[#002B5B] text-white border-[#002B5B]"
                          : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                          }`}
                        style={
                          isActive
                            ? {
                              backgroundColor: primaryColor,
                              borderColor: primaryColor,
                            }
                            : {}
                        }
                      >
                        {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filtered Documents Preview */}
              {retirementDocs.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <p className="text-gray-600 text-lg dark:text-gray-400">
                    No documents found in{" "}
                    {previewLanguage === "EN" ? "English" : "Spanish"}.
                  </p>
                </div>
              ) : (
                <DocumentPreviewTab
                  selectedPlan="current-plan"
                  isLoading={false}
                  documents={retirementDocs}
                  onDelete={handleDeleteClick}
                  onDownload={handleDownload}
                  onDocumentsChange={refreshDocuments}
                  onSaveEdit={handleSaveEdit}
                  brandColor={primaryColor}
                  accentColor={secondaryColor}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewDocument(null);
        }}
        document={previewDocument}
        isLoading={isLoadingPreview}
      />
    </div>
  );
}
