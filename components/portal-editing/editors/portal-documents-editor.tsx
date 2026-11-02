"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { useClientPortal } from "@/contexts/client-portal-context";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";

interface PortalDocument {
  id?: string;
  title?: string;
  name?: string;
  category?: string;
  [key: string]: unknown;
}

/**
 * Documents editor — rename and remove the plan's document rows from the portal.
 *
 * Uploads stay in the dashboard upload flow for now; the panel is for the
 * in-place corrections an advisor makes while reviewing the page.
 */
export function PortalDocumentsEditor() {
  const { clientData } = useClientPortal();
  const {
    beginSave,
    finishSave,
    failSave,
    saveState,
    saveError,
    patchClientData,
    refetchPortal,
  } = usePortalEditing();

  const documents: PortalDocument[] = Array.isArray(clientData?.documents)
    ? (clientData?.documents as PortalDocument[])
    : [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dirtyRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous };
      documents.forEach((document) => {
        const id = String(document.id || "");
        if (id && next[id] === undefined) {
          next[id] = String(document.title || document.name || "");
        }
      });
      return next;
    });
  }, [documents]);

  const rename = useCallback(
    async (id: string, title: string) => {
      beginSave();
      try {
        const response = await fetch(`/api/documents/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not rename this document.");
        }
        patchClientData({
          documents: documents.map((document) =>
            String(document.id) === id ? { ...document, title } : document,
          ),
        });
        finishSave();
      } catch (error) {
        failSave(
          error instanceof Error
            ? error.message
            : "Could not rename this document.",
        );
        await refetchPortal();
      }
    },
    [beginSave, finishSave, failSave, patchClientData, refetchPortal, documents],
  );

  const remove = useCallback(
    async (id: string) => {
      beginSave();
      try {
        const response = await fetch(`/api/documents/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Could not delete this document.");
        }
        patchClientData({
          documents: documents.filter(
            (document) => String(document.id) !== id,
          ),
        });
        finishSave();
        window.dispatchEvent(
          new CustomEvent("plan-documents-persisted", {
            detail: { clientId: clientData?.id },
          }),
        );
      } catch (error) {
        failSave(
          error instanceof Error
            ? error.message
            : "Could not delete this document.",
        );
        await refetchPortal();
      }
    },
    [
      beginSave,
      finishSave,
      failSave,
      patchClientData,
      refetchPortal,
      documents,
      clientData?.id,
    ],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        {saveState === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </>
        )}
        {saveState === "saved" && <span>Saved</span>}
        {saveState === "error" && (
          <span className="text-red-500">{saveError || "Save failed"}</span>
        )}
      </div>

      <section>
        <SectionHeader number={1} title="Documents" />
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This plan has no documents yet.
          </p>
        ) : (
          <div className="space-y-4">
            {documents.map((document, index) => {
              const id = String(document.id || "");
              return (
                <div key={id || index} className="space-y-1.5">
                  <Label className="text-xs">
                    {String(document.category || "Document")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={drafts[id] ?? String(document.title || "")}
                      onChange={(event) => {
                        dirtyRef.current.add(id);
                        setDrafts((previous) => ({
                          ...previous,
                          [id]: event.target.value,
                        }));
                      }}
                      onBlur={(event) => {
                        if (!id || !dirtyRef.current.has(id)) return;
                        dirtyRef.current.delete(id);
                        void rename(id, event.target.value);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete document"
                      onClick={() => void remove(id)}
                      disabled={!id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">
          Upload new documents from the plan&rsquo;s Documents page; they appear
          here once saved.
        </p>
      </section>
    </div>
  );
}
