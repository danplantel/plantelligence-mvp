import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Step5Onboarding } from "../step-5-onboarding";

const wizard = vi.hoisted(() => {
  const state = {
    step5SubStep: "review" as "review" | "disclosures" | "team",
    stepData: {
      branding: { organizationName: "Acme" },
      teamSize: { teamSize: "2_5" },
    } as Record<string, any>,
    setStep5SubStep: vi.fn(),
  };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  state.setStep5SubStep.mockImplementation((sub: typeof state.step5SubStep) => {
    state.step5SubStep = sub;
    notify();
  });

  return { state, listeners, notify };
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

vi.mock("@/components/wizard/steps/step-5a-summary", () => ({
  Step5aSummary: () => <div data-testid="step-5a">5a summary</div>,
}));

vi.mock("@/components/wizard/steps/step-5b-disclosures", () => ({
  Step5bDisclosures: ({
    errorFields = [],
    onValidationChange,
    organizationName,
    forceUniversalScope,
    onSkipForNow,
  }: {
    errorFields?: string[];
    onValidationChange?: (isValid: boolean) => void;
    organizationName?: string;
    forceUniversalScope?: boolean;
    onSkipForNow?: () => void;
  }) => (
    <div
      data-testid="step-5b"
      data-error-fields={errorFields.join(",")}
      data-organization-name={organizationName}
      data-force-universal={String(forceUniversalScope)}
      data-has-skip={String(typeof onSkipForNow === "function")}
    >
      5b disclosures
      <button
        type="button"
        onClick={() => onValidationChange?.(true)}
      >
        5b-valid
      </button>
    </div>
  ),
}));

vi.mock("@/components/wizard/steps/step-5c-team", () => ({
  Step5cTeam: ({
    errorFields = [],
    onValidationChange,
  }: {
    errorFields?: string[];
    onValidationChange?: (isValid: boolean) => void;
  }) => (
    <div
      data-testid="step-5c"
      data-error-fields={errorFields.join(",")}
    >
      5c team
      <button
        type="button"
        onClick={() => onValidationChange?.(true)}
      >
        5c-valid
      </button>
    </div>
  ),
}));

describe("Step5Onboarding", () => {
  beforeEach(() => {
    wizard.state.step5SubStep = "review";
    wizard.state.stepData = {
      branding: { organizationName: "Acme" },
      teamSize: { teamSize: "2_5" },
    };
    wizard.state.setStep5SubStep.mockClear();
  });

  it("shows only review and disclosures for a solo organization", () => {
    wizard.state.stepData.teamSize = { teamSize: "solo" };

    render(<Step5Onboarding />);

    expect(
      screen.getByRole("button", { name: /Review Your Information/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Compliance Disclosures/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Invite Your Team/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("step-5a")).toBeInTheDocument();
  });

  it("shows the team sub-step for organizations larger than one person", () => {
    render(<Step5Onboarding />);

    expect(
      screen.getByRole("button", { name: /Invite Your Team/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("step-5a")).toBeInTheDocument();
  });

  it("returns to a completed sub-step without walking through the footer", async () => {
    wizard.state.step5SubStep = "disclosures";

    render(<Step5Onboarding />);

    await userEvent.click(
      screen.getByRole("button", { name: /Review Your Information/ }),
    );

    expect(wizard.state.setStep5SubStep).toHaveBeenCalledWith("review");
    expect(await screen.findByTestId("step-5a")).toBeInTheDocument();
    expect(screen.queryByTestId("step-5b")).not.toBeInTheDocument();
  });

  it("does not allow jumping to a future sub-step", async () => {
    render(<Step5Onboarding />);

    const teamButton = screen.getByRole("button", {
      name: /Invite Your Team/,
    });
    expect(teamButton).toBeDisabled();

    await userEvent.click(teamButton);

    expect(wizard.state.setStep5SubStep).not.toHaveBeenCalledWith("team");
  });

  it("passes organization name, scope, errors, and the skip handler to 5b", () => {
    wizard.state.step5SubStep = "disclosures";
    const onStep5Skip = vi.fn();

    render(
      <Step5Onboarding
        errorFields={["disclosures"]}
        onStep5Skip={onStep5Skip}
      />,
    );

    const step5b = screen.getByTestId("step-5b");
    expect(step5b).toHaveAttribute("data-organization-name", "Acme");
    expect(step5b).toHaveAttribute("data-force-universal", "true");
    expect(step5b).toHaveAttribute("data-has-skip", "true");
    expect(step5b).toHaveAttribute("data-error-fields", "disclosures");
  });

  it("forwards 5b validity to the wizard", async () => {
    wizard.state.step5SubStep = "disclosures";
    const onValidationChange = vi.fn();

    render(<Step5Onboarding onValidationChange={onValidationChange} />);

    await userEvent.click(screen.getByRole("button", { name: "5b-valid" }));

    expect(onValidationChange).toHaveBeenCalledWith(true);
  });

  it("renders 5c and forwards its validity when the team step applies", async () => {
    wizard.state.step5SubStep = "team";
    const onValidationChange = vi.fn();

    render(
      <Step5Onboarding
        errorFields={["teamInvites"]}
        onValidationChange={onValidationChange}
      />,
    );

    expect(screen.getByTestId("step-5c")).toHaveAttribute(
      "data-error-fields",
      "teamInvites",
    );

    await userEvent.click(screen.getByRole("button", { name: "5c-valid" }));

    expect(onValidationChange).toHaveBeenCalledWith(true);
  });

  it("falls back to disclosures when the team step does not apply", () => {
    wizard.state.step5SubStep = "team";
    wizard.state.stepData.teamSize = { teamSize: "solo" };

    render(<Step5Onboarding />);

    expect(screen.getByTestId("step-5b")).toBeInTheDocument();
    expect(screen.queryByTestId("step-5c")).not.toBeInTheDocument();
  });

  it("omits the skip handler when the wizard does not provide one", () => {
    wizard.state.step5SubStep = "disclosures";

    render(<Step5Onboarding />);

    expect(screen.getByTestId("step-5b")).toHaveAttribute(
      "data-has-skip",
      "false",
    );
  });
});
