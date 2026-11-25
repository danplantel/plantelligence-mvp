"use client";

import { suggestDocumentName } from "@/lib/gemini-suggest-doc-name";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import type { TopicDocumentLink } from "@/types/topic";

/**
 * Adding a document from the advisor's computer to ONE topic.
 *
 * The file becomes a real, plan-scoped document so a participant can open it
 * through the same viewer the benefit's documents use — but it is filed under
 * {@link TOPIC_DOCUMENT_CATEGORY}, a label no hub claims. `documentRowMatchesHub`
 * compares a row's resolved category against the hub's own (Retirement, Group
 * Health, …), so a card-only document never appears in the benefit's Documents &
 * Forms list. It does show in the advisor's Documents admin, which is where a
 * stray upload can be found and removed.
 *
 * Naming is the same courtesy the Documents feature gives: the model reads the
 * file and suggests a title, and the file name is the fallback.
 */

/** The category a card-only document is filed under — claimed by no hub. */
export const TOPIC_DOCUMENT_CATEGORY = "Topic documents";

/** A card-only document is one small file, not a plan's document library. */
export const TOPIC_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/** Above this the file is named from its name only (no model round trip). */
const AI_NAME_MAX_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/** The model can read these directly; anything else is named from its file name. */
function isModelReadable(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    name.endsWith(".pdf") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  );
}

/**
 * Upload one file and return the attachment to store on the topic: a title plus
 * the plan-scoped link participants open it through.
 *
 * Throws with a message the dialog can show as-is — "storage is not configured",
 * "too large", the API's own refusal — so nothing fails silently.
 */
export async function uploadTopicDocument(params: {
  file: File;
  planId: string;
  /** Fired with the title that will be used (AI-suggested, else the file name). */
  onNameSuggestion?: (title: string) => void;
}): Promise<TopicDocumentLink> {
  const { file, planId, onNameSuggestion } = params;
  if (!planId) throw new Error("Save the plan before adding a document.");
  if (!file || file.size === 0) throw new Error("That file is empty.");
  if (file.size > TOPIC_DOCUMENT_MAX_BYTES) {
    throw new Error("That file is too large. Use a file under 25 MB.");
  }

  // 1. Name it — a convenience, never a reason to fail the upload.
  let suggested = "";
  if (isModelReadable(file) && file.size <= AI_NAME_MAX_BYTES) {
    try {
      const result = await suggestDocumentName(
        "",
        file.name,
        TOPIC_DOCUMENT_CATEGORY,
        await readAsDataUrl(file),
      );
      suggested = (result.display_title || "").trim();
    } catch {
      // Fall through to the file name.
    }
  }
  const title = suggested || file.name.replace(/\.[^.]+$/, "") || "Document";
  onNameSuggestion?.(title);

  // 2. Put the file in storage.
  const storageKey = await uploadFileToR2({
    file,
    purpose: "document",
    clientId: planId,
    fileName: file.name,
    category: TOPIC_DOCUMENT_CATEGORY,
    type: "Document",
  });
  if (!storageKey) {
    throw new Error("Storage is not configured for uploads.");
  }

  // 3. A plan-scoped Document row, so the participant opens it through
  //    `/api/documents/{id}/view` like every other document on the hub.
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: planId,
      storageKey,
      fileName: file.name,
      title,
      type: "Document",
      category: TOPIC_DOCUMENT_CATEGORY,
      showQrCode: false,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (body as { error?: string } | null)?.error ||
        "Could not save that document.",
    );
  }
  const id = (body as { document?: { id?: string } } | null)?.document?.id;
  if (!id) throw new Error("Could not save that document.");

  return { title, url: `/api/documents/${id}/view` };
}
