import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompletenessAutoTrigger } from "../completeness-auto-trigger";

/**
 * `CompletenessAutoTrigger` decides, on mount, whether a hub page should open
 * the "Incomplete Benefit Setup" dialog.
 *
 * Two behaviours are worth pinning here:
 *
 *  - it computes against the **merged** document list (API rows + the embedded
 *    ones), not the embedded list alone, so a document that only exists in the
 *    database is not reported as missing;
 *  - it computes *before* that merge resolves too, which means the first pass
 *    can report **"Plan documents missing"** and open the dialog, then close it
 *    when the merge lands. The render log below records that sequence.
 *
 * The dialog is stubbed to a JSON dump: the question is what the trigger
 * decides, not how the dialog looks.
 */

const mocks = vi.hoisted(() => ({
  completeness: vi.fn(),
  fetchDocs: vi.fn(),
  merge: vi.fn((api: unknown[], embedded: unknown[]) => [...api, ...embedded]),
  dialogRenders: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/benefit-completeness", () => ({
  getBenefitCompleteness: (category: string, data: unknown) =>
    mocks.completeness(category, data),
}));

vi.mock("@/lib/fetch-plan-documents-client", () => ({
  fetchPlanDocumentsForClient: (...args: unknown[]) => mocks.fetchDocs(...args),
}));

vi.mock("@/lib/plan-client-documents-merge", () => ({
  mergePlanDocumentRows: (api: unknown[], embedded: unknown[]) =>
    mocks.merge(api, embedded),
}));

vi.mock("../incomplete-benefit-dialog", () => ({
  IncompleteBenefitDialog: (props: Record<string, unknown>) => {
    mocks.dialogRenders.push(props);
    return <pre data-testid="dialog">{JSON.stringify(props)}</pre>;
  },
}));

const COMPLETE = { isComplete: true, missingInfo: [] };
const INCOMPLETE = {
  isComplete: false,
  missingInfo: ["Plan documents missing"],
};

function client(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Acme",
    documents: [{ id: "doc-1" }],
    keyContacts: [],
    ...overrides,
  };
}

function dialogProps() {
  return JSON.parse(screen.getByTestId("dialog").textContent || "{}");
}

function renderTrigger(
  props: Partial<React.ComponentProps<typeof CompletenessAutoTrigger>> = {},
) {
  return render(
    <CompletenessAutoTrigger
      category={"Retirement" as never}
      clientData={client()}
      clientId="plan-1"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dialogRenders = [];
  mocks.completeness.mockReturnValue(COMPLETE);
  mocks.fetchDocs.mockResolvedValue([]);
  mocks.merge.mockImplementation((api: unknown[], embedded: unknown[]) => [
    ...api,
    ...embedded,
  ]);
});

describe("CompletenessAutoTrigger", () => {
  it("opens the dialog for an incomplete benefit", async () => {
    mocks.completeness.mockReturnValue(INCOMPLETE);
    renderTrigger();

    await waitFor(() => expect(dialogProps().isOpen).toBe(true));
    expect(dialogProps()).toMatchObject({
      category: "Retirement",
      clientId: "plan-1",
      missingInfo: ["Plan documents missing"],
    });
  });

  it("stays closed for a complete benefit", async () => {
    renderTrigger();

    await waitFor(() => expect(mocks.completeness).toHaveBeenCalled());
    expect(dialogProps().isOpen).toBe(false);
    expect(dialogProps().missingInfo).toEqual([]);
  });

  it("computes against the merged documents", async () => {
    mocks.fetchDocs.mockResolvedValue([{ id: "api-doc" }]);
    renderTrigger();

    await waitFor(() =>
      expect(mocks.completeness).toHaveBeenCalledWith(
        "Retirement",
        expect.objectContaining({
          documents: [{ id: "api-doc" }, { id: "doc-1" }],
        }),
      ),
    );
    expect(mocks.merge).toHaveBeenCalledWith(
      [{ id: "api-doc" }],
      [{ id: "doc-1" }],
    );
  });

  it("computes once on the embedded list before the merge resolves", async () => {
    // The first pass reports the documents missing, then the merge closes it.
    let release: (rows: unknown[]) => void = () => {};
    mocks.fetchDocs.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    mocks.completeness
      .mockReturnValueOnce(INCOMPLETE)
      .mockReturnValue(COMPLETE);

    renderTrigger();

    await waitFor(() =>
      expect(mocks.completeness).toHaveBeenCalledWith(
        "Retirement",
        expect.objectContaining({ documents: [{ id: "doc-1" }] }),
      ),
    );
    // The dialog was rendered open before the merge landed.
    expect(mocks.dialogRenders.some((props) => props.isOpen === true)).toBe(
      true,
    );

    await act(async () => {
      release([{ id: "api-doc" }]);
    });

    await waitFor(() => expect(dialogProps().isOpen).toBe(false));
    expect(mocks.dialogRenders[mocks.dialogRenders.length - 1]?.isOpen).toBe(
      false,
    );
  });

  it("does not fetch documents without a plan id", async () => {
    renderTrigger({ clientId: "" });

    await waitFor(() => expect(mocks.completeness).toHaveBeenCalled());
    expect(mocks.fetchDocs).not.toHaveBeenCalled();
  });

  it("re-fetches when the embedded document ids change", async () => {
    const { rerender } = renderTrigger();
    await waitFor(() => expect(mocks.fetchDocs).toHaveBeenCalledTimes(1));

    rerender(
      <CompletenessAutoTrigger
        category={"Retirement" as never}
        clientData={client({ documents: [{ id: "doc-1" }, { id: "doc-2" }] })}
        clientId="plan-1"
      />,
    );

    await waitFor(() => expect(mocks.fetchDocs).toHaveBeenCalledTimes(2));
  });

  it("does not re-fetch when the same ids arrive in a new array", async () => {
    const { rerender } = renderTrigger();
    await waitFor(() => expect(mocks.fetchDocs).toHaveBeenCalledTimes(1));

    rerender(
      <CompletenessAutoTrigger
        category={"Retirement" as never}
        clientData={client({ documents: [{ id: "doc-1" }] })}
        clientId="plan-1"
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.fetchDocs).toHaveBeenCalledTimes(1);
  });

  it("closes when the benefit becomes complete on a later update", async () => {
    mocks.completeness
      .mockReturnValueOnce(INCOMPLETE)
      .mockReturnValue(COMPLETE);
    const { rerender } = renderTrigger();

    await waitFor(() => expect(dialogProps().isOpen).toBe(true));

    rerender(
      <CompletenessAutoTrigger
        category={"Retirement" as never}
        clientData={client({ companyLogo: "https://cdn.test/logo.png" })}
        clientId="plan-1"
      />,
    );

    await waitFor(() => expect(dialogProps().isOpen).toBe(false));
  });

  it("stops working after unmount", async () => {
    let release: (rows: unknown[]) => void = () => {};
    mocks.fetchDocs.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const callsBefore = () => mocks.completeness.mock.calls.length;

    const { unmount } = renderTrigger();
    await waitFor(() => expect(mocks.completeness).toHaveBeenCalled());
    const afterMount = callsBefore();

    unmount();
    await act(async () => {
      release([{ id: "api-doc" }]);
    });

    expect(callsBefore()).toBe(afterMount);
  });
});
