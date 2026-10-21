import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewClientStep5 } from "../step-5-disclaimer";

/**
 * Create Plan step 5 (Home Page footer disclosure).
 *
 * The footer editor and the portal footer are mocked, so the tests cover the
 * screen's own decisions: which disclaimer source wins on mount (saved plan →
 * seeded profile → inherited onboarding → platform default), the debounced
 * server write for inline edits, and the footer-background persistence.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};
  const onboarding: any = {
    stepData: { disclaimers: { disclaimers: [] }, branding: {} },
    loadStepData: vi.fn(async () => null),
  };
  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      stepData: {},
      saveStepDataLocally: vi.fn(),
      saveStepDataToServer: vi.fn(async () => ({})),
      draftClientId: "plan-1",
      advisorProfile: null,
      ...overrides,
    });
    return state;
  };
  return {
    state,
    onboarding,
    resetState,
    fetchProfileOnce: vi.fn(async () => null),
  };
});

vi.mock("@/lib/new-client-wizard-store", () => {
  const useNewClientWizardStore = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    { getState: () => mocks.state },
  );
  return { useNewClientWizardStore };
});

vi.mock("@/lib/onboarding-wizard-store", () => ({
  useOnboardingWizardStore: () => ({
    stepData: mocks.onboarding.stepData,
    loadStepData: mocks.onboarding.loadStepData,
  }),
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
}));

vi.mock("@/components/wizard/steps/sections/disclosure-footer-editor", () => ({
  DisclosureFooterEditor: ({
    text,
    mode,
    defaultText,
    onTextChange,
    onModeChange,
    onFooterBgModeChange,
  }: any) => (
    <div data-testid="footer-editor">
      <p data-testid="editor-text">{text}</p>
      <span data-testid="editor-mode">{mode}</span>
      <p data-testid="editor-default-text">{defaultText}</p>
      <button type="button" onClick={() => onTextChange(`${text} updated`)}>
        Append text
      </button>
      <button type="button" onClick={() => onModeChange("custom")}>
        Choose custom
      </button>
      <button type="button" onClick={() => onFooterBgModeChange("secondary")}>
        Secondary footer
      </button>
    </div>
  ),
}));

vi.mock("@/components/pages/client-portal/sections/portal-disclaimers", () => ({
  PortalDisclaimers: ({ companyData }: any) => (
    <div data-testid="portal-disclaimers">{companyData.disclaimers}</div>
  ),
}));

const defaultSave = {
  disclaimers: expect.any(Array),
  footerBackground: expect.any(Object),
};

beforeEach(() => {
  mocks.resetState();
  mocks.onboarding.stepData = {
    disclaimers: { disclaimers: [] },
    branding: {},
  };
  mocks.onboarding.loadStepData.mockReset().mockResolvedValue(null);
  mocks.fetchProfileOnce.mockReset().mockResolvedValue(null);
});

describe("NewClientStep5", () => {
  it("adopts the seeded profile disclaimer on mount and persists it", async () => {
    mocks.state.stepData = { companyBasics: { companyName: "Acme" } };
    // `User.disclaimer` is stored as an array (or JSON/plain text); a bare object
    // is ignored by `parseProfileDisclaimer`.
    mocks.state.advisorProfile = {
      disclaimer: [
        { id: "profile-1", text: "Profile disclosure for [Company Name]" },
      ],
      organizationName: "Advisor Firm",
    };

    render(<NewClientStep5 />);

    const editor = await screen.findByTestId("footer-editor");
    expect(editor).toHaveTextContent("Profile disclosure for Acme");
    expect(screen.getByTestId("editor-mode")).toHaveTextContent("custom");
    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
      "disclaimers",
      expect.objectContaining({
        disclaimers: [
          expect.objectContaining({
            id: "profile-1",
            text: "Profile disclosure for Acme",
            locations: ["Home Page"],
          }),
        ],
      }),
    );
    expect(mocks.fetchProfileOnce).not.toHaveBeenCalled();
  });

  it("shows a draft's saved disclaimer without fetching the profile", async () => {
    mocks.state.stepData = {
      companyBasics: { companyName: "Acme" },
      disclaimers: {
        disclaimers: [
          {
            id: "saved-1",
            text: "Saved disclosure for [Company Name]",
            locations: ["Home Page"],
          },
        ],
      },
    };

    render(<NewClientStep5 />);

    const editor = await screen.findByTestId("footer-editor");
    expect(editor).toHaveTextContent("Saved disclosure for Acme");
    expect(mocks.state.saveStepDataLocally).not.toHaveBeenCalled();
    expect(mocks.fetchProfileOnce).not.toHaveBeenCalled();
  });

  it("inherits the onboarding disclaimer when the plan and profile have none", async () => {
    mocks.onboarding.stepData = {
      disclaimers: {
        disclaimers: [{ id: "onb-1", text: "Onboarding disclosure" }],
      },
      branding: { organizationName: "Advisor Firm" },
    };
    mocks.state.stepData = { companyBasics: { companyName: "Acme" } };

    render(<NewClientStep5 />);

    await waitFor(() =>
      expect(screen.getByTestId("footer-editor")).toHaveTextContent(
        "Onboarding disclosure",
      ),
    );
    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
      "disclaimers",
      expect.objectContaining({
        disclaimers: [
          expect.objectContaining({
            text: "Onboarding disclosure",
            locations: ["Home Page"],
          }),
        ],
      }),
    );
  });

  it("seeds the platform default but leaves the choice unselected and blank", async () => {
    mocks.state.stepData = { companyBasics: { companyName: "Acme" } };

    render(<NewClientStep5 />);

    await waitFor(() =>
      expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
        "disclaimers",
        expect.objectContaining({
          disclaimers: [
            expect.objectContaining({
              text: expect.stringContaining("Acme"),
              locations: ["Home Page"],
            }),
          ],
        }),
      ),
    );
    expect(mocks.fetchProfileOnce).toHaveBeenCalledTimes(1);
    expect(mocks.onboarding.loadStepData).toHaveBeenCalledWith("disclaimers");
    // Neither radio is preselected and the editor starts blank; "Use Default"
    // is what writes the seeded copy into the field.
    expect(screen.getByTestId("editor-mode").textContent).toBe("");
    expect(screen.getByTestId("editor-text").textContent).toBe("");
    expect(screen.getByTestId("editor-default-text")).toHaveTextContent(
      "Acme",
    );
  });

  it("saves an inline edit locally at once and to the server after the debounce", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      companyBasics: { companyName: "Acme" },
      disclaimers: {
        disclaimers: [
          { id: "saved-1", text: "Existing", locations: ["Home Page"] },
        ],
      },
    };
    render(<NewClientStep5 />);
    await screen.findByTestId("footer-editor");

    await user.click(screen.getByRole("button", { name: "Append text" }));

    await waitFor(() =>
      expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
        "disclaimers",
        expect.objectContaining({
          disclaimers: [
            expect.objectContaining({
              text: expect.stringContaining("updated"),
            }),
          ],
        }),
      ),
    );

    await waitFor(
      () =>
        expect(mocks.state.saveStepDataToServer).toHaveBeenCalledWith(
          "disclaimers",
          defaultSave,
        ),
      { timeout: 3_000 },
    );
  });

  it("switches the editor into custom mode on request", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      companyBasics: { companyName: "Acme" },
      disclaimers: {
        disclaimers: [
          { id: "saved-1", text: "Existing", locations: ["Home Page"] },
        ],
      },
    };
    render(<NewClientStep5 />);
    await screen.findByTestId("footer-editor");

    await user.click(screen.getByRole("button", { name: "Choose custom" }));

    expect(screen.getByTestId("editor-mode")).toHaveTextContent("custom");
  });

  it("persists the footer background choice", async () => {
    const user = userEvent.setup();
    mocks.state.stepData = {
      companyBasics: { companyName: "Acme" },
      disclaimers: {
        disclaimers: [
          { id: "saved-1", text: "Existing", locations: ["Home Page"] },
        ],
      },
    };
    render(<NewClientStep5 />);
    await screen.findByTestId("footer-editor");

    await user.click(screen.getByRole("button", { name: "Secondary footer" }));

    await waitFor(() =>
      expect(mocks.state.saveStepDataToServer).toHaveBeenCalledWith(
        "disclaimers",
        {
          disclaimers: [
            expect.objectContaining({ id: "saved-1", text: "Existing" }),
          ],
          footerBackground: { mode: "secondary", customColor: "" },
        },
      ),
    );
  });
});
