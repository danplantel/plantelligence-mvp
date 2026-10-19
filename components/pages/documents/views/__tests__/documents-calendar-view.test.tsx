import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentsCalendarView } from "../documents-calendar-view";
import { scheduleDayKeyToDate, todayScheduleDayKey } from "@/lib/date";

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <button type="button" onClick={() => onSelect?.(new Date(2026, 6, 4))}>
      pick-date
    </button>
  ),
}));

function dayKeyOffset(offset: number): string {
  const base = scheduleDayKeyToDate(todayScheduleDayKey());
  base.setDate(base.getDate() + offset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    title: "SPD 2025",
    fileName: "spd.pdf",
    type: "SPD",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    expirationDate: dayKeyOffset(5),
    client: { id: "plan-1", companyName: "Acme" },
    category: "Retirement",
    language: "EN" as const,
    ...overrides,
  };
}

function renderView(props: Partial<React.ComponentProps<typeof DocumentsCalendarView>> = {}) {
  const onPreview = vi.fn();
  const onUpdateReviewDate = vi.fn().mockResolvedValue(true);
  render(
    <DocumentsCalendarView
      documents={[makeDoc()]}
      onPreview={onPreview}
      onUpdateReviewDate={onUpdateReviewDate}
      {...props}
    />,
  );
  return { onPreview, onUpdateReviewDate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentsCalendarView", () => {
  it("shows the empty summary when no document has a review date", () => {
    renderView({ documents: [makeDoc({ expirationDate: undefined })] });

    expect(screen.getByText("No review dates scheduled")).toBeInTheDocument();
  });

  it("counts documents inside the 15-month window", () => {
    renderView({ documents: [makeDoc(), makeDoc({ id: "doc-2", title: "SBC" })] });

    expect(
      screen.getByText("2 documents with a review date in the next 15 months"),
    ).toBeInTheDocument();
  });

  it("excludes dates outside the window", () => {
    renderView({
      documents: [makeDoc({ expirationDate: dayKeyOffset(800) })],
    });

    expect(screen.getByText("No review dates scheduled")).toBeInTheDocument();
  });

  it("renders the month grid and a per-month count badge", () => {
    renderView();

    expect(screen.getAllByText("1 document").length).toBeGreaterThan(0);
    expect(screen.getByTitle("SPD 2025")).toBeInTheDocument();
  });

  it("opens the day drawer with the document's metadata", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTitle("SPD 2025"));

    expect(await screen.findByText("Documents for review")).toBeInTheDocument();
    expect(screen.getByText("SPD 2025")).toBeInTheDocument();
    expect(screen.getByText("Retirement")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText(/Review date:/)).toBeInTheDocument();
  });

  it("forwards the preview callback", async () => {
    const user = userEvent.setup();
    const { onPreview } = renderView();

    await user.click(screen.getByTitle("SPD 2025"));
    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-1", title: "SPD 2025" }),
    );
  });

  it("saves a newly picked review date", async () => {
    const user = userEvent.setup();
    const { onUpdateReviewDate } = renderView();

    await user.click(screen.getByTitle("SPD 2025"));
    await user.click(
      await screen.findByRole("button", { name: /Change review date/ }),
    );
    await user.click(await screen.findByText("pick-date"));
    await user.click(screen.getByRole("button", { name: "Save date" }));

    await waitFor(() =>
      expect(onUpdateReviewDate).toHaveBeenCalledWith("doc-1", "2026-07-04"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Save date")).not.toBeInTheDocument(),
    );
  });

  it("clears the review date", async () => {
    const user = userEvent.setup();
    const { onUpdateReviewDate } = renderView();

    await user.click(screen.getByTitle("SPD 2025"));
    await user.click(
      await screen.findByRole("button", { name: /Change review date/ }),
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(onUpdateReviewDate).toHaveBeenCalledWith("doc-1", null),
    );
  });

  it("keeps the editor open when the update fails", async () => {
    const user = userEvent.setup();
    const { onUpdateReviewDate } = renderView();
    onUpdateReviewDate.mockResolvedValue(false);

    await user.click(screen.getByTitle("SPD 2025"));
    await user.click(
      await screen.findByRole("button", { name: /Change review date/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save date" }));

    await waitFor(() => expect(onUpdateReviewDate).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Save date" })).toBeInTheDocument();
  });

  it("disables the save action while the update is in flight", async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveUpdate = resolve;
    });
    const { onUpdateReviewDate } = renderView();
    onUpdateReviewDate.mockReturnValue(pending);

    await user.click(screen.getByTitle("SPD 2025"));
    await user.click(
      await screen.findByRole("button", { name: /Change review date/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save date" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save date" })).toBeDisabled(),
    );

    resolveUpdate(true);
    await waitFor(() =>
      expect(screen.queryByText("Save date")).not.toBeInTheDocument(),
    );
  });
});
