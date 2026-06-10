"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { DocumentPreviewModal } from "@/components/pages/documents/components/document-preview-modal";
import { DocumentEditModal } from "@/components/pages/documents/components/document-edit-modal";
import { DocumentPreviewTab } from "@/components/pages/documents/tabs/document-preview-tab";
import { DocumentUploadTab } from "@/components/pages/documents/tabs/document-upload-tab";
import { DocumentListTab } from "@/components/pages/documents/tabs/document-list-tab";
import type {
  Document,
  SortColumn,
  SortDirection,
  Client,
} from "@/components/pages/documents/types";
import { StickyPlanCombobox } from "@/components/plan-selector/sticky-plan-combobox";
import {
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";
import { Button } from "@/components/ui/button";

function DocumentsPreviewEmptyState(props: {
  selectedPlan: string;
  isLoading: boolean;
  sortedCount: number;
  filteredForPreviewCount: number;
  previewLanguage: "EN" | "ES";
  onGoToUpload: () => void;
}) {
  const {
    selectedPlan,
    isLoading,
    sortedCount,
    filteredForPreviewCount,
    previewLanguage,
    onGoToUpload,
  } = props;

  if (!selectedPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2 max-w-md mx-auto">
        <p className="text-gray-800 text-lg font-semibold">Select a plan</p>
        <p className="text-muted-foreground text-sm">
          Choose a plan above to view and manage documents for that client.
        </p>
      </div>
    );
  }

  if (isLoading && sortedCount === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue" />
          <span className="text-gray-600">Loading documents…</span>
        </div>
      </div>
    );
  }

  const noDocsForPlan = sortedCount === 0;
  const onlyWrongLanguage =
    sortedCount > 0 && filteredForPreviewCount === 0;

  if (noDocsForPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 max-w-lg mx-auto rounded-lg border border-dashed border-gray-200 bg-gray-50/80">
        <p className="text-gray-900 text-lg font-semibold">
          No documents for this plan yet
        </p>
        <p className="text-muted-foreground text-sm">
          Upload retirement plan documents for this client on the Upload tab. After you save, they
          show up in preview and on the portal.
        </p>
        <Button type="button" onClick={onGoToUpload}>
          Upload documents
        </Button>
      </div>
    );
  }

  if (onlyWrongLanguage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3 max-w-lg mx-auto">
        <p className="text-gray-900 text-lg font-semibold">
          No documents in {previewLanguage === "EN" ? "English" : "Spanish"}
        </p>
        <p className="text-muted-foreground text-sm">
          This plan has documents in another language. Use the language toggle above, or upload a{" "}
          {previewLanguage === "EN" ? "English" : "Spanish"} file on the Upload tab.
        </p>
        <Button type="button" variant="outline" onClick={onGoToUpload}>
          Go to Upload
        </Button>
      </div>
    );
  }

  return null;
}

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DocumentsPage() {
  const { setTitle } = usePageTitleContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    title: string;
    blobUrl?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<{
    id: string;
    title: string;
    description?: string;
    fileName?: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    // Load from localStorage or default to "cards"
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("documentsViewMode");
      return (saved === "table" || saved === "cards" ? saved : "cards") as
        | "table"
        | "cards";
    }
    return "cards";
  });
  const [activeTab, setActiveTab] = useState("preview");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [hasUnsavedUploadChanges, setHasUnsavedUploadChanges] = useState(false);
  const [uploadSaveFn, setUploadSaveFn] = useState<(() => Promise<void>) | null>(
    null,
  );
  // Language state for Document Preview
  const [previewLanguage, setPreviewLanguage] = useState<"EN" | "ES">("EN");
  const leaveGuard = useNavigateAwayGuard({
    enabled: true,
    hasUnsavedChanges: activeTab === "upload" && hasUnsavedUploadChanges,
    onSaveAndExit: async () => {
      if (!uploadSaveFn) {
        throw new Error("No save action is available yet for uploaded documents.");
      }
      await uploadSaveFn();
      setHasUnsavedUploadChanges(false);
      await fetchDocuments();
    },
  });

  // SWR: clients list — cached, shows instantly on revisit
  // Declared before useEffects that depend on `clients`
  const clientsKey = "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc";
  const { data: clientsData, mutate: refreshClientsSWR } = useSWR(clientsKey, jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const clients: Client[] = useMemo(
    () => ((clientsData?.data as Client[]) ?? []).filter((c) => (c.status ?? "Active") !== "Archived"),
    [clientsData],
  );

  // SWR: documents — key changes with filters so each combo is cached separately
  const docsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (typeFilter !== "all") params.append("type", typeFilter);
    if (clientFilter !== "all") params.append("clientId", clientFilter);
    return `/api/documents?${params.toString()}`;
  }, [searchTerm, typeFilter, clientFilter]);

  const { data: docsData, isLoading: docsLoading, mutate: refreshDocsSWR } = useSWR(
    docsKey,
    jsonFetcher,
    {
      keepPreviousData: true,
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      onSuccess: () => setIsLoading(false),
      onError: () => {
        toast.error("Failed to fetch documents");
        setIsLoading(false);
      },
    },
  );
  const documents: Document[] = docsData?.data ?? [];

  const fetchDocuments = useCallback(() => {
    refreshDocsSWR();
  }, [refreshDocsSWR]);

  // Update URL when filters change
  const updateURL = (search: string, type: string, client: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type !== "all") params.set("type", type);
    if (client !== "all") {
      const selectedClient = clients.find((c) => c.id === client);
      if (selectedClient) params.set("company", selectedClient.companyName);
    }
    if (selectedPlan) params.set("planId", selectedPlan);

    const tabParam = searchParams.get("tab");
    if (tabParam && ["preview", "upload", "list"].includes(tabParam)) {
      params.set("tab", tabParam);
    }

    const newURL = params.toString()
      ? `/new/documents?${params.toString()}`
      : "/new/documents";
    router.replace(newURL);
  };

  // Set page title
  useEffect(() => {
    setTitle("Documents");
  }, [setTitle]);

  // Sync URL params with filters on mount
  useEffect(() => {
    const companyParam = searchParams.get("company");
    const searchParam = searchParams.get("search");
    const typeParam = searchParams.get("type");
    const tabParam = searchParams.get("tab");

    if (searchParam) setSearchTerm(searchParam);
    if (typeParam) setTypeFilter(typeParam);

    // Set active tab from URL parameter
    if (tabParam && ["preview", "upload", "list"].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    // If company param exists, find the client and set filter and selected plan
    if (companyParam && clients.length > 0) {
      const decodedCompany = decodeURIComponent(companyParam.replace(/\+/g, " "));
      let client = clients.find(
        (c) => c.companyName.toLowerCase() === decodedCompany.toLowerCase(),
      );
      if (!client) {
        client = clients.find(
          (c) =>
            c.companyName.toLowerCase().includes(decodedCompany.toLowerCase()) ||
            decodedCompany.toLowerCase().includes(c.companyName.toLowerCase()),
        );
      }
      if (client) {
        setClientFilter(client.id);
        setSelectedPlan(client.id);
      }
    }
  }, [searchParams, clients]);

  // Per-module sticky plan + ?planId= override
  useEffect(() => {
    if (clients.length === 0) return;
    const urlPlanId = searchParams.get("planId")?.trim() || null;
    const resolved = resolveStickyPlanId(clients, "documents", urlPlanId);
    if (!resolved) return;
    setSelectedPlan((prev) => (urlPlanId ? resolved : prev || resolved));
    setClientFilter((prev) => {
      if (urlPlanId) return resolved;
      if (!prev || prev === "all") return resolved;
      return prev;
    });
    if (urlPlanId && resolved === urlPlanId) {
      persistPlanSelection("documents", resolved);
    }
  }, [clients, searchParams]);

  // Update URL when filters change (clients must be loaded first)
  useEffect(() => {
    if (clients.length > 0) {
      updateURL(searchTerm, typeFilter, clientFilter);
    }
  }, [searchTerm, typeFilter, clientFilter, selectedPlan, clients.length, searchParams]);

  const handlePlanChange = (clientId: string) => {
    setSelectedPlan(clientId);
    setClientFilter(clientId);
    const params = new URLSearchParams(window.location.search);
    params.set("planId", clientId);
    router.replace(`/new/documents?${params.toString()}`);
  };

  // Set active tab from URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["preview", "upload", "list"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      // Fetch from the secure endpoint
      const response = await fetch(`/api/documents/${documentId}/view`);

      if (!response.ok) {
        toast.error("Failed to download document");
        return;
      }

      // Create blob from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("An error occurred while downloading the document");
    }
  };

  const handleDeleteClick = (documentId: string, documentTitle: string) => {
    setDocumentToDelete({ id: documentId, title: documentTitle });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      const response = await fetch(`/api/documents/${documentToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Document deleted successfully!");
        fetchDocuments(); // Refresh the documents list
      } else {
        toast.error("Failed to delete document");
      }
    } catch (error) {
      toast.error("An error occurred while deleting the document");
    } finally {
      setDocumentToDelete(null);
    }
  };

  const getDocumentType = (doc: Document) => {
    if (doc.type) return doc.type;
    const titleLower = doc.title.toLowerCase();
    if (
      titleLower.includes("spd") ||
      titleLower.includes("summary plan description") ||
      titleLower.includes("plan highlights")
    ) {
      return "SPD";
    }
    if (
      titleLower.includes("sbc") ||
      titleLower.includes("summary of benefits")
    ) {
      return "SBC";
    }
    return "Document";
  };

  // Calculate expiration status for documents
  const getExpirationStatus = (doc: Document) => {
    if (!doc.expirationDate) return null;
    const expirationDate = new Date(doc.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);

    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiration < 0) {
      return { status: "expired", days: Math.abs(daysUntilExpiration) };
    } else if (daysUntilExpiration <= 30) {
      return { status: "expiring_soon", days: daysUntilExpiration };
    }
    return null;
  };

  // Get documents with expiration alerts
  const expiredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const status = getExpirationStatus(doc);
      return status?.status === "expired";
    });
  }, [documents]);

  const expiringSoonDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const status = getExpirationStatus(doc);
      return status?.status === "expiring_soon";
    });
  }, [documents]);

  const sortedDocuments = [...documents].sort((a, b) => {
    // First, sort by type (SPD, SBC, Document)
    const aType = getDocumentType(a);
    const bType = getDocumentType(b);
    const typeOrder = { SPD: 1, SBC: 2, Document: 3 };
    const typeDiff =
      (typeOrder[aType as keyof typeof typeOrder] || 3) -
      (typeOrder[bType as keyof typeof typeOrder] || 3);

    if (typeDiff !== 0) {
      return typeDiff;
    }

    // Then sort by selected column
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

  // Get available languages from documents
  const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
    const languages = new Set<"EN" | "ES">();
    sortedDocuments.forEach((doc) => {
      const lang = (doc as any).language;
      if (lang === "ES" || lang === "EN") {
        languages.add(lang);
      } else {
        // Default to EN if language is not specified
        languages.add("EN");
      }
    });
    return Array.from(languages).sort((a, b) => {
      // EN first, then ES (preview toggle order)
      if (a === "EN" && b === "ES") return -1;
      if (a === "ES" && b === "EN") return 1;
      return 0;
    });
  }, [sortedDocuments]);

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

  // Convert documents to RetirementDocumentItem format
  const retirementDocs = useMemo<RetirementDocumentItem[]>(() => {
    const mappedDocs = sortedDocuments.map((doc) => {
      const docType = getDocumentType(doc);
      const docLanguage = (doc as any).language;
      const language = (
        docLanguage === "ES" || docLanguage === "EN" ? docLanguage : "EN"
      ) as "EN" | "ES";

      return {
        id: doc.id,
        title: doc.title,
        description: (doc as any).shortDescription || doc.fileName || doc.title,
        // Add cache-busting parameter to ensure updated files are loaded
        href: `/api/documents/${doc.id}/view?t=${doc.uploadedAt}`,
        language: language,
        category: (doc as any).category ?? undefined,
        categorySuggested: (doc as any).categorySuggested ?? undefined,
        categoryConfidence: (doc as any).categoryConfidence ?? undefined,
        meta: {
          type: docType,
          client: {
            id: doc.client.id,
            companyName: doc.client.companyName,
          },
          uploadedAt: doc.uploadedAt,
        },
        onEdit: undefined, // Edit functionality is handled by DocumentsCardsView internally
        onDelete: () => {
          handleDeleteClick(doc.id, doc.title);
        },
        onDownload: () => {
          handleDownload(doc.id, doc.fileName);
        },
      };
    });

    // Filter by current language (EN before ES when both appear)
    return mappedDocs
      .filter((doc) => doc.language === previewLanguage)
      .sort((a, b) => {
        if (a.language === "EN" && b.language === "ES") return -1;
        if (a.language === "ES" && b.language === "EN") return 1;
        return 0;
      });
  }, [sortedDocuments, previewLanguage]);

  const handleSaveEdit = async (
    docId: string,
    title: string,
    description: string,
    file?: File,
  ) => {
    try {
      if (file && selectedPlan) {
        try {
          const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
          const key = await uploadFileToR2({
            file,
            purpose: "document",
            clientId: selectedPlan,
            fileName: file.name,
            category: "other",
          });
          if (key) {
            const response = await fetch(`/api/documents/${docId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                shortDescription: description,
                storageKey: key,
                fileName: file.name,
              }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
              toast.success("Document updated successfully");
              setTimeout(() => {
                fetchDocuments();
                if (typeof window !== "undefined" && window.caches) {
                  caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name));
                  });
                }
              }, 500);
              return;
            }
          }
        } catch (r2Err) {
          console.warn("[handleSaveEdit] R2 upload failed, falling back to FormData", r2Err);
        }
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("shortDescription", description);
      if (file) {
        formData.append("file", file);
      }

      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Document updated successfully");
        // Force refresh documents list and clear cache
        // Add timestamp to break cache
        setTimeout(() => {
          fetchDocuments();
          // Force browser to reload document URLs by clearing cache
          if (typeof window !== "undefined" && window.caches) {
            caches.keys().then((names) => {
              names.forEach((name) => {
                caches.delete(name);
              });
            });
          }
        }, 500);
      } else {
        toast.error(result.error || "Failed to update document");
        throw new Error(result.error || "Failed to update document");
      }
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error("An error occurred while updating the document");
      throw error;
    }
  };

  const handleEditFromTable = (documentId: string, title: string) => {
    // Find the document
    const doc = documents.find((d) => d.id === documentId);
    if (doc) {
      setDocumentToEdit({
        id: doc.id,
        title: doc.title,
        description: (doc as any).shortDescription || "",
        fileName: doc.fileName,
      });
      setEditModalOpen(true);
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
      // Fetch document as blob to create preview URL
      const response = await fetch(`/api/documents/${documentId}/view`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Preview error response:", errorText);
        toast.error(`Failed to load document preview: ${response.status}`);
        setPreviewOpen(false);
        return;
      }

      const blob = await response.blob();

      if (blob.size < 100) {
        // If blob is too small, it's probably an error message
        const text = await blob.text();
        console.error("Small blob content:", text);
        toast.error("Document appears to be corrupted or empty");
        setPreviewOpen(false);
        return;
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

  const goToUploadTab = () => {
    setActiveTab("upload");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "upload");
      window.history.pushState({}, "", url.toString());
    }
  };

  return (
    <div className="p-6">
      <div className="w-full space-y-6 max-w-4xl mx-auto">
        {/* Expiration Alerts */}
        {expiredDocuments.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Expired Documents</AlertTitle>
            <AlertDescription>
              {expiredDocuments.length} document
              {expiredDocuments.length > 1 ? "s have" : " has"} expired. Please
              update or remove them.
              <ul className="mt-2 list-disc list-inside">
                {expiredDocuments.slice(0, 5).map((doc) => (
                  <li key={doc.id}>
                    {doc.title} - Expired {getExpirationStatus(doc)?.days} day
                    {getExpirationStatus(doc)?.days !== 1 ? "s" : ""} ago
                  </li>
                ))}
                {expiredDocuments.length > 5 && (
                  <li>...and {expiredDocuments.length - 5} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {expiringSoonDocuments.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <Clock className="h-4 w-4" />
            <AlertTitle>Documents Expiring Soon</AlertTitle>
            <AlertDescription>
              {expiringSoonDocuments.length} document
              {expiringSoonDocuments.length > 1 ? "s are" : " is"} expiring
              within the next 30 days. Please review and update them.
              <ul className="mt-2 list-disc list-inside">
                {expiringSoonDocuments.slice(0, 5).map((doc) => (
                  <li key={doc.id}>
                    {doc.title} - Expires in {getExpirationStatus(doc)?.days}{" "}
                    day
                    {getExpirationStatus(doc)?.days !== 1 ? "s" : ""}
                  </li>
                ))}
                {expiringSoonDocuments.length > 5 && (
                  <li>...and {expiringSoonDocuments.length - 5} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Plan Selector (sticky per module + recents + scalable search) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Select Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <StickyPlanCombobox
              module="documents"
              plans={clients}
              value={selectedPlan}
              onChange={handlePlanChange}
              disabled={clients.length === 0}
              required
              label="Plan"
              id="documents-plan"
            />
            {!selectedPlan && clients.length > 0 && (
              <p className="text-sm text-amber-600 mt-2">
                Please select a plan to manage documents
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", value);
              window.history.pushState({}, "", url.toString());
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="preview">Document Preview</TabsTrigger>
            <TabsTrigger value="upload">Upload Documents</TabsTrigger>
            <TabsTrigger value="list">Document List</TabsTrigger>
          </TabsList>

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
                      className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${
                        isActive
                          ? "bg-[#002B5B] text-white border-[#002B5B]"
                          : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50"
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: "#002B5B",
                              borderColor: "#002B5B",
                            }
                          : { color: "#002B5B", borderColor: "#D1D5DB" }
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
              <DocumentsPreviewEmptyState
                selectedPlan={selectedPlan}
                isLoading={isLoading}
                sortedCount={sortedDocuments.length}
                filteredForPreviewCount={retirementDocs.length}
                previewLanguage={previewLanguage}
                onGoToUpload={goToUploadTab}
              />
            ) : (
              <DocumentPreviewTab
                selectedPlan={selectedPlan}
                isLoading={isLoading}
                documents={retirementDocs}
                onDelete={handleDeleteClick}
                onDownload={handleDownload}
                onDocumentsChange={fetchDocuments}
                onSaveEdit={handleSaveEdit}
              />
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <DocumentUploadTab
              selectedPlan={selectedPlan}
              showSaveButton={true}
              onHasUnsavedChangesChange={setHasUnsavedUploadChanges}
              onSaveFunctionReady={setUploadSaveFn}
              onDocumentsSaved={() => {
                setTimeout(() => {
                  fetchDocuments();
                }, 500);
              }}
            />

            {/* Document Preview with Language Switcher */}
            {sortedDocuments.length > 0 && (
              <div className="mt-6">
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
                              : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50"
                          }`}
                          style={
                            isActive
                              ? {
                                  backgroundColor: "#002B5B",
                                  borderColor: "#002B5B",
                                }
                              : { color: "#002B5B", borderColor: "#D1D5DB" }
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
                  <DocumentsPreviewEmptyState
                    selectedPlan={selectedPlan}
                    isLoading={isLoading}
                    sortedCount={sortedDocuments.length}
                    filteredForPreviewCount={retirementDocs.length}
                    previewLanguage={previewLanguage}
                    onGoToUpload={goToUploadTab}
                  />
                ) : (
                  <DocumentPreviewTab
                    selectedPlan={selectedPlan}
                    isLoading={isLoading}
                    documents={retirementDocs}
                    onDelete={handleDeleteClick}
                    onDownload={handleDownload}
                    onDocumentsChange={fetchDocuments}
                    onSaveEdit={handleSaveEdit}
                  />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <DocumentListTab
              selectedPlan={selectedPlan}
              isLoading={isLoading}
              documents={sortedDocuments}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onDelete={handleDeleteClick}
              getDocumentType={getDocumentType}
              onEdit={handleEditFromTable}
              onGoToUpload={goToUploadTab}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        description={
          documentToDelete
            ? `Are you sure you want to delete "${documentToDelete.title}"? This action cannot be undone and the document will be permanently removed.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

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

      {/* Document Edit Modal */}
      <DocumentEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setDocumentToEdit(null);
        }}
        document={documentToEdit}
        onSave={handleSaveEdit}
      />
      <NavigateAwayWarningDialog
        open={leaveGuard.dialogOpen}
        isSaving={leaveGuard.isSaving}
        isDiscarding={leaveGuard.isDiscarding}
        onStay={leaveGuard.stayAndKeepEditing}
        onSaveAndExit={leaveGuard.saveAndExit}
        onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
        onDialogOpenChange={leaveGuard.dialogOnOpenChange}
        onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
      />

    </div>
  );
}
