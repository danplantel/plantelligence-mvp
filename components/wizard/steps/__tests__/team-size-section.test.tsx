import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeamSize } from "@/types/wizard";

import { TeamSizeSection } from "../sections/team-size-section/team-size-section";

const store = vi.hoisted(() => ({
  stepData: {} as Record<string, any>,
  saveStepData: vi.fn(async () => undefined),
  validateFieldOnBlur: vi.fn(async () => undefined),
}));

vi.mock("@/lib/onboarding-wizard-store", () => ({
  useOnboardingWizardStore: () => store,
}));

function ValueProbe() {
  const { watch } = useFormContext();
  return <pre data-testid="form-values">{JSON.stringify(watch())}</pre>;
}

function FormWrapper({
  defaultValues = {},
  children,
}: {
  defaultValues?: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const methods = useForm({ defaultValues });
  return (
    <FormProvider {...methods}>
      {children}
      <ValueProbe />
    </FormProvider>
  );
}

function values() {
  return JSON.parse(screen.getByTestId("form-values").textContent ?? "{}");
}

describe("TeamSizeSection", () => {
  beforeEach(() => {
    store.stepData = {};
    store.saveStepData.mockClear();
    store.saveStepData.mockResolvedValue(undefined);
    store.validateFieldOnBlur.mockClear();
  });

  it("renders every band and the helper copy", () => {
    render(
      <FormWrapper>
        <TeamSizeSection />
      </FormWrapper>,
    );

    expect(screen.getByRole("radio", { name: /Just me/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /2–5/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /6–20/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /21\+/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Count Team Members within your organization only/),
    ).toBeInTheDocument();
  });

  it("preselects the stored band", () => {
    render(
      <FormWrapper defaultValues={{ teamSize: TeamSize.SIX_TWENTY }}>
        <TeamSizeSection />
      </FormWrapper>,
    );

    expect(screen.getByRole("radio", { name: /6–20/ })).toBeChecked();
  });

  it("saves the selected band", async () => {
    render(
      <FormWrapper>
        <TeamSizeSection />
      </FormWrapper>,
    );

    await userEvent.click(screen.getByRole("radio", { name: /2–5/ }));

    await waitFor(() =>
      expect(store.saveStepData).toHaveBeenCalledWith(
        "teamSize",
        { teamSize: TeamSize.TWO_FIVE },
        true,
      ),
    );
    expect(values()).toMatchObject({ teamSize: TeamSize.TWO_FIVE });
  });

  it("does not autosave when disableAutoSave is set", async () => {
    render(
      <FormWrapper>
        <TeamSizeSection disableAutoSave />
      </FormWrapper>,
    );

    await userEvent.click(screen.getByRole("radio", { name: /2–5/ }));

    expect(store.saveStepData).not.toHaveBeenCalled();
  });

  it("shows the required error", () => {
    render(
      <FormWrapper>
        <TeamSizeSection errorFields={["teamSize"]} />
      </FormWrapper>,
    );

    expect(
      screen.getByText("Please select a team size"),
    ).toBeInTheDocument();
  });

  it("validates the band on blur outside the group", () => {
    const { container } = render(
      <FormWrapper defaultValues={{ teamSize: TeamSize.SOLO }}>
        <TeamSizeSection />
      </FormWrapper>,
    );

    const group = container.querySelector(
      '[data-field="teamSize"]',
    ) as HTMLElement;
    fireEvent.blur(group, { relatedTarget: document.body });

    expect(store.validateFieldOnBlur).toHaveBeenCalledWith(
      1,
      "teamSize",
      expect.objectContaining({
        teamSize: { teamSize: TeamSize.SOLO },
      }),
    );
  });

  it("ignores blur moving between radios", () => {
    const { container } = render(
      <FormWrapper>
        <TeamSizeSection />
      </FormWrapper>,
    );

    const group = container.querySelector(
      '[data-field="teamSize"]',
    ) as HTMLElement;
    const inside = group.querySelector("button") as HTMLElement;
    fireEvent.blur(group, { relatedTarget: inside });

    expect(store.validateFieldOnBlur).not.toHaveBeenCalled();
  });

  it("renders without the card heading when hideCard is set", () => {
    render(
      <FormWrapper>
        <TeamSizeSection hideCard />
      </FormWrapper>,
    );

    expect(screen.queryByText("Team Size")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Just me/ })).toBeInTheDocument();
  });
});
