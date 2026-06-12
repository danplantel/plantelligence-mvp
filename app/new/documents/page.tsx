"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { AlertTriangle, Clock, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { DocumentPreviewModal } from "@/components/pages/documents/components/document-preview-modal";
import { DocumentEditModal } from "@/components/pages/documents/components/document-edit-modal";
import { DocumentUploadTab } from "@/components/pages/documents/tabs/document-upload-tab";
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
import { Badge } from "@/components/ui/badge";
import { formatUsDate } from "@/lib/date";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Document Accordion Header (rendered inside AccordionTrigger) ──
function DocumentAccordionHeader({
  doc,
  docType,
  onEdit,
  onDelete,
  onDownload,
}: {
  doc: RetirementDocumentItem;
  docType: string;
  onEdit: (docId: string, title: string) => void;
  onDelete: (docId: string, title: string) => void;
  onDownload: (docId: string, fileName: string) => void;
}) {
  const handleAction = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  return (
    <div className="flex items-center gap-3 w-full pr-4">
      {/* Document info */}
      <FileText className="h-5 w-5 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
            {doc.title}
          </span>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-gray-200 text-gray-600">
            {docType}
          </Badge>
          <Badge className="text-[10px] h-5 px-1.5 bg-[#002B5B]/10 text-[#002B5B] border-transparent">
            {doc.language}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {doc.meta?.uploadedAt ? formatUsDate(doc.meta.uploadedAt) : ""}
          {" · "}
          {doc.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Edit"
          onClick={(e) =>
            handleAction(e, () =>
              onEdit(doc.meta?.id ?? doc.id, doc.title),
            )
          }
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Download"
          onClick={(e) =>
            handleAction(e, () => onDownload(doc.meta?.id ?? doc.id, doc.title))
          }
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          title="Delete"
          onClick={(e) =>
            handleAction(e, () =>
              onDelete(doc.meta?.id ?? doc.id, doc.title),
            )
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Inline Document Preview (embedded inside AccordionContent) ──
function DocumentAccordionPreview({
  docId,
  preview,
}: {
  docId: string;
  preview: { blobUrl: string; loading: boolean } | undefined;
}) {
  if (!preview) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue" />
      </div>
    );
  }

  if (preview.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue" />
        <span className="ml-2 text-sm text-gray-500">Loading preview…</span>
      </div>
    );
  }

  if (!preview.blobUrl) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-gray-500">Could not load document preview.</p>
      </div>
    );
  }

  return (
    <iframe
      src={`${preview.blobUrl}#view=FitH`}
      className="w-full h-[70vh] border border-gray-200 rounded-md"
      title="Document preview"
    />
  );
}

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
  const [activeSection, setActiveSection] = useState<"upload" | "documents">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "upload") return "upload";
    }
    return "documents";
  });
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [hasUnsavedUploadChanges, setHasUnsavedUploadChanges] = useState(false);
  const [uploadSaveFn, setUploadSaveFn] = useState<(() => Promise<void>) | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<"EN" | "ES">("EN");

  // Accordion state — single accordion open at a time
  const [openAccordion, setOpenAccordion] = useState<string>("");
  const [docPreviews, setDocPreviews] = useState<Record<string, { blobUrl: string; loading: boolean }>>({});

  const leaveGuard = useNavigateAwayGuard({
    enabled: true,
    hasUnsavedChanges: activeSection === "upload" && hasUnsavedUploadChanges,
    onSaveAndExit: async () => {
      if (!uploadSaveFn) {
        throw new Error("No save action is available yet for uploaded documents.");
      }
      await uploadSaveFn();
      setHasUnsavedUploadChanges(false);
      await fetchDocuments();
    },
  });

  // SWR: clients list
  const clientsKey =
    "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc";
  const { data: clientsData } = useSWR(clientsKey, jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const clients: Client[] = useMemo(
    () =>
      ((clientsData?.data as Client[]) ?? []).filter(
        (c) => (c.status ?? "Active") !== "Archived",
      ),
    [clientsData],
  );

  // SWR: documents
  const docsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (typeFilter !== "all") params.append("type", typeFilter);
    if (clientFilter !== "all") params.append("clientId", clientFilter);
    return `/api/documents?${params.toString()}`;
  }, [searchTerm, typeFilter, clientFilter]);

  const {
    data: docsData,
    mutate: refreshDocsSWR,
  } = useSWR(docsKey, jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    onSuccess: () => setIsLoading(false),
    onError: () => {
      toast.error("Failed to fetch documents");
      setIsLoading(false);
    },
  });
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
    params.set("section", activeSection);

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

    if (tabParam === "upload") setActiveSection("upload");
    else if (tabParam && ["preview", "list"].includes(tabParam)) setActiveSection("documents");

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

  // Update URL when filters change
  useEffect(() => {
    if (clients.length > 0) {
      updateURL(searchTerm, typeFilter, clientFilter);
    }
  }, [searchTerm, typeFilter, clientFilter, selectedPlan, activeSection, clients.length, searchParams]);

  const handlePlanChange = (clientId: string) => {
    setSelectedPlan(clientId);
    setClientFilter(clientId);
    // Clear cached previews when switching plans
    setDocPreviews({});
    setOpenAccordion("");
    const params = new URLSearchParams(window.location.search);
    params.set("planId", clientId);
    router.replace(`/new/documents?${params.toString()}`);
  };

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
      const response = await fetch(`/api/documents/${documentId}/view`);
      if (!response.ok) {
        toast.error("Failed to download document");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
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
        // Remove from preview cache
        setDocPreviews((prev) => {
          const next = { ...prev };
          delete next[documentToDelete.id];
          return next;
        });
        fetchDocuments();
      } else {
        toast.error("Failed to delete document");
      }
    } catch {
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
    ) return "SPD";
    if (
      titleLower.includes("sbc") ||
      titleLower.includes("summary of benefits")
    ) return "SBC";
    return "Document";
  };

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
    const aType = getDocumentType(a);
    const bType = getDocumentType(b);
    const typeOrder = { SPD: 1, SBC: 2, Document: 3 };
    const typeDiff =
      (typeOrder[aType as keyof typeof typeOrder] || 3) -
      (typeOrder[bType as keyof typeof typeOrder] || 3);
    if (typeDiff !== 0) return typeDiff;

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

  const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
    const languages = new Set<"EN" | "ES">();
    sortedDocuments.forEach((doc) => {
      const lang = (doc as any).language;
      if (lang === "ES" || lang === "EN") {
        languages.add(lang);
      } else {
        languages.add("EN");
      }
    });
    return Array.from(languages).sort((a, b) => {
      if (a === "EN" && b === "ES") return -1;
      if (a === "ES" && b === "EN") return 1;
      return 0;
    });
  }, [sortedDocuments]);

  useEffect(() => {
    if (availableLanguages.length > 0) {
      if (!availableLanguages.includes(previewLanguage)) {
        setPreviewLanguage(availableLanguages[0]);
      }
    }
  }, [availableLanguages, previewLanguage]);

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
        onEdit: undefined,
        onDelete: () => handleDeleteClick(doc.id, doc.title),
        onDownload: () => handleDownload(doc.id, doc.fileName),
      };
    });

    return mappedDocs
      .filter((doc) => doc.language === previewLanguage)
      .sort((a, b) => {
        if (a.language === "EN" && b.language === "ES") return -1;
        if (a.language === "ES" && b.language === "EN") return 1;
        return 0;
      });
  }, [sortedDocuments, previewLanguage]);

  // ── Lazy-load document preview when accordion opens ──
  const handleAccordionChange = useCallback(
    async (value: string) => {
      setOpenAccordion(value);
      if (!value) return;

      const docId = value;

      // Skip if already fetched or loading
      if (docPreviews[docId]) return;

      setDocPreviews((prev) => ({
        ...prev,
        [docId]: { blobUrl: "", loading: true },
      }));

      try {
        const response = await fetch(`/api/documents/${docId}/view`);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setDocPreviews((prev) => ({
            ...prev,
            [docId]: { blobUrl, loading: false },
          }));
        } else {
          setDocPreviews((prev) => ({
            ...prev,
            [docId]: { blobUrl: "", loading: false },
          }));
        }
      } catch {
        setDocPreviews((prev) => ({
          ...prev,
          [docId]: { blobUrl: "", loading: false },
        }));
      }
    },
    [docPreviews],
  );

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
              // Clear cached preview so it reloads
              setDocPreviews((prev) => {
                const next = { ...prev };
                delete next[docId];
                return next;
              });
              setTimeout(() => {
                fetchDocuments();
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
      if (file) formData.append("file", file);

      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Document updated successfully");
        setDocPreviews((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
        setTimeout(() => {
          fetchDocuments();
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

  const handleEditFromAccordion = (documentId: string, title: string) => {
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

  const handlePreview = async (documentIdOrDoc: string | RetirementDocumentItem, title?: string) => {
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
    setActiveSection("upload");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", "upload");
      window.history.pushState({}, "", url.toString());
    }
  };

  const goToDocumentsSection = () => {
    setActiveSection("documents");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", "documents");
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

        {/* ── Combined Plan Selector + Sections ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl font-bold">Plan Documents</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <StickyPlanCombobox
              module="documents"
              plans={clients}
              value={selectedPlan}
              onChange={handlePlanChange}
              disabled={clients.length === 0}
              required
              label="Select a plan"
              id="documents-plan"
            />
            {!selectedPlan && clients.length > 0 && (
              <p className="text-sm text-amber-600 mt-2">
                Please select a plan to manage documents.
              </p>
            )}
          </CardContent>

          {/* Section toggle tabs */}
          {selectedPlan && (
            <div className="px-6 flex gap-0 border-b">
              <button
                type="button"
                onClick={goToUploadTab}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeSection === "upload"
                    ? "border-[#002B5B] text-[#002B5B]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                }`}
              >
                Upload Documents
              </button>
              <button
                type="button"
                onClick={goToDocumentsSection}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeSection === "documents"
                    ? "border-[#002B5B] text-[#002B5B]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                }`}
              >
                Documents
              </button>
            </div>
          )}

          <CardContent className="pt-6">
            {!selectedPlan ? null : activeSection === "upload" ? (
              <>
                {/* Info banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3 mb-6">
                  <div className="text-blue-500 mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      Upload retirement plan documents and forms here. After saving, they appear in the Documents tab and on the Benefits Hub.
                    </p>
                  </div>
                </div>
                <DocumentUploadTab
                  selectedPlan={selectedPlan}
                  showSaveButton={true}
                  onHasUnsavedChangesChange={setHasUnsavedUploadChanges}
                  onSaveFunctionReady={setUploadSaveFn}
                  onDocumentsSaved={() => {
                    toast.success("Document saved successfully");
                    // Re-fetch the document list first, then navigate once data is ready.
                    setTimeout(async () => {
                      await fetchDocuments();
                      setActiveSection("documents");
                      if (typeof window !== "undefined") {
                        const url = new URL(window.location.href);
                        url.searchParams.set("section", "documents");
                        window.history.pushState({}, "", url.toString());
                      }
                    }, 500);
                  }}
                />
              </>
            ) : (
              /* ── Documents Accordion Section (merged Preview + List) ── */
              <div className="space-y-4">
                {/* Info banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3">
                  <div className="text-blue-500 mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      This is how the documents will display on the Benefits Hub. Expand any document to preview its contents. You can edit titles, descriptions, download, or delete documents using the buttons on each card.
                    </p>
                  </div>
                </div>
                {/* Language Switcher */}
                {availableLanguages.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((lang) => {
                      const isActive = previewLanguage === lang;
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setPreviewLanguage(lang)}
                          className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${
                            isActive
                              ? "bg-[#002B5B] text-white border-[#002B5B]"
                              : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50"
                          }`}
                          style={
                            isActive
                              ? { backgroundColor: "#002B5B", borderColor: "#002B5B" }
                              : { color: "#002B5B", borderColor: "#D1D5DB" }
                          }
                        >
                          {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Skeleton loading state */}
                {isLoading && sortedDocuments.length === 0 && (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue" />
                      <span className="text-gray-600">Loading documents…</span>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!isLoading && sortedDocuments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80">
                    <p className="text-gray-900 text-lg font-semibold">
                      No documents for this plan yet
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Upload retirement plan documents for this client on the Upload tab.
                      After you save, they will appear here.
                    </p>
                    <Button type="button" onClick={goToUploadTab}>
                      Upload documents
                    </Button>
                  </div>
                )}

                {/* Wrong-language-only empty state */}
                {!isLoading && sortedDocuments.length > 0 && retirementDocs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                    <p className="text-gray-900 text-lg font-semibold">
                      No documents in {previewLanguage === "EN" ? "English" : "Spanish"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      This plan has documents in another language. Use the language toggle
                      above, or upload a{" "}
                      {previewLanguage === "EN" ? "English" : "Spanish"} file on the Upload
                      tab.
                    </p>
                    <Button type="button" variant="outline" onClick={goToUploadTab}>
                      Go to Upload
                    </Button>
                  </div>
                )}

                {/* Accordion List */}
                {retirementDocs.length > 0 && (
                  <Accordion
                    type="single"
                    collapsible
                    value={openAccordion}
                    onValueChange={handleAccordionChange}
                    className="border rounded-lg bg-white"
                  >
                    {retirementDocs.map((doc) => {
                      const docId = doc.meta?.id ?? doc.id;
                      const docType = (doc.meta?.type as string) ?? "Document";
                      const preview = docPreviews[docId];

                      return (
                        <AccordionItem
                          key={docId}
                          value={docId}
                          className="px-4 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <DocumentAccordionHeader
                              doc={doc}
                              docType={docType}
                              onEdit={handleEditFromAccordion}
                              onDelete={handleDeleteClick}
                              onDownload={handleDownload}
                            />
                          </AccordionTrigger>
                          <AccordionContent>
                            <DocumentAccordionPreview docId={docId} preview={preview} />
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* Document Preview Modal (kept for full-screen preview from other entry points) */}
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
