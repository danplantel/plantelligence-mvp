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

