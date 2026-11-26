import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  announcePlanDocumentsAdded,
  announcePlanDocumentsRemoved,
  preservePendingPlanDocuments,
  usePlanDocumentChanges,
} from "../usePlanDocumentChanges";
import type { RetirementDocumentItem } from "@/components/pages/client-portal/sections/benefit-document-section";

/**
 * The Editing Panel's document edits must reach the page beside it in the same
 * frame, not after the context refetch and the page's own re-read. The panel
 * announces the ROWS it added and the IDS it removed; this hook applies them, for
 * that plan only and for this page's hub only.
 */
function mount(onInsert = vi.fn(), onRemove = vi.fn()) {
  renderHook(() =>
    usePlanDocumentChanges({
      clientId: "plan-1",
      targetHub: "Retirement",
      onInsert,
      onRemove,
    }),
  );
  return { onInsert, onRemove };
}

describe("usePlanDocumentChanges — added", () => {
  it("hands the page the rows its own plan just gained, as hub items", () => {
    const { onInsert } = mount();

    act(() => {
      announcePlanDocumentsAdded("plan-1", [
        {
          id: "cmwuveth9000j62a0dbv0jopi",
          title: "Enrollment Guide",
          category: "Retirement",
          language: "EN",
          shortDescription: "How to enroll.",
        },
      ]);
    });

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "cmwuveth9000j62a0dbv0jopi",
        title: "Enrollment Guide",
        description: "How to enroll.",
        href: "/api/documents/cmwuveth9000j62a0dbv0jopi/view",
      }),
    ]);
  });

  it("ignores another plan's rows", () => {
    const { onInsert } = mount();

    act(() => {
      announcePlanDocumentsAdded("plan-2", [
        { id: "cmw-other", title: "Someone else's", category: "Retirement" },
      ]);
    });

    expect(onInsert).not.toHaveBeenCalled();
  });

  it("ignores a document that belongs to another benefit's hub", () => {
    const { onInsert } = mount();

    act(() => {
      announcePlanDocumentsAdded("plan-1", [
        { id: "cmw-health", title: "Health summary", category: "Group Health" },
      ]);
    });

    expect(onInsert).not.toHaveBeenCalled();
  });

  it("does not announce an empty list", () => {
    const listener = vi.fn();
    window.addEventListener("plan-documents-added", listener);
    const { onInsert } = mount();

    act(() => {
      announcePlanDocumentsAdded("plan-1", []);
    });

    expect(listener).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
    window.removeEventListener("plan-documents-added", listener);
  });
});

describe("usePlanDocumentChanges — removed", () => {
  it("drops the ids this plan just lost", () => {
    const { onRemove } = mount();

    act(() => {
      announcePlanDocumentsRemoved("plan-1", ["cmwuveth9000j62a0dbv0jopi"]);
    });

    expect(onRemove).toHaveBeenCalledWith(["cmwuveth9000j62a0dbv0jopi"]);
  });

  it("ignores another plan's deletion", () => {
    const { onRemove } = mount();

    act(() => {
      announcePlanDocumentsRemoved("plan-2", ["cmw-other"]);
    });

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("does not announce an empty removal", () => {
    const listener = vi.fn();
    window.addEventListener("plan-documents-removed", listener);
    const { onRemove } = mount();

    act(() => {
      announcePlanDocumentsRemoved("plan-1", []);
    });

    expect(listener).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    window.removeEventListener("plan-documents-removed", listener);
  });
});

/**
 * A page's own library read can start BEFORE an upload commits, so its answer is a
 * list without the new document. That read must not wipe the card the panel already
 * drew — which is what "it only appears a moment later" actually was.
 */
describe("preservePendingPlanDocuments", () => {
  const item = (id: string): RetirementDocumentItem => ({
    id,
    title: id,
    description: "",
    href: "",
    language: "EN",
  });

  it("keeps the card the panel just drew while the read has not caught up", () => {
    const addedIds = { current: new Set(["cmw-new"]) };

    expect(
      preservePendingPlanDocuments(
        [item("cmw-old")],
        [item("cmw-new")],
        addedIds,
      ),
    ).toEqual([item("cmw-old"), item("cmw-new")]);
  });

  it("hands the read's own list back once it includes the card, and stops tracking it", () => {
    const addedIds = { current: new Set(["cmw-new"]) };
    const fetched = [item("cmw-new"), item("cmw-old")];

    expect(
      preservePendingPlanDocuments(fetched, [item("cmw-new")], addedIds),
    ).toBe(fetched);
    expect(addedIds.current.size).toBe(0);
  });

  it("never resurrects a document the panel did not add", () => {
    const addedIds = { current: new Set<string>() };
    const fetched = [item("cmw-old")];

    expect(
      preservePendingPlanDocuments(fetched, [item("cmw-gone")], addedIds),
    ).toBe(fetched);
  });
});
