import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationType } from "@/types/wizard";

import { UserProfileSection } from "../sections/user-profile-section/user-profile-section";

const store = vi.hoisted(() => ({
  stepData: {} as Record<string, any>,
  saveStepDataLocally: vi.fn(),
  saveStepData: vi.fn(async () => undefined),
  loadStepData: vi.fn(async () => null),
  validateFieldOnBlur: vi.fn(async () => undefined),
  clearFieldError: vi.fn(),
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

describe("UserProfileSection", () => {
  beforeEach(() => {
    store.stepData = {};
    store.saveStepData.mockClear();
    store.saveStepData.mockResolvedValue(undefined);
    store.validateFieldOnBlur.mockClear();
    store.clearFieldError.mockClear();
  });

  it("renders every organization option and no custom field by default", () => {
    render(
      <FormWrapper>
        <UserProfileSection />
      </FormWrapper>,
    );

    expect(screen.getByText("Financial Advisor / RIA")).toBeInTheDocument();
    expect(screen.getByText("Employer / Plan Sponsor")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/benefits marketplace/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Your Organizaation")).toBeInTheDocument();
  });

  it("preselects a stored legacy organization type", () => {
    render(
      <FormWrapper defaultValues={{ organizationType: "ria" }}>
        <UserProfileSection />
      </FormWrapper>,
    );

    expect(
      screen.getByRole("radio", { name: /Financial Advisor \/ RIA/ }),
    ).toBeChecked();
  });

  it("saves the selected type and clears its stale error", async () => {
    render(
      <FormWrapper>
        <UserProfileSection />
      </FormWrapper>,
    );

    await userEvent.click(screen.getByText("Financial Advisor / RIA"));

    await waitFor(() =>
      expect(store.saveStepData).toHaveBeenCalledWith(
        "clientProfile",
        {
          organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
          customOrganization: undefined,
        },
        true,
      ),
    );
    expect(store.clearFieldError).toHaveBeenCalledWith("organizationType");
    expect(values()).toMatchObject({
      organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
    });
  });

  it("reveals the description field for Other and persists its text", async () => {
    render(
      <FormWrapper>
        <UserProfileSection />
      </FormWrapper>,
    );

    await userEvent.click(screen.getByText("Other"));

    const textarea = screen.getByPlaceholderText(/benefits marketplace/);
    expect(textarea).toBeInTheDocument();

    await userEvent.type(textarea, "Niche benefits marketplace");

    await waitFor(() =>
      expect(store.saveStepData).toHaveBeenCalledWith(
        "clientProfile",
        {
          organizationType: OrganizationType.OTHER,
          customOrganization: "Niche benefits marketplace",
        },
        true,
      ),
    );
    expect(store.clearFieldError).toHaveBeenCalledWith("customOrganization");
  });

  it("clears custom text when switching away from Other", async () => {
    render(
      <FormWrapper
        defaultValues={{
          organizationType: OrganizationType.OTHER,
          customOrganization: "Old custom",
        }}
      >
        <UserProfileSection />
      </FormWrapper>,
    );

    await userEvent.click(screen.getByText("Financial Advisor / RIA"));

    await waitFor(() =>
      expect(store.saveStepData).toHaveBeenCalledWith(
        "clientProfile",
        {
          organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
          customOrganization: undefined,
        },
        true,
      ),
    );
    expect(values()).toMatchObject({ customOrganization: "" });
    expect(
      screen.queryByPlaceholderText(/benefits marketplace/),
    ).not.toBeInTheDocument();
  });

  it("does not autosave when disableAutoSave is set", async () => {
    render(
      <FormWrapper>
        <UserProfileSection disableAutoSave />
      </FormWrapper>,
    );

    await userEvent.click(screen.getByText("Financial Advisor / RIA"));

    expect(store.saveStepData).not.toHaveBeenCalled();
  });

  it("shows required-field errors", () => {
    render(
      <FormWrapper>
        <UserProfileSection
          errorFields={["organizationType", "customOrganization"]}
        />
      </FormWrapper>,
    );

    expect(
      screen.getByText("Please select an organization type"),
    ).toBeInTheDocument();
  });

  it("validates the organization type on blur outside the radio group", () => {
    const { container } = render(
      <FormWrapper>
        <UserProfileSection />
      </FormWrapper>,
    );

    const group = container.querySelector(
      '[data-field="organizationType"]',
    ) as HTMLElement;
    fireEvent.blur(group, { relatedTarget: document.body });

    expect(store.validateFieldOnBlur).toHaveBeenCalledWith(
      1,
      "organizationType",
      expect.objectContaining({
        clientProfile: expect.objectContaining({
          organizationType: undefined,
        }),
      }),
    );
  });

  it("ignores blur moving between radios", () => {
    const { container } = render(
      <FormWrapper>
        <UserProfileSection />
      </FormWrapper>,
    );

    const group = container.querySelector(
      '[data-field="organizationType"]',
    ) as HTMLElement;
    const insideRadio = group.querySelector("button") as HTMLElement;
    fireEvent.blur(group, { relatedTarget: insideRadio });

    expect(store.validateFieldOnBlur).not.toHaveBeenCalled();
  });

  it("renders without the card heading when hideCard is set", () => {
    render(
      <FormWrapper>
        <UserProfileSection hideCard />
      </FormWrapper>,
    );

    expect(screen.queryByText("Your Organizaation")).not.toBeInTheDocument();
    expect(screen.getByText("Financial Advisor / RIA")).toBeInTheDocument();
  });
});
