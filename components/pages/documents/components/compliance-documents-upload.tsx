"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import { FileText } from "lucide-react";
import {
  RetirementDocumentsAccordion,
  type RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { DocumentsCardsView } from "../views/documents-cards-view";
import {
  convertToDocumentFormat,
  detectDocumentType,
  getDocumentDescription,
  guessLanguageFromDocument,
} from "@/lib/compliance-document-utils";
import { persistNewDocumentsToApi } from "@/lib/benefits-document-persist";
import { Document, BenefitsCategory } from "@/types/new-client-wizard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { BulkCategoryAssignmentHint } from "@/lib/document-bulk-category-suggest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ComplianceDocumentsUploadProps {
  clientId?: string; // For documents tab - client ID from plan selector
  brandColor?: string;
  accentColor?: string;
  showPreview?: boolean;
  showInfoCard?: boolean;
  infoCardText?: string;
  onSave?: (documents: Document[]) => void;
  // For wizard integration
  initialDocuments?: Document[];
  onDocumentsChange?: (documents: Document[]) => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  // For unsaved changes tracking
  onHasUnsavedChangesChange?: (hasUnsaved: boolean) => void;
  showSaveButton?: boolean;
  // Expose save function to parent
  onSaveFunctionReady?: (saveFn: () => Promise<void>) => void;
  // Language selection (controlled from parent)
  language?: "EN" | "ES";
  onLanguageChange?: (language: "EN" | "ES") => void;
  fixedCategory?: BenefitsCategory;
  filterDocuments?: (doc: Document) => boolean;
  /** When true, uncategorized uploads block secondary actions and hide “Skip for now” (3b.2). */
  strictCategoryEnforcement?: boolean;
  /**
   * Wizard Step 3b: tighter info/dropzone; parent lays out at half width (`lg:grid-cols-2`).
   */
  compact?: boolean;
  /** Called when new documents have been added (e.g., after review confirm),
   *  before the save-to-API round-trip. Use for showing loading indicators. */
  onDocumentsAdded?: () => void;
  /** Called when upload state changes (true = uploading in progress). */
  onUploadingChange?: (isUploading: boolean) => void;
}

export function ComplianceDocumentsUpload({
  clientId,
  brandColor = "#002B5B",
  accentColor = "#6B7280",
  showPreview = true,
  showInfoCard = true,
  infoCardText = "Upload plan documents and forms here. They will be accessible to employees on the Benefits Hub. You can also skip this step for now.",
  onSave,
  initialDocuments = [],
  onDocumentsChange,
  secondaryAction,
  onHasUnsavedChangesChange,
  showSaveButton = false,
  onSaveFunctionReady,
  language: controlledLanguage = "EN",
  onLanguageChange,
  fixedCategory,
  filterDocuments,
  strictCategoryEnforcement = false,
  compact = false,
  onDocumentsAdded,
  onUploadingChange,
}: ComplianceDocumentsUploadProps) {
  // Parents often pass inline `onDocumentsChange` (new identity each render). Stabilize for
  // effect deps and always invoke the latest callback via a ref to avoid notify → sync → fetch loops.
  const onDocumentsChangeRef = useRef(onDocumentsChange);
  onDocumentsChangeRef.current = onDocumentsChange;
  const isWizardControlled = Boolean(onDocumentsChange);

  const [retirementPlanDocuments, setRetirementPlanDocuments] =
    useState<Document[]>(initialDocuments);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const editSectionRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const lastSavedDocumentsRef = useRef<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [hasSkippedCategorization, setHasSkippedCategorization] = useState(false);
  const prevUncategorizedCount = useRef(0);

  /** Hoisted so early `useMemo` (documents preview) can remove rows safely. */
  function removeRetirementDocumentById(docId: string) {
    setRetirementPlanDocuments((prev) =>
      prev.filter((doc) => doc.id !== docId),
    );
    setEditingDocument((ed) => (ed?.id === docId ? null : ed));
  }

  // Create a serialized version of documents for dependency tracking
  // Use a hash of file content to detect file changes
  const documentsSerialized = useMemo(() => {
    const filteredDocs = filterDocuments
      ? retirementPlanDocuments.filter(filterDocuments)
      : retirementPlanDocuments;

    const serialized = JSON.stringify(
      filteredDocs.map((d) => ({
        id: d.id,
        name: d.name,
        shortDescription: d.shortDescription,
        fileSignature: d.file ? d.file.substring(0, 200) : "", // Use first 200 chars to detect changes
        originalFileName: d.originalFileName,
        language: (d as any).language,
      })),
    );
    return serialized;
  }, [retirementPlanDocuments, filterDocuments]);

  const documentsPreview = useMemo<RetirementDocumentItem[]>(() => {
    const filteredDocs = filterDocuments
      ? retirementPlanDocuments.filter(filterDocuments)
      : retirementPlanDocuments;

    return filteredDocs.map((doc) => {
      const docLanguage = (doc as any).language;
      const detectedLanguage =
        docLanguage === "ES" || docLanguage === "EN"
          ? docLanguage
          : guessLanguageFromDocument(doc);
      const docType = detectDocumentType(doc.originalFileName || doc.name);

      // Use API endpoint if document has a database ID (more efficient for large files)
      // Otherwise use the file data directly
      let href = doc.file;

      // Check if document has a database ID (MongoDB ObjectID format: 24-character hex string)
      // Temporary IDs have formats like: "doc-{timestamp}-{random}", "plan-doc-{timestamp}-{random}", etc.
      const isTemporaryId =
        typeof doc.id === "string" &&
        (doc.id.startsWith("doc-") ||
          doc.id.startsWith("plan-doc-") ||
          doc.id.startsWith("optional-doc-") ||
          doc.id.startsWith("temp-"));

      // MongoDB ObjectID is a 24-character hex string
      const isDatabaseId =
        typeof doc.id === "string" &&
        /^[0-9a-fA-F]{24}$/.test(doc.id) &&
        !isTemporaryId;

      if (isDatabaseId) {
        href = `/api/documents/${doc.id}/view`;
      } else if ((doc as any).storageKey) {
        href = `/api/r2/signed-url?key=${encodeURIComponent((doc as any).storageKey)}&redirect=1`;
      } else if (
        doc.file &&
        !doc.file.startsWith("http") &&
        !doc.file.startsWith("/")
      ) {
        href = doc.file;
      }

      return {
        id: doc.id,
        title: doc.name,
        description: getDocumentDescription(doc),
        href: href,
        language: detectedLanguage,
        category: doc.category,
        categorySuggested: doc.categorySuggested,
        categoryConfidence: doc.categoryConfidence,
        showQrCode: (doc as any).showQrCode !== false,
        meta: {
          source: "retirement",
          id: doc.id,
          type: docType,
          uploadedAt: (doc as any).uploadedAt || new Date().toISOString(),
        },
        onDelete: () => {
          removeRetirementDocumentById(doc.id);
        },
        onToggleShowQrCode: isDatabaseId
          ? (next: boolean) => {
              void (async () => {
                const res = await fetch(`/api/documents/${doc.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ showQrCode: next }),
                });
                if (!res.ok) {
                  toast.error("Could not update QR code visibility");
                  return;
                }
                const updated = retirementPlanDocuments.map((d) =>
                  d.id === doc.id ? { ...d, showQrCode: next } : d,
                );
                setRetirementPlanDocuments(updated);
                setPreviewKey((p) => p + 1);
                onDocumentsChangeRef.current?.(updated);
              })();
            }
          : undefined,
        onArchive: isDatabaseId
          ? () => {
              void (async () => {
                if (
                  !window.confirm(
                    "Archive this document? It will be removed from the Benefits Hub but kept for your records.",
                  )
                ) {
                  return;
                }
                const res = await fetch(`/api/documents/${doc.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    archivedAt: new Date().toISOString(),
                  }),
                });
                if (!res.ok) {
                  toast.error("Could not archive document");
                  return;
                }
                const updated = retirementPlanDocuments.filter(
                  (d) => d.id !== doc.id,
                );
                setRetirementPlanDocuments(updated);
                setEditingDocId((cur) => (cur === doc.id ? null : cur));
                setPreviewKey((p) => p + 1);
                onDocumentsChangeRef.current?.(updated);
                toast.success("Document archived");
              })();
            }
          : undefined,
      };
    });
  }, [retirementPlanDocuments, previewKey]);

  const hasDocumentsPreview = documentsPreview.length > 0;

  const uncategorizedDocuments = useMemo(() => {
    return retirementPlanDocuments.filter(
      (doc) => doc.category == null || String(doc.category).trim() === "",
    );
  }, [retirementPlanDocuments]);

  const allDocumentsCategorized =
    uncategorizedDocuments.length === 0 ||
    (!strictCategoryEnforcement && hasSkippedCategorization);

  // Reset skip flag if new uncategorized documents are added
  useEffect(() => {
    if (uncategorizedDocuments.length > prevUncategorizedCount.current) {
      setHasSkippedCategorization(false);
    }
    prevUncategorizedCount.current = uncategorizedDocuments.length;
  }, [uncategorizedDocuments.length]);

  // Sync with external document changes (wizard / parent). Parent state (Zustand) can
  // re-render a tick *before* the latest upload is committed — `initialDocuments` can
  // be briefly [] or a stale list while local `retirementPlanDocuments` has new R2 rows
  // with `temp-` / `doc-` ids, which was wiping the UI right after upload.
  useEffect(() => {
    if (!isWizardControlled) return;
    setRetirementPlanDocuments((prev) => {
      const next = initialDocuments;
      if (next.length === 0 && prev.length > 0) {
        const hasR2InFlight = prev.some(
          (d) =>
            (String(d.id).startsWith("temp-") ||
              String(d.id).startsWith("doc-") ||
              String(d.id).startsWith("plan-doc-")) &&
            (d as { storageKey?: string }).storageKey,
        );
        if (hasR2InFlight) {
          return prev;
        }
      }
      if (next.length < prev.length) {
        const hasR2InFlight = prev.some(
          (d) =>
            (String(d.id).startsWith("temp-") ||
              String(d.id).startsWith("doc-")) &&
            (d as { storageKey?: string }).storageKey,
        );
        if (hasR2InFlight) {
          const nextIds = new Set(next.map((d) => d.id));
          const wouldDropR2 = prev.some(
            (d) =>
              (String(d.id).startsWith("temp-") ||
                String(d.id).startsWith("doc-")) &&
              (d as { storageKey?: string }).storageKey &&
              !nextIds.has(d.id),
          );
          if (wouldDropR2) {
            return prev;
          }
        }
      }
      const prevIds = prev
        .map((d) => d.id)
        .sort()
        .join(",");
      const newIds = next
        .map((d) => d.id)
        .sort()
        .join(",");
      if (newIds === prevIds) {
        return prev;
      }
      return next;
    });
  }, [initialDocuments, isWizardControlled]);

  // Notify parent when documents change (for wizard integration)
  useEffect(() => {
    if (!isWizardControlled) return;
    const timeoutId = setTimeout(() => {
      onDocumentsChangeRef.current?.(retirementPlanDocuments);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [retirementPlanDocuments, isWizardControlled]);


  // Track previous clientId to detect changes
  const previousClientIdRef = useRef<string | undefined>(clientId);

  // Load documents from server when clientId is provided
  useEffect(() => {
    // Reset initialization when clientId changes
    if (previousClientIdRef.current !== clientId) {
      initialized.current = false;
      previousClientIdRef.current = clientId;
      // Clear documents when switching clients
      setRetirementPlanDocuments([]);
    }

    const loadDocuments = async () => {
      // Don't load if already initialized for this clientId, or if no clientId, or if in wizard mode
      if (initialized.current || !clientId || isWizardControlled) {
        return;
      }

      try {
        const response = await fetch(
          `/api/new-client-wizard/optional-documents?clientId=${clientId}`,
        );

        if (response.ok) {
          const result = await response.json();
          const optionalData = result.optionalDocuments;

          if (optionalData && optionalData.retirementPlanDocuments) {
            const convertedDocuments = await Promise.all(
              optionalData.retirementPlanDocuments.map(
                async (doc: any, index: number) => {
                  const converted = await convertToDocumentFormat(doc, index);

                  return converted;
                },
              ),
            );

            setRetirementPlanDocuments(convertedDocuments);

            // Update the saved state reference after loading
            // Update saved state with the same format as tracking
            const loadedDocumentsSerialized = JSON.stringify(
              convertedDocuments
                .map((d: any) => ({
                  id: d.id,
                  name: d.name,
                  shortDescription: d.shortDescription || "",
                  fileSignature: d.file
                    ? d.file.substring(0, 100) +
                    (d.file.length > 100 ? "..." : "")
                    : "",
                  originalFileName: d.originalFileName || "",
                }))
                .sort((a: any, b: any) => a.id.localeCompare(b.id)),
            );
            lastSavedDocumentsRef.current = loadedDocumentsSerialized;
            setHasUnsavedChanges(false);
            if (onHasUnsavedChangesChange) {
              onHasUnsavedChangesChange(false);
            }
          } else {
            // No documents found, set empty state
            setRetirementPlanDocuments([]);
            lastSavedDocumentsRef.current = JSON.stringify([]);
            setHasUnsavedChanges(false);
            if (onHasUnsavedChangesChange) {
              onHasUnsavedChangesChange(false);
            }
          }
        } else {
          console.error(
            "ComplianceDocumentsUpload: API response not OK:",
            response.status,
            response.statusText,
          );
        }
      } catch (error) {
        console.error("Error loading documents from server:", error);
      } finally {
        initialized.current = true;
      }
    };

    loadDocuments();
  }, [clientId, isWizardControlled, onHasUnsavedChangesChange]);

  // Documents page: persist new R2 uploads immediately so they appear in Preview/List without requiring Save
  // DISABLED when showSaveButton is true (the user must click Save manually)
  const isPersistingRef = useRef(false);
  const persistedStorageKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!clientId || isWizardControlled || !showSaveButton) return;
    // Don't auto-persist while a manual save is in progress (and vice versa)
    if (isSavingRef.current) return;

    const isTempPersistId = (id: string) =>
      String(id).startsWith("temp-") ||
      String(id).startsWith("doc-") ||
      String(id).startsWith("plan-doc-") ||
      String(id).startsWith("optional-doc-");
    const tempDocs = retirementPlanDocuments.filter(
      (d) => {
        const key = (d as any).storageKey as string | undefined;
        return (
          key &&
          key.trim() !== "" &&
          isTempPersistId(String(d.id)) &&
          !persistedStorageKeys.current.has(key.trim())
        );
      },
    );
    if (tempDocs.length === 0 || isPersistingRef.current) return;

    // Mark these storage keys as persisted BEFORE the async call,
    // so re-entrant effect runs skip them.
    for (const d of tempDocs) {
      persistedStorageKeys.current.add((d as any).storageKey.trim());
    }

    isPersistingRef.current = true;
    // Notify parent that auto-persist has begun (e.g. to show a loading dialog)
    onDocumentsAdded?.();
    persistNewDocumentsToApi(clientId, retirementPlanDocuments)
      .then((updated) => {
        setRetirementPlanDocuments(updated);
        const savedState = JSON.stringify(
          updated
            .map((d) => ({
              id: d.id,
              name: d.name,
              shortDescription: d.shortDescription || "",
              fileSignature: (d as any).storageKey ? "r2" : "",
              originalFileName: d.originalFileName || "",
            }))
            .sort((a, b) => a.id.localeCompare(b.id))
        );
        lastSavedDocumentsRef.current = savedState;
        setHasUnsavedChanges(false);
        if (onHasUnsavedChangesChange) onHasUnsavedChangesChange(false);
        // Notify the parent so it can re-fetch SWR data — mutual exclusion
        // guards now prevent duplicate persistence from cascading re-fetches.
        onSave?.(updated);
      })
      .catch((err) => {
        console.error("Persist new documents failed:", err);
        // Re-allow these keys to be retried on next effect run
        for (const d of tempDocs) {
          persistedStorageKeys.current.delete((d as any).storageKey.trim());
        }
      })
      .finally(() => {
        isPersistingRef.current = false;
      });
  }, [
    clientId,
    isWizardControlled,
    showSaveButton,
    retirementPlanDocuments,
    onSave,
    onHasUnsavedChangesChange,
  ]);

  // Track unsaved changes - improved comparison
  useEffect(() => {
    if (!clientId || isWizardControlled) return; // Skip if in wizard mode
    if (!initialized.current) return; // Wait for initial load to complete

    // Create a more comprehensive serialized version to compare
    // Include: count, IDs, names, and file signatures (first 100 chars for better detection)
    const currentDocumentsSerialized = JSON.stringify(
      retirementPlanDocuments
        .map((d) => ({
          id: d.id,
          name: d.name,
          shortDescription: d.shortDescription || "",
          fileSignature: d.file
            ? d.file.substring(0, 100) + (d.file.length > 100 ? "..." : "")
            : "",
          originalFileName: d.originalFileName || "",
        }))
        .sort((a, b) => a.id.localeCompare(b.id)), // Sort for consistent comparison
    );

    const hasChanges =
      currentDocumentsSerialized !== lastSavedDocumentsRef.current;
    setHasUnsavedChanges(hasChanges);

    if (onHasUnsavedChangesChange) {
      onHasUnsavedChangesChange(hasChanges);
    }
  }, [
    retirementPlanDocuments,
    clientId,
    isWizardControlled,
    onHasUnsavedChangesChange,
  ]);

  // Save documents to server when they change (if clientId is provided and auto-save is enabled)
  useEffect(() => {
    if (!clientId || isWizardControlled || showSaveButton) return; // Skip if in wizard mode or manual save mode

    // Skip if there are no documents loaded yet (prevents spurious saves on mount / tab switch)
    if (!initialized.current) return;

    // Skip if documents haven't changed or are empty — avoid saving an empty list
    if (retirementPlanDocuments.length === 0) return;

    // Create a serialized version to compare (same format as tracking)
    const currentDocumentsSerialized = JSON.stringify(
      retirementPlanDocuments
        .map((d) => ({
          id: d.id,
          name: d.name,
          shortDescription: d.shortDescription || "",
          fileSignature: d.file
            ? d.file.substring(0, 100) + (d.file.length > 100 ? "..." : "")
            : "",
          originalFileName: d.originalFileName || "",
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );

    // Skip if documents haven't changed
    if (currentDocumentsSerialized === lastSavedDocumentsRef.current) {
      return;
    }

    const saveDocumentsToServer = async () => {
      const missingCategory = retirementPlanDocuments.filter(
        (d) => !d.category?.trim(),
      );
      if (missingCategory.length > 0 && !hasSkippedCategorization) {
        return;
      }

      setIsSaving(true);
      try {
        const optionalFiles = retirementPlanDocuments.map((doc) => {
          const hasR2 = (doc as any).storageKey && String((doc as any).storageKey).trim() !== "";
          let fileData: string | undefined;
          if (hasR2 || doc.file === "r2:stored") {
            fileData = undefined;
          } else {
            fileData = doc.file;
            if (fileData && fileData.startsWith("data:")) {
              const base64Index = fileData.indexOf(",");
              fileData =
                base64Index !== -1
                  ? fileData.substring(base64Index + 1)
                  : fileData;
            }
          }

          const fileType =
            doc.originalFileName?.split(".").pop()?.toLowerCase() || "pdf";

          const docLanguage = (doc as any).language;
          const language =
            docLanguage === "ES" || docLanguage === "EN"
              ? docLanguage
              : guessLanguageFromDocument(doc);

          return {
            fileName: doc.originalFileName || doc.name,
            fileData: fileData ?? "",
            fileType,
            description: doc.shortDescription || "",
            language,
            expirationDate: doc.expirationDate || undefined,
            ...(hasR2 && { storageKey: (doc as any).storageKey }),
            category: doc.category,
          };
        });

        const response = await fetch(
          `/api/new-client-wizard/optional-documents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clientId,
              optionalFiles,
              provideSpanishVersions: false,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          toast.error(
            errorData.error || "Failed to save documents. Please try again.",
          );
          console.error("Failed to save documents to server:", errorData);
        } else {
          // Update saved state with the same format as tracking
          const savedState = JSON.stringify(
            retirementPlanDocuments
              .map((d) => ({
                id: d.id,
                name: d.name,
                shortDescription: d.shortDescription || "",
                fileSignature: d.file
                  ? d.file.substring(0, 100) +
                  (d.file.length > 100 ? "..." : "")
                  : "",
                originalFileName: d.originalFileName || "",
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          );
          lastSavedDocumentsRef.current = savedState;
          setHasUnsavedChanges(false);
          if (onHasUnsavedChangesChange) {
            onHasUnsavedChangesChange(false);
          }
          toast.success("Documents saved successfully");
          if (onSave) {
            onSave(retirementPlanDocuments);
          }
        }
      } catch (error) {
        console.error("Error saving documents to server:", error);
        toast.error("Error saving documents. Please try again.");
      } finally {
        setIsSaving(false);
      }
    };

    // Debounce the save
    const timeoutId = setTimeout(saveDocumentsToServer, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    retirementPlanDocuments,
    clientId,
    onSave,
    isWizardControlled,
    showSaveButton,
    hasSkippedCategorization,
  ]);

  // Expose save function to parent component
  useEffect(() => {
    if (onSaveFunctionReady && clientId) {
      onSaveFunctionReady(handleManualSave);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSaveFunctionReady, clientId, retirementPlanDocuments]);

  // Manual save function
  const handleManualSave = async () => {
    // Don't manually save while auto-persist is in flight
    if (!clientId || isSavingRef.current || isPersistingRef.current) return;
    isSavingRef.current = true;

    // Don't attempt to save when there are no documents — prevents spurious success toast
    if (retirementPlanDocuments.length === 0) {
      isSavingRef.current = false;
      return;
    }

    const missingCategory = retirementPlanDocuments.filter(
      (d) => !d.category?.trim(),
    );
    if (missingCategory.length > 0 && !hasSkippedCategorization) {
      toast.error("Assign a category to every document before saving.");
      isSavingRef.current = false;
      return;
    }

    // Notify parent that saving has begun (e.g. to show a loading dialog)
    onDocumentsAdded?.();

    setIsSaving(true);
    try {
      // Only send documents that haven't been persisted yet (temp IDs with storageKey).
      // Already-persisted documents with real DB IDs are skipped to avoid duplicates.
      const isTempId = (id: string) =>
        String(id).startsWith("temp-") ||
        String(id).startsWith("doc-") ||
        String(id).startsWith("plan-doc-") ||
        String(id).startsWith("optional-doc-");

      const docsToSave = retirementPlanDocuments.filter(
        (d) => isTempId(String(d.id)) && (d as any).storageKey,
      );

      if (docsToSave.length === 0) {
        setIsSaving(false);
        isSavingRef.current = false;
        return;
      }

      const optionalFiles = docsToSave.map((doc) => {
        let fileData = doc.file;
        if (fileData && fileData.startsWith("data:")) {
          const base64Index = fileData.indexOf(",");
          fileData =
            base64Index !== -1 ? fileData.substring(base64Index + 1) : fileData;
        }

        const fileType =
          doc.originalFileName?.split(".").pop()?.toLowerCase() || "pdf";

        const docLanguage = (doc as any).language;
        const language =
          docLanguage === "ES" || docLanguage === "EN"
            ? docLanguage
            : guessLanguageFromDocument(doc);

        return {
          title: doc.name || doc.originalFileName || "Document",
          fileName: doc.originalFileName || doc.name,
          fileData,
          fileType,
          description: doc.shortDescription || "",
          language,
          ...((doc as any).storageKey && { storageKey: (doc as any).storageKey }),
          category: doc.category,
        };
      });

      const response = await fetch(
        `/api/new-client-wizard/optional-documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientId,
            optionalFiles,
            provideSpanishVersions: false,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(
          errorData.error || "Failed to save documents. Please try again.",
        );
        console.error("Failed to save documents to server:", errorData);
      } else {
        // Update saved state with the same format as tracking
        const savedState = JSON.stringify(
          retirementPlanDocuments
            .map((d) => ({
              id: d.id,
              name: d.name,
              shortDescription: d.shortDescription || "",
              fileSignature: d.file
                ? d.file.substring(0, 100) + (d.file.length > 100 ? "..." : "")
                : "",
              originalFileName: d.originalFileName || "",
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        );
        lastSavedDocumentsRef.current = savedState;
        setHasUnsavedChanges(false);
        if (onHasUnsavedChangesChange) {
          onHasUnsavedChangesChange(false);
        }
        toast.success("Documents saved successfully");
        if (onSave) {
          onSave(retirementPlanDocuments);
        }
      }
    } catch (error) {
      console.error("Error saving documents to server:", error);
      toast.error("Error saving documents. Please try again.");
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const [bulkMajorityModal, setBulkMajorityModal] = useState<{
    category: BenefitsCategory;
    displayLabel: string;
    documentIds: string[];
    voteCount: number;
    totalUncategorized: number;
  } | null>(null);

  const [mixedCategoryBanner, setMixedCategoryBanner] = useState<{
    documentIds: string[];
    lowConfidenceIds: string[];
  } | null>(null);

  const handleBulkCategoryAssignmentHint = (hint: BulkCategoryAssignmentHint) => {
    if (hint.kind === "strict_majority") {
      setMixedCategoryBanner(null);
      setBulkMajorityModal({
        category: hint.category,
        displayLabel: hint.displayLabel,
        documentIds: hint.documentIds,
        voteCount: hint.voteCount,
        totalUncategorized: hint.totalUncategorized,
      });
      return;
    }
    setBulkMajorityModal(null);
    setMixedCategoryBanner({
      documentIds: hint.documentIds,
      lowConfidenceIds: hint.lowConfidenceIds,
    });
  };

  useEffect(() => {
    if (uncategorizedDocuments.length === 0) {
      setMixedCategoryBanner(null);
    }
  }, [uncategorizedDocuments.length]);

  const lowConfidenceIdSet = useMemo(
    () => new Set(mixedCategoryBanner?.lowConfidenceIds ?? []),
    [mixedCategoryBanner],
  );

  const handleEditPreviewDoc = (docItem: RetirementDocumentItem) => {
    const docId = docItem.meta?.id || docItem.id;
    // Enable inline editing on the card
    setEditingDocId(docId);
  };

  const handleStartEdit = (docId: string) => {
    setEditingDocId(docId);
  };

  const handleSaveInlineEdit = async (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => {
    const doc = retirementPlanDocuments.find((d) => d.id === docId);
    const effectiveCategory = category ?? doc?.category;
    let fileData: string | undefined;
    let originalFileName: string | undefined;
    let storageKey: string | undefined;

    if (file) {
      if (clientId) {
        try {
          const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
          const key = await uploadFileToR2({
            file,
            purpose: "document",
            clientId,
            fileName: file.name,
            category: effectiveCategory ?? undefined,
          });
          if (key) {
            storageKey = key;
            fileData = "r2:stored";
            originalFileName = file.name;
          }
        } catch (err) {
          console.error("R2 upload failed, falling back to base64:", err);
        }
      }
      if (!storageKey) {
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
          return;
        }
      }
    }

    const updatedDocuments = retirementPlanDocuments.map((d) =>
      d.id === docId
        ? {
            ...d,
            name: title,
            shortDescription: description,
            ...(effectiveCategory !== undefined && { category: effectiveCategory }),
            ...(fileData !== undefined && { file: fileData }),
            ...(originalFileName !== undefined && { originalFileName }),
            ...(storageKey !== undefined && { storageKey }),
          }
        : d,
    );

    setRetirementPlanDocuments(updatedDocuments);
    setEditingDocId(null);
    setPreviewKey((prev) => prev + 1);
    if (onDocumentsChange) {
      onDocumentsChange(updatedDocuments);
    }
  };

  const handleApplyCategoryToAll = (category: BenefitsCategory) => {
    // "Multiple" is not a real category assignment — skip so the dropdown stays open
    // and the user can pick a different option.
    if (category === "Multiple") return;
    const updatedDocuments = retirementPlanDocuments.map((doc) =>
      !doc.category ? { ...doc, category } : doc
    );
    setRetirementPlanDocuments(updatedDocuments);
    if (onDocumentsChange) {
      onDocumentsChange(updatedDocuments);
    }
    toast.success(`Applied ${category} to all uncategorized documents`);
  };

  const handleApplyCategoryToUncategorizedSubset = (
    category: BenefitsCategory,
    documentIds: string[],
  ) => {
    const idSet = new Set(documentIds);
    const updatedDocuments = retirementPlanDocuments.map((doc) =>
      idSet.has(doc.id) && !doc.category?.trim() ? { ...doc, category } : doc,
    );
    setRetirementPlanDocuments(updatedDocuments);
    onDocumentsChange?.(updatedDocuments);
    setBulkMajorityModal(null);
    toast.success(`Applied ${category} to ${documentIds.length} document(s)`);
  };

  const handleUpdateDocumentCategory = (docId: string, category: BenefitsCategory) => {
    const updatedDocuments = retirementPlanDocuments.map((doc) =>
      doc.id === docId ? { ...doc, category } : doc
    );
    setRetirementPlanDocuments(updatedDocuments);
    if (onDocumentsChange) {
      onDocumentsChange(updatedDocuments);
    }
  };

  const handleCancelInlineEdit = () => {
    setEditingDocId(null);
  };

  const handleSaveEditedDocument = (updatedDoc: Document) => {
    if (!editingDocument) return;

    const updatedDocuments = retirementPlanDocuments.map((doc) =>
      doc.id === updatedDoc.id ? updatedDoc : doc,
    );

    setRetirementPlanDocuments(updatedDocuments);
    setEditingDocument(null);

    // Notify parent component of changes
    if (onDocumentsChange) {
      onDocumentsChange(updatedDocuments);
    }
  };

  const handleCancelEdit = () => {
    setEditingDocument(null);
  };

  const handleDeleteDocument = (docId: string) => {
    removeRetirementDocumentById(docId);
  };

  const handleDeleteForPreview = (documentId: string, documentTitle: string) => {
    handleDeleteDocument(documentId);
    toast.success(`"${documentTitle}" deleted`);
  };

  const handleDownloadForPreview = async (documentId: string, fileName: string) => {
    const doc = retirementPlanDocuments.find((d) => d.id === documentId);
    if (!doc || !doc.file) {
      toast.error("Document not found or file is missing");
      return;
    }

    try {
      // If it's a data URL or base64, create blob and download
      if (doc.file.startsWith("data:")) {
        const response = await fetch(doc.file);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (doc.file.startsWith("/api/")) {
        // If it's an API endpoint, fetch and download
        const response = await fetch(doc.file);
        if (!response.ok) {
          toast.error("Failed to download document");
          return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Direct URL
        const link = document.createElement("a");
        link.href = doc.file;
        link.download = fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("An error occurred while downloading the document");
    }
  };

  return (
    <div className={compact ? "space-y-3 min-w-0" : "space-y-4"}>
      {showInfoCard && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-accent-blue/10 dark:border-accent-blue/30">
          <CardContent
            className={
              compact ? "py-3 px-4" : "py-4 sm:py-6 p-4 sm:p-6"
            }
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent-blue mt-0.5 flex-shrink-0" />
              <div>
                <p
                  className={
                    compact
                      ? "text-sm leading-snug text-blue-900 font-medium dark:text-accent-blue-light"
                      : "text-sm sm:text-base md:text-lg leading-relaxed text-blue-900 font-medium dark:text-accent-blue-light"
                  }
                >
                  {infoCardText}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {mixedCategoryBanner && uncategorizedDocuments.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 font-semibold dark:text-amber-200">
            Categories differ across uploads
          </AlertTitle>
          <AlertDescription className="text-amber-900/90 text-sm dark:text-amber-300/90">
            Assign a category to each document below. Rows marked with low AI
            confidence may need a manual check.
          </AlertDescription>
        </Alert>
      )}

      {/* Uncategorized Documents Review List */}
      {!allDocumentsCategorized && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full mr-6">
            <AlertTitle className="font-semibold mb-0 dark:text-red-200">Uncategorized Documents</AlertTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-red-600 uppercase dark:text-red-400">Apply to all:</span>
              <Select onValueChange={(value: any) => handleApplyCategoryToAll(value)}>
                <SelectTrigger className="h-7 text-[10px] bg-white border-red-200 w-32 dark:bg-gray-700 dark:border-red-800 dark:text-gray-300">
                  <SelectValue placeholder="Select Benefit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retirement">Retirement</SelectItem>
                  <SelectItem value="Group Life">Group Life</SelectItem>
                  <SelectItem value="Group Health">Group Health</SelectItem>
                  <SelectItem value="Multiple">Multiple</SelectItem>
                  <SelectItem value="Other Benefits">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDescription className="space-y-3 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-sm opacity-90">
                Please assign a category to the following documents before proceeding.
              </p>
              {!strictCategoryEnforcement && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-100/50 font-bold uppercase underline dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                  onClick={() => setHasSkippedCategorization(true)}
                >
                  Skip for now
                </Button>
              )}
            </div>
            <div className="bg-white/50 rounded-lg border border-red-100 divide-y divide-red-100 overflow-hidden dark:bg-gray-800/50 dark:border-red-800 dark:divide-red-800">
              {uncategorizedDocuments.map((doc) => (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3 dark:text-gray-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-red-400 flex-shrink-0 dark:text-red-500" />
                    <span className="text-sm font-medium truncate">{doc.name}</span>
                    <Badge variant="outline" className="text-[10px] py-0 h-4 border-red-200 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20">
                      Required
                    </Badge>
                    {lowConfidenceIdSet.has(doc.id) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 h-4 border-amber-300 text-amber-800 bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:bg-amber-900/20"
                      >
                        Low AI confidence
                      </Badge>
                    )}
                  </div>
                  <div className="w-full sm:w-48">
                    <Select
                      value={doc.category || undefined}
                      onValueChange={(value: any) => handleUpdateDocumentCategory(doc.id, value)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white border-red-200 focus:ring-red-500 dark:bg-gray-700 dark:border-red-800 dark:text-gray-300">
                        <SelectValue placeholder="Select Benefit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Retirement">Retirement</SelectItem>
                        <SelectItem value="Group Life">Group Life</SelectItem>
                        <SelectItem value="Group Health">Group Health</SelectItem>
                        <SelectItem value="Multiple">Multiple</SelectItem>
                        <SelectItem value="Other Benefits">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            {secondaryAction && (
              <p className="text-[10px] text-red-600 font-medium dark:text-red-400">
                * &quot;{secondaryAction.label}&quot; button is disabled until all documents are categorized.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {editingDocument && (
        <div ref={editSectionRef}>
          <DocumentsUploadSection
            documents={retirementPlanDocuments}
            onDocumentsChange={setRetirementPlanDocuments}
            title={fixedCategory ? `Edit ${fixedCategory} Plan Document` : "Edit Plan Document"}
            description="Update the document name, description, or replace the file"
            editingDocument={editingDocument}
            onSaveEdit={handleSaveEditedDocument}
            onCancelEdit={handleCancelEdit}
            fixedCategory={fixedCategory}
            hideUploadBackdrop={!!onDocumentsChange}
            clientId={clientId}
            pdfOnly={strictCategoryEnforcement}
            compactDropzone={compact}
            onBulkCategoryAssignmentHint={
              strictCategoryEnforcement
                ? handleBulkCategoryAssignmentHint
                : undefined
            }
            onUploadingChange={onUploadingChange}
          />
        </div>
      )}

      {!editingDocument && (
        <DocumentsUploadSection
          documents={retirementPlanDocuments}
          onDocumentsChange={setRetirementPlanDocuments}
          title={fixedCategory ? `${fixedCategory} Plan Documents` : "Upload Plan Documents"}
          description="Upload plan documents and forms for this client. After saving, they appear in the Documents section. Employees will see them in the Benefits Hub."
          secondaryAction={
            secondaryAction
              ? {
                ...secondaryAction,
                disabled: secondaryAction.disabled || !allDocumentsCategorized,
              }
              : undefined
          }
          fixedCategory={fixedCategory}
          hideUploadBackdrop={!!onDocumentsChange}
          clientId={clientId}
          pdfOnly={strictCategoryEnforcement}
          compactDropzone={compact}
          onBulkCategoryAssignmentHint={
            strictCategoryEnforcement
              ? handleBulkCategoryAssignmentHint
              : undefined
          }
          onUploadingChange={onUploadingChange}
        />
      )}

      {showPreview && hasDocumentsPreview && (
        <DocumentsCardsView
          documents={documentsPreview}
          onDelete={handleDeleteForPreview}
          onDownload={handleDownloadForPreview}
          onDocumentsChange={() => {
            // Force preview update
            setPreviewKey((prev) => prev + 1);
            if (onDocumentsChange) {
              onDocumentsChange(retirementPlanDocuments);
            }
          }}
          onSaveEdit={handleSaveInlineEdit}
          brandColor={brandColor}
          accentColor={accentColor}
        />
      )}

      <AlertDialog
        open={!!bulkMajorityModal}
        onOpenChange={(open) => {
          if (!open) {
            setBulkMajorityModal(null);
          }
        }}
      >
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100">Bulk category suggestion</AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2 dark:text-gray-400">
              <span className="block">
                Apply{" "}
                <span className="font-semibold text-foreground">
                  &ldquo;{bulkMajorityModal?.displayLabel}&rdquo;
                </span>{" "}
                to all {bulkMajorityModal?.totalUncategorized} uncategorized
                document
                {bulkMajorityModal &&
                bulkMajorityModal.totalUncategorized !== 1
                  ? "s"
                  : ""}
                ?
              </span>
              <span className="block text-muted-foreground">
                {bulkMajorityModal?.voteCount} of{" "}
                {bulkMajorityModal?.totalUncategorized} files met the AI
                confidence threshold for that category (audit fields are still
                stored per file).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Review individually</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!bulkMajorityModal) return;
                handleApplyCategoryToUncategorizedSubset(
                  bulkMajorityModal.category,
                  bulkMajorityModal.documentIds,
                );
              }}
            >
              Apply to all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
