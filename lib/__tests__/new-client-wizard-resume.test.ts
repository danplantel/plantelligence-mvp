import { beforeEach, describe, expect, it, vi } from "vitest";

import { NEW_CLIENT_DRAFT_STORAGE_KEY } from "../draft-utils";
import {
  NEW_CLIENT_WIZARD_OWNER_KEY,
  NEW_CLIENT_WIZARD_SAVED_AT_KEY,
  NEW_CLIENT_WIZARD_STORAGE_KEY,
  clearWizardBrowserState,
  formatSavedAt,
  hasMeaningfulLocalWork,
  lookupDraft,
  peekPendingDraftId,
  readLocalSavedAt,
  readWizardOwner,
  rememberWizardOwner,
  wizardBlobBelongsTo,
} from "../new-client-wizard-resume";

/**
 * Resume/ownership helpers.
 *
 * These decide whether unsaved browser typing may be adopted and whether a
 * draft row still exists. The distinction that matters is `lookupDraft`'s
 * three-value answer: only an explicit 404 may lead to discarding local work.
 */

const fetchMock = vi.fn();

function jsonResponse(ok: boolean, status = ok ? 200 : 500) {
  return { ok, status } as Response;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("wizard snapshot ownership", () => {
  it("round-trips the owner id", () => {
    rememberWizardOwner("user-1");

    expect(localStorage.getItem(NEW_CLIENT_WIZARD_OWNER_KEY)).toBe("user-1");
    expect(readWizardOwner()).toBe("user-1");
  });

  it("ignores a missing owner id", () => {
    rememberWizardOwner(null);
    rememberWizardOwner(undefined);
    rememberWizardOwner("");

    expect(localStorage.getItem(NEW_CLIENT_WIZARD_OWNER_KEY)).toBeNull();
  });

  it("survives storage that refuses to write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => rememberWizardOwner("user-1")).not.toThrow();
  });

  it("reads a null owner when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readWizardOwner()).toBeNull();
  });

  it("clears the snapshot, timestamp, owner and hand-off pointer", () => {
    localStorage.setItem(NEW_CLIENT_WIZARD_STORAGE_KEY, "{}");
    localStorage.setItem(NEW_CLIENT_WIZARD_SAVED_AT_KEY, "1");
    localStorage.setItem(NEW_CLIENT_WIZARD_OWNER_KEY, "user-1");
    sessionStorage.setItem(NEW_CLIENT_DRAFT_STORAGE_KEY, "draft-1");

    clearWizardBrowserState();

    expect(localStorage.getItem(NEW_CLIENT_WIZARD_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(NEW_CLIENT_WIZARD_SAVED_AT_KEY)).toBeNull();
    expect(localStorage.getItem(NEW_CLIENT_WIZARD_OWNER_KEY)).toBeNull();
    expect(sessionStorage.getItem(NEW_CLIENT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("swallows a failing clear", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => clearWizardBrowserState()).not.toThrow();
  });
});

describe("wizardBlobBelongsTo", () => {
  it("refuses a snapshot that does not exist", () => {
    rememberWizardOwner("user-1");

    expect(wizardBlobBelongsTo("user-1")).toBe(false);
  });

  it("refuses a snapshot with no recorded owner", () => {
    localStorage.setItem(NEW_CLIENT_WIZARD_STORAGE_KEY, "{}");

    expect(wizardBlobBelongsTo("user-1")).toBe(false);
  });

  it("refuses a snapshot owned by another user", () => {
    localStorage.setItem(NEW_CLIENT_WIZARD_STORAGE_KEY, "{}");
    rememberWizardOwner("user-2");

    expect(wizardBlobBelongsTo("user-1")).toBe(false);
  });

  it("accepts the owner's own snapshot", () => {
    localStorage.setItem(NEW_CLIENT_WIZARD_STORAGE_KEY, "{}");
    rememberWizardOwner("user-1");

    expect(wizardBlobBelongsTo("user-1")).toBe(true);
  });

  it("refuses to attribute a snapshot without a signed-in user", () => {
    localStorage.setItem(NEW_CLIENT_WIZARD_STORAGE_KEY, "{}");
    rememberWizardOwner("user-1");

    expect(wizardBlobBelongsTo(null)).toBe(false);
  });

  it("refuses a snapshot when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(wizardBlobBelongsTo("user-1")).toBe(false);
  });
});

describe("peekPendingDraftId", () => {
  it("returns the hand-off pointer without consuming it", () => {
    sessionStorage.setItem(NEW_CLIENT_DRAFT_STORAGE_KEY, "draft-1");

    expect(peekPendingDraftId()).toBe("draft-1");
    expect(sessionStorage.getItem(NEW_CLIENT_DRAFT_STORAGE_KEY)).toBe(
      "draft-1",
    );
  });

  it("treats a blank pointer as absent", () => {
    sessionStorage.setItem(NEW_CLIENT_DRAFT_STORAGE_KEY, "   ");

    expect(peekPendingDraftId()).toBeNull();
  });

  it("returns null when session storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(peekPendingDraftId()).toBeNull();
  });
});

