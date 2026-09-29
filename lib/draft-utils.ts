export const NEW_CLIENT_DRAFT_STORAGE_KEY =
  "plantelligence:selectedDraftId";

export const storePendingDraftSelection = (draftId: string) => {
  if (typeof window === "undefined" || !draftId) {
    return;
  }

  try {
    window.sessionStorage.setItem(NEW_CLIENT_DRAFT_STORAGE_KEY, draftId);
  } catch {
    // Best effort only – ignore storage errors
  }
};

export const consumePendingDraftSelection = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const draftId = window.sessionStorage.getItem(
      NEW_CLIENT_DRAFT_STORAGE_KEY,
    );

    if (draftId) {
      window.sessionStorage.removeItem(NEW_CLIENT_DRAFT_STORAGE_KEY);
    }

    return draftId;
  } catch {
    return null;
  }
};

/**
 * Read the pending selection WITHOUT consuming it.
 *
 * A caller must be able to verify the draft still exists before honouring the pointer — a
 * hand-off from View Plans can outlive the plan itself (deleted meanwhile, or the browser was
 * pointed at a fresh database). `consumePendingDraftSelection` clears the pointer as a side
 * effect, so it cannot be used for that check.
 */
export const peekPendingDraftSelection = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const draftId = window.sessionStorage.getItem(NEW_CLIENT_DRAFT_STORAGE_KEY);
    return draftId && draftId.trim() ? draftId : null;
  } catch {
    return null;
  }
};

