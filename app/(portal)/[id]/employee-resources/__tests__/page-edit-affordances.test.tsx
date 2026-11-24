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
  /** The key the page hands SWR — which payload it reads from. */
  swrKey: null as string | null,
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
// The KEY is captured: it decides whether an armed editor sees a hidden hub's board.
vi.mock("swr", () => ({
  default: (key: string) => {
    mocks.swrKey = key;
    return {
      data: { enabled: true, topics: null },
      error: null,
    };
  },
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
    // The page prints the plan/group id through this helper, so the mock has to
    // carry it too — a partial mock that omits it crashes the whole route.
    formatPlanGroupIdLabel: (value?: string | null) => value ?? "",
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
    mocks.swrKey = null;
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

  it("reads the BUILDER payload in an armed edit view", () => {
    // The participant payload answers `topics: null` while the hub is unpublished,
    // which is why Quick Answers vanished until the page was published. An armed
    // editor reads the builder payload, where the board is always present.
    render(<EmployeeResourcesPage />);

    expect(mocks.swrKey).toBe("/api/clients/plan-1/employee-resources");
  });

  it("keeps the participant payload when no editor is armed", () => {
    mocks.editing.value = null;

    render(<EmployeeResourcesPage />);

    expect(mocks.swrKey).toBe(
      "/api/clients/plan-1/employee-resources?forPortal=1",
    );
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