describe("lookupDraft", () => {
  it("asks the server with no-store and an encoded id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(true));

    await expect(lookupDraft("draft/1")).resolves.toBe("exists");

    expect(fetchMock).toHaveBeenCalledWith("/api/clients/draft%2F1", {
      cache: "no-store",
    });
  });

  it("reads a 404 as missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse(false, 404));

    await expect(lookupDraft("draft-1")).resolves.toBe("missing");
  });

  it.each([401, 403, 500])(
    "answers unknown for HTTP %i instead of discarding work",
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(false, status));

      await expect(lookupDraft("draft-1")).resolves.toBe("unknown");
    },
  );

  it("answers unknown when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(lookupDraft("draft-1")).resolves.toBe("unknown");
  });
});

describe("formatSavedAt", () => {
  it("formats a real timestamp", () => {
    const formatted = formatSavedAt("2026-03-01T10:00:00.000Z");

    expect(formatted).toContain("2026");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("returns an empty string for an unusable value", () => {
    expect(formatSavedAt("not-a-date")).toBe("");
    expect(formatSavedAt("")).toBe("");
  });
});

describe("readLocalSavedAt", () => {
  it("returns an empty string when nothing was stored", () => {
    expect(readLocalSavedAt()).toBe("");
  });

  it.each(["not-a-number", "0", "-5"])(
    "returns an empty string for %s",
    (raw) => {
      localStorage.setItem(NEW_CLIENT_WIZARD_SAVED_AT_KEY, raw);

      expect(readLocalSavedAt()).toBe("");
    },
  );

  it("formats a stored epoch timestamp", () => {
    localStorage.setItem(
      NEW_CLIENT_WIZARD_SAVED_AT_KEY,
      String(Date.UTC(2026, 2, 1, 10, 0, 0)),
    );

    expect(readLocalSavedAt()).toContain("2026");
  });

  it("returns an empty string when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readLocalSavedAt()).toBe("");
  });
});

describe("hasMeaningfulLocalWork", () => {
  it("reports nothing for missing or empty data", () => {
    expect(hasMeaningfulLocalWork(undefined)).toBe(false);
    expect(hasMeaningfulLocalWork({})).toBe(false);
  });

  it("counts a company name", () => {
    expect(
      hasMeaningfulLocalWork({ companyBasics: { companyName: "Acme" } }),
    ).toBe(true);
  });

  it("ignores whitespace in the plan type but accepts a real one", () => {
    expect(hasMeaningfulLocalWork({ companyBasics: { planType: "   " } })).toBe(
      false,
    );
    expect(
      hasMeaningfulLocalWork({ companyBasics: { planType: "group" } }),
    ).toBe(true);
  });

  it("ignores the shipped welcome headline placeholder", () => {
    expect(
      hasMeaningfulLocalWork({
        welcomeStatement: {
          headline: "Welcome to the <Company Name> Benefits Hub!",
        },
      }),
    ).toBe(false);
    expect(
      hasMeaningfulLocalWork({
        welcomeStatement: { headline: "Welcome to Acme Benefits" },
      }),
    ).toBe(true);
  });

  it("counts authored contacts only", () => {
    expect(hasMeaningfulLocalWork({ keyContacts: { contacts: [] } })).toBe(
      false,
    );
    expect(
      hasMeaningfulLocalWork({ keyContacts: { contacts: [{ id: "c1" }] } }),
    ).toBe(true);
  });
});
