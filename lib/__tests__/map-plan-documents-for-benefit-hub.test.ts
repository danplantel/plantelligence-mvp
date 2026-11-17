import { describe, expect, it } from "vitest";

import {
  benefitCategoryToDocumentHubLabel,
  mapMergedRowsToBenefitHubItems,
} from "@/lib/map-plan-documents-for-benefit-hub";

/**
 * The href a hub card carries.
 *
 * Reported symptom: on a benefit hub, "VIEW/DOWNLOAD" opened an empty modal and
 * the browser logged `Failed to launch 'r2:stored' because the scheme does not
 * have a registered handler`. The mapping decided "is this a persisted row?" by
 * testing for a 24-character MongoDB ObjectId. Ids are cuids in Postgres, so the
 * test was false for EVERY row and the href fell through to `fileUrl` — which is
 * the literal placeholder `"r2:stored"` for an R2 upload.
 *
 * A persisted row must open through `/api/documents/{id}/view` (the route that
 * signs the R2 object for the caller) whatever shape its id has, and a row with
 * no id may only use a `fileUrl` that is actually a URL.
 */

const RETIREMENT_HUB = benefitCategoryToDocumentHubLabel("Retirement");

/** A Postgres cuid, as `Document.id` is now. */
const CUID = "cm3kf0a1b0000abcd1234efgh";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: CUID,
    title: "Enrollment Booklet",
    fileName: "enrollment-booklet.pdf",
    fileUrl: "r2:stored",
    storageKey: "org/user-1/documents/retirement/enrollment-booklet.pdf",
    type: "Document",
    category: "Retirement",
    language: "EN",
    ...overrides,
  };
}

describe("mapMergedRowsToBenefitHubItems hrefs", () => {
  it("opens a persisted row through the view route, not its r2 placeholder", () => {
    const [item] = mapMergedRowsToBenefitHubItems([row()], RETIREMENT_HUB);

    expect(item.href).toBe(`/api/documents/${CUID}/view`);
    expect(item.href).not.toBe("r2:stored");
  });

  it("does the same for a legacy MongoDB ObjectId", () => {
    const mongoId = "5f1d7c9a2b3c4d5e6f7a8b9c";
    const [item] = mapMergedRowsToBenefitHubItems(
      [row({ id: mongoId })],
      RETIREMENT_HUB,
    );

    expect(item.href).toBe(`/api/documents/${mongoId}/view`);
  });

  it("keeps a real URL on a row that has not been persisted", () => {
    const dataUrl = "data:application/pdf;base64,JVBERi0xLjQK";
    const [item] = mapMergedRowsToBenefitHubItems(
      [row({ id: "plan-doc-1729000000000-abc", fileUrl: dataUrl })],
      RETIREMENT_HUB,
    );

    expect(item.href).toBe(dataUrl);
  });

  it("carries nothing openable for a draft row with only the placeholder", () => {
    const [item] = mapMergedRowsToBenefitHubItems(
      [row({ id: "plan-doc-1729000000000-abc", fileUrl: "r2:stored" })],
      RETIREMENT_HUB,
    );

    expect(item.href).toBe("");
  });

  it("carries nothing openable for a bare R2 key", () => {
    const [item] = mapMergedRowsToBenefitHubItems(
      [
        row({
          id: "doc-1729000000000-xyz",
          fileUrl: "org/user-1/documents/retirement/enrollment-booklet.pdf",
        }),
      ],
      RETIREMENT_HUB,
    );

    expect(item.href).toBe("");
  });

  it("keeps the stored file name so the preview knows the file type", () => {
    const [item] = mapMergedRowsToBenefitHubItems([row()], RETIREMENT_HUB);

    expect(item.fileName).toBe("enrollment-booklet.pdf");
  });

  it("still drops archived rows and other hubs", () => {
    expect(
      mapMergedRowsToBenefitHubItems(
        [row({ archivedAt: new Date("2026-01-01T00:00:00Z") })],
        RETIREMENT_HUB,
      ),
    ).toEqual([]);

    expect(
      mapMergedRowsToBenefitHubItems(
        [row({ category: "Group Health", storageKey: null })],
        RETIREMENT_HUB,
      ),
    ).toEqual([]);
  });
});
