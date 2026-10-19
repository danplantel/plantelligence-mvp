import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SummaryEditModal } from "../sections/summary-edit-modals/summary-edit-modal";

vi.mock("@/components/ui/chip-typeahead", () => ({
  ChipTypeahead: () => <div data-testid="chip-typeahead" />,
}));

vi.mock("@/components/ui/upload-input", () => ({
  UploadInput: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid={`upload-${placeholder}`} />
  ),
}));

vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: () => <div data-testid="image-editor" />,
}));

vi.mock("@/components/ui/color-picker", () => ({
  ColorPicker: () => <div data-testid="color-picker" />,
}));

vi.mock("@/components/ui/info-dialog", () => ({
  InfoDialog: () => null,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: vi.fn(async () => undefined),
}));

const initialData = {
  clientProfile: {
    organizationType: "ria",
    customOrganization: "",
    organizationName: "Acme",
    website: "acme.example",
  },
  teamSize: { teamSize: "2_5" },
  services: {
    services: ["retirement"],
    customService: "Custom Service",
  },
  branding: {
    brandColor: "#111111",
    missionStatement: "Our mission",
    logo: "r2/logo.png",
    backgroundImage: "r2/background.jpg",
  },
  userSetup: {
    name: "Ada",
    email: "ada@example.com",
    phone: "2135888888",
    phoneExtension: "12",
    title: "Advisor",
    designations: ["cfp"],
    saveAsContact: false,
    headshot: "r2/headshot.jpg",
    backgroundImage: "r2/user-bg.jpg",
  },
};

function renderModal(overrides: Record<string, unknown> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    initialData,
    ...overrides,
  };

  return { props, ...render(<SummaryEditModal {...props} />) };
}

describe("SummaryEditModal", () => {
  it("renders nothing while closed", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByText("Edit Summary")).not.toBeInTheDocument();
  });

  it("renders the tabbed editor with the stored organization values", () => {
    renderModal();

    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Branding")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("saves the normalized edit payload", async () => {
    const { props } = renderModal();

    await userEvent.click(
      screen.getByRole("button", { name: "Save Changes" }),
    );

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationType: "financial_advisor_ria",
        customOrganization: "",
        teamSize: "2_5",
        services: ["retirement"],
        customService: "Custom Service",
        brandColor: "#111111",
        organizationName: "Acme",
        website: "acme.example",
        missionStatement: "Our mission",
        logo: "r2/logo.png",
        backgroundImage: "r2/background.jpg",
        name: "Ada",
        email: "ada@example.com",
        phone: "2135888888",
        phoneExtension: "12",
        title: "Advisor",
        designations: ["CFP"],
        saveAsContact: false,
        headshot: "r2/headshot.jpg",
        userBackgroundImage: "r2/user-bg.jpg",
      }),
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("edits the organization name before saving", async () => {
    const { props } = renderModal();

    await userEvent.click(screen.getByRole("tab", { name: /Branding/ }));

    const input = screen.getByPlaceholderText("Enter your organization name");
    await userEvent.clear(input);
    await userEvent.type(input, "Beta");

    await userEvent.click(
      screen.getByRole("button", { name: "Save Changes" }),
    );

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ organizationName: "Beta" }),
    );
  });

  it("edits the user name before saving", async () => {
    const { props } = renderModal();

    await userEvent.click(screen.getByRole("tab", { name: /User/ }));

    const input = screen.getByPlaceholderText("Enter your full name");
    await userEvent.clear(input);
    await userEvent.type(input, "Ada Lovelace");

    await userEvent.click(
      screen.getByRole("button", { name: "Save Changes" }),
    );

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ada Lovelace" }),
    );
  });

  it("Cancel closes without saving", async () => {
    const { props } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
