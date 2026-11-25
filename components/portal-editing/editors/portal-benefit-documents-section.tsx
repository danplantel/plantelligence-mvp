"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ComplianceDocumentsUpload } from "@/components/pages/documents/components/compliance-documents-upload";
import { convertToDocumentFormat } from "@/lib/compliance-document-utils";
import { persistNewDocumentsToApi } from "@/lib/benefits-document-persist";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { isPersistedDocumentId } from "@/lib/document-id";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import type {
  BenefitsCategory,
  Document as WizardDocument,
} from "@/types/new-client-wizard";

/** Mirrors the Documents feature's own limits (the library's edit card enforces these). */
const MAX_TITLE_LENGTH = 85;
const MAX_DESCRIPTION_LENGTH = 160;

/**
 * The portal panel's "Benefit Documents" section — the plan's own files, the ones
 * the hub prints under "Documents & Forms".
 *
 * One flow, no tabs: the AI-named uploader sits above the list of what this benefit
 * already has. A row carries its name and description with the quick actions on
 * their own line beneath, so nothing needs a horizontal scroll.
 *
 * These are `Document` rows rather than benefit draft fields, so every change is
 * written as it happens — the uploader persists what it staged
 * (`persistNewDocumentsToApi`), a delete removes the row (and the R2 object), and a
 * rename PATCHes the row. Each change then announces `plan-documents-persisted`,
 * which the portal context already listens for, so the page beside the panel
 * re-reads the library.
 */
interface PortalBenefitDocumentsSectionProps {
  /** The plan — the portal URL's own segment (the API resolves a slug too). */
  planId: string;
  /** The benefit category, which scopes the list and the upload target. */
  benefitCategory: string;
  brandColor?: string;
  secondaryColor?: string;
}

/** The uploader's own document shape — the same rows Create/Edit Benefit holds. */
type PlanDocumentDraft = WizardDocument;

/** Announce the change so the portal re-reads the plan (and every hub section). */
function announcePlanDocumentsChanged(planId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("plan-documents-persisted", { detail: { clientId: planId } }),
  );
}

/** The hub vocabulary the uploader's category picker uses. */
function toHubCategory(category: string): BenefitsCategory {
  if (
    category === "Company / Plan Sponsor" ||
    category === "Custom" ||
    category === "Other"
  ) {
    return "Other Benefits";
  }
  return category as BenefitsCategory;
}

