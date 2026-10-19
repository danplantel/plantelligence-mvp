import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserSetupSection } from "../sections/user-setup-section/user-setup-section";

const store = vi.hoisted(() => ({
  stepData: {
    branding: { organizationName: "Acme" },
    clientProfile: { organizationName: "Acme" },
  },
  loadAllWizardData: vi.fn(async () => ({})),
}));

const deleteFromR2 = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/onboarding-wizard-store", () => ({
  useOnboardingWizardStore: () => store,
}));

vi.mock("@/lib/upload-to-r2", () => ({ deleteFromR2 }));

vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: ({
    onChange,
    onRemove,
  }: {
    onChange: (value: string, fileName: string, data?: unknown) => void;
    onRemove: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onChange("r2/headshot.png", "headshot.png", { crop: "round" })
        }
      >
        upload-headshot
      </button>
      <button type="button" onClick={onRemove}>
        remove-headshot
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ alt }: { alt?: string }) => <span>{alt}</span>,
}));

vi.mock("@/components/ui/chip-typeahead", () => ({
  ChipTypeahead: ({
    selectedValues,
    onChange,
    dataField,
  }: {
    selectedValues: string[];
    onChange: (values: string[]) => void;
    dataField?: string;
  }) => (
    <div data-testid="designation-picker" data-field={dataField}>
      <span data-testid="selected-designations">
        {selectedValues.join(",")}
      </span>
      <button
        type="button"
        onClick={() => onChange(["CFP"])}
      >
        add-cfp
      </button>
      <button type="button" onClick={() => onChange([])}>
        clear-designations
      </button>
    </div>
  ),
}));

vi.mock("@/components/pages/settings/email-change-section", () => ({
  EmailChangeSection: () => <div data-testid="email-change" />,
}));
vi.mock("@/components/pages/settings/password-change-section", () => ({
  PasswordChangeSection: () => <div data-testid="password-change" />,
}));
vi.mock("@/components/pages/settings/google-account-section", () => ({
  GoogleAccountSection: () => <div data-testid="google-account" />,
}));

const defaultData = {
  name: "Ada",
  email: "ada@example.com",
  organizationEmail: "org@example.com",
  phone: "2135888888",
  phoneExtension: "12",
  title: "Financial Advisor",
  designations: [] as string[],
  headshot: "",
  headshotFileName: "",
  saveAsContact: true,
};

function FormWrapper({
  data = defaultData,
  onDataChange,
  onFieldBlur,
  ...props
}: {
  data?: typeof defaultData;
  onDataChange?: (field: string, value: unknown) => void;
  onFieldBlur?: (field: string) => void;
  alwaysShowDesignations?: boolean;
  hideDesignations?: boolean;
  hideCard?: boolean;
  emailChangeMode?: boolean;
  authProvider?: string;
  showPrimaryServiceCategories?: boolean;
  headshotFirst?: boolean;
}) {
  const methods = useForm({ defaultValues: data });
  return (
    <FormProvider {...methods}>
      <UserSetupSection
        data={data}
        onDataChange={onDataChange ?? vi.fn()}
        onFieldBlur={onFieldBlur}
        {...props}
      />
    </FormProvider>
  );
}

