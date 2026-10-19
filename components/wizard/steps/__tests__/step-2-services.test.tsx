import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Step2Services } from "../step-2-services";

const wizard = vi.hoisted(() => {
  const state = {
    stepData: {} as Record<string, any>,
    saveStepDataLocally: vi.fn(async () => undefined),
    saveStepData: vi.fn(async () => undefined),
    loadStepData: vi.fn(async (): Promise<any> => null),
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
  "@/components/wizard/steps/sections/services-section/services-section",
  () => ({
    ServicesSection: ({
      selectedServices,
      onServicesChange,
      customService,
      onCustomServiceChange,
      errorFields = [],
    }: {
      selectedServices: string[];
      onServicesChange?: (services: string[]) => void;
      customService: string;
      onCustomServiceChange: (value: string) => void;
      errorFields?: string[];
    }) => (
      <div
        data-testid="services-section"
        data-selected={selectedServices.join(",")}
        data-custom={customService}
        data-error-fields={errorFields.join(",")}
      >
        <button
          type="button"
          onClick={() => onServicesChange?.(["retirement"])}
        >
          select-retirement
        </button>
        <button
          type="button"
          onClick={() => onServicesChange?.(["group_health"])}
        >
          select-group-health
        </button>
        <button type="button" onClick={() => onServicesChange?.(["other"])}>
          select-other
        </button>
        <button type="button" onClick={() => onServicesChange?.([])}>
          clear-services
        </button>
        <button
          type="button"
          onClick={() => onCustomServiceChange("Custom benefit")}
        >
          set-custom-service
        </button>
      </div>
    ),
  }),
);

const licenses = [
  { id: "license-1", state: "CA", type: "life", number: "12345" },
];

describe("Step2Services", () => {
  beforeEach(() => {
    wizard.state.stepData = {};
    wizard.state.saveStepData.mockReset();
    wizard.state.saveStepData.mockResolvedValue(undefined);
    wizard.state.loadStepData.mockReset();
    wizard.state.loadStepData.mockResolvedValue(null);
  });

  it("seeds the section from stored services, custom service, and licenses", () => {
    wizard.state.stepData = {
      services: {
        services: ["retirement", "group_life_disability"],
        customService: "Stored custom",
      },
      insuranceLicensing: { licenses },
    };

    render(<Step2Services errorFields={["services"]} />);

    const section = screen.getByTestId("services-section");
    expect(section).toHaveAttribute(
      "data-selected",
      "retirement,group_life_disability",
    );
    expect(section).toHaveAttribute("data-custom", "Stored custom");
    expect(section).toHaveAttribute("data-error-fields", "services");
  });

  it("loads services from the server when the store has none", async () => {
    wizard.state.loadStepData.mockResolvedValue({
      services: ["supplemental_health"],
      customService: "Loaded custom",
    });

    render(<Step2Services />);

    await waitFor(() =>
      expect(screen.getByTestId("services-section")).toHaveAttribute(
        "data-selected",
        "supplemental_health",
      ),
    );
    expect(screen.getByTestId("services-section")).toHaveAttribute(
      "data-custom",
      "Loaded custom",
    );
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("services", true);
  });

  it("does not reload services when the store already has a selection", () => {
    wizard.state.stepData = {
      services: { services: ["retirement"] },
    };

    render(<Step2Services />);

    expect(wizard.state.loadStepData).not.toHaveBeenCalled();
  });

  it("saves a non-insurance selection and resets the insurance flag", async () => {
    wizard.state.stepData = {
      insuranceLicensing: { licenses },
    };

    render(<Step2Services />);

    await userEvent.click(
      screen.getByRole("button", { name: "select-retirement" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "services",
        { services: ["retirement"], customService: "" },
        true,
      ),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "insuranceLicensing",
        {
          offersInsurance: false,
          attestation: false,
          licenses,
        },
        true,
      ),
    );
  });

  it("marks the organization as offering insurance for health services", async () => {
    render(<Step2Services />);

    await userEvent.click(
      screen.getByRole("button", { name: "select-group-health" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "insuranceLicensing",
        expect.objectContaining({ offersInsurance: true }),
        true,
      ),
    );
  });

  it("clears custom service text when Other is deselected", async () => {
    wizard.state.stepData = {
      services: { services: ["other"], customService: "Existing custom" },
    };

    render(<Step2Services />);

    await userEvent.click(
      screen.getByRole("button", { name: "select-retirement" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "services",
        { services: ["retirement"], customService: "" },
        true,
      ),
    );
    expect(screen.getByTestId("services-section")).toHaveAttribute(
      "data-custom",
      "",
    );
  });

  it("keeps the custom service text when Other remains selected", async () => {
    wizard.state.stepData = {
      services: { services: ["other"], customService: "Existing custom" },
    };

    render(<Step2Services />);

    await userEvent.click(screen.getByRole("button", { name: "select-other" }));

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "services",
        { services: ["other"], customService: "Existing custom" },
        true,
      ),
    );
  });

  it("persists custom service edits with the current selection", async () => {
    wizard.state.stepData = {
      services: { services: ["retirement"], customService: "" },
    };

    render(<Step2Services />);

    await userEvent.click(
      screen.getByRole("button", { name: "set-custom-service" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "services",
        { services: ["retirement"], customService: "Custom benefit" },
        true,
      ),
    );
    expect(screen.getByTestId("services-section")).toHaveAttribute(
      "data-custom",
      "Custom benefit",
    );
  });

  it("logs a failed services save without crashing", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    wizard.state.saveStepData.mockRejectedValue(new Error("server down"));

    render(<Step2Services />);

    await userEvent.click(
      screen.getByRole("button", { name: "select-retirement" }),
    );

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to save services:",
        expect.any(Error),
      ),
    );
    expect(screen.getByTestId("services-section")).toHaveAttribute(
      "data-selected",
      "retirement",
    );
  });
});
