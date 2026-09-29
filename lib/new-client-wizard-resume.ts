/**
 * Resume decision for the New-Client (plan) wizard.
 *
 * The rule this module exists to enforce:
 *
 *   **A draft is a row on the server, and only the server can say whether one exists.
 *   Browser storage is a cache of in-progress typing — never evidence that a plan exists.**
 *
 * ## The bug this replaces
 *
 * [`app/(dashboard)/new-client/page.tsx`](../app/(dashboard)/new-client/page.tsx:101) decided
 * whether to show "You have an in-progress plan" purely from `localStorage` and
 * `sessionStorage`. Three ways that goes wrong, all from the same root cause:
 *
 *  1. **A fresh database still showed the dialog.** Point the app at an empty Postgres (or
 *     delete the draft in View Plans) and the browser keeps the old blob, so the wizard
 *     offered to resume a plan that does not exist.
 *  2. **A stale hand-off pointer.** `sessionStorage["plantelligence:selectedDraftId"]` is a
 *     leftover from clicking a draft in View Plans; the dialog was shown even when loading
 *     that draft found nothing.
 *  3. **Cross-account bleed.** The blob is keyed `new-client-wizard` — per browser, not per
 *     user. Sign in as a second advisor on the same machine and their wizard rehydrated the
 *     first advisor's company name, contacts and images.
 *
 * The fix is to make the decision server-authoritative, and to refuse to adopt a blob that
 * cannot be attributed to the signed-in user. Deleting local state is only ever done when the
 * *server* says the draft is gone — a network error must never discard real work.
 *
 * Client-side only. No React, no Prisma.
 */
import { NEW_CLIENT_DRAFT_STORAGE_KEY } from "./draft-utils";

/** The Zustand persist key holding the wizard snapshot (`persist({ name })` in the store). */
export const NEW_CLIENT_WIZARD_STORAGE_KEY = "new-client-wizard";

/** Companion key: which user the snapshot belongs to. Not part of the store. */
export const NEW_CLIENT_WIZARD_OWNER_KEY = "new-client-wizard-owner";

/** Companion key: the human-readable "saved at" timestamp. Written by createSafeStorage. */
export const NEW_CLIENT_WIZARD_SAVED_AT_KEY = "new-client-wizard-saved-at";

/** Record that this browser's wizard snapshot belongs to `userId`. */
export function rememberWizardOwner(userId: string | null | undefined): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(NEW_CLIENT_WIZARD_OWNER_KEY, userId);
  } catch {
    /* Quota or private mode. The guard below stays conservative, so this is safe to skip. */
  }
}

/** The user this browser's wizard snapshot belongs to, or null when unattributable. */
export function readWizardOwner(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NEW_CLIENT_WIZARD_OWNER_KEY);
  } catch {
    return null;
  }
}

/** Remove every trace of the wizard's browser state. */
export function clearWizardBrowserState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NEW_CLIENT_WIZARD_STORAGE_KEY);
    window.localStorage.removeItem(NEW_CLIENT_WIZARD_SAVED_AT_KEY);
    window.localStorage.removeItem(NEW_CLIENT_WIZARD_OWNER_KEY);
    window.sessionStorage.removeItem(NEW_CLIENT_DRAFT_STORAGE_KEY);
  } catch {
    /* Storage unavailable — nothing to clear. */
  }
}

/**
 * May this user adopt the persisted wizard snapshot?
 *
 * Returns false for an unattributable snapshot as well as a foreign one — a missing owner
 * sentinel (state written before this guard existed), unreadable storage, or no snapshot at
 * all. Deliberately conservative: adopting a snapshot we cannot prove is yours is exactly how
 * one advisor's draft data appears in another advisor's wizard, and the cost of being wrong
 * the other way is one discarded blob whose server-side draft — if it exists — is still
 * reachable from View Plans.
 */
export function wizardBlobBelongsTo(userId: string | null | undefined): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    if (window.localStorage.getItem(NEW_CLIENT_WIZARD_STORAGE_KEY) === null) return false;
    return readWizardOwner() === userId;
  } catch {
    return false;
  }
}

/** Peek at the View-Plans hand-off pointer WITHOUT consuming it, so it can be verified first. */
export function peekPendingDraftId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(NEW_CLIENT_DRAFT_STORAGE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export type DraftLookup = "exists" | "missing" | "unknown";

/**
 * Ask the server whether a draft row still exists.
 *
 * `"unknown"` is a distinct, load-bearing answer: a network failure must NOT be read as
 * "the draft is gone", because the caller deletes local work on `"missing"`. Treating an
 * offline blip as a deletion would destroy the user's typing.
 */
export async function lookupDraft(draftId: string): Promise<DraftLookup> {
  try {
    const response = await fetch(`/api/clients/${encodeURIComponent(draftId)}`, {
      cache: "no-store",
    });
    if (response.ok) return "exists";
    if (response.status === 404) return "missing";
    // 401/403/500 — we cannot distinguish "gone" from "not allowed to look", so preserve.
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Format a server timestamp for the resume dialog, or "" when unusable. */
export function formatSavedAt(iso: string): string {
  try {
    const savedAt = new Date(iso);
    if (Number.isNaN(savedAt.getTime())) return "";
    return savedAt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** The local "saved at" timestamp written alongside the snapshot by createSafeStorage. */
export function readLocalSavedAt(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(NEW_CLIENT_WIZARD_SAVED_AT_KEY);
    if (!raw) return "";
    const timestamp = Number(raw);
    if (Number.isNaN(timestamp) || timestamp <= 0) return "";
    return formatSavedAt(new Date(timestamp).toISOString());
  } catch {
    return "";
  }
}

/**
 * Does the snapshot hold work a user would be upset to lose?
 *
 * Used to decide whether unsaved local typing should be PRESERVED when the server reports no
 * draft. It deliberately answers a narrower question than "is there any local state": once
 * the server has confirmed no draft exists, this data cannot be reconciled against anything,
 * so the only useful distinction is whether discarding it would destroy typing the user can
 * still see on screen.
 *
 * Accepts a structural slice rather than the store's `stepData` type, so this module stays
 * free of the store dependency.
 */
export function hasMeaningfulLocalWork(
  stepData:
    | {
        companyBasics?: { companyName?: string | null; planType?: string | null };
        welcomeStatement?: { headline?: string | null };
        keyContacts?: { contacts?: unknown[] | null };
      }
    | undefined,
): boolean {
  if (!stepData) return false;
  const headline = stepData.welcomeStatement?.headline;
  return (
    !!stepData.companyBasics?.companyName ||
    !!stepData.companyBasics?.planType?.trim() ||
    // The wizard ships this placeholder, so it is not evidence of authored content.
    (!!headline && headline !== "Welcome to the <Company Name> Benefits Hub!") ||
    !!(stepData.keyContacts?.contacts && stepData.keyContacts.contacts.length > 0)
  );
}
