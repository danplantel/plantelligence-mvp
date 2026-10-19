import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../views/documents-cards-view", () => ({
  DocumentsCardsView: (props: any) => (
    <div
      data-testid="cards-view"
      data-count={props.documents.length}
      data-brand={props.brandColor}
      data-accent={props.accentColor}
      data-hide-category={String(!!props.hideCategoryBadge)}
    />
  ),
}));

import { DocumentPreviewTab } from "../document-preview-tab";

const documentFixture = {
  id: "doc-1",
  title: "SPD",
  description: "Summary",
  href: "/api/documents/doc-1/view",
  language: "EN" as const,
};

function renderTab(overrides: Partial<React.ComponentProps<typeof DocumentPreviewTab>> = {}) {
  render(
    <DocumentPreviewTab
      selectedPlan="plan-1"
      isLoading={false}
      documents={[documentFixture] as any}
      onDelete={vi.fn()}
      onDownload={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("DocumentPreviewTab", () => {
  it("asks for a plan when none is selected", () => {
    renderTab({ selectedPlan: "" });

    expect(
      screen.getByText("Please select a plan to view document preview"),
    ).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    renderTab({ isLoading: true });

    expect(screen.getByText("Loading documents...")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    renderTab({ documents: [] });

    expect(screen.getByText("No documents found.")).toBeInTheDocument();
    expect(screen.queryByTestId("cards-view")).not.toBeInTheDocument();
  });

  it("renders the banner and wizard hint", () => {
    renderTab({ showWizardNextHint: true });

    expect(screen.getByText("Plan Documents Overview")).toBeInTheDocument();
    expect(
      screen.getByText(/This is how the documents will display/),
    ).toBeInTheDocument();
  });

  it("forwards documents and branding to the cards view", () => {
    renderTab({
      brandColor: "#123456",
      accentColor: "#654321",
      hideCategoryBadge: true,
    });

    const cards = screen.getByTestId("cards-view");
    expect(cards).toHaveAttribute("data-count", "1");
    expect(cards).toHaveAttribute("data-brand", "#123456");
    expect(cards).toHaveAttribute("data-accent", "#654321");
    expect(cards).toHaveAttribute("data-hide-category", "true");
  });
});
