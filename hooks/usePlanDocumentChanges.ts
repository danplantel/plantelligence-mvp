"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

import { mapMergedRowsToBenefitHubItems } from "@/lib/map-plan-documents-for-benefit-hub";
import type { RetirementDocumentItem } from "@/components/pages/client-portal/sections/benefit-document-section";

/**
 * "The plan's documents just changed" — the Editing Panel telling the page beside
 * it what to draw, WITHOUT waiting for a refetch.
 *
 * The generic alternative is `plan-documents-persisted`: the portal context
 * refetches the plan, the page notices new ids and re-reads the library — two round
 * trips, and the band sits unchanged while the advisor watches. These two events
 * carry the change itself, so the hub can draw it on the same frame; the refetch
 * that follows reconciles.
 */
export const PLAN_DOCUMENTS_ADDED_EVENT = "plan-documents-added";
export const PLAN_DOCUMENTS_REMOVED_EVENT = "plan-documents-removed";

export interface PlanDocumentsAddedDetail {
  /** The plan the rows belong to (a page ignores another plan's event). */
  clientId: string;
  /** Row-shaped documents, as the documents API returns them. */
  rows: Record<string, unknown>[];
}

export interface PlanDocumentsRemovedDetail {
  clientId: string;
  /** The ids that are gone. */
  ids: string[];
}

/** Announce rows that were just persisted, so the hub can show them at once. */
export function announcePlanDocumentsAdded(
  clientId: string,
  rows: Record<string, unknown>[],
): void {
  if (typeof window === "undefined" || rows.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<PlanDocumentsAddedDetail>(PLAN_DOCUMENTS_ADDED_EVENT, {
      detail: { clientId, rows },
    }),
  );
}

/** Announce documents that were just deleted, so the hub can drop them at once. */
export function announcePlanDocumentsRemoved(
  clientId: string,
  ids: string[],
): void {
  const clean = ids.map((id) => String(id ?? "").trim()).filter(Boolean);
  if (typeof window === "undefined" || clean.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<PlanDocumentsRemovedDetail>(PLAN_DOCUMENTS_REMOVED_EVENT, {
      detail: { clientId, ids: clean },
    }),
  );
}

/**
 * Keep the page's document band in step with the Editing Panel, frame by frame.
 *
 * `targetHub` is this page's own hub label (`benefitCategoryToDocumentHubLabel`), so
 * an added row is mapped exactly as the page maps its library — same title, href
 * and description. Rows for another plan, or for another benefit's hub, are
 * dropped by the listener, and the caller dedupes by id so the later refetch
 * cannot double a card.
 */
export function usePlanDocumentChanges(options: {
  clientId?: string | null;
  targetHub: string;
  /** Show documents uploaded in the panel straight away. */
  onInsert: (items: RetirementDocumentItem[]) => void;
  /** Drop documents deleted in the panel straight away. */
  onRemove: (ids: string[]) => void;
}): { addedIds: MutableRefObject<Set<string>> } {
  const { clientId, targetHub, onInsert, onRemove } = options;
  // A new callback identity each render must not re-subscribe the listener.
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;
  /**
   * Ids the panel added and the page's own re-read has not confirmed yet.
   *
   * The panel announces an upload BEFORE the page's next library read, and that
   * read can answer from a request that started before the row was created. Without
   * this, a freshly drawn card would be wiped by a stale list and only come back a
   * beat later — the "it appears late" this exists to prevent.
   */
  const addedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!clientId) return;

    const handleAdded = (event: Event) => {
      const detail = (event as CustomEvent<PlanDocumentsAddedDetail>).detail;
      if (!detail || detail.clientId !== clientId) return;
      const rows = Array.isArray(detail.rows) ? detail.rows : [];
      if (rows.length === 0) return;
      const items = mapMergedRowsToBenefitHubItems(rows, targetHub);
      if (items.length === 0) return;
      for (const item of items) addedIds.current.add(item.id);
      onInsertRef.current(items);
    };

    const handleRemoved = (event: Event) => {
      const detail = (event as CustomEvent<PlanDocumentsRemovedDetail>).detail;
      if (!detail || detail.clientId !== clientId) return;
      const ids = Array.isArray(detail.ids)
        ? detail.ids.map((id) => String(id ?? "")).filter(Boolean)
        : [];
      if (ids.length === 0) return;
      for (const id of ids) addedIds.current.delete(id);
      onRemoveRef.current(ids);
    };

    window.addEventListener(PLAN_DOCUMENTS_ADDED_EVENT, handleAdded);
    window.addEventListener(PLAN_DOCUMENTS_REMOVED_EVENT, handleRemoved);
    return () => {
      window.removeEventListener(PLAN_DOCUMENTS_ADDED_EVENT, handleAdded);
      window.removeEventListener(PLAN_DOCUMENTS_REMOVED_EVENT, handleRemoved);
    };
  }, [clientId, targetHub]);

  return { addedIds };
}

/**
 * Keep a document the panel JUST drew, even when the read that answers next was
 * already in flight when the row was created.
 *
 * The page's own library read is the authority for everything else — its order,
 * renames, deletions made elsewhere — so this only re-adds the ids the panel
 * announced and that read has not confirmed yet. Once a read includes one, it stops
 * being tracked (see `addedIds`).
 */
export function preservePendingPlanDocuments(
  fetched: RetirementDocumentItem[],
  current: RetirementDocumentItem[],
  addedIds: MutableRefObject<Set<string>>,
): RetirementDocumentItem[] {
  const fetchedIds = new Set(fetched.map((doc) => doc.id));
  const pending = current.filter(
    (doc) => addedIds.current.has(doc.id) && !fetchedIds.has(doc.id),
  );
  for (const id of fetchedIds) addedIds.current.delete(id);
  if (pending.length === 0) return fetched;
  return [...fetched, ...pending];
}
