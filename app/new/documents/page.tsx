"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Clock, FileText, Download, Pencil, Trash2,
  Eye, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatUsDate } from "@/lib/date";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Sortable table header ──
function SortableTh({
  column,
  label,
  currentColumn,
  direction,
  onSort,
  className = "",
}: {
  column: string;
  label: string;
  currentColumn: string;
  direction: SortDirection;
  onSort: (col: string) => void;
  className?: string;
}) {
  const isActive = currentColumn === column;
  return (
    <th
      className={`px-3 py-3 text-left text-[0.6em] font-medium text-gray-500 dark:!text-gray-200 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 ${className}`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-gray-300 dark:text-gray-600" />
        )}
      </span>
    </th>
  );
}

export default function DocumentsPage() {
  const { setTitle } = usePageTitleContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [loadedCards, setLoadedCards] = useState<Set<string>>(new Set());
  const handleCardLoad = useCallback((docId: string) => {
    setLoadedCards((prev) => { const next = new Set(prev); next.add(docId); return next; });
  }, []);
  const [clientFilter, setClientFilter] = useState("all");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
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
    category?: string;
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

  const [docPreviews, setDocPreviews] = useState<Record<string, { blobUrl: string; loading: boolean }>>({});
  const [expandedRow, setExpandedRow] = useState<string>("");

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

  useEffect(() => {
    setTitle("Documents");
  }, [setTitle]);

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

  useEffect(() => {
    if (clients.length > 0) {
      updateURL(searchTerm, typeFilter, clientFilter);
    }
  }, [searchTerm, typeFilter, clientFilter, selectedPlan, activeSection, clients.length, searchParams]);

  const handlePlanChange = (clientId: string) => {
    setSelectedPlan(clientId);
    setClientFilter(clientId);
    setDocPreviews({});
    setExpandedRow("");
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
      if (!response.ok) { toast.error("Failed to download document"); return; }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch { toast.error("An error occurred while downloading the document"); }
  };

  const handleDeleteClick = (documentId: string, documentTitle: string) => {
    setDocumentToDelete({ id: documentId, title: documentTitle });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;
    if (documentToDelete.id === "__bulk__") {
      return handleBulkDeleteConfirm();
    }
    try {
      const response = await fetch(`/api/documents/${documentToDelete.id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Document deleted successfully!");
        setDocPreviews((prev) => { const next = { ...prev }; delete next[documentToDelete.id]; return next; });
        await fetchDocuments();
      } else toast.error("Failed to delete document");
    } catch { toast.error("An error occurred while deleting the document"); }
    finally { setDocumentToDelete(null); }
  };

  const getDocumentType = (doc: Document) => {
    if (doc.type) return doc.type;
    const titleLower = doc.title.toLowerCase();
    if (titleLower.includes("spd") || titleLower.includes("summary plan description") || titleLower.includes("plan highlights")) return "SPD";
    if (titleLower.includes("sbc") || titleLower.includes("summary of benefits")) return "SBC";
    return "Document";
  };

  const getExpirationStatus = (doc: Document) => {
    if (!doc.expirationDate) return null;
    const expirationDate = new Date(doc.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiration < 0) return { status: "expired", days: Math.abs(daysUntilExpiration) };
    if (daysUntilExpiration <= 30) return { status: "expiring_soon", days: daysUntilExpiration };
    return null;
  };

  const expiredDocuments = useMemo(() => documents.filter((doc) => getExpirationStatus(doc)?.status === "expired"), [documents]);
  const expiringSoonDocuments = useMemo(() => documents.filter((doc) => getExpirationStatus(doc)?.status === "expiring_soon"), [documents]);

  const sortedDocuments = [...documents].sort((a, b) => {
    const aType = getDocumentType(a);
    const bType = getDocumentType(b);
    const typeOrder = { SPD: 1, SBC: 2, Document: 3 };
    const typeDiff = (typeOrder[aType as keyof typeof typeOrder] || 3) - (typeOrder[bType as keyof typeof typeOrder] || 3);
    if (typeDiff !== 0) return typeDiff;
    let aValue: any = a[sortColumn];
    let bValue: any = b[sortColumn];
    if (sortColumn === "uploadedAt" || sortColumn === "expirationDate") { aValue = aValue ? new Date(aValue).getTime() : 0; bValue = bValue ? new Date(bValue).getTime() : 0; }
    else if (sortColumn === "client") { aValue = a.client.companyName?.toLowerCase() || ""; bValue = b.client.companyName?.toLowerCase() || ""; }
    else { aValue = aValue?.toString().toLowerCase() || ""; bValue = bValue?.toString().toLowerCase() || ""; }
    return (sortDirection === "asc" ? 1 : -1) * (aValue > bValue ? 1 : aValue < bValue ? -1 : 0);
  });

  const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
    const languages = new Set<"EN" | "ES">();
    sortedDocuments.forEach((doc) => { const lang = (doc as any).language; if (lang === "ES" || lang === "EN") languages.add(lang); else languages.add("EN"); });
    return Array.from(languages).sort((a, b) => (a === "EN" && b === "ES" ? -1 : a === "ES" && b === "EN" ? 1 : 0));
  }, [sortedDocuments]);

  useEffect(() => { if (availableLanguages.length > 0 && !availableLanguages.includes(previewLanguage)) setPreviewLanguage(availableLanguages[0]); }, [availableLanguages, previewLanguage]);

  const retirementDocs = useMemo<RetirementDocumentItem[]>(() => {
    const mappedDocs = sortedDocuments.map((doc) => {
      const docType = getDocumentType(doc);
      const docLanguage = (doc as any).language;
      const language = (docLanguage === "ES" || docLanguage === "EN" ? docLanguage : "EN") as "EN" | "ES";
      return {
        id: doc.id, title: doc.title,
        description: (doc as any).shortDescription || doc.fileName || doc.title,
        href: `/api/documents/${doc.id}/view?t=${doc.uploadedAt}`,
        language, category: (doc as any).category ?? undefined,
        categorySuggested: (doc as any).categorySuggested ?? undefined,
        categoryConfidence: (doc as any).categoryConfidence ?? undefined,
        expirationDate: doc.expirationDate,
        meta: { type: docType, client: { id: doc.client.id, companyName: doc.client.companyName }, uploadedAt: doc.uploadedAt },
        onEdit: undefined, onDelete: () => handleDeleteClick(doc.id, doc.title), onDownload: () => handleDownload(doc.id, doc.fileName),
      };
    });
    return mappedDocs.filter((doc) => doc.language === previewLanguage).sort((a, b) => (a.language === "EN" && b.language === "ES" ? -1 : a.language === "ES" && b.language === "EN" ? 1 : 0));
  }, [sortedDocuments, previewLanguage]);

  const filteredDocs = useMemo(() => {
    return retirementDocs.filter((doc) => {
      const docType = (doc.meta?.type as string) || "Document";
      const docCategory = (doc as any).category as string | undefined;
      const docLanguage = (doc as any).language as string | undefined;
      if (typeFilter !== "all" && docType !== typeFilter) return false;
      if (categoryFilter !== "all" && docCategory !== categoryFilter) return false;
      if (languageFilter !== "all" && docLanguage !== languageFilter) return false;
      return true;
    });
  }, [retirementDocs, typeFilter, categoryFilter, languageFilter]);

  const handleRowExpand = useCallback(async (docId: string) => {
    if (expandedRow === docId) { setExpandedRow(""); return; }
    setExpandedRow(docId);
    if (docPreviews[docId]) return;
    setDocPreviews((prev) => ({ ...prev, [docId]: { blobUrl: "", loading: true } }));
    try {
      const response = await fetch(`/api/documents/${docId}/view`);
      if (response.ok) { const blob = await response.blob(); const blobUrl = URL.createObjectURL(blob); setDocPreviews((prev) => ({ ...prev, [docId]: { blobUrl, loading: false } })); }
      else setDocPreviews((prev) => ({ ...prev, [docId]: { blobUrl: "", loading: false } }));
    } catch { setDocPreviews((prev) => ({ ...prev, [docId]: { blobUrl: "", loading: false } })); }
  }, [expandedRow, docPreviews]);

  const handlePreviewFromTable = async (documentId: string, documentTitle: string) => {
    setIsLoadingPreview(true);
    setPreviewOpen(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/view`);
      if (!response.ok) { toast.error(`Failed to load document preview: ${response.status}`); setPreviewOpen(false); return; }
      const blob = await response.blob();
      if (blob.size < 100) { toast.error("Document appears to be corrupted or empty"); setPreviewOpen(false); return; }
      const blobUrl = URL.createObjectURL(blob);
      setPreviewDocument({ id: documentId, title: documentTitle, blobUrl });
    } catch { toast.error("Failed to load document preview"); setPreviewOpen(false); }
    finally { setIsLoadingPreview(false); }
  };

  const handleSaveEdit = async (docId: string, title: string, description: string, file?: File, category?: string) => {
    try {
      if (file && selectedPlan) {
        try {
          const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
          const key = await uploadFileToR2({ file, purpose: "document", clientId: selectedPlan, fileName: file.name, category: "other" });
          if (key) {
            const response = await fetch(`/api/documents/${docId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, shortDescription: description, storageKey: key, fileName: file.name, category }) });
            const result = await response.json();
            if (response.ok && result.success) { toast.success("Document updated successfully"); setDocPreviews((prev) => { const next = { ...prev }; delete next[docId]; return next; }); setTimeout(() => fetchDocuments(), 500); return; }
          }
        } catch (r2Err) { console.warn("[handleSaveEdit] R2 upload failed, falling back to FormData", r2Err); }
      }
      const formData = new FormData(); formData.append("title", title); formData.append("shortDescription", description); if (file) formData.append("file", file); if (category) formData.append("category", category);
      const response = await fetch(`/api/documents/${docId}`, { method: "PATCH", body: formData });
      const result = await response.json();
      if (response.ok && result.success) { toast.success("Document updated successfully"); setDocPreviews((prev) => { const next = { ...prev }; delete next[docId]; return next; }); setTimeout(() => fetchDocuments(), 500); }
      else { toast.error(result.error || "Failed to update document"); throw new Error(result.error || "Failed to update document"); }
    } catch (error) { console.error("Error updating document:", error); toast.error("An error occurred while updating the document"); throw error; }
  };

  const handleEditFromTable = (documentId: string) => {
    const doc = documents.find((d) => d.id === documentId);
    if (doc) { setDocumentToEdit({ id: doc.id, title: doc.title, description: (doc as any).shortDescription || "", fileName: doc.fileName, category: doc.category }); setEditModalOpen(true); }
  };

  const goToUploadTab = () => { setActiveSection("upload"); const url = new URL(window.location.href); url.searchParams.set("section", "upload"); window.history.pushState({}, "", url.toString()); };
  const goToDocumentsSection = () => { setActiveSection("documents"); const url = new URL(window.location.href); url.searchParams.set("section", "documents"); window.history.pushState({}, "", url.toString()); };

  const uniqueCategories = useMemo(() => { const cats = new Set<string>(); retirementDocs.forEach((doc) => { const cat = (doc as any).category as string | undefined; if (cat) cats.add(cat); }); return Array.from(cats).sort(); }, [retirementDocs]);

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocs((prev) => { const next = new Set(prev); if (next.has(docId)) next.delete(docId); else next.add(docId); return next; });
  };
  const toggleSelectAll = () => {
    setSelectedDocs((prev) => {
      if (prev.size === filteredDocs.length) return new Set();
      return new Set(filteredDocs.map((d) => d.meta?.id ?? d.id));
    });
  };
  const clearSelectedDocs = () => setSelectedDocs(new Set());
  const handleBulkDelete = async () => {
    if (selectedDocs.size === 0) return;
    setDocumentToDelete({ id: "__bulk__", title: `${selectedDocs.size} document${selectedDocs.size !== 1 ? "s" : ""}` });
    setDeleteDialogOpen(true);
  };
  const handleBulkDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteDialogOpen(false);
    let deleted = 0;
    try {
      for (const docId of selectedDocs) {
        const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
        if (response.ok) { deleted++; setDocPreviews((prev) => { const next = { ...prev }; delete next[docId]; return next; }); }
      }
      if (deleted > 0) { clearSelectedDocs(); await fetchDocuments(); }
      else toast.error("Failed to delete documents");
    } catch { toast.error("An error occurred while deleting documents"); }
    finally { setIsDeleting(false); setDeleteDialogOpen(false); setDocumentToDelete(null); }
  };

  return (
    <div className="p-6">
      <div className="w-full space-y-6 max-w-4xl mx-auto">
        {expiredDocuments.length > 0 && (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Documents Past Review Date</AlertTitle><AlertDescription>{expiredDocuments.length} document{expiredDocuments.length > 1 ? "s have" : " has"} passed their review date. Please update or remove them.<ul className="mt-2 list-disc list-inside">{expiredDocuments.slice(0, 5).map((doc) => (<li key={doc.id}>{doc.title} - {getExpirationStatus(doc)?.days} day{getExpirationStatus(doc)?.days !== 1 ? "s" : ""} past review date</li>))}{expiredDocuments.length > 5 && <li>...and {expiredDocuments.length - 5} more</li>}</ul></AlertDescription></Alert>
        )}
        {expiringSoonDocuments.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Clock className="h-4 w-4" /><AlertTitle>Documents Due for Review</AlertTitle><AlertDescription>{expiringSoonDocuments.length} document{expiringSoonDocuments.length > 1 ? "s are" : " is"} due for review within the next 30 days. Please review and update them.<ul className="mt-2 list-disc list-inside">{expiringSoonDocuments.slice(0, 5).map((doc) => (<li key={doc.id}>{doc.title} - Due for review in {getExpirationStatus(doc)?.days} day{getExpirationStatus(doc)?.days !== 1 ? "s" : ""}</li>))}{expiringSoonDocuments.length > 5 && <li>...and {expiringSoonDocuments.length - 5} more</li>}</ul></AlertDescription></Alert>
        )}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-2xl font-bold">Plan Documents</CardTitle></CardHeader>
          {!clientsData ? (
            <CardContent className="pb-3 space-y-3"><Skeleton className="h-10 w-full rounded-md" /><Skeleton className="h-4 w-64" /><div className="pt-4 space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-full" /><div className="space-y-2 pt-2">{[1, 2, 3, 4].map((i) => (<div key={i} className="flex items-center gap-3 py-2"><Skeleton className="h-5 w-5 shrink-0 rounded" /><div className="flex-1 min-w-0 space-y-1.5"><div className="flex items-center gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-12 rounded-full" /><Skeleton className="h-4 w-8 rounded-full" /></div><Skeleton className="h-3 w-72" /></div></div>))}</div></div></CardContent>
          ) : (
            <>
              <CardContent className="pb-3"><StickyPlanCombobox module="documents" plans={clients} value={selectedPlan} onChange={handlePlanChange} disabled={clients.length === 0} required label="Select a plan" id="documents-plan" className="w-full sm:flex sm:items-center sm:gap-3 [&>div.relative]:sm:flex-1" />{!selectedPlan && clients.length > 0 && <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">Please select a plan to manage documents.</p>}</CardContent>
              {selectedPlan && (<div className="px-6 flex gap-0 border-b dark:border-gray-700"><button type="button" onClick={goToUploadTab} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSection === "upload" ? "border-accent-blue text-accent-blue" : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 dark:hover:border-gray-600"}`}>Upload Documents</button><button type="button" onClick={goToDocumentsSection} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSection === "documents" ? "border-accent-blue text-accent-blue" : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 dark:hover:border-gray-600"}`}>View Documents</button></div>)}
              <CardContent className="pt-6">
                {!selectedPlan ? null : activeSection === "upload" ? (
                  <><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Upload Documents</h3><p className="text-sm text-muted-foreground mb-6">Upload retirement plan documents and forms for this client. After saving, they appear in the Documents section.</p><DocumentUploadTab selectedPlan={selectedPlan} showSaveButton={true} onHasUnsavedChangesChange={setHasUnsavedUploadChanges} onSaveFunctionReady={setUploadSaveFn} onDocumentsSaved={() => { toast.success("Document saved successfully"); setTimeout(async () => { await fetchDocuments(); setActiveSection("documents"); const url = new URL(window.location.href); url.searchParams.set("section", "documents"); window.history.pushState({}, "", url.toString()); }, 500); }} /></>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Documents List</h3>
                    <p className="text-sm text-muted-foreground">Review and manage all documents for this plan. Use the filters to narrow results, click column headers to sort, and expand rows to preview.</p>
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <div className="flex items-center gap-3 flex-wrap">
                        {availableLanguages.length > 1 && (
                          <div className="flex gap-2">
                            {availableLanguages.map((lang) => {
                              const isActive = previewLanguage === lang;
                              return (
                                <button key={lang} type="button" onClick={() => setPreviewLanguage(lang)}
                                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${isActive ? "bg-[#002B5B] text-white border-[#002B5B] dark:bg-blue-900 dark:border-blue-900" : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50 dark:bg-gray-800 dark:text-blue-300 dark:border-gray-600 dark:hover:bg-gray-700"}`}>
                                  {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}><SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem><SelectItem value="Retirement">Retirement</SelectItem><SelectItem value="Group Health">Group Health</SelectItem><SelectItem value="Group Life">Group Life</SelectItem><SelectItem value="Other Benefits">Other</SelectItem>{uniqueCategories.filter((c) => !["Retirement","Group Health","Group Life","Other Benefits"].includes(c)).map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select>
                        <Select value={languageFilter} onValueChange={(v) => setLanguageFilter(v)}><SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Language" /></SelectTrigger><SelectContent><SelectItem value="all">All Languages</SelectItem><SelectItem value="EN">English</SelectItem><SelectItem value="ES">Español</SelectItem></SelectContent></Select>
                        {filteredDocs.length !== retirementDocs.length && <span className="text-xs text-muted-foreground">{filteredDocs.length} of {retirementDocs.length} documents</span>}
                      </div>
                      <div className="flex items-center border rounded-md overflow-hidden dark:border-gray-600 shrink-0">
                        <button type="button" onClick={() => setViewMode("list")} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-accent-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}><List className="h-3.5 w-3.5 mr-1 inline" />List</button>
                        <button type="button" onClick={() => setViewMode("cards")} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-accent-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}><LayoutGrid className="h-3.5 w-3.5 mr-1 inline" />Cards</button>
                      </div>
                    </div>
                    {isLoading && sortedDocuments.length === 0 && (<div className="space-y-2 rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-900 p-4">{[1, 2, 3, 4].map((i) => (<div key={i} className="flex items-center gap-3 py-2"><Skeleton className="h-5 w-5 shrink-0 rounded" /><div className="flex-1 min-w-0 space-y-1.5"><div className="flex items-center gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-12 rounded-full" /><Skeleton className="h-4 w-8 rounded-full" /></div><Skeleton className="h-3 w-72" /></div></div>))}</div>)}
                    {!isLoading && sortedDocuments.length === 0 && (<div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50"><p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">No documents for this plan yet</p><p className="text-muted-foreground text-sm">Upload retirement plan documents for this client on the Upload tab. After you save, they will appear here.</p><Button type="button" onClick={goToUploadTab}>Upload documents</Button></div>)}
                    {!isLoading && sortedDocuments.length > 0 && retirementDocs.length === 0 && (<div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3"><p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">No documents in {previewLanguage === "EN" ? "English" : "Spanish"}</p><p className="text-muted-foreground text-sm">This plan has documents in another language. Use the language toggle above, or upload a {previewLanguage === "EN" ? "English" : "Spanish"} file on the Upload tab.</p><Button type="button" variant="outline" onClick={goToUploadTab}>Go to Upload</Button></div>)}
                    {!isLoading && retirementDocs.length > 0 && filteredDocs.length === 0 && (<div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3"><p className="text-gray-900 dark:text-gray-100 text-base font-semibold">No documents match the current filters</p><p className="text-muted-foreground text-sm">Try adjusting the type, category or language filters above.</p><Button size="sm" variant="outline" onClick={() => { setTypeFilter("all"); setCategoryFilter("all"); setLanguageFilter("all"); }}>Clear Filters</Button></div>)}
                    {/* Deleting loading indicator */}
                    {isDeleting && (
                      <div className="flex items-center justify-center rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-4 py-4 dark:border-accent-blue/20 dark:bg-accent-blue/10">
                        <div className="flex items-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent-blue border-t-transparent" />
                          <span className="text-sm font-medium text-accent-blue">Deleting documents...</span>
                        </div>
                      </div>
                    )}

                    {/* Bulk action bar */}
                    {selectedDocs.size > 0 && !isDeleting && (
                      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-800 dark:bg-red-900/20">
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">
                          {selectedDocs.size} document{selectedDocs.size !== 1 ? "s" : ""} selected
                        </span>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={clearSelectedDocs}>Clear</Button>
                          <Button type="button" variant="destructive" size="sm" className="text-xs h-7" onClick={handleBulkDelete}>Delete selected</Button>
                        </div>
                      </div>
                    )}

                    {filteredDocs.length > 0 && viewMode === "list" && (
                      <div className="rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                              <tr>
                                <th className="px-3 py-3 w-10">
                                  <Checkbox checked={selectedDocs.size === filteredDocs.length && filteredDocs.length > 0} onCheckedChange={() => toggleSelectAll()} />
                                </th>
                                <SortableTh column="title" label="Filename" currentColumn={sortColumn} direction={sortDirection} onSort={() => handleSort("title" as any)} />
                                <SortableTh column="category" label="Category" currentColumn={sortColumn} direction={sortDirection} onSort={() => handleSort("category" as any)} className="w-32" />
                                <SortableTh column="language" label="Language" currentColumn={sortColumn} direction={sortDirection} onSort={() => handleSort("language" as any)} className="w-24" />
                                <SortableTh column="expirationDate" label="Review Date" currentColumn={sortColumn} direction={sortDirection} onSort={() => handleSort("expirationDate")} className="w-28" />
                                <th className="px-3 py-3 text-left text-[0.6em] font-medium text-gray-500 dark:!text-gray-200 uppercase tracking-wider w-28">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {filteredDocs.map((doc) => {
                                const docId = doc.meta?.id ?? doc.id;
                                const docCategory = (doc as any).category as string | undefined;
                                const expiration = (doc as any).expirationDate as string | undefined;
                                return (
                                  <tr key={docId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-3 py-3 w-10">
                                      <Checkbox checked={selectedDocs.has(docId)} onCheckedChange={() => toggleSelectDoc(docId)} />
                                    </td>
                                    <td className="px-3 py-3">
                                      <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[280px]">{doc.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[280px]">{doc.description}</p>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3">
                                      <Badge className="text-[10px] h-5 px-1.5 bg-[#002B5B]/10 text-[#002B5B] dark:bg-blue-900/30 dark:text-blue-300 border-transparent">{docCategory || "—"}</Badge>
                                    </td>
                                    <td className="px-3 py-3">
                                      <Badge className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-transparent">{doc.language}</Badge>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-gray-600 dark:!text-gray-200 whitespace-nowrap">{expiration ? formatUsDate(expiration) : "—"}</td>
                                    <td className="px-3 py-3">
                                      <div className="flex items-center gap-0.5">
                                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="View" onClick={(e) => { e.stopPropagation(); handlePreviewFromTable(docId, doc.title); }}>
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={(e) => { e.stopPropagation(); handleEditFromTable(docId); }}>
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download" onClick={(e) => { e.stopPropagation(); handleDownload(docId, doc.title); }}>
                                          <Download className="h-3 w-3" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400" title="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteClick(docId, doc.title); }}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Card View — PDF preview embedded in each card */}
                    {filteredDocs.length > 0 && viewMode === "cards" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDocs.map((doc) => {
                          const docId = doc.meta?.id ?? doc.id;
                          const docCategory = (doc as any).category as string | undefined;
                          const expiration = (doc as any).expirationDate as string | undefined;
                          const docLanguage = (doc as any).language as string | undefined;
                          return (
                            <Card key={docId} className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                              {/* PDF Preview */}
                              <div className="h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative overflow-hidden group">
                                <div className={`absolute top-2 left-2 z-10 transition-opacity ${selectedDocs.has(docId) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                  <Checkbox checked={selectedDocs.has(docId)} onCheckedChange={() => toggleSelectDoc(docId)} className="bg-white/90 dark:bg-gray-800/90" />
                                </div>
                                {!loadedCards.has(docId) && (
                                  <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent-blue border-t-transparent" />
                                    <span className="text-xs">Loading preview...</span>
                                  </div>
                                )}
                                <embed
                                  src={`/api/documents/${docId}/view#toolbar=0&navpanes=0`}
                                  className={`w-full h-full border-0 ${!loadedCards.has(docId) ? "absolute inset-0 opacity-0" : ""}`}
                                  type="application/pdf"
                                  onLoad={() => handleCardLoad(docId)}
                                />
                              </div>
                              {/* Card body */}
                              <CardContent className="p-4 space-y-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{doc.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{doc.description}</p>
                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  <Badge className="text-[10px] h-5 px-1.5 bg-[#002B5B]/10 text-[#002B5B] dark:bg-blue-900/30 dark:text-blue-300 border-transparent">{docCategory || "—"}</Badge>
                                  {docLanguage && (
                                    <Badge className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-transparent">{docLanguage}</Badge>
                                  )}
                                  {expiration && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto">{formatUsDate(expiration)}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 pt-1 border-t border-gray-100 dark:border-gray-700">
                                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="View" onClick={(e) => { e.stopPropagation(); handlePreviewFromTable(docId, doc.title); }}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={(e) => { e.stopPropagation(); handleEditFromTable(docId); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download" onClick={(e) => { e.stopPropagation(); handleDownload(docId, doc.title); }}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 ml-auto text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400" title="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteClick(docId, doc.title); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title="Delete Document" description={documentToDelete ? `Are you sure you want to delete "${documentToDelete.title}"? This action cannot be undone and the document will be permanently removed.` : ""} confirmText="Delete" cancelText="Cancel" variant="destructive" />
      <DocumentPreviewModal isOpen={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewDocument(null); }} document={previewDocument} isLoading={isLoadingPreview} />
      <DocumentEditModal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setDocumentToEdit(null); }} document={documentToEdit} onSave={handleSaveEdit} />
      <NavigateAwayWarningDialog open={leaveGuard.dialogOpen} isSaving={leaveGuard.isSaving} isDiscarding={leaveGuard.isDiscarding} onStay={leaveGuard.stayAndKeepEditing} onSaveAndExit={leaveGuard.saveAndExit} onDiscardWithoutSaving={leaveGuard.discardWithoutSaving} onDialogOpenChange={leaveGuard.dialogOnOpenChange} onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose} />
    </div>
  );
}
