import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A benefit hub's blue edit buttons.
 *
 * The four hub pages are one template, so this suite pins the template once: each
 * region the benefit panel edits carries a button, and each button names the panel
 * ANCHOR that owns it. (`benefits-editor-panel.tsx` renders its sections as
 * children, so the anchors are hand-applied there and a typo would silently open the
 * panel at the top.)
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
    profile: null,
    loading: false,
    refetch: vi.fn(),
  }),
}));

// The plan's benefit read has not answered; the page falls back to the preview
// snapshot, which is empty here. Only the buttons matter to this suite.
vi.mock("swr", () => ({
  default: () => ({ data: undefined, error: null }),
}));

vi.mock("@/lib/fetch-plan-documents-client", () => ({
  fetchPlanDocumentsForClient: async () => [],
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  useOptionalPortalEditing: () => mocks.editing.value,
}));

// The regions are covered by their own suites; here they are landmarks.
vi.mock(
  "@/components/pages/client-portal/sections/portal-welcome-banner",
  () => ({ PortalWelcomeBanner: () => <div>banner</div> }),
);
vi.mock("@/components/pages/client-portal/sections/benefits-video-section", () => ({
  BenefitsVideoSection: () => <div>journey</div>,
}));
vi.mock(
  "@/components/pages/client-portal/sections/how-can-we-help-section",
  () => ({
    HowCanWeHelpSection: () => <div>help cards</div>,
    formatPlanGroupIdLabel: () => "",
  }),
);
vi.mock("@/components/pages/client-portal/sections/quick-answers-section", () => ({
  QuickAnswersSection: () => <div>quick answers</div>,
}));
vi.mock("@/components/pages/client-portal/sections/have-questions", () => ({
  HaveQuestions: () => <div>have questions</div>,
}));
vi.mock(
  "@/components/pages/client-portal/sections/benefit-document-section",
  () => ({ BenefitDocumentSection: () => <div>documents</div> }),
);
vi.mock(
  "@/components/pages/client-portal/sections/completeness-auto-trigger",
  () => ({ CompletenessAutoTrigger: () => null }),
);

import RetirementPage from "../page";

describe("Retirement hub — blue edit affordances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.value = { canEdit: true, focusSection: mocks.focusSection };
  });

  it("offers one button per editable region, in page order", () => {
    render(<RetirementPage />);

    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Edit header background",
      "Edit video section",
      "Edit how we can help",
      "Edit quick answers",
      "Edit have questions",
    ]);
  });

  it("names the benefit panel's anchor for each region", async () => {
    const user = userEvent.setup();
    render(<RetirementPage />);

    for (const label of [
      "Edit header background",
      "Edit video section",
      "Edit how we can help",
      "Edit quick answers",
      "Edit have questions",
    ]) {
      await user.click(screen.getByRole("button", { name: label }));
    }

    expect(mocks.focusSection.mock.calls).toEqual([
      ["benefit-hero-image"],
      ["benefit-video"],
      ["benefit-help"],
      ["benefit-quick-answers"],
      ["benefit-have-questions"],
    ]);
  });

  it("draws no button for a participant", () => {
    mocks.editing.value = null;
    render(<RetirementPage />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
