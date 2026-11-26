import React from "react";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The portal panel's "Benefit Documents" section.
 *
 * One flow instead of tabs: the AI-named uploader sits above the benefit's own
 * rows, each row carries its quick actions on a line of its own, and every change
 * is written to the plan's library immediately — a delete removes the row, a rename
 * PATCHes it, and both announce `plan-documents-persisted` so the hub re-reads.
 */

const RETIREMENT_DOC = {
  id: "cmwuveth9000j62a0dbv0jopi",
  title: "Retirement Plan Enrollment Guide",
  shortDescription: "How to enroll.",
  storageKey: "org/org-1/plans/plan-1/documents/Retirement/guide.pdf",
  category: "Retirement",
};

const HEALTH_DOC = {
  id: "cmwuvesfl000h62a0qp5ww5mc",
  title: "Health Plan Summary",
  storageKey: "org/org-1/plans/plan-1/documents/Group%20Health/summary.pdf",
  category: "Group Health",
};

const mocks = vi.hoisted(() => ({
  fetchPlanDocumentsForClient: vi.fn(),
  persistNewDocumentsToApi: vi.fn(),
  deleteFromR2: vi.fn(async () => true),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// The scroll itself is the page's own helper (jsdom has no `scrollIntoView`), so
// the assertion is "the section asked the page to show the band".
vi.mock("@/lib/portal-section-anchors", () => ({
  scrollToPortalSection: vi.fn(),
}));

vi.mock("@/lib/fetch-plan-documents-client", () => ({
  fetchPlanDocumentsForClient: mocks.fetchPlanDocumentsForClient,
}));

vi.mock("@/lib/benefits-document-persist", () => ({
  persistNewDocumentsToApi: mocks.persistNewDocumentsToApi,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: mocks.deleteFromR2,
}));

// The uploader is the Documents feature's own component, covered by its own
// suites; here it is a landmark that can hand back a file — either still staged
// (a `temp-` id) or already saved by the uploader's own auto-persist effect.
vi.mock(
  "@/components/pages/documents/components/compliance-documents-upload",
  () => ({
    ComplianceDocumentsUpload: ({
      onDocumentsChange,
    }: {
      onDocumentsChange?: (documents: unknown[]) => void;
    }) => (
      <>
        <button
          type="button"
          onClick={() => {
            const staged = {
              id: "temp-1",
              name: "New 401(k) Notice",
              file: "r2:stored",
              type: "other",
              size: 10,
              status: "success",
              storageKey: "org/org-1/plans/plan-1/documents/Retirement/notice.pdf",
              category: "Retirement",
            };
            onDocumentsChange?.([staged]);
          }}
        >
          Stage an upload
        </button>
        <button
          type="button"
          onClick={() => {
            const saved = {
              id: "cmwuvsaved0000000000000001",
              name: "Saved Notice",
              file: "r2:stored",
              type: "other",
              size: 10,
              status: "success",
              storageKey: "org/org-1/plans/plan-1/documents/Retirement/saved.pdf",
              category: "Retirement",
            };
            onDocumentsChange?.([saved]);
          }}
        >
          Stage an already-saved upload
        </button>
      </>
    ),
  }),
);

vi.mock("@/lib/compliance-document-utils", () => ({
  convertToDocumentFormat: async (row: Record<string, any>) => ({
    id: row.id,
    name: row.title,
    file: `/api/documents/${row.id}/view`,
    type: "other",
    size: 0,
    status: "success",
    shortDescription: row.shortDescription,
    storageKey: row.storageKey,
    category: row.category,
  }),
}));

import { scrollToPortalSection } from "@/lib/portal-section-anchors";
import { PortalBenefitDocumentsSection } from "../portal-benefit-documents-section";

function renderSection() {
  return render(
    <PortalBenefitDocumentsSection planId="plan-1" benefitCategory="Retirement" />,
  );
}

let dispatched: string[] = [];
/** Rows the section handed the page, so it could draw them at once. */
let addedRows: Record<string, unknown>[][] = [];
/** Ids the section told the page to drop. */
let removedIds: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  dispatched = [];
  addedRows = [];
  removedIds = [];
  mocks.fetchPlanDocumentsForClient.mockResolvedValue([
    RETIREMENT_DOC,
    HEALTH_DOC,
  ]);
  // A real persist swaps the staged `temp-` id for the row's id and returns a NEW
  // list — that is what tells the section something was written.
  mocks.persistNewDocumentsToApi.mockImplementation(
    async (_planId: string, documents: Record<string, any>[]) =>
      documents.map((doc) => ({ ...doc, id: "cmwnewrow00000000000000001" })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) })),
  );
  const originalDispatch = window.dispatchEvent.bind(window);
  vi.spyOn(window, "dispatchEvent").mockImplementation((event: Event) => {
    dispatched.push(event.type);
    if (event.type === "plan-documents-added") {
      addedRows.push(
        ((event as CustomEvent).detail?.rows ?? []) as Record<string, unknown>[],
      );
    }
    if (event.type === "plan-documents-removed") {
      removedIds.push(
        ...(((event as CustomEvent).detail?.ids ?? []) as string[]),
      );
    }
    return originalDispatch(event);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PortalBenefitDocumentsSection", () => {
  it("lists this benefit's documents only, with the quick actions on their own line", async () => {
    renderSection();

    const row = await screen.findByTestId("portal-benefit-document-row");
    expect(within(row).getByText("Retirement Plan Enrollment Guide")).toBeInTheDocument();
    expect(within(row).getByText("How to enroll.")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Rename" }),
    ).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Delete" })).toBeInTheDocument();

    // The Group Health document belongs to another benefit's list.
    expect(screen.queryByText("Health Plan Summary")).not.toBeInTheDocument();
    // No tabs, no separate preview surface.
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("renames a document through its row, then announces the change", async () => {
    const user = userEvent.setup();
    renderSection();

    const row = await screen.findByTestId("portal-benefit-document-row");
    await user.click(within(row).getByRole("button", { name: "Rename" }));

    const title = screen.getByLabelText("Title") as HTMLInputElement;
    expect(title.value).toBe("Retirement Plan Enrollment Guide");
    await user.clear(title);
    await user.type(title, "2026 Enrollment Guide");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/documents/${RETIREMENT_DOC.id}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    await waitFor(() =>
      expect(dispatched).toContain("plan-documents-persisted"),
    );
  });

  it("drops the row on the same frame it is confirmed, then deletes it", async () => {
    const user = userEvent.setup();
    renderSection();

    const row = await screen.findByTestId("portal-benefit-document-row");
    await user.click(within(row).getByRole("button", { name: "Delete" }));

    const dialog = within(await screen.findByRole("alertdialog"));
    await user.click(dialog.getByRole("button", { name: "Delete" }));

    // The card is gone at once — no round trip in front of it…
    await waitFor(() =>
      expect(
        screen.queryByText("Retirement Plan Enrollment Guide"),
      ).not.toBeInTheDocument(),
    );
    // …the page beside the panel is told on the same frame…
    await waitFor(() => expect(removedIds).toContain(RETIREMENT_DOC.id));

    // …and the row (then the stored object) is cleaned up behind it.
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/documents/${RETIREMENT_DOC.id}`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(mocks.deleteFromR2).toHaveBeenCalledWith(RETIREMENT_DOC.storageKey);
    await waitFor(() =>
      expect(dispatched).toContain("plan-documents-persisted"),
    );
  });

  it("puts the row back when the delete is refused", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "nope" }),
    } as unknown as Response);

    const user = userEvent.setup();
    renderSection();

    const row = await screen.findByTestId("portal-benefit-document-row");
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    await user.click(dialog.getByRole("button", { name: "Delete" }));

    // The row survived on the server, so it comes back — in the panel…
    await waitFor(() =>
      expect(
        screen.getByText("Retirement Plan Enrollment Guide"),
      ).toBeInTheDocument(),
    );
    // …and on the page, which had already been told to drop it.
    await waitFor(() => expect(addedRows.length).toBeGreaterThan(0));
  });

  it("persists a staged upload, re-reads the library and shows where it landed", async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByTestId("portal-benefit-document-row");
    await user.click(screen.getByRole("button", { name: "Stage an upload" }));

    await waitFor(() =>
      expect(mocks.persistNewDocumentsToApi).toHaveBeenCalledWith(
        "plan-1",
        expect.arrayContaining([expect.objectContaining({ id: "temp-1" })]),
      ),
    );
    await waitFor(() =>
      expect(dispatched).toContain("plan-documents-persisted"),
    );
    // …the page is handed the rows to draw, so the card is there before the
    // refetch has even answered…
    await waitFor(() => expect(addedRows.length).toBeGreaterThan(0));
    expect(addedRows[0]).toEqual([
      expect.objectContaining({
        id: "cmwnewrow00000000000000001",
        title: "New 401(k) Notice",
        category: "Retirement",
      }),
    ]);
    // …and the hub's Documents & Forms band is brought into view, so the advisor
    // sees the file rather than having to hunt for it.
    await waitFor(() =>
      expect(scrollToPortalSection).toHaveBeenCalledWith("benefit-documents"),
    );
  });

  it("hands the page a row the uploader already saved, before any write of its own", async () => {
    const user = userEvent.setup();
    renderSection();

    await screen.findByTestId("portal-benefit-document-row");
    // The uploader's own auto-persist effect won the race: the row is already
    // real, so this section's `persistNewDocumentsToApi` has nothing to write and
    // answers with the very array it was handed.
    mocks.persistNewDocumentsToApi.mockImplementation(
      async (_planId: string, documents: Record<string, any>[]) => documents,
    );

    await user.click(
      screen.getByRole("button", { name: "Stage an already-saved upload" }),
    );

    // The page still hears about the row — immediately, on that frame.
    await waitFor(() => expect(addedRows.length).toBeGreaterThan(0));
    expect(addedRows[0]).toEqual([
      expect.objectContaining({
        id: "cmwuvsaved0000000000000001",
        title: "Saved Notice",
        category: "Retirement",
      }),
    ]);
    expect(scrollToPortalSection).toHaveBeenCalledWith("benefit-documents");
  });
});
