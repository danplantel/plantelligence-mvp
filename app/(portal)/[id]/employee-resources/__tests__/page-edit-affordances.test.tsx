import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Employee Resources' three blue edit buttons.
 *
 * The page is three regions — the header photograph, the help cards and the quick
 * answers — and each one is a section of THIS page's Edit Panel. A button that
 * named the wrong section would open the panel at the top and leave the advisor to
 * find their own region, so the wiring is what these assertions cover: which anchor
 * each button asks for.
 */

const mocks = vi.hoisted(() => ({
  focusSection: vi.fn(),
  editing: {
    value: null as null | { canEdit: boolean; focusSection: (id: string) => void },
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({
    clientData: { id: "plan-1", companyName: "Acme", brandColor: "#123456" },
    loading: false,
    refetch: vi.fn(),
  }),
}));

// The page renders nothing until the hub read answers; only `enabled` matters here.
vi.mock("swr", () => ({
  default: () => ({
    data: { enabled: true, topics: null },
    error: null,
  }),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null, loading: false }),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

// The three regions are covered by their own suites; here they are just landmarks.
vi.mock("@/components/pages/client-portal/sections/news-events-header", () => ({
  NewsEventsHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock(
  "@/components/pages/client-portal/sections/how-can-we-help-section",
  () => ({
    HowCanWeHelpSection: () => <div>help cards</div>,
  }),
);

vi.mock(
  "@/components/pages/client-portal/sections/quick-answers-section",
  () => ({
    QuickAnswersSection: () => <div>quick answers</div>,
  }),
);

vi.mock("@/components/pages/client-portal/sections/have-questions", () => ({
  HaveQuestions: () => <div>have questions</div>,
}));

import EmployeeResourcesPage from "../page";

describe("Employee Resources — blue edit affordances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = {
      canEdit: true,
      focusSection: mocks.focusSection,
    };
  });

  it("offers one button per editable region, in page order", () => {
    render(<EmployeeResourcesPage />);

    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Edit hero background", "Edit how we can help", "Edit quick answers"]);
  });

  it("opens the panel on the hero section from the header's button", async () => {
    const user = userEvent.setup();
    render(<EmployeeResourcesPage />);

    await user.click(screen.getByRole("button", { name: "Edit hero background" }));

    expect(mocks.focusSection).toHaveBeenCalledWith("employee-resources-hero");
  });

  it("opens the panel on the help cards' section", async () => {
    const user = userEvent.setup();
    render(<EmployeeResourcesPage />);

    await user.click(
      screen.getByRole("button", { name: "Edit how we can help" }),
    );

    expect(mocks.focusSection).toHaveBeenCalledWith("employee-resources-help");
  });

  it("opens the panel on the quick answers' section", async () => {
    const user = userEvent.setup();
    render(<EmployeeResourcesPage />);

    await user.click(
      screen.getByRole("button", { name: "Edit quick answers" }),
    );

    expect(mocks.focusSection).toHaveBeenCalledWith(
      "employee-resources-quick-answers",
    );
  });

  it("draws no button for a participant", () => {
    mocks.editing.value = null;
    render(<EmployeeResourcesPage />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
