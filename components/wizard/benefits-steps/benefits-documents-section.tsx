"use client";

import { useState, useMemo, useEffect } from "react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { persistNewDocumentsToApi } from "@/lib/benefits-document-persist";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { BenefitsCategory } from "@/types/new-client-wizard";

interface BenefitsDocumentsSectionProps {
  clientId: string;
  /** Wizard Step 4 documents (may span multiple benefit categories). */
  documents: any[];
  onChange: (docs: any[]) => void;
  /** Current benefit category being configured (scopes upload + list). */
  benefitCategory?: string;
  brandColor?: string;
  secondaryColor?: string;
  companyName?: string;
}

/** Map a benefit category to the hub preview category label used by the category filter. */
function toPreviewCategory(category?: string): BenefitsCategory {
  const cat = category || "Retirement";
  if (cat === "Company / Plan Sponsor" || cat === "Custom") return "Other Benefits";
  return cat as BenefitsCategory;
}

/** Remove duplicate documents by id (keep first occurrence). */
const dedupeDocumentsById = (docs: any[]): any[] =>
  docs.filter(
    (doc, index, self) =>
      index === self.findIndex((d) => d.id === doc.id),
  );

export function BenefitsDocumentsSection({
  clientId,
  documents,
  onChange,
  benefitCategory = "Retirement",
  brandColor = "#002B5B",
  secondaryColor = "#E6C47A",
  companyName = "Plan",
}: BenefitsDocumentsSectionProps) {
  // Tabs state — "upload" is the first (default) tab
  const [activeTab, setActiveTab] = useState("upload");
  const [sortColumn, setSortColumn] = useState<SortColumn>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Track whether documents are currently being uploaded (disable tab switching)
  const [isUploading, setIsUploading] = useState(false);

  // Pending document deletion (awaiting confirmation dialog)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Document preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    title: string;
    blobUrl?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Language state for preview + upload
  const [selectedLanguage, setSelectedLanguage] = useState<"EN" | "ES">("EN");
  const [previewLanguage, setPreviewLanguage] = useState<"EN" | "ES">("EN");
  const [activeCategory, setActiveCategory] = useState<BenefitsCategory>(() =>
    toPreviewCategory(benefitCategory),
  );

  // Preview tab: only benefit categories (no "All Docs" - hub preview shows by category)
  const benefitCategories: BenefitsCategory[] = [
    "Retirement",
    "Group Life",
    "Group Health",
    "Other Benefits",
  ];

  // Get available languages from documents
  const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
    const languages = new Set<"EN" | "ES">();
    documents.forEach((doc) => {
      const lang = (doc.language as "EN" | "ES") || "EN";
      languages.add(lang);
    });
    return Array.from(languages).sort((a, b) => {
      if (a === "EN" && b === "ES") return -1;
      if (a === "ES" && b === "EN") return 1;
      return 0;
    });
  }, [documents]);

  // Sync previewLanguage with available languages
  useEffect(() => {
    if (availableLanguages.length > 0) {
      if (!availableLanguages.includes(previewLanguage)) {
        setPreviewLanguage(availableLanguages[0]);
      }
    }
  }, [availableLanguages, previewLanguage]);

  // Documents scoped to the current benefit category (list + upload filtering)
  const categoryDocs = useMemo(() => {
    if (!benefitCategory) return documents;
    const target = resolvePersistedDocumentCategory(
      "Document",
      benefitCategory,
    );
    return documents.filter(
      (doc) =>
        resolvePersistedDocumentCategory(
          "Document",
          doc.category,
          (doc as { storageKey?: string }).storageKey,
        ) === target,
    );
  }, [documents, benefitCategory]);

  // Convert documents to RetirementDocumentItem format for DocumentPreviewTab
  const retirementDocs = useMemo<RetirementDocumentItem[]>(() => {
    const mappedDocs = documents.map((doc) => {
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

    // Filter by current language (single language per preview; order EN before ES)
    const filteredByLang = mappedDocs
      .filter((doc) => doc.language === previewLanguage)
      .sort((a, b) => {
        if (a.language === "EN" && b.language === "ES") return -1;
        if (a.language === "ES" && b.language === "EN") return 1;
        return 0;
      });

    // Filter by active category (Preview mimics hub - no "All Docs")
    return filteredByLang.filter((doc) => {
      const originalDoc = documents.find((d) => d.id === doc.id);
      return originalDoc?.category === activeCategory;
    });
  }, [documents, previewLanguage, activeCategory]);

  // When switching to Preview tab: default to Retirement or first category with docs
  useEffect(() => {
    if (activeTab === "preview" && benefitCategories.length > 0) {
      const defaultCat = benefitCategories.includes("Retirement")
        ? "Retirement"
        : benefitCategories[0];
      setActiveCategory((prev) =>
        benefitCategories.includes(prev) ? prev : defaultCat,
      );
    }
  }, [activeTab, benefitCategories]);

  // Convert documents to DocumentsModuleDocument format for DocumentListTab
  const documentsForList = useMemo<DocumentsModuleDocument[]>(() => {
    return categoryDocs.map((doc) => ({
      id: doc.id,
      title: doc.name,
      fileName: doc.originalFileName || doc.name,
      type: "Document",
      uploadedAt: (doc as any).uploadedAt || new Date().toISOString(),
      client: {
        id: clientId || "current-plan",
        companyName: companyName,
      },
      category: doc.category,
      categorySuggested: doc.categorySuggested,
      categoryConfidence: doc.categoryConfidence,
      expirationDate: doc.expirationDate,
    }));
  }, [categoryDocs, clientId, companyName]);

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

  // Open the "Are you sure?" confirmation dialog before deleting.
  const handleDeleteClick = (documentId: string, documentTitle: string) => {
    setDeleteConfirm({ id: documentId, title: documentTitle });
  };

  // Perform the actual deletion after the user confirms.
  const confirmDelete = async () => {
    const pending = deleteConfirm;
    if (!pending) return;
    const doc = documents.find((d) => d.id === pending.id);
    if (doc?.storageKey) {
      await deleteFromR2(doc.storageKey);
    }
    onChange(documents.filter((doc) => doc.id !== pending.id));
    toast.success(`"${pending.title}" deleted`);
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    const doc = documents.find((d) => d.id === documentId);
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
      const doc = documents.find((d) => d.id === documentId);
      if (!doc || !doc.file) {
        toast.error("Document not found");
        setPreviewOpen(false);
        return;
      }

      const response = await fetch(doc.file);
      if (!response.ok) {
        toast.error("Failed to load document preview");
        setPreviewOpen(false);
        return;
      }
      const blob = await response.blob();
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
    // Controlled component: force a re-render via a new array reference.
    onChange([...documents]);
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

    const updatedDocuments = documents.map((doc) =>
      doc.id === docId
        ? {
            ...doc,
            name: title,
            shortDescription: description,
            ...(fileData && { file: fileData }),
            ...(originalFileName && { originalFileName: originalFileName }),
            ...(category !== undefined && {
              category: category as BenefitsCategory,
            }),
          }
        : doc,
    );

    onChange(updatedDocuments);
    toast.success("Document updated successfully");
  };

  const handleEditFromList = (documentId: string, title: string) => {
    // Switch to preview tab and trigger edit for the document
    setActiveTab("preview");
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editDocument", {
          detail: { documentId },
        }),
      );
    }, 100);
  };

  const handleUploadChange = (docs: any[]) => {
    const deduped = dedupeDocumentsById(docs);
    const prevCount = documents.length;
    onChange(deduped);
    // Switch to list view only when documents are actually added (count increases)
    if (deduped.length > prevCount) {
      setActiveTab("list");
      const addedCount = deduped.length - prevCount;
      toast.success(
        `${addedCount} document${addedCount === 1 ? "" : "s"} added successfully.`,
      );
    }
    if (!clientId) return;
    void (async () => {
      try {
        const merged = await persistNewDocumentsToApi(clientId, deduped);
        const next = merged !== deduped ? merged : deduped;
        onChange(next);
        try {
          const rows = await fetchPlanDocumentsForClient(clientId);
          if (rows.length > 0) {
            const converted = await Promise.all(
              (rows as any[]).map((doc: any, index: number) =>
                convertToDocumentFormat(
                  { ...doc, name: doc.title, fileUrl: doc.fileUrl, storageKey: doc.storageKey },
                  index,
                ),
              ),
            );
            const seenRefetch = new Set<string>();
            const dedupedConverted = converted.filter((d: any) => {
              const key = d.id || d.name || d.file;
              if (seenRefetch.has(key)) return false;
              seenRefetch.add(key);
              return true;
            });
            onChange(dedupedConverted);
          }
        } catch (e) {
          console.error("Refetch plan documents after upload failed", e);
        }
      } catch (e) {
        console.error("Persist plan documents after upload failed", e);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("plan-documents-persisted", {
            detail: { clientId },
          }),
        );
      }
    })();
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="list" disabled={isUploading}>
            List
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={isUploading}>
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <ComplianceDocumentsUpload
            clientId={clientId}
            initialDocuments={categoryDocs}
            onDocumentsChange={handleUploadChange}
            onUploadingChange={setIsUploading}
            brandColor={brandColor}
            accentColor={secondaryColor}
            showPreview={false}
            showInfoCard={true}
            language={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            compact={true}
            fixedCategory={toPreviewCategory(benefitCategory)}
            filterDocuments={(doc) => {
              const b = benefitCategory;
              if (!b) return true;
              return (
                resolvePersistedDocumentCategory(
                  "Document",
                  doc.category,
                  (doc as { storageKey?: string }).storageKey,
                ) === resolvePersistedDocumentCategory("Document", b)
              );
            }}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <AlertTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Plan Documents Overview
            </AlertTitle>
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
              Review all uploaded plan documents, forms, and notices below. Use
              the column headers to sort, and expand rows to preview or edit.
              Documents with missing categories will need to be assigned before
              proceeding.
            </AlertDescription>
          </Alert>
          <DocumentListTab
            selectedPlan={clientId || "current-plan"}
            isLoading={false}
            documents={sortedDocuments}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onPreview={(id, title) => handleEditFromList(id, title)}
            getDocumentType={getDocumentType}
            onDelete={(id, name) => handleDeleteClick(id, name)}
            onDownload={(id, name) => handleDownload(id, name)}
            compact
            hideUploadedTime
            showActionTooltips
            showDirectEditDelete
            onEdit={(id, title, updates) => {
              if (updates?.category !== undefined) {
                const docIndex = documents.findIndex((d) => d.id === id);
                if (docIndex !== -1) {
                  const newDocs = [...documents];
                  newDocs[docIndex] = {
                    ...newDocs[docIndex],
                    category: updates.category as BenefitsCategory,
                  };
                  onChange(newDocs);
                  const isPersistedMongoId =
                    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
                  if (isPersistedMongoId && clientId) {
                    void fetch(`/api/documents/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ category: updates.category }),
                    }).then(async (res) => {
                      if (!res.ok) {
                        await res.json().catch(() => ({}));
                        console.error(
                          "Failed to persist document category:",
                          res,
                        );
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

        <TabsContent value="preview" className="mt-6 pb-24">
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
                    className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${
                      isActive
                        ? "bg-[#002B5B] text-white border-[#002B5B]"
                        : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: brandColor,
                            borderColor: brandColor,
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

          {/* Category Filter Tabs - only benefit categories (no All Docs; Preview mimics hub) */}
          <div className="mb-8 flex flex-wrap gap-2 border-b pb-4">
            {benefitCategories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 text-[14px] font-semibold transition-all relative ${
                    isActive
                      ? "text-accent-blue dark:text-accent-blue"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {cat === "Other Benefits" ? "Other" : cat}
                  {isActive && (
                    <div className="absolute bottom-[-17px] left-0 right-0 h-[3px] rounded-t-full bg-accent-blue" />
                  )}
                </button>
              );
            })}
          </div>

          {retirementDocs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-600 text-lg dark:text-gray-400">
                No documents found.
              </p>
            </div>
          ) : (
            <DocumentPreviewTab
              selectedPlan={clientId || "current-plan"}
              isLoading={false}
              documents={retirementDocs}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
              onDocumentsChange={refreshDocuments}
              showWizardNextHint={true}
              onSaveEdit={handleSaveEdit}
              brandColor={brandColor}
              accentColor={secondaryColor}
            />
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

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        onConfirm={confirmDelete}
        title="Delete document?"
        description={
          deleteConfirm
            ? `Are you sure you want to delete "${deleteConfirm.title}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