/** Keep the first occurrence of each id — the uploader can echo one twice. */
function dedupeById(documents: PlanDocumentDraft[]): PlanDocumentDraft[] {
  const seen = new Set<string>();
  return documents.filter((doc) => {
    const id = String(doc.id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function PortalBenefitDocumentsSection({
  planId,
  benefitCategory,
  brandColor,
  secondaryColor,
}: PortalBenefitDocumentsSectionProps) {
  const [documents, setDocuments] = useState<PlanDocumentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  /** The document whose name/description is being edited. */
  const [editing, setEditing] = useState<PlanDocumentDraft | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  /** The document awaiting delete confirmation. */
  const [pendingDelete, setPendingDelete] = useState<PlanDocumentDraft | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  /** The list the next change is diffed against — read without re-binding. */
  const documentsRef = useRef<PlanDocumentDraft[]>([]);
  documentsRef.current = documents;

  /**
   * Documents belonging to THIS benefit's category. The list and the uploader are
   * both scoped this way, so a document of another benefit is never listed — nor
   * ever removed — from here.
   */
  const inBenefitScope = useCallback(
    (doc: PlanDocumentDraft) =>
      resolvePersistedDocumentCategory(
        "Document",
        doc.category,
        typeof doc.storageKey === "string" ? doc.storageKey : undefined,
      ) === resolvePersistedDocumentCategory("Document", benefitCategory),
    [benefitCategory],
  );

  const load = useCallback(async () => {
    const rows = await fetchPlanDocumentsForClient(planId);
    const converted = await Promise.all(
      (rows as unknown as Record<string, unknown>[]).map((row, index) =>
        convertToDocumentFormat(row, index),
      ),
    );
    const next = converted as unknown as PlanDocumentDraft[];
    documentsRef.current = next;
    setDocuments(next);
  }, [planId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((error) => {
        console.error("[portal-benefit-documents] read failed:", error);
      })
      .finally(() => setLoading(false));
  }, [load]);

  const scopedDocuments = documents.filter(inBenefitScope);

  /**
   * The uploader hands back its whole list. New files still carry a `temp-` id
   * and a storage key, which is exactly what `persistNewDocumentsToApi` turns into
   * rows — it returns the SAME array when there is nothing to persist, so a plain
   * re-render never triggers a write.
   */
  const handleUploadChange = useCallback(
    (next: PlanDocumentDraft[]) => {
      const deduped = dedupeById(next);
      const outside = documentsRef.current.filter((doc) => !inBenefitScope(doc));
      const merged = [...deduped, ...outside];
      documentsRef.current = merged;
      setDocuments(merged);

      void (async () => {
        const persisted = await persistNewDocumentsToApi(
          planId,
          deduped as unknown as Parameters<typeof persistNewDocumentsToApi>[1],
        );
        if (persisted === (deduped as unknown)) return;
        try {
          await load();
          announcePlanDocumentsChanged(planId);
          toast.success("Document added to this benefit.");
        } catch (error) {
          console.error("[portal-benefit-documents] reload failed:", error);
        }
      })();
    },
    [inBenefitScope, load, planId],
  );

  const beginEdit = (doc: PlanDocumentDraft) => {
    setEditing(doc);
    setEditTitle(String(doc.name ?? ""));
    setEditDescription(String(doc.shortDescription ?? ""));
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEdit = async () => {
    const doc = editing;
    const title = editTitle.trim();
    if (!doc || !title) return;

    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("shortDescription", editDescription.trim());
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "Could not save that document.");
      }
      cancelEdit();
      await load();
      announcePlanDocumentsChanged(planId);
      toast.success("Document updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save that document.",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    const doc = pendingDelete;
    if (!doc) return;

    setDeleting(true);
    try {
      if (typeof doc.storageKey === "string" && doc.storageKey.trim()) {
        await deleteFromR2(doc.storageKey);
      }
      if (isPersistedDocumentId(String(doc.id))) {
        const response = await fetch(`/api/documents/${doc.id}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 404) {
          throw new Error("Could not delete that document.");
        }
      }
      setPendingDelete(null);
      await load();
      announcePlanDocumentsChanged(planId);
      toast.success(`"${doc.name}" deleted.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete that document.",
      );
    } finally {
      setDeleting(false);
    }
  };

  /** Open the document as the participant would (the advisor's session authorizes it). */
  const download = (doc: PlanDocumentDraft) => {
    if (typeof window === "undefined") return;
    window.open(`/api/documents/${doc.id}/view?download=1`, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading this benefit&rsquo;s documents…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The way in — the same AI-named uploader Create/Edit Benefit uses. */}
      <ComplianceDocumentsUpload
        clientId={planId}
        initialDocuments={scopedDocuments}
        onDocumentsChange={
          handleUploadChange as unknown as (
            documents: PlanDocumentDraft[],
          ) => void
        }
        brandColor={brandColor}
        accentColor={secondaryColor}
        showInfoCard={false}
        showPreview={false}
        compact
        fixedCategory={toHubCategory(benefitCategory)}
        filterDocuments={(doc) =>
          resolvePersistedDocumentCategory(
            "Document",
            doc.category,
            (doc as { storageKey?: string }).storageKey,
          ) === resolvePersistedDocumentCategory("Document", benefitCategory)
        }
      />

      {/* What this benefit already lists, one row each: name and description on
          top, quick actions on their own line beneath — never a horizontal scroll. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-[12px] font-semibold text-foreground">
            Uploaded documents
          </p>
          <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {scopedDocuments.length}{" "}
            {scopedDocuments.length === 1 ? "document" : "documents"}
          </span>
        </div>

        {scopedDocuments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No documents for this benefit yet — upload one above and it appears
            here and on the page.
          </p>
        ) : (
          <ul className="space-y-2">
            {scopedDocuments.map((doc) => (
              <li
                key={doc.id}
                data-testid="portal-benefit-document-row"
                className="min-w-0 rounded-lg border border-muted bg-white p-3"
              >
                <div className="flex items-start gap-2">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-semibold text-foreground"
                      title={doc.name}
                    >
                      {doc.name}
                    </p>
                    {doc.shortDescription && (
                      <p
                        className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground"
                        title={doc.shortDescription}
                      >
                        {doc.shortDescription}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[11px]"
                    onClick={() => download(doc)}
                  >
                    Download
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[11px]"
                    onClick={() => beginEdit(doc)}
                  >
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(doc)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rename / re-describe — the same two fields, and the same limits, as the
          Documents feature's own edit card. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) cancelEdit();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
            <DialogDescription>
              The name and description participants read on this benefit&rsquo;s
              page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="portal-doc-title" className="text-xs font-bold">
                  Title
                </Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {editTitle.length}/{MAX_TITLE_LENGTH}
                </span>
              </div>
              <Input
                id="portal-doc-title"
                value={editTitle}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label
                  htmlFor="portal-doc-description"
                  className="text-xs font-bold"
                >
                  Description
                </Label>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {editDescription.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
              <Textarea
                id="portal-doc-description"
                rows={3}
                value={editDescription}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEdit}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveEdit()}
              disabled={savingEdit || !editTitle.trim()}
            >
              {savingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
        title="Delete Document"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? It is removed from this benefit's Documents & Forms for good.`
            : ""
        }
        confirmText={deleting ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}
