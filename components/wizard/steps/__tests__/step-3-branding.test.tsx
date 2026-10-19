import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Step3Branding } from "../step-3-branding/step-3-branding";

const wizard = vi.hoisted(() => {
  const state = {
    stepData: {} as Record<string, any>,
    saveStepDataLocally: vi.fn(async () => undefined),
    saveStepData: vi.fn(async () => undefined),
    saveStepDataToServer: vi.fn(async () => true),
    clearErrorFields: vi.fn(),
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
  "@/components/wizard/steps/sections/branding-setup-card/branding-setup-card",
  () => ({
    BrandingSetupCard: ({
      data,
      errorFields = [],
      onDataChange,
      onFileRemove,
      onLogoPreview,
    }: {
      data: Record<string, any>;
      errorFields?: string[];
      onDataChange: (field: string, value: unknown) => void;
      onFileRemove: (field: string) => void;
      onLogoPreview?: (dataUrl: string) => void;
    }) => (
      <div
        data-testid="branding-card"
        data-organization-name={data.organizationName}
        data-website={data.website}
        data-mission={data.missionStatement}
        data-background={data.backgroundImage}
        data-logo={data.logo}
        data-error-fields={errorFields.join(",")}
      >
        <button
          type="button"
          onClick={() => onDataChange("organizationName", "Acme")}
        >
          change-org-name
        </button>
        <button
          type="button"
          onClick={() => onDataChange("website", "beta.example")}
        >
          change-website
        </button>
        <button
          type="button"
          onClick={() => onDataChange("backgroundImage", "r2/new-bg.jpg")}
        >
          change-background
        </button>
        <button
          type="button"
          onClick={() => onDataChange("logo", "r2/logo.png")}
        >
          change-logo
        </button>
        <button
          type="button"
          onClick={() => onLogoPreview?.("data:image/png;base64,logo")}
        >
          preview-logo
        </button>
        <button type="button" onClick={() => onFileRemove("logo")}>
          remove-logo
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-colors-section",
  () => ({
    BrandColorsSection: ({
      primaryColor,
      secondaryColor,
      onPrimaryChange,
      onSecondaryChange,
      logoDataUrl,
      websiteUrl,
      organizationName,
      errorFields = [],
    }: {
      primaryColor: string;
      secondaryColor: string;
      onPrimaryChange: (value: string) => void;
      onSecondaryChange: (value: string) => void;
      logoDataUrl?: string;
      websiteUrl?: string;
      organizationName?: string;
      errorFields?: string[];
    }) => (
      <div
        data-testid="brand-colors"
        data-primary={primaryColor}
        data-secondary={secondaryColor}
        data-logo-data-url={logoDataUrl ?? ""}
        data-website={websiteUrl}
        data-organization-name={organizationName}
        data-error-fields={errorFields.join(",")}
      >
        <button
          type="button"
          onClick={() => onPrimaryChange("#111111")}
        >
          change-primary
        </button>
        <button
          type="button"
          onClick={() => onSecondaryChange("#222222")}
        >
          change-secondary
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-images-section",
  () => ({
    BrandImagesSection: ({
      brandImages,
      onBrandImagesChange,
      errorFields = [],
    }: {
      brandImages: Record<string, any>;
      onBrandImagesChange: (images: Record<string, any>) => void;
      errorFields?: string[];
    }) => (
      <div
        data-testid="brand-images"
        data-header={brandImages.header?.url ?? ""}
        data-error-fields={errorFields.join(",")}
      >
        <button
          type="button"
          onClick={() =>
            onBrandImagesChange({ ...brandImages, header: null })
          }
        >
          remove-background
        </button>
        <button
          type="button"
          onClick={() =>
            onBrandImagesChange({
              ...brandImages,
              header: {
                url: "data:image/png;base64,image",
                fileName: "banner.png",
              },
            })
          }
        >
          upload-background-data-url
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "@/components/wizard/steps/sections/avatar-generator-card/avatar-generator-card",
  () => ({
    AvatarGeneratorCard: () => <div data-testid="avatar-generator" />,
  }),
);

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: vi.fn(async () => undefined),
  uploadFileToR2: vi.fn(
    async () => "advisor/background/banner.png",
  ),
}));

const { deleteFromR2, uploadFileToR2 } = await import("@/lib/upload-to-r2");

describe("Step3Branding", () => {
  beforeEach(() => {
    // Step 3 logs each branding payload; keep the test output readable.
    vi.spyOn(console, "log").mockImplementation(() => {});

    wizard.state.stepData = {
      clientProfile: { organizationType: "financial_advisor_ria" },
      branding: {
        organizationName: "Acme",
        website: "https://acme.example",
        backgroundImage: "r2/old-bg.jpg",
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
      },
    };
    wizard.state.saveStepDataLocally.mockReset();
    wizard.state.saveStepDataLocally.mockResolvedValue(undefined);
    wizard.state.saveStepData.mockReset();
    wizard.state.saveStepData.mockResolvedValue(undefined);
    wizard.state.saveStepDataToServer.mockReset();
    wizard.state.saveStepDataToServer.mockResolvedValue(true);
    wizard.state.clearErrorFields.mockReset();

    vi.mocked(deleteFromR2).mockReset();
    vi.mocked(deleteFromR2).mockResolvedValue(undefined as never);
    vi.mocked(uploadFileToR2).mockReset();
    vi.mocked(uploadFileToR2).mockResolvedValue(
      "advisor/background/banner.png",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => new Blob(["image"], { type: "image/png" }),
      })),
    );
  });

  it("renders every branding surface and forwards error fields", () => {
    render(<Step3Branding errorFields={["logo"]} />);

    expect(screen.getByTestId("branding-card")).toHaveAttribute(
      "data-error-fields",
      "logo",
    );
    expect(screen.getByTestId("brand-colors")).toHaveAttribute(
      "data-error-fields",
      "logo",
    );
    expect(screen.getByTestId("brand-images")).toHaveAttribute(
      "data-error-fields",
      "logo",
    );
  });

  it("clears stale error fields when the step mounts", () => {
    render(<Step3Branding />);

    expect(wizard.state.clearErrorFields).toHaveBeenCalledTimes(1);
  });

  it("seeds the default welcome statement with the organization name", async () => {
    render(<Step3Branding />);

    await waitFor(() =>
      expect(screen.getByTestId("branding-card")).toHaveAttribute(
        "data-mission",
        expect.stringContaining("Welcome to Acme!"),
      ),
    );
  });

  it("updates the welcome statement when the organization name changes", async () => {
    render(<Step3Branding />);

    await userEvent.click(
      screen.getByRole("button", { name: "change-org-name" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("branding-card")).toHaveAttribute(
        "data-mission",
        expect.stringContaining("Welcome to Acme!"),
      ),
    );
    expect(wizard.state.saveStepDataLocally).toHaveBeenCalledWith(
      "branding",
      expect.objectContaining({ organizationName: "Acme" }),
    );
  });

  it("mirrors organization name and website edits into client profile data", async () => {
    render(<Step3Branding />);

    await userEvent.click(
      screen.getByRole("button", { name: "change-org-name" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepDataLocally).toHaveBeenCalledWith(
        "clientProfile",
        expect.objectContaining({
          organizationName: "Acme",
          website: "https://acme.example",
        }),
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "change-website" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepDataLocally).toHaveBeenCalledWith(
        "clientProfile",
        expect.objectContaining({ website: "beta.example" }),
      ),
    );
  });

  it("persists background changes locally and to the server", async () => {
    render(<Step3Branding />);

    await userEvent.click(
      screen.getByRole("button", { name: "change-background" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepDataLocally).toHaveBeenCalledWith(
        "branding",
        expect.objectContaining({ backgroundImage: "r2/new-bg.jpg" }),
      ),
    );
    expect(wizard.state.saveStepDataToServer).toHaveBeenCalledWith(
      "branding",
      expect.objectContaining({ backgroundImage: "r2/new-bg.jpg" }),
    );
  });

  it("records a logo preview without extracting colors", async () => {
    render(<Step3Branding />);

    expect(screen.getByTestId("brand-colors")).toHaveAttribute(
      "data-logo-data-url",
      "",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "preview-logo" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("brand-colors")).toHaveAttribute(
        "data-logo-data-url",
        "data:image/png;base64,logo",
      ),
    );
  });

  it("persists primary and secondary color choices as branding data", async () => {
    render(<Step3Branding />);

    await userEvent.click(
      screen.getByRole("button", { name: "change-primary" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("brand-colors")).toHaveAttribute(
        "data-primary",
        "#111111",
      ),
    );
    expect(wizard.state.saveStepDataLocally).toHaveBeenCalledWith(
      "branding",
      expect.objectContaining({ primaryColor: "#111111" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "change-secondary" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("brand-colors")).toHaveAttribute(
        "data-secondary",
        "#222222",
      ),
    );
    expect(wizard.state.saveStepDataLocally).toHaveBeenCalledWith(
      "branding",
      expect.objectContaining({ secondaryColor: "#222222" }),
    );
  });

  it("deletes the stored background when the slot is cleared", async () => {
    render(<Step3Branding />);

    await userEvent.click(
      screen.getByRole("button", { name: "remove-background" }),
    );

    await waitFor(() =>
      expect(deleteFromR2).toHaveBeenCalledWith("r2/old-bg.jpg"),
    );
    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalledWith(
        "branding",
        expect.objectContaining({ backgroundImage: "" }),
      ),
    );
  });

  it("uploads a data-url background to R2 and persists the returned key", async () => {
    render(<Step3Branding />);

    await userEvent.click(
      screen.getByRole("button", { name: "upload-background-data-url" }),
    );

    await waitFor(() =>
      expect(uploadFileToR2).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "banner.png",
          subPath: "advisor/background",
        }),
      ),
    );
    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalledWith(
        "branding",
        expect.objectContaining({
          backgroundImage: "advisor/background/banner.png",
        }),
      ),
    );
    expect(screen.getByTestId("brand-images")).toHaveAttribute(
      "data-header",
      "advisor/background/banner.png",
    );
  });

  it("clears the logo and persists the removal", async () => {
    render(<Step3Branding />);

    await userEvent.click(screen.getByRole("button", { name: "remove-logo" }));

    await waitFor(() =>
      expect(wizard.state.saveStepDataLocally).toHaveBeenLastCalledWith(
        "branding",
        expect.objectContaining({ logo: "", logoFileName: "" }),
      ),
    );
  });
});
