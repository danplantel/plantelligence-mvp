import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
  FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
  PLATFORM_DISCLOSURE_TEXT,
  combineDisclosureText,
} from "@/lib/disclaimer-constants";
import type { Disclaimer } from "@/types/wizard";

import { Step5bDisclosures } from "../step-5b-disclosures";

const POWERED_BY_PLATFORM_TEXT = "Powered by PlanTelligence®";
const BENEFITS_HUB_LOCATION = "Benefits Hub / Client Website";
const FLYER_LOCATION = "Marketing Materials";

const wizard = vi.hoisted(() => {
  const state = {
    stepData: { disclaimers: { disclaimers: [] } } as Record<string, any>,
    saveStepDataLocally: vi.fn(),
    saveStepDataToServer: vi.fn(async () => true),
    loadStepData: vi.fn(async (): Promise<any> => ({ disclaimers: [] })),
  };
  const listeners = new Set<() => void>();

  return {
    state,
    listeners,
    notify: () => listeners.forEach((listener) => listener()),
    newClient: {
      stepData: {},
      saveStepDataLocally: vi.fn(),
      saveStepDataToServer: vi.fn(async () => true),
    },
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

vi.mock("@/lib/new-client-wizard-store", () => ({
  useNewClientWizardStore: () => wizard.newClient,
}));

vi.mock(
  "@/components/wizard/steps/sections/attestation-modals/skip-attestation-modal",
  () => ({
    SkipAttestationModal: ({
      isOpen,
      onClose,
      onConfirm,
    }: {
      isOpen: boolean;
      onClose: () => void;
      onConfirm: () => void;
    }) =>
      isOpen ? (
        <div data-testid="skip-attestation">
          <button type="button" onClick={onClose}>
            close-skip
          </button>
          <button type="button" onClick={onConfirm}>
            confirm-skip
          </button>
        </div>
      ) : null,
  }),
);

function disclaimerText(
  call: unknown,
  location: string,
): string | undefined {
  const payload = call as {
    disclaimers?: Disclaimer[];
  };
  return payload.disclaimers?.find((item) =>
    (item.locations || []).includes(location),
  )?.text;
}

function lastLocalDisclaimers(): Disclaimer[] {
  const calls = wizard.state.saveStepDataLocally.mock.calls.filter(
    ([type]) => type === "disclaimers",
  );
  const last = calls.at(-1);
  return (last?.[1] as { disclaimers: Disclaimer[] } | undefined)?.disclaimers ?? [];
}

async function openEditor() {
  await userEvent.click(screen.getByRole("button", { name: "Add Now" }));
  expect(
    await screen.findByText("1. Benefits Hub Footer"),
  ).toBeInTheDocument();
}

describe("Step5bDisclosures", () => {
  beforeEach(() => {
    wizard.state.stepData = { disclaimers: { disclaimers: [] } };
    wizard.state.saveStepDataLocally.mockReset();
    wizard.state.saveStepDataToServer.mockReset();
    wizard.state.saveStepDataToServer.mockResolvedValue(true);
    wizard.state.loadStepData.mockReset();
    wizard.state.loadStepData.mockResolvedValue({ disclaimers: [] });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({}),
      })),
    );
  });

  it("starts with the two-action intro and reports the step as invalid", async () => {
    const onValidationChange = vi.fn();

    render(
      <Step5bDisclosures
        errorFields={[]}
        onValidationChange={onValidationChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Add Now/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Use Default \/ Skip for now/ }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(onValidationChange).toHaveBeenLastCalledWith(false),
    );
  });

  it("opens the disclosure editor from Add Now and reports the step as valid", async () => {
    const onValidationChange = vi.fn();

    render(
      <Step5bDisclosures
        errorFields={[]}
        onValidationChange={onValidationChange}
      />,
    );

    await openEditor();

    expect(screen.getByText("2. Flyer & Marketing")).toBeInTheDocument();
    expect(
      screen.getAllByPlaceholderText("Enter or paste your disclosure text here..."),
    ).toHaveLength(2);
    await waitFor(() =>
      expect(onValidationChange).toHaveBeenLastCalledWith(true),
    );
  });

  it("hands the skip action to the wizard when onSkipForNow is provided", async () => {
    const onSkipForNow = vi.fn();

    render(<Step5bDisclosures errorFields={[]} onSkipForNow={onSkipForNow} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Use Default \/ Skip for now/ }),
    );

    expect(onSkipForNow).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("skip-attestation")).not.toBeInTheDocument();
  });

  it("opens the skip attestation without a skip handler and persists recommended defaults on confirm", async () => {
    render(<Step5bDisclosures errorFields={[]} />);

    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalled(),
    );
    wizard.state.saveStepDataLocally.mockClear();
    wizard.state.saveStepDataToServer.mockClear();

    await userEvent.click(
      screen.getByRole("button", { name: /Use Default \/ Skip for now/ }),
    );
    expect(screen.getByTestId("skip-attestation")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "confirm-skip" }),
    );

    expect(screen.queryByTestId("skip-attestation")).not.toBeInTheDocument();
    expect(
      screen.getByText("1. Benefits Hub Footer"),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalled(),
    );

    const localCall = wizard.state.saveStepDataLocally.mock.calls.find(
      ([type, payload]) =>
        type === "disclaimers" &&
        disclaimerText(payload, BENEFITS_HUB_LOCATION) !== undefined,
    );
    expect(localCall).toBeDefined();
    expect(disclaimerText(localCall?.[1], BENEFITS_HUB_LOCATION)).toBe(
      combineDisclosureText(
        BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
        PLATFORM_DISCLOSURE_TEXT,
      ),
    );
    expect(disclaimerText(localCall?.[1], FLYER_LOCATION)).toBe(
      combineDisclosureText(
        FLYER_MARKETING_YOUR_DISCLOSURE_TEXT,
        POWERED_BY_PLATFORM_TEXT,
      ),
    );
  });

  it("persists the recommended copy when Use Default is selected", async () => {
    render(<Step5bDisclosures errorFields={[]} forceUniversalScope />);
    await openEditor();

    const recommended = document.getElementById(
      "benefits_hub-recommended",
    ) as HTMLElement;
    fireEvent.click(recommended);

    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalledWith(
        "disclaimers",
        expect.objectContaining({
          disclaimers: expect.arrayContaining([
            expect.objectContaining({
              locations: [BENEFITS_HUB_LOCATION],
            }),
          ]),
        }),
      ),
    );

    const saved = lastLocalDisclaimers();
    const benefits = saved.find((item) =>
      (item.locations || []).includes(BENEFITS_HUB_LOCATION),
    );
    expect(benefits?.text).toBe(
      combineDisclosureText(
        BENEFITS_HUB_YOUR_DISCLOSURE_TEXT,
        PLATFORM_DISCLOSURE_TEXT,
      ),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/onboarding-wizard/disclaimers",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("debounces and persists custom disclosure text", async () => {
    render(<Step5bDisclosures errorFields={[]} />);
    await openEditor();

    const [benefitsTextarea] = screen.getAllByPlaceholderText(
      "Enter or paste your disclosure text here...",
    );

    fireEvent.change(benefitsTextarea, {
      target: { value: "Custom disclosure copy" },
    });

    await waitFor(
      () => {
        const benefits = lastLocalDisclaimers().find((item) =>
          (item.locations || []).includes(BENEFITS_HUB_LOCATION),
        );
        expect(benefits?.text).toBe(
          combineDisclosureText(
            "Custom disclosure copy",
            PLATFORM_DISCLOSURE_TEXT,
          ),
        );
      },
      { timeout: 2000 },
    );
  });

  it("restores a saved custom disclosure and selects custom mode", async () => {
    const savedText = combineDisclosureText(
      "Previously saved copy",
      PLATFORM_DISCLOSURE_TEXT,
    );
    const stored: Disclaimer[] = [
      {
        id: "benefits-1",
        text: savedText,
        locations: [BENEFITS_HUB_LOCATION],
        customLocation: "",
      },
    ];
    wizard.state.stepData = { disclaimers: { disclaimers: stored } };
    wizard.state.loadStepData.mockResolvedValue({ disclaimers: stored });

    render(<Step5bDisclosures errorFields={[]} />);
    await openEditor();

    const [benefitsTextarea] = screen.getAllByPlaceholderText(
      "Enter or paste your disclosure text here...",
    );
    expect(benefitsTextarea).toHaveValue("Previously saved copy");
    expect(screen.getAllByLabelText("Add my own")[0]).toBeChecked();
  });

  it("caps custom text at the section limit", async () => {
    render(<Step5bDisclosures errorFields={[]} />);
    await openEditor();

    const [, flyerTextarea] = screen.getAllByPlaceholderText(
      "Enter or paste your disclosure text here...",
    );

    fireEvent.change(flyerTextarea, {
      target: { value: "x".repeat(300) },
    });

    expect(flyerTextarea).toHaveValue("x".repeat(250));
    expect(screen.getByText("250 / 250 characters")).toBeInTheDocument();
  });
});