describe("UserSetupSection", () => {
  beforeEach(() => {
    store.stepData = {
      branding: { organizationName: "Acme" },
      clientProfile: { organizationName: "Acme" },
    };
    store.loadAllWizardData.mockClear();
    deleteFromR2.mockClear();
  });

  it("renders the profile fields and defaults Save as Contact on", () => {
    render(<FormWrapper />);

    expect(screen.getByPlaceholderText("Enter your full name")).toHaveValue(
      "Ada",
    );
    expect(
      screen.getByPlaceholderText("Enter your professional title"),
    ).toHaveValue("Financial Advisor");
    expect(
      screen.getByPlaceholderText("your.organization@example.com"),
    ).toHaveValue("org@example.com");
    expect(
      screen.getByRole("checkbox", {
        name: "Save me as a contact for future plans",
      }),
    ).toBeChecked();
  });

  it("reports name changes on blur", async () => {
    const onDataChange = vi.fn();
    const onFieldBlur = vi.fn();
    render(
      <FormWrapper
        onDataChange={onDataChange}
        onFieldBlur={onFieldBlur}
      />,
    );

    const name = screen.getByPlaceholderText("Enter your full name");
    fireEvent.change(name, { target: { value: "Ada Lovelace" } });
    fireEvent.blur(name);

    expect(onDataChange).toHaveBeenCalledWith("name", "Ada Lovelace");
    expect(onFieldBlur).toHaveBeenCalledWith("name");
  });

  it("persists title edits immediately and validates on blur", async () => {
    const onDataChange = vi.fn();
    const onFieldBlur = vi.fn();
    render(
      <FormWrapper
        onDataChange={onDataChange}
        onFieldBlur={onFieldBlur}
      />,
    );

    const title = screen.getByPlaceholderText(
      "Enter your professional title",
    );
    fireEvent.change(title, { target: { value: "Retirement Plan Advisor" } });

    expect(onDataChange).toHaveBeenCalledWith(
      "title",
      "Retirement Plan Advisor",
    );

    fireEvent.blur(title);
    expect(onFieldBlur).toHaveBeenCalledWith("title");
  });

  it("persists the organization email on blur", () => {
    const onDataChange = vi.fn();
    const onFieldBlur = vi.fn();
    render(
      <FormWrapper
        onDataChange={onDataChange}
        onFieldBlur={onFieldBlur}
      />,
    );

    const input = screen.getByPlaceholderText(
      "your.organization@example.com",
    );
    fireEvent.change(input, { target: { value: "hello@acme.example" } });
    fireEvent.blur(input);

    expect(onDataChange).toHaveBeenCalledWith(
      "organizationEmail",
      "hello@acme.example",
    );
    expect(onFieldBlur).toHaveBeenCalledWith("organizationEmail");
  });

  it("formats and normalizes the phone number", () => {
    const onDataChange = vi.fn();
    const onFieldBlur = vi.fn();
    render(
      <FormWrapper
        data={{ ...defaultData, phone: "" }}
        onDataChange={onDataChange}
        onFieldBlur={onFieldBlur}
      />,
    );

    const phone = screen.getByPlaceholderText("(555) 123-4567");
    fireEvent.change(phone, { target: { value: "2135888888" } });

    expect(phone).toHaveValue("(213) 588-8888");

    fireEvent.blur(phone);

    expect(onDataChange).toHaveBeenCalledWith("phone", "2135888888");
    expect(onFieldBlur).toHaveBeenCalledWith("phone");
  });

  it("toggles the Save as Contact preference", async () => {
    const onDataChange = vi.fn();
    render(<FormWrapper onDataChange={onDataChange} />);

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Save me as a contact for future plans",
      }),
    );

    expect(onDataChange).toHaveBeenCalledWith("saveAsContact", false);
  });

  it("renders the designations picker and live preview when relevant", () => {
    render(<FormWrapper />);

    expect(screen.getByText("Designations (Optional)")).toBeInTheDocument();
    expect(screen.getByTestId("designation-picker")).toHaveAttribute(
      "data-field",
      "designations",
    );
    expect(screen.getByText("Live Preview")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Financial Advisor")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("hides designations when hideDesignations is set", () => {
    render(<FormWrapper hideDesignations />);

    expect(
      screen.queryByText("Designations (Optional)"),
    ).not.toBeInTheDocument();
  });

  it("shows designations for titles with no suggestions when alwaysShowDesignations is set", () => {
    render(
      <FormWrapper
        data={{ ...defaultData, title: "Relationship Manager" }}
        alwaysShowDesignations
      />,
    );

    expect(screen.getByText("Designations (Optional)")).toBeInTheDocument();
  });

  it("persists designation selections and updates the preview", async () => {
    const onDataChange = vi.fn();
    render(<FormWrapper onDataChange={onDataChange} />);

    await userEvent.click(screen.getByRole("button", { name: "add-cfp" }));

    expect(onDataChange).toHaveBeenCalledWith("designations", ["CFP"]);
    await waitFor(() =>
      expect(screen.getByText("Ada, CFP®")).toBeInTheDocument(),
    );
  });

  it("forwards headshot changes and removals", async () => {
    const onDataChange = vi.fn();
    render(
      <FormWrapper
        data={{ ...defaultData, headshot: "r2/old.png" }}
        onDataChange={onDataChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "upload-headshot" }),
    );

    expect(onDataChange).toHaveBeenCalledWith(
      "headshot",
      "r2/headshot.png",
    );
    expect(onDataChange).toHaveBeenCalledWith(
      "headshotFileName",
      "headshot.png",
    );
    expect(onDataChange).toHaveBeenCalledWith("headshotData", {
      crop: "round",
    });

    await userEvent.click(
      screen.getByRole("button", { name: "remove-headshot" }),
    );

    // The upload updated the form field, so removal deletes the new value.
    expect(deleteFromR2).toHaveBeenCalledWith("r2/headshot.png");
    expect(onDataChange).toHaveBeenCalledWith("headshot", "");
  });

  it("renders the settings-only email/password blocks in emailChangeMode", () => {
    render(<FormWrapper emailChangeMode />);

    expect(screen.getByTestId("email-change")).toBeInTheDocument();
    expect(screen.getByTestId("password-change")).toBeInTheDocument();
  });

  it("shows the Google account block for Google accounts", () => {
    render(
      <FormWrapper
        emailChangeMode
        authProvider="google"
      />,
    );

    expect(screen.getByTestId("google-account")).toBeInTheDocument();
  });

  it("renders without the card copy when hideCard is set", () => {
    render(<FormWrapper hideCard />);

    expect(
      screen.queryByText(
        "Tell us about yourself to personalize your experience",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter your full name"),
    ).toBeInTheDocument();
  });
});
