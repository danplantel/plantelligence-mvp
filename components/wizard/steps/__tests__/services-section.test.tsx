import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceType } from "@/types/wizard";

import { ServicesSection } from "../sections/services-section/services-section";

const store = vi.hoisted(() => ({
  validateFieldOnBlur: vi.fn(async () => undefined),
}));

vi.mock("@/lib/onboarding-wizard-store", () => ({
  useOnboardingWizardStore: () => store,
}));

vi.mock("@/components/ui/primary-service-categories-select", () => ({
  PrimaryServiceCategoriesSelect: ({
    selectedValues,
    onSelectionChange,
    destructive,
    dataField,
  }: {
    selectedValues: string[];
    onSelectionChange: (values: string[]) => void;
    destructive?: boolean;
    dataField?: string;
  }) => (
    <div
      data-testid="category-select"
      data-selected={selectedValues.join(",")}
      data-destructive={String(destructive)}
      data-field={dataField}
    >
      <button
        type="button"
        onClick={() => onSelectionChange(["Retirement"])}
      >
        select-retirement
      </button>
      <button
        type="button"
        onClick={() => onSelectionChange(["Retirement", "Group Health"])}
      >
        select-retirement-health
      </button>
      <button type="button" onClick={() => onSelectionChange(["Other"])}>
        select-other
      </button>
      <button type="button" onClick={() => onSelectionChange([])}>
        clear-categories
      </button>
    </div>
  ),
}));

function renderSection(
  overrides: Partial<React.ComponentProps<typeof ServicesSection>> = {},
) {
  const onServicesChange = vi.fn();
  const onCustomServiceChange = vi.fn();
  const props = {
    selectedServices: [ServiceType.RETIREMENT],
    onServicesChange,
    customService: "",
    onCustomServiceChange,
    ...overrides,
  };

  return {
    onServicesChange,
    onCustomServiceChange,
    ...render(<ServicesSection {...props} />),
  };
}

describe("ServicesSection", () => {
  beforeEach(() => {
    store.validateFieldOnBlur.mockClear();
  });

  it("maps selected services to category values", () => {
    renderSection({
      selectedServices: [
        ServiceType.RETIREMENT,
        ServiceType.GROUP_HEALTH,
      ],
    });

    expect(screen.getByTestId("category-select")).toHaveAttribute(
      "data-selected",
      "Retirement,Group Health",
    );
    expect(screen.getByTestId("category-select")).toHaveAttribute(
      "data-field",
      "services",
    );
  });

  it("emits ServiceType values when categories change", async () => {
    const { onServicesChange } = renderSection();

    await userEvent.click(
      screen.getByRole("button", { name: "select-retirement-health" }),
    );

    expect(onServicesChange).toHaveBeenCalledWith([
      ServiceType.RETIREMENT,
      ServiceType.GROUP_HEALTH,
    ]);
  });

  it("falls back to onServiceToggle when no bulk handler is provided", async () => {
    const onServiceToggle = vi.fn();
    renderSection({
      selectedServices: [ServiceType.RETIREMENT],
      onServicesChange: undefined,
      onServiceToggle,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "select-retirement-health" }),
    );

    // Only the added service is toggled; Retirement was already selected.
    expect(onServiceToggle).toHaveBeenCalledWith(ServiceType.GROUP_HEALTH);
  });

  it("toggles off services removed from the selection", async () => {
    const onServiceToggle = vi.fn();
    renderSection({
      selectedServices: [ServiceType.RETIREMENT, ServiceType.GROUP_HEALTH],
      onServicesChange: undefined,
      onServiceToggle,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "select-retirement" }),
    );

    expect(onServiceToggle).toHaveBeenCalledWith(
      ServiceType.GROUP_HEALTH,
    );
  });

  it("shows the custom field only when Other is selected", async () => {
    const { rerender, onCustomServiceChange } = renderSection({
      selectedServices: [],
      customService: "",
    });

    expect(
      screen.queryByPlaceholderText("Enter custom benefits..."),
    ).not.toBeInTheDocument();

    rerender(
      <ServicesSection
        selectedServices={[ServiceType.OTHER]}
        onServicesChange={vi.fn()}
        customService=""
        onCustomServiceChange={onCustomServiceChange}
      />,
    );

    const input = screen.getByPlaceholderText("Enter custom benefits...");
    await userEvent.type(input, "Custom benefit");

    expect(onCustomServiceChange).toHaveBeenCalled();
  });

  it("counts and caps custom text at 50 characters", () => {
    renderSection({
      selectedServices: [ServiceType.OTHER],
      customService: "x".repeat(50),
    });

    const input = screen.getByPlaceholderText("Enter custom benefits...");
    expect(input).toHaveAttribute("maxLength", "50");
    expect(screen.getByText("50/50 characters")).toBeInTheDocument();
  });

  it("validates services and the custom field on blur", () => {
    const { container, rerender } = renderSection();

    const servicesWrapper = container.querySelector(
      '[data-field="services"]',
    )?.parentElement as HTMLElement;
    fireEvent.blur(servicesWrapper, { relatedTarget: document.body });

    expect(store.validateFieldOnBlur).toHaveBeenCalledWith(2, "services");

    rerender(
      <ServicesSection
        selectedServices={[ServiceType.OTHER]}
        onServicesChange={vi.fn()}
        customService="Custom"
        onCustomServiceChange={vi.fn()}
      />,
    );

    fireEvent.blur(screen.getByPlaceholderText("Enter custom benefits..."), {
      relatedTarget: document.body,
    });

    expect(store.validateFieldOnBlur).toHaveBeenCalledWith(
      2,
      "customService",
    );
  });

  it("shows both required errors and marks the selector destructive", () => {
    renderSection({
      selectedServices: [ServiceType.OTHER],
      customService: "",
      errorFields: ["services", "customService"],
    });

    expect(screen.getByTestId("category-select")).toHaveAttribute(
      "data-destructive",
      "true",
    );
    expect(
      screen.getByText("Please select at least one service"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please specify your custom benefits"),
    ).toBeInTheDocument();
  });

  it("renders without the card heading when hideCard is set", () => {
    renderSection({ hideCard: true });

    expect(
      screen.queryByText(
        "Which service categories do you offer? (Select all that apply)",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("category-select")).toBeInTheDocument();
  });
});
