import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Step5aSummary } from "../step-5a-summary";

const wizard = vi.hoisted(() => {
  const state = {
    stepData: {} as Record<string, any>,
    saveStepDataLocally: vi.fn(async () => undefined),
    loadStepData: vi.fn(async (): Promise<any> => undefined),
    saveStepData: vi.fn(async () => undefined),
    saveSummaryData: vi.fn(async () => undefined),
    startEditingFromReview: vi.fn(),
  };
  const listeners = new Set<() => void>();

  return {
    state,
    listeners,
    notify: () => listeners.forEach((listener) => listener()),
  };
});

vi.mock("@/lib/onboarding-wizard-store", () => {
  const useOnboardingWizardStore = (
    selector: (state: typeof wizard.state) => unknown = (state) => state,
  ) =>
    React.useSyncExternalStore(
      (onChange) => {
        wizard.listeners.add(onChange);
        return () => {
          wizard.listeners.delete(onChange);
        };
      },
      () => selector(wizard.state),
      () => selector(wizard.state),
    );

  useOnboardingWizardStore.getState = () => wizard.state;

  return { useOnboardingWizardStore };
});

const editData = {
  organizationType: "other",
  customOrganization: "Custom Org",
  website: "site.example",
  teamSize: "2_5",
  services: ["retirement"],
  customService: "Custom Service",
  brandColor: "#123456",
  missionStatement: "Our mission",
  logo: "r2/logo.png",
  backgroundImage: "r2/background.jpg",
  backgroundFileName: "background.jpg",
  name: "Ada",
  email: "ada@example.com",
  phone: "2135888888",
  title: "Advisor",
  designations: ["CFP"],
  saveAsContact: true,
  headshot: "r2/headshot.jpg",
  headshotFileName: "headshot.jpg",
  userBackgroundImage: "r2/user-bg.jpg",
  userBackgroundFileName: "user-bg.jpg",
};

vi.mock(
  "@/components/wizard/steps/sections/summary-edit-modals/summary-edit-modal",
  () => ({
    SummaryEditModal: ({
      isOpen,
      onSave,
    }: {
      isOpen: boolean;
      onSave: (data: unknown) => void;
    }) => (
      <div data-testid="summary-edit-modal" data-open={String(isOpen)}>
        <button
          type="button"
          onClick={() => onSave(editData)}
        >
          edit-modal-save
        </button>
      </div>
    ),
  }),
);

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ alt }: { alt?: string }) => <span data-testid="headshot">{alt}</span>,
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ alt }: { alt?: string }) => (
    <img data-testid="branding-image" alt={alt} />
  ),
}));

describe("Step5aSummary", () => {
  beforeEach(() => {
    wizard.state.stepData = {
      clientProfile: {
        organizationType: "financial_advisor_ria",
        customOrganization: "",
      },
      teamSize: { teamSize: "2_5" },
      services: {
        services: ["retirement", "group_health"],
        customService: "Custom Benefit",
      },
      branding: {
        organizationName: "Acme",
        website: "acme.example",
        primaryColor: "#111111",
        secondaryColor: "#222222",
        logo: "",
        backgroundImage: "",
      },
      userSetup: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        organizationEmail: "org@example.com",
        phone: "2135888888",
        phoneExtension: "12",
        title: "Advisor",
        designations: ["CFP"],
        saveAsContact: false,
        headshot: "",
      },
    };

    wizard.state.loadStepData.mockReset();
    wizard.state.loadStepData.mockResolvedValue(undefined);
    wizard.state.saveSummaryData.mockReset();
    wizard.state.saveSummaryData.mockResolvedValue(undefined);
    wizard.state.startEditingFromReview.mockReset();
  });

  it("loads every section's data when it mounts", async () => {
    render(<Step5aSummary />);

    await waitFor(() =>
      expect(wizard.state.loadStepData).toHaveBeenCalledTimes(5),
    );
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("clientProfile");
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("teamSize");
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("services");
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("branding");
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("userSetup");
  });

  it("renders the stored review values", () => {
    render(<Step5aSummary />);

    expect(screen.getByText("Financial Advisor / RIA")).toBeInTheDocument();
    expect(screen.getByText("2–5")).toBeInTheDocument();
    expect(
      screen.getByText("Retirement, Group Health, Custom Benefit"),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("acme.example")).toBeInTheDocument();
    expect(screen.getByText("#111111")).toBeInTheDocument();
    expect(screen.getByText("#222222")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace, CFP®")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("org@example.com")).toBeInTheDocument();
    expect(screen.getByText("(213) 588-8888")).toBeInTheDocument();
    expect(screen.getByText(/Ext\. 12/)).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("No logo")).toBeInTheDocument();
    expect(screen.getByText("No background image")).toBeInTheDocument();
  });

  it("opens each section in edit-from-review mode", async () => {
    render(<Step5aSummary />);

    const editButtons = screen.getAllByRole("button", { name: /Edit/ });
    expect(editButtons).toHaveLength(4);

    for (let index = 0; index < editButtons.length; index += 1) {
      await userEvent.click(editButtons[index]);
    }

    expect(wizard.state.startEditingFromReview.mock.calls).toEqual([
      [1],
      [2],
      [3],
      [4],
    ]);
  });

  it("saves edited values as one summary payload", async () => {
    render(<Step5aSummary />);

    await userEvent.click(
      screen.getByRole("button", { name: "edit-modal-save" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveSummaryData).toHaveBeenCalledWith({
        clientProfile: {
          organizationType: "other",
          customOrganization: "Custom Org",
          website: "site.example",
        },
        teamSize: { teamSize: "2_5" },
        services: {
          services: ["retirement"],
          customService: "Custom Service",
        },
        branding: {
          brandColor: "#123456",
          missionStatement: "Our mission",
          logo: "r2/logo.png",
          backgroundImage: "r2/background.jpg",
          backgroundFileName: "background.jpg",
        },
        userSetup: {
          name: "Ada",
          email: "ada@example.com",
          phone: "2135888888",
          phoneExtension: "",
          title: "Advisor",
          designations: ["CFP"],
          saveAsContact: true,
          headshot: "r2/headshot.jpg",
          headshotFileName: "headshot.jpg",
          backgroundImage: "r2/user-bg.jpg",
          backgroundFileName: "user-bg.jpg",
        },
      }),
    );
  });

  it("logs a failed summary save", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    wizard.state.saveSummaryData.mockRejectedValue(new Error("save failed"));

    render(<Step5aSummary />);

    await userEvent.click(
      screen.getByRole("button", { name: "edit-modal-save" }),
    );

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "❌ Step5a - Failed to save summary data:",
        expect.any(Error),
      ),
    );
  });

  it("renders placeholders for missing values", () => {
    wizard.state.stepData = {};

    render(<Step5aSummary />);

    expect(screen.getAllByText("Not specified").length).toBeGreaterThanOrEqual(
      5,
    );
    expect(screen.getByText("No logo")).toBeInTheDocument();
    expect(screen.getByText("No background image")).toBeInTheDocument();
  });
});
