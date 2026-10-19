import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFormContext } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Step1UserProfile } from "../step-1-user-profile";

const wizard = vi.hoisted(() => {
  const state = {
    stepData: {} as Record<string, any>,
    saveStepDataLocally: vi.fn(),
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

vi.mock("@/hooks/use-scroll-to-error-field", () => ({
  useScrollToErrorField: vi.fn(),
}));

vi.mock(
  "@/components/wizard/steps/sections/user-profile-section/user-profile-section",
  () => ({
    UserProfileSection: ({ errorFields = [] }: { errorFields?: string[] }) => {
      const { setValue, watch } = useFormContext();

      return (
        <div
          data-testid="user-profile"
          data-error-fields={errorFields.join(",")}
        >
          <pre data-testid="form-values">{JSON.stringify(watch())}</pre>
          <button
            type="button"
            onClick={() =>
              setValue("organizationType", "financial_advisor_ria")
            }
          >
            choose-advisor
          </button>
          <button
            type="button"
            onClick={() => setValue("customOrganization", "Custom Org")}
          >
            custom-org
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "@/components/wizard/steps/sections/team-size-section/team-size-section",
  () => ({
    TeamSizeSection: ({ errorFields = [] }: { errorFields?: string[] }) => (
      <div
        data-testid="team-size"
        data-error-fields={errorFields.join(",")}
      />
    ),
  }),
);

function formValues(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId("form-values").textContent ?? "{}");
}

describe("Step1UserProfile", () => {
  beforeEach(() => {
    wizard.state.stepData = {};
  });

  it("renders the profile section and hides team size until an organization type is chosen", () => {
    render(<Step1UserProfile />);

    expect(screen.getByTestId("user-profile")).toBeInTheDocument();
    expect(screen.queryByTestId("team-size")).not.toBeInTheDocument();
  });

  it("reveals the team size section after an organization type is selected", async () => {
    render(<Step1UserProfile />);

    await userEvent.click(
      screen.getByRole("button", { name: "choose-advisor" }),
    );

    expect(await screen.findByTestId("team-size")).toBeInTheDocument();
    expect(formValues()).toMatchObject({
      organizationType: "financial_advisor_ria",
    });
  });

  it("prefills the form from stored step data", () => {
    wizard.state.stepData = {
      clientProfile: {
        organizationType: "financial_advisor_ria",
        customOrganization: "Stored Org",
      },
      teamSize: { teamSize: "two_to_five" },
    };

    render(<Step1UserProfile />);

    expect(formValues()).toMatchObject({
      organizationType: "financial_advisor_ria",
      customOrganization: "Stored Org",
      teamSize: "two_to_five",
    });
    // A stored organization type means team size is already visible.
    expect(screen.getByTestId("team-size")).toBeInTheDocument();
  });

  it("normalizes legacy organization type and team size ids", () => {
    wizard.state.stepData = {
      clientProfile: { organizationType: "ria" },
      teamSize: { teamSize: "just_me" },
    };

    render(<Step1UserProfile />);

    expect(formValues()).toMatchObject({
      organizationType: "financial_advisor_ria",
      teamSize: "solo",
    });
  });

  it("passes error fields to both sections", () => {
    wizard.state.stepData = {
      clientProfile: { organizationType: "financial_advisor_ria" },
    };

    render(<Step1UserProfile errorFields={["organizationType", "teamSize"]} />);

    expect(screen.getByTestId("user-profile")).toHaveAttribute(
      "data-error-fields",
      "organizationType,teamSize",
    );
    expect(screen.getByTestId("team-size")).toHaveAttribute(
      "data-error-fields",
      "organizationType,teamSize",
    );
  });

  it("resyncs the form when the store receives newer step data", async () => {
    const { rerender } = render(<Step1UserProfile />);

    wizard.state.stepData = {
      clientProfile: {
        organizationType: "hybrid_wealth_insurance",
        customOrganization: "New Org",
      },
      teamSize: { teamSize: "six_to_twenty" },
    };
    wizard.notify();
    rerender(<Step1UserProfile />);

    await waitFor(() =>
      expect(formValues()).toMatchObject({
        organizationType: "hybrid_wealth_insurance",
        customOrganization: "New Org",
        teamSize: "six_to_twenty",
      }),
    );
  });
});
