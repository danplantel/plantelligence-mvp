"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, CalendarDays, Clock, FileText, Download, Loader2, Pencil, Save, Trash2,
  Eye, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List, Search, GripVertical, ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RetirementDocumentsAccordion, RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { DocumentPreviewModal } from "@/components/pages/documents/components/document-preview-modal";
import { DocumentEditModal } from "@/components/pages/documents/components/document-edit-modal";
import { DocumentUploadTab } from "@/components/pages/documents/tabs/document-upload-tab";
import { DocumentsCalendarView } from "@/components/pages/documents/views/documents-calendar-view";
import type {
  Document,
  SortColumn,
  SortDirection,
  Client,
} from "@/components/pages/documents/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getLastPlanId,
  getRecentPlanIds,
  persistPlanSelection,
  resolveStickyPlanId,
} from "@/lib/plan-selector-storage";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";
import { Button } from "@/components/ui/button";
import { getBenefitsHubOpenPortalUrl } from "@/lib/marketing/hub-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatUsDate } from "@/lib/date";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

// Sortable table header
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

// Plan search bar (replaces StickyPlanCombobox)
function PlanSearchBar({
  plans,
  value,
  onChange,
  disabled,
  userSubdomain,
}: {
  plans: Client[];
  value: string;
  onChange: (planId: string) => void;
  disabled?: boolean;
  userSubdomain?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const recentIds = getRecentPlanIds();
  const planMap = useMemo(() => {
    const m = new Map<string, Client>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  // Resolve recent plan objects from localStorage recents list
  const recentPlanObjects = useMemo(() => {
    const result: Client[] = [];
    const seen = new Set<string>();
    for (const id of recentIds) {
      const p = planMap.get(id);
      if (p && !seen.has(id)) {
        result.push(p);
        seen.add(id);
      }
    }
    return result;
  }, [recentIds, planMap]);

  const isCurrentPlan = useCallback(
    (id: string) => value === id,
    [value],
  );

  // Dropdown items: all plans sorted with recents first, filtered by query when typing
  const allPlansSorted = useMemo(() => {
    const recentSet = new Set(recentPlanObjects.map((p) => p.id));
    const recents: Client[] = [];
    const others: Client[] = [];
    for (const p of plans) {
      if (recentSet.has(p.id)) {
        recents.push(p);
      } else {
        others.push(p);
      }
    }
    others.sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" }));
    return [...recents, ...others];
  }, [plans, recentPlanObjects]);

  const dropdownItems = useMemo(() => {
    if (!query.trim()) return allPlansSorted;
    const q = query.toLowerCase();
    return allPlansSorted.filter((p) => p.companyName.toLowerCase().includes(q));
  }, [query, allPlansSorted]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === value),
    [plans, value],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [dropdownItems.length, open]);

  const selectPlan = (planId: string) => {
    persistPlanSelection("documents", planId);
    onChange(planId);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (dropdownItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % dropdownItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + dropdownItems.length) % dropdownItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = dropdownItems[highlight];
      if (item) selectPlan(item.id);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-2xl font-bold shrink-0">View Documents</CardTitle>
        </div>
        {value && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const slug =
                (selectedPlan as any)?.slug;
              const resolvedSlug = slug || value;
              const url = getBenefitsHubOpenPortalUrl(
                resolvedSlug,
                userSubdomain,
              );
              window.open(url, "_blank");
            }}
            className="gap-1.5 shrink-0 text-white bg-accent-blue hover:bg-accent-blue/80"
          >
            <ExternalLink className="h-4 w-4" />
            Open Portal
          </Button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search for a plan"
          value={query}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="h-9 pl-9 pr-3 bg-white dark:bg-gray-800"
          aria-label="Search plans"
          aria-expanded={open}
          aria-haspopup="listbox"
          autoComplete="off"
        />
      </div>

      {/* Recent Plans chips (same style as benefits page) */}
      {recentPlanObjects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Clock className="size-3 text-gray-400 shrink-0" />
          {recentPlanObjects.slice(0, 5).map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => selectPlan(plan.id)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                isCurrentPlan(plan.id)
                  ? "bg-[#23919C]/10 text-[#23919C] border-[#23919C]/30"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 text-muted-foreground dark:border-gray-600 dark:hover:border-[#23919C]/50",
              )}
            >
              {plan.companyName}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              className="rounded-md border border-input bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50"
              style={{
                position: "fixed",
                top: (containerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                left: containerRef.current?.getBoundingClientRect().left ?? 0,
                width: containerRef.current?.getBoundingClientRect().width ?? 300,
                maxHeight: 288,
              }}
            >
              {query.trim() && (
                <div className="px-3 py-1.5 border-b border-border/60">
                  <p className="text-xs text-muted-foreground">
                    {dropdownItems.length} plan{dropdownItems.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              )}
              <div className="overflow-y-auto max-h-[256px] py-1">
                {dropdownItems.length > 0 && (
                  <>
                    {/* Recent plans section */}
                    {recentPlanObjects.length > 0 && (
                      <div className="px-2 pb-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                          <Clock className="h-3 w-3" />
                          Recent
                        </div>
                        {recentPlanObjects.map((plan, idx) => {
                          const isHi = highlight === idx;
                          return (
                            <button
                              key={`r-${plan.id}`}
                              type="button"
                              role="option"
                              aria-selected={value === plan.id}
                              className={cn(
                                "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                isHi && "bg-accent-blue/10 text-accent-blue font-medium",
                                !isHi && "hover:bg-muted",
                              )}
                              onClick={() => selectPlan(plan.id)}
                              onMouseEnter={() => setHighlight(idx)}
                            >
                              {plan.companyName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* All other plans */}
                    {dropdownItems.length > recentPlanObjects.length && (
                      <div className={cn("px-2", recentPlanObjects.length > 0 && "pt-1 border-t border-border/60")}>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                          {query.trim() ? "Matching plans" : "All plans"}
                        </div>
                        {dropdownItems.slice(recentPlanObjects.length).map((plan, idx) => {
                          const globalIdx = recentPlanObjects.length + idx;
                          const isHi = highlight === globalIdx;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              role="option"
                              aria-selected={value === plan.id}
                              className={cn(
                                "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                isHi && "bg-accent-blue/10 text-accent-blue font-medium",
                                !isHi && "hover:bg-muted",
                              )}
                              onClick={() => selectPlan(plan.id)}
                              onMouseEnter={() => setHighlight(globalIdx)}
                            >
                              {plan.companyName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                {dropdownItems.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {query.trim() ? "No plans match your search." : "No plans available."}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function DocumentsPage() {
  const { setTitle, setSubtitle } = usePageTitleContext();

  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const { data: profileData } = useSWR("/api/profile", jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const userSubdomain: string | undefined = profileData?.subdomain || undefined;
  // Initialize from localStorage so the default category is available immediately
  // on page reload, avoiding a visible flip from "All Categories" to the real default.
  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    try {
      return localStorage.getItem("plantelligence:defaultDocCategory") || "all";
    } catch {
      return "all";
    }
  });
  const [languageFilter, setLanguageFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "cards" | "calendar" | "preview">("list");
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
  // Plan-scoped documents loaded explicitly (brute-force) for the selected plan.
  // `isLoadingDocs` drives a spinner dialog while a plan switch reloads docs.
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsLoadedForPlan, setDocsLoadedForPlan] = useState<string | null>(null);
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
  const [isTransitioningToDocuments, setIsTransitioningToDocuments] = useState(false);
  const [docPreviews, setDocPreviews] = useState<Record<string, { blobUrl: string; loading: boolean }>>({});
  const [expandedRow, setExpandedRow] = useState<string>("");
  // Re-ordered document ids waiting to be persisted from the Document Preview.
  const [pendingOrderIds, setPendingOrderIds] = useState<string[] | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

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

  // Brute-force fetch of the selected plan's documents. Called explicitly on
  // every plan change (and after mutations via `fetchDocuments`) so the list
  // always reflects the active plan — no SWR key/staleness involved.
  const loadDocumentsForPlan = useCallback(
    async (planId: string, showSpinner: boolean) => {
      if (!planId) return;
      if (showSpinner) {
        // Clear stale rows immediately so the previous plan's documents can
        // never linger while the new plan's documents are being fetched.
        setDocuments([]);
        setDocsLoadedForPlan(null);
        setIsLoadingDocs(true);
      }
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.append("search", searchTerm);
        if (typeFilter !== "all") params.append("type", typeFilter);
        params.append("clientId", planId);
        const response = await fetch(`/api/documents?${params.toString()}`);
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to fetch documents");
        }
        const raw: Document[] = json?.data ?? [];
        const deduped = raw.filter(
          (doc, idx, arr) => arr.findIndex((d) => d.id === doc.id) === idx,
        );
        setDocuments(deduped);
        setDocsLoadedForPlan(planId);
      } catch (error) {
        console.error("Error fetching documents:", error);
        setDocuments([]);
        setDocsLoadedForPlan(null);
        toast.error("Failed to fetch documents");
      } finally {
        setIsLoading(false);
        if (showSpinner) setIsLoadingDocs(false);
      }
    },
    [searchTerm, typeFilter],
  );

  // Refetch the currently selected plan's documents (silent — used after
  // upload/delete/reorder/review-date mutations).
  const fetchDocuments = useCallback((): Promise<any> => {
    if (!selectedPlan) return Promise.resolve();
    return loadDocumentsForPlan(selectedPlan, false);
  }, [selectedPlan, loadDocumentsForPlan]);

  // Reload whenever the plan (or the server-side search/type filters) changes.
  // Switching plans triggers a fresh brute-force fetch with a spinner dialog.
  const docFetchKey = `${selectedPlan}::${searchTerm}::${typeFilter}`;
  const lastDocFetchKeyRef = useRef("");
  useEffect(() => {
    if (!selectedPlan) return;
    if (lastDocFetchKeyRef.current === docFetchKey) return;
    const switchingPlans = lastDocFetchKeyRef.current !== "";
    lastDocFetchKeyRef.current = docFetchKey;
    setDocPreviews({});
    setExpandedRow("");
    void loadDocumentsForPlan(selectedPlan, switchingPlans);
  }, [docFetchKey, selectedPlan, loadDocumentsForPlan]);

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
      ? `/documents?${params.toString()}`
      : "/documents";
    router.replace(newURL);
  };

  // NOTE: Default category filter is intentionally kept as "all" (set in useState).
  // Auto-setting from primaryServiceCategories was removed because it filtered out
  // documents whose category didn't match the user's default service category,
  // causing documents to appear invisible until the user manually cleared the filter.

  useEffect(() => {
    setTitle("Documents");
  }, [setTitle]);

  // Show the selected plan's company name in the page header (next to the
  // "Documents" title) instead of inside the plan search bar.
  useEffect(() => {
    const plan = clients.find((c) => c.id === selectedPlan);
    setSubtitle(plan?.companyName ?? "");
  }, [clients, selectedPlan, setSubtitle]);

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
    // Don't auto-select a plan when there's neither a URL param nor a previously stored
    // selection (e.g. after logout + login where clearAllPlanSelections() was called).
    if (!urlPlanId && !getLastPlanId("documents")) return;
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
    // No-op when the same plan is already selected — avoids clearing the loaded
    // documents (the fetch effect won't re-run because the key is unchanged).
    if (clientId === selectedPlan) return;
    setSelectedPlan(clientId);
    setClientFilter(clientId);
    // Clear stale rows immediately so the previous plan's documents never flash
    // under the new plan header while the brute-force fetch runs. The
    // docFetchKey effect below performs the actual load (with a spinner).
    setDocuments([]);
    setDocsLoadedForPlan(null);
    setDocPreviews({});
    setExpandedRow("");
    const params = new URLSearchParams(window.location.search);
    params.set("planId", clientId);
    router.replace(`/documents?${params.toString()}`);
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
    return mappedDocs.sort((a, b) => (a.language === "EN" && b.language === "ES" ? -1 : a.language === "ES" && b.language === "EN" ? 1 : 0));
  }, [sortedDocuments]);

  const filteredDocs = useMemo(() => {
    return retirementDocs.filter((doc) => {
      const docType = (doc.meta?.type as string) || "Document";
      const docCategory = (doc as any).category as string | undefined;
      const docLanguage = (doc as any).language as string | undefined;
      if (typeFilter !== "all" && docType !== typeFilter) return false;
      if (categoryFilter !== "all") {
        // Support comma-separated categories: match if docCategory contains the filter value
        const docCategories = (docCategory || "").split(",").map((c) => c.trim()).filter(Boolean);
        if (!docCategories.includes(categoryFilter)) return false;
      }
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

  const handleUpdateDocumentReviewDate = async (
    docId: string,
    date: string | null,
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expirationDate: date }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(date ? "Review date updated" : "Review date cleared");
        setDocPreviews((prev) => { const next = { ...prev }; delete next[docId]; return next; });
        await fetchDocuments();
        return true;
      }
      toast.error(result.error || "Failed to update review date");
      return false;
    } catch {
      toast.error("An error occurred while updating the review date");
      return false;
    }
  };

  // ---- Document Preview reorder (persisted to the plan) ----
  // Order-preserving items that mirror hub ordering (list/cards still use type-sorted data).
  const previewOrderedDocs = useMemo<RetirementDocumentItem[]>(() => {
    return documents.map((doc) => {
      const docType = getDocumentType(doc);
      const docLanguage = (doc as any).language;
      const language = (docLanguage === "ES" || docLanguage === "EN" ? docLanguage : "EN") as "EN" | "ES";
      return {
        id: doc.id,
        title: doc.title,
        description: (doc as any).shortDescription || doc.fileName || doc.title,
        href: `/api/documents/${doc.id}/view?t=${doc.uploadedAt}`,
        language,
        category: (doc as any).category ?? undefined,
        categorySuggested: (doc as any).categorySuggested ?? undefined,
        categoryConfidence: (doc as any).categoryConfidence ?? undefined,
        expirationDate: doc.expirationDate,
        meta: {
          type: docType,
          client: { id: doc.client.id, companyName: doc.client.companyName },
          uploadedAt: doc.uploadedAt,
        },
      };
    });
  }, [documents]);

  const previewCurrentOrderIds = useMemo(
    () => previewOrderedDocs.map((d) => d.meta?.id || d.id).filter(Boolean) as string[],
    [previewOrderedDocs],
  );

  const orderDirty = useMemo(() => {
    if (!pendingOrderIds) return false;
    if (pendingOrderIds.length !== previewCurrentOrderIds.length) return true;
    return pendingOrderIds.some((id, i) => id !== previewCurrentOrderIds[i]);
  }, [pendingOrderIds, previewCurrentOrderIds]);

  const handlePreviewOrderChange = useCallback((docs: RetirementDocumentItem[]) => {
    setPendingOrderIds(docs.map((d) => d.meta?.id || d.id).filter(Boolean) as string[]);
  }, []);

  const revertPreviewOrder = useCallback(() => setPendingOrderIds(null), []);

  const saveDocumentOrder = useCallback(async () => {
    if (!pendingOrderIds || pendingOrderIds.length === 0) return;
    setIsSavingOrder(true);
    try {
      const response = await fetch("/api/documents/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: pendingOrderIds }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Document order saved");
        setPendingOrderIds(null);
        await fetchDocuments();
      } else {
        toast.error(result.error || "Failed to save document order");
      }
    } catch {
      toast.error("An error occurred while saving the document order");
    } finally {
      setIsSavingOrder(false);
    }
  }, [pendingOrderIds, fetchDocuments]);

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
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {!clientsData ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="relative">
                  <Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            ) : (
              <>
                <PlanSearchBar plans={clients} value={selectedPlan} onChange={handlePlanChange} disabled={clients.length === 0} userSubdomain={userSubdomain} />
              </>
            )}
          </CardContent>
              {selectedPlan && clientsData && (<div className="px-6 flex gap-0 border-b dark:border-gray-700"><button type="button" onClick={goToUploadTab} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSection === "upload" ? "border-accent-blue text-accent-blue" : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 dark:hover:border-gray-600"}`}>Upload Documents</button><button type="button" onClick={goToDocumentsSection} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSection === "documents" ? "border-accent-blue text-accent-blue" : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 dark:hover:border-gray-600"}`}>View Documents</button></div>)}
              {selectedPlan && clientsData && (
                <CardContent className="pt-6">
                  {activeSection === "upload" ? (
                  <><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Upload Documents</h3><p className="text-sm text-muted-foreground mb-2">
                    Upload PDFs for this Benefits Hub. Suggestions should be reviewed before publishing.</p>
                    <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                      <AlertDescription className="text-xs text-center text-blue-700 dark:text-blue-300">
                        You can upload up to 10 files at once. For larger batches, upload in groups of 10 or fewer.
                      </AlertDescription>
                    </Alert>
                    <DocumentUploadTab
                      selectedPlan={selectedPlan}
                      showSaveButton={false}
                      onHasUnsavedChangesChange={setHasUnsavedUploadChanges}
                      onSaveFunctionReady={setUploadSaveFn}
                      onDocumentsAdded={() => {
                        setIsTransitioningToDocuments(true);
                        setActiveSection("documents");
                        const url = new URL(window.location.href);
                        url.searchParams.set("section", "documents");
                        window.history.pushState({}, "", url.toString());
                      }}
                      onDocumentsSaved={() => {
                        fetchDocuments().then(() => {
                          setIsTransitioningToDocuments(false);
                          toast.success("Documents added successfully");
                        });
                      }}
                    /></>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Documents List</h3>
                    <p className="text-sm text-muted-foreground">Review and manage all documents for this plan. Use the filters to narrow results, click column headers to sort, and expand rows to preview.</p>
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}><SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all" disabled={viewMode === "preview"}>All Categories</SelectItem><SelectItem value="Retirement">Retirement</SelectItem><SelectItem value="Group Health">Group Health</SelectItem><SelectItem value="Group Life">Group Life</SelectItem><SelectItem value="Multiple" disabled={viewMode === "preview"}>Multiple</SelectItem><SelectItem value="Other Benefits" disabled={viewMode === "preview"}>Other</SelectItem>{uniqueCategories.filter((c) => !["Retirement","Group Health","Group Life","Multiple","Other Benefits"].includes(c)).map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select>
                        {/* Language toggle buttons — hidden while Preview is active because the
                            Preview accordion renders its own portal-style ENGLISH/ESPAÑOL switcher. */}
                        {viewMode !== "preview" && (
                        <div className="flex gap-1">
                          {(["EN", "ES"] as const).map((lang) => {
                            const isActive = languageFilter === lang;
                            const count = sortedDocuments.filter((doc) => {
                              const docLang = (doc as any).language;
                              return (docLang === lang || (!docLang && lang === "EN"));
                            }).length;
                            return (
                              <button
                                key={lang}
                                type="button"
                                onClick={() => setLanguageFilter(isActive ? "all" : lang)}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                                  isActive
                                    ? "bg-accent-blue text-white border-accent-blue"
                                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                {lang === "EN" ? `ENGLISH (${count})` : `ESPANOL (${count})`}
                              </button>
                            );
                          })}
                        </div>
                        )}
                        {viewMode !== "preview" && filteredDocs.length !== retirementDocs.length && <span className="text-xs text-muted-foreground">{filteredDocs.length} of {retirementDocs.length} documents</span>}
                      </div>
                      <div className="flex items-center border rounded-md overflow-hidden dark:border-gray-600 shrink-0">
                        <button type="button" onClick={() => setViewMode("list")} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-accent-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}><List className="h-3.5 w-3.5 mr-1 inline" />List</button>
                        <button type="button" onClick={() => setViewMode("cards")} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-accent-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}><LayoutGrid className="h-3.5 w-3.5 mr-1 inline" />Cards</button>
                        <button type="button" onClick={() => setViewMode("calendar")} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "calendar" ? "bg-accent-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}><CalendarDays className="h-3.5 w-3.5 mr-1 inline" />Calendar</button>
                        <button type="button" onClick={() => setViewMode("preview")} className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === "preview" ? "bg-accent-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}><Eye className="h-3.5 w-3.5 mr-1 inline" />Preview</button>
                      </div>
                    </div>
                    {viewMode === "calendar" ? (
                      <DocumentsCalendarView
                        documents={documents}
                        onPreview={(doc) => handlePreviewFromTable(doc.id, doc.title)}
                        onUpdateReviewDate={handleUpdateDocumentReviewDate}
                      />
                    ) : viewMode === "preview" ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-foreground">Document Preview</h3>
                              <p className="text-xs text-muted-foreground truncate">
                                This is how your documents appear to plan members on the Benefits Hub. Drag a document to reorder it.
                              </p>
                            </div>
                          </div>
                          {previewOrderedDocs.length > 0 && (
                            <div className="flex shrink-0 items-center gap-2">
                              {orderDirty && (
                                <Button type="button" size="sm" variant="outline" disabled={isSavingOrder} onClick={revertPreviewOrder}>
                                  Revert
                                </Button>
                              )}
                              <Button type="button" size="sm" className="gap-1.5" disabled={!orderDirty || isSavingOrder} onClick={saveDocumentOrder}>
                                {isSavingOrder ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                                Save order
                              </Button>
                            </div>
                          )}
                        </div>
                        {previewOrderedDocs.length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-muted/20 px-4 py-16 text-center">
                            <FileText className="h-10 w-10 text-muted-foreground/50" />
                            <p className="mt-3 text-sm text-muted-foreground">No documents available for preview.</p>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-xl border border-border/60">
                            <RetirementDocumentsAccordion
                              retirementDocs={previewOrderedDocs}
                              reorderable
                              onOrderChange={handlePreviewOrderChange}
                              brandColor={clients.find((c) => c.id === selectedPlan) ? ((clients.find((c) => c.id === selectedPlan) as any).brandColor || "#1F3A60") : "#1F3A60"}
                              accentColor={clients.find((c) => c.id === selectedPlan) ? ((clients.find((c) => c.id === selectedPlan) as any).secondaryColor || "#6B7280") : "#6B7280"}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                    {!isLoading && !isLoadingDocs && docsLoadedForPlan === selectedPlan && sortedDocuments.length === 0 && (<div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50"><p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">No documents for this plan yet</p><p className="text-muted-foreground text-sm">Upload retirement plan documents for this client on the Upload tab. After you save, they will appear here.</p><Button type="button" onClick={goToUploadTab}>Upload documents</Button></div>)}
                    {!isLoading && !isLoadingDocs && docsLoadedForPlan === selectedPlan && sortedDocuments.length > 0 && retirementDocs.length === 0 && (<div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3"><p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">No documents in {languageFilter === "all" ? "English" : languageFilter === "EN" ? "English" : "Spanish"}</p><p className="text-muted-foreground text-sm">This plan has documents in another language. Use the language toggle above, or upload a file in the appropriate language on the Upload tab.</p><Button type="button" variant="outline" onClick={goToUploadTab}>Go to Upload</Button></div>)}
                    {!isLoading && !isLoadingDocs && docsLoadedForPlan === selectedPlan && retirementDocs.length > 0 && filteredDocs.length === 0 && (<div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3"><p className="text-gray-900 dark:text-gray-100 text-base font-semibold">No documents match the current filters</p><p className="text-muted-foreground text-sm">Try adjusting the type, category or language filters above.</p><Button size="sm" variant="outline" onClick={() => { setTypeFilter("all"); setCategoryFilter("all"); setLanguageFilter("all"); }}>Clear Filters</Button></div>)}
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
                                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate max-w-[280px]">{doc.title}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[280px]">{doc.description}</p>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3">
                                      <Badge
                                        className="text-[10px] h-5 px-1.5 bg-[#002B5B]/10 text-[#002B5B] hover:bg-[#002B5B] hover:text-white dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800 dark:hover:text-white border-transparent cursor-default transition-colors"
                                        title={docCategory?.includes(",") ? docCategory : undefined}
                                      >
                                        {docCategory && docCategory.includes(",") ? "Multiple" : docCategory || "â€”"}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-3">
                                      <Badge className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100 border-transparent">{doc.language}</Badge>
                                    </td>
                                    <td className="px-3 py-3 text-xs text-gray-600 dark:!text-gray-200 whitespace-nowrap">{expiration ? formatUsDate(expiration) : "â€”"}</td>
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

                    {/* Card View refactored without PDF preview, draggable */}
                    {filteredDocs.length > 0 && viewMode === "cards" && (
                      <DragDropContext onDragEnd={(result) => {
                        if (!result.destination) return;
                        const items = Array.from(filteredDocs);
                        const [reordered] = items.splice(result.source.index, 1);
                        items.splice(result.destination.index, 0, reordered);
                        // Reorder is local to the UI â€” items refilter when data re-fetches
                      }}>
                        <div className="space-y-2">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"/></svg>
                            Drag cards to reorder
                          </p>
                        <Droppable droppableId="documents-cards">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filteredDocs.map((doc, index) => {
                                const docId = doc.meta?.id ?? doc.id;
                                const docCategory = (doc as any).category as string | undefined;
                                const expiration = (doc as any).expirationDate as string | undefined;
                                const docLanguage = (doc as any).language as string | undefined;
                                return (
                                  <Draggable key={docId} draggableId={docId} index={index}>
                                    {(provided, snapshot) => (
                                      <Card
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`overflow-hidden dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow ${snapshot.isDragging ? "shadow-lg rotate-1 scale-105" : ""}`}
                                      >
                                        <CardContent className="p-5 space-y-4">
                                          {/* Checkbox + icon row */}
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-0">
                                              <span
                                                {...provided.dragHandleProps}
                                                title="Drag to reorder"
                                                className="cursor-grab active:cursor-grabbing p-2 -ml-1.5 rounded-md text-gray-500 hover:text-accent-blue hover:bg-accent-blue/10 dark:text-gray-400 dark:hover:text-accent-blue dark:hover:bg-accent-blue/20 border border-transparent hover:border-accent-blue/20 transition-colors"
                                              >
                                                <GripVertical className="w-6 h-6" />
                                              </span>
                                              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-accent-blue/10 dark:bg-accent-blue/20">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-6 h-6 text-accent-blue" fill="currentColor">
                                                  <path d="m433.798 106.268-96.423-91.222c-10.256-9.703-23.68-15.046-37.798-15.046h-183.577c-30.327 0-55 24.673-55 55v402c0 30.327 24.673 55 55 55h280c30.327 0 55-24.673 55-55v-310.778c0-15.049-6.27-29.612-17.202-39.954zm-29.137 13.732h-74.661c-2.757 0-5-2.243-5-5v-70.364zm-8.661 362h-280c-13.785 0-25-11.215-25-25v-402c0-13.785 11.215-25 25-25h179v85c0 19.299 15.701 35 35 35h91v307c0 13.785-11.215 25-25 25z"/>
                                                  <path d="m363 200h-220c-8.284 0-15 6.716-15 15s6.716 15 15 15h220c8.284 0 15-6.716 15-15s-6.716-15-15-15z"/>
                                                  <path d="m363 280h-220c-8.284 0-15 6.716-15 15s6.716 15 15 15h220c8.284 0 15-6.716 15-15s-6.716-15-15-15z"/>
                                                  <path d="m215.72 360h-72.72c-8.284 0-15 6.716-15 15s6.716 15 15 15h72.72c8.284 0 15-6.716 15-15s-6.716-15-15-15z"/>
                                                </svg>
                                              </div>
                                            </div>
                                            <Checkbox checked={selectedDocs.has(docId)} onCheckedChange={() => toggleSelectDoc(docId)} />
                                          </div>

                                          {/* Title & description */}
                                          <div className="space-y-1">
                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{doc.title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{doc.description}</p>
                                          </div>

                                          {/* Category, language, date badges */}
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <Badge
                                              className="text-[10px] h-5 px-1.5 bg-[#002B5B]/10 text-[#002B5B] hover:bg-[#002B5B] hover:text-white dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800 dark:hover:text-white border-transparent cursor-default transition-colors"
                                              title={docCategory?.includes(",") ? docCategory : undefined}
                                            >
                                              {docCategory && docCategory.includes(",") ? "Multiple" : docCategory || "â€”"}
                                            </Badge>
                                            {docLanguage && (
                                              <Badge className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100 border-transparent">{docLanguage}</Badge>
                                            )}
                                            {expiration ? (
                                              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto flex items-center gap-1">
                                                <span className="font-medium text-gray-400 dark:text-gray-500">Review Date:</span>
                                                {formatUsDate(expiration)}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">No review date</span>
                                            )}
                                          </div>

                                          {/* Action buttons */}
                                          <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="View" onClick={(e) => { e.stopPropagation(); handlePreviewFromTable(docId, doc.title); }}>
                                              <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit" onClick={(e) => { e.stopPropagation(); handleEditFromTable(docId); }}>
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400" title="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteClick(docId, doc.title); }}>
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                        </div>
                      </DragDropContext>
                  )}
                      </>
                    )}
                  </div>
                )}
                </CardContent>
              )}
        </Card>
      </div>
      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title="Delete Document" description={documentToDelete ? `Are you sure you want to delete "${documentToDelete.title}"? This action cannot be undone and the document will be permanently removed.` : ""} confirmText="Delete" cancelText="Cancel" variant="destructive" />
      <DocumentPreviewModal isOpen={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewDocument(null); }} document={previewDocument} isLoading={isLoadingPreview} />
      <DocumentEditModal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setDocumentToEdit(null); }} document={documentToEdit} onSave={handleSaveEdit} />
      <NavigateAwayWarningDialog open={leaveGuard.dialogOpen} isSaving={leaveGuard.isSaving} isDiscarding={leaveGuard.isDiscarding} onStay={leaveGuard.stayAndKeepEditing} onSaveAndExit={leaveGuard.saveAndExit} onDiscardWithoutSaving={leaveGuard.discardWithoutSaving} onDialogOpenChange={leaveGuard.dialogOnOpenChange} onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose} />
      
      {/* Loading dialog shown while documents are being saved and transitioned to View Documents */}
      <Dialog open={isTransitioningToDocuments}>
        <DialogContent className="sm:max-w-sm [&>button.absolute]:hidden" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-accent-blue border-t-transparent" />
            <DialogTitle className="text-lg font-semibold text-accent-blue">Adding Documents</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-center">
              Saving and loading your documents…
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading spinner dialog shown while the selected plan's documents load */}
      <Dialog
        open={activeSection === "documents" && !!selectedPlan && isLoadingDocs}
      >
        <DialogContent className="sm:max-w-sm [&>button.absolute]:hidden" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-accent-blue border-t-transparent" />
            <DialogTitle className="text-lg font-semibold text-accent-blue">Loading Documents</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-center">
              Loading documents for the selected plan…
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


