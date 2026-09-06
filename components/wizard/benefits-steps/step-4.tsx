"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { Document, BenefitsCategory } from "@/types/new-client-wizard";
import { ComplianceDocumentsUpload } from "@/components/pages/documents/components/compliance-documents-upload";
import { convertToDocumentFormat, detectDocumentType } from "@/lib/compliance-document-utils";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import { persistNewDocumentsToApi } from "@/lib/benefits-document-persist";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChevronRight } from "lucide-react";
import { DocumentListTab } from "@/components/pages/documents/tabs/document-list-tab";
import { RetirementDocumentsAccordion, RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import type {
    Document as DocumentsModuleDocument,
    SortColumn,
    SortDirection,
} from "@/components/pages/documents/types";

/**
 * True when the id references a persisted Prisma/MongoDB Document row
 * (24-char hex ObjectId) rather than an in-session temporary id.
 */
const isPersistedDocumentId = (id: string): boolean =>
    /^[0-9a-fA-F]{24}$/.test(String(id)) &&
    !/^(doc-|plan-doc-|optional-doc-|temp-)/.test(String(id));

export function BenefitsStep4() {
    const { stepData, saveStepData } = useBenefitsWizardStore();
    const step1Data = stepData.step1;
    const planId = step1Data?.planId;

    // Use local state effectively synced with store
    const [documents, setDocuments] = useState<Document[]>(stepData.step4?.documents || []);
    const [isLoading, setIsLoading] = useState(false);

    // Pending document deletion (awaiting confirmation dialog)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Tabs state
    const [activeTab, setActiveTab] = useState("upload");
    const [sortColumn, setSortColumn] = useState<SortColumn>("uploadedAt");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [previewLanguage, setPreviewLanguage] = useState<"EN" | "ES">("EN");
    const [selectedLanguage, setSelectedLanguage] = useState<"EN" | "ES">("EN");

    // Colors from plan — matches portal page pattern (brandColor top-level → brandColors nested)
    const primaryColor = step1Data?.selectedPlan?.brandColor
        || step1Data?.selectedPlan?.brandColors?.primary
        || "#002B5B";
    const secondaryColor = step1Data?.selectedPlan?.secondaryColor
        || step1Data?.selectedPlan?.brandColors?.secondary
        || "#E6C47A";
    const companyName = step1Data?.selectedPlan?.name || "Plan";

    const isInitialized = useRef(false);
    const previousPlanIdRef = useRef<string | undefined>(undefined);

    // Changing plans must re-run the document load; otherwise a prior plan’s init bit blocks fetch.
    useEffect(() => {
        if (previousPlanIdRef.current !== planId) {
            isInitialized.current = false;
            previousPlanIdRef.current = planId;
        }
    }, [planId]);

    // Initial load from API for existing plan documents.
    // ALWAYS re-fetch on mount (per plan) so documents uploaded from other
    // screens (e.g. the Documents page) are reflected here, instead of trusting
    // stale persisted step4 state. Any store docs that were added in this
    // session but not yet persisted (temp IDs) are merged back in so in-wizard
    // uploads are never dropped.
    useEffect(() => {
        const loadPlanDocuments = async () => {
            if (isInitialized.current || !planId) return;

            setIsLoading(true);
            try {
                const rows = await fetchPlanDocumentsForClient(planId);
                const convertedDocs = await Promise.all(
                    (rows as any[]).map((doc: any, index: number) =>
                        convertToDocumentFormat(
                            {
                                ...doc,
                                name: doc.title,
                                fileUrl: doc.fileUrl,
                                storageKey: doc.storageKey,
                            },
                            index,
                        ),
                    ),
                );

                const storeDocs = (stepData.step4?.documents || []) as any[];
                const apiIds = new Set(convertedDocs.map((d) => String(d.id)));
                const isTempId = (id: unknown) => {
                    const s = String(id ?? "");
                    return (
                        s.startsWith("temp-") ||
                        s.startsWith("doc-") ||
                        s.startsWith("plan-doc-") ||
                        s.startsWith("optional-doc-")
                    );
                };
                // Preserve only unpersisted in-session docs (temp IDs) — real-ID
                // rows missing from the API belong to another plan or were deleted.
                const unpersisted = storeDocs.filter(
                    (d) => isTempId((d as any).id) && !apiIds.has(String((d as any).id)),
                );
                const merged = [...convertedDocs, ...unpersisted];

                setDocuments(merged);
                saveStepData(4, { documents: merged });
            } catch (error) {
                console.error("Error loading documents:", error);
                toast.error("Failed to load existing documents");
            } finally {
                setIsLoading(false);
                isInitialized.current = true;
            }
        };

        loadPlanDocuments();
    }, [planId, saveStepData, stepData.step4?.documents]);

    // Save to store only when documents change significantly
    useEffect(() => {
        if (!isInitialized.current) return;

        // Simple equality check to avoid infinite loops
        const currentStoreDocs = stepData.step4?.documents || [];
        const serializedCurrent = JSON.stringify(currentStoreDocs);
        const serializedNext = JSON.stringify(documents);
        if (serializedCurrent !== serializedNext) {
            // Deduplicate by ID before saving
            const seen = new Set<string>();
            const deduped = documents.filter((d) => {
                const key = d.id || d.name || d.file || "";
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            saveStepData(4, { documents: deduped });
        }
    }, [documents, saveStepData, stepData.step4?.documents]);


    // Helper: Available languages
    const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
        const languages = new Set<"EN" | "ES">();
        documents.forEach((doc) => {
            languages.add(normalizePortalDocumentLanguage(doc.language, "EN"));
        });
        return Array.from(languages).sort((a, b) => {
            if (a === "EN" && b === "ES") return -1;
            if (a === "ES" && b === "EN") return 1;
            return 0;
        });
    }, [documents]);

    // Sync preview language
    useEffect(() => {
        if (availableLanguages.length > 0 && !availableLanguages.includes(previewLanguage)) {
            setPreviewLanguage(availableLanguages[0]);
        }
    }, [availableLanguages, previewLanguage]);

    // When creating a benefit for a specific category, only show documents for that category
    const benefitCategory = step1Data?.benefitCategory;
    const documentsForCategory = useMemo(() => {
        if (!benefitCategory) return documents;
        return documents.filter((doc) => {
            const a = resolvePersistedDocumentCategory(
                "Document",
                doc.category,
                (doc as { storageKey?: string }).storageKey,
            );
            const b = resolvePersistedDocumentCategory("Document", benefitCategory);
            return a === b;
        });
    }, [documents, benefitCategory]);

    // Format for Preview Tab
    const previewDocs = useMemo<RetirementDocumentItem[]>(() => {
        return documentsForCategory
            .filter(
                (doc) =>
                    normalizePortalDocumentLanguage(doc.language, "EN") ===
                    previewLanguage,
            )
            .map(doc => ({
                id: doc.id,
                title: doc.name,
                description: doc.shortDescription || doc.name,
                href: doc.file,
                language: normalizePortalDocumentLanguage(doc.language, "EN"),
                category: doc.category,
                categorySuggested: doc.categorySuggested,
                categoryConfidence: doc.categoryConfidence,
                meta: {
                    id: doc.id,
                    type: "Document",
                    uploadedAt: new Date().toISOString() // In a real app use doc.uploadedAt if available
                },
                onDelete: () => handleDelete(doc.id, doc.name),
                onDownload: () => handleDownload(doc),
            }));
    }, [documentsForCategory, previewLanguage]);

    // Format for List Tab
    const listDocs = useMemo<DocumentsModuleDocument[]>(() => {
        return documentsForCategory.map(doc => ({
            id: doc.id,
            title: doc.name,
            fileName: doc.originalFileName || doc.name,
            type: "Document",
            uploadedAt: new Date().toISOString(),
            client: {
                id: planId || "current",
                companyName: companyName
            },
            category: doc.category,
            categorySuggested: doc.categorySuggested,
            categoryConfidence: doc.categoryConfidence,
            expirationDate: doc.expirationDate,
        }));
    }, [documentsForCategory, planId, companyName]);

    // Sorted List Docs
    const sortedListDocs = useMemo(() => {
        return [...listDocs].sort((a, b) => {
            let aValue: any = a[sortColumn];
            let bValue: any = b[sortColumn];

            if (sortColumn === "uploadedAt") {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            } else {
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
            }

            if (sortDirection === "asc") return aValue > bValue ? 1 : -1;
            return aValue < bValue ? 1 : -1;
        });
    }, [listDocs, sortColumn, sortDirection]);

    // Handlers
    // Opening the delete "request" shows the confirmation dialog. The actual
    // deletion (see confirmDelete) also removes the persisted backend record so
    // the document does not reappear when Step 4 is re-fetched on remount.
    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name });
    };

    // Perform the deletion after the user confirms:
    // 1. Persisted DB documents are deleted via DELETE /api/documents/:id and
    //    their R2 object is cleaned up.
    // 2. R2-only uploads (temp ids) just have their R2 object removed.
    // 3. Local state/store are updated so the card disappears immediately and
    //    stays deleted on the next Step 4 fetch.
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { id, name } = deleteTarget;
        const doc = documents.find(d => d.id === id);
        const isDbDoc = doc ? isPersistedDocumentId(doc.id) : false;

        setIsDeleting(true);
        try {
            if (isDbDoc && doc) {
                const res = await fetch(`/api/documents/${doc.id}`, {
                    method: "DELETE",
                });
                if (!res.ok && res.status !== 404) {
                    console.error("Failed to delete document:", res.status);
                    toast.error(`Failed to delete "${name}"`);
                    return;
                }
                // DB row removed (or already gone) — clean up the stored file.
                if (doc.storageKey) {
                    await deleteFromR2(doc.storageKey).catch(() => undefined);
                }
            } else if (doc?.storageKey) {
                // Uploaded to R2 but not yet persisted to the DB (temp id).
                await deleteFromR2(doc.storageKey).catch(() => undefined);
            }

            setDocuments(prev => prev.filter(d => d.id !== id));
            toast.success(`"${name}" deleted`);

            if (planId) {
                window.dispatchEvent(
                    new CustomEvent("plan-documents-persisted", {
                        detail: { clientId: planId },
                    }),
                );
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            toast.error(`Failed to delete "${name}"`);
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    const handleDownload = async (doc: Document) => {
        if (!doc.file) return;

        try {
            const link = document.createElement("a");
            link.href = doc.file;
            link.download = doc.originalFileName || doc.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            toast.error("Download failed");
        }
    };

    const handleSort = (col: SortColumn) => {
        if (sortColumn === col) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(col);
            setSortDirection("asc");
        }
    };

    const handleSaveEdit = async (
        docId: string,
        title: string,
        description: string,
        file?: File,
        category?: BenefitsCategory
    ) => {
        setDocuments(prev => {
            const updated = prev.map(doc =>
                doc.id === docId ? {
                    ...doc,
                    name: title,
                    shortDescription: description,
                    ...(category !== undefined && { category })
                } : doc
            );
            return updated;
        });

        toast.success("Document updated");
    };

    const syncDocumentsToPlan = useCallback(
        async (docs: Document[]) => {
            const id = (planId || "").trim();
            if (!id) return;

            const merged = await persistNewDocumentsToApi(id, docs);
            const next = merged !== docs ? merged : docs;
            setDocuments(next);
            saveStepData(4, { documents: next });

            try {
                const rows = await fetchPlanDocumentsForClient(id);
                if (rows.length > 0) {
                    const convertedDocs = await Promise.all(
                        (rows as any[]).map((doc: any, index: number) =>
                            convertToDocumentFormat(
                                {
                                    ...doc,
                                    name: doc.title,
                                    fileUrl: doc.fileUrl,
                                    storageKey: doc.storageKey,
                                },
                                index,
                            ),
                        ),
                    );
                    setDocuments(convertedDocs);
                    saveStepData(4, { documents: convertedDocs });
                }
            } catch (e) {
                console.error("Refetch plan documents after change failed", e);
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("plan-documents-persisted", {
                        detail: { clientId: id },
                    }),
                );
            }
        },
        [planId, saveStepData],
    );

    const handleComplianceDocumentsChange = useCallback(
        (docs: Document[]) => {
            setDocuments((prev) => {
                if (docs.length > prev.length) {
                    toast.success("Document added");
                    setActiveTab("list");
                }
                return docs;
            });
            if (planId) {
                void syncDocumentsToPlan(docs);
            }
        },
        [planId, syncDocumentsToPlan],
    );

    if (!planId) {
        return (
          <div className="text-center py-10 text-muted-foreground">
            Please select a plan in Step 1 first.
          </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-20">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-6">
                    <DocumentListTab
                        selectedPlan={planId}
                        isLoading={false}
                        documents={sortedListDocs}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        onPreview={() => setActiveTab("preview")}
                        getDocumentType={(doc) => detectDocumentType(doc.fileName)}
                        onDelete={handleDelete}
                        onDownload={(id, name) => {
                            const doc = documents.find(d => d.id === id);
                            if (doc) handleDownload(doc);
                        }}
                        onEdit={(id, title, updates) => {
                            if (updates?.category) {
                                const docIndex = documents.findIndex(d => d.id === id);
                                if (docIndex !== -1) {
                                    const newDocs = [...documents];
                                    newDocs[docIndex] = { ...newDocs[docIndex], category: updates.category as any };
                                    setDocuments(newDocs);
                                    toast.success("Category updated");
                                }
                            } else {
                                setActiveTab("preview");
                            }
                        }}
                        availableCategories={[
                            "Retirement",
                            "Group Health",
                            "Group Life",
                            "Other Benefits"
                        ]}
                    />
                </TabsContent>

                <TabsContent value="preview" className="mt-6">
                    {/* `portal-root` forces Light Mode regardless of the dashboard dark theme —
                        the preview must look like the (always-light) employee portal. */}
                    <div className="portal-root">
                        {/* Language Switcher for Preview */}
                        {availableLanguages.length > 1 && (
                            <div className="mb-6 flex gap-2">
                                {availableLanguages.map(lang => (
                                    <button
                                        key={lang}
                                        onClick={() => setPreviewLanguage(lang)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                            previewLanguage === lang
                                                ? "bg-primary text-white border-primary"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                        }`}
                                        style={previewLanguage === lang ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                                    >
                                        {lang === "EN" ? "English" : "Español"}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Preview using the same RetirementDocumentsAccordion as the portal pages */}
                        <RetirementDocumentsAccordion
                            brandColor={primaryColor}
                            accentColor={secondaryColor}
                            retirementDocs={previewDocs}
                            title={`${benefitCategory || "Plan"} Documents & Forms`}
                            description={`Access all your important ${(benefitCategory || "plan").toLowerCase()} plan documents, forms, and notices in one convenient location.`}
                            accordionHeaderTitle={
                                benefitCategory === "Group Health"
                                    ? "Health Plan Documents"
                                    : benefitCategory === "Group Life"
                                        ? "Life Insurance Documents"
                                        : benefitCategory === "Company / Plan Sponsor"
                                            ? "Wellness Program Documents"
                                            : "Retirement Plan Documents"
                            }
                        />
                    </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-6 space-y-6">
                    <ComplianceDocumentsUpload
                        clientId={planId || undefined}
                        initialDocuments={documents}
                        onDocumentsChange={handleComplianceDocumentsChange}
                        brandColor={primaryColor}
                        accentColor={secondaryColor}
                        showPreview={false}
                        language={selectedLanguage}
                        onLanguageChange={setSelectedLanguage}
                        fixedCategory={step1Data?.benefitCategory as BenefitsCategory | undefined}
                        filterDocuments={step1Data?.benefitCategory
                            ? (doc) =>
                                  resolvePersistedDocumentCategory(
                                      "Document",
                                      doc.category,
                                      (doc as { storageKey?: string }).storageKey,
                                  ) ===
                                  resolvePersistedDocumentCategory(
                                      "Document",
                                      step1Data.benefitCategory,
                                  )
                            : undefined}
                    />
                </TabsContent>
            </Tabs>

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setDeleteTarget(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Document"
                description={deleteTarget
                    ? `Are you sure you want to delete "${deleteTarget.name}"? This will permanently remove the document and its stored file.`
                    : ""}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                isLoading={isDeleting}
            />
        </div>
    );
}
