import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Step4UserSetup } from "../step-4-user-setup";

const wizard = vi.hoisted(() => {
  const state = {
    stepData: {} as Record<string, any>,
    saveStepData: vi.fn(async () => undefined),
    saveStepDataToServer: vi.fn(async () => true),
    loadStepData: vi.fn(async (): Promise<any> => null),
    validateFieldOnBlur: vi.fn(async () => undefined),
    clearErrorFields: vi.fn(),
    session: {
      user: {
        id: "user-1",
        name: "Session Name",
        email: "session@example.com",
      },
    } as { user?: { id?: string; name?: string; email?: string } } | null,
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

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: wizard.state.session }),
}));

vi.mock("@/hooks/useDebounce", () => ({
  // Return the value immediately so assertions do not need fake timers.
  useDebounce: (value: unknown) => value,
}));

vi.mock("@/hooks/use-scroll-to-error-field", () => ({
  useScrollToErrorField: vi.fn(),
}));

vi.mock(
  "@/components/wizard/steps/sections/user-setup-section/user-setup-section",
  () => ({
    UserSetupSection: ({
      data,
      errorFields = [],
      onDataChange,
      onFieldBlur,
    }: {
      data: Record<string, any>;
      errorFields?: string[];
      onDataChange: (field: string, value: unknown) => void;
      onFieldBlur?: (field: string) => void;
    }) => (
      <div
        data-testid="user-setup-section"
        data-name={data.name ?? ""}
        data-email={data.email ?? ""}
        data-organization-email={data.organizationEmail ?? ""}
        data-phone={data.phone ?? ""}
        data-title={data.title ?? ""}
        data-error-fields={errorFields.join(",")}
      >
        <button
          type="button"
          onClick={() => onDataChange("name", "Ada")}
        >
          change-name
        </button>
        <button
          type="button"
          onClick={() => onDataChange("phone", "2135888888")}
        >
          change-phone
        </button>
        <button
          type="button"
          onClick={() => onDataChange("headshot", "data:image/png;base64,h")}
        >
          change-headshot
        </button>
        <button type="button" onClick={() => onFieldBlur?.("title")}>
          blur-title
        </button>
      </div>
    ),
  }),
);

vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: () => <div data-testid="image-editor" />,
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ alt }: { alt?: string }) => <span data-testid="headshot">{alt}</span>,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: vi.fn(async () => undefined),
}));

describe("Step4UserSetup", () => {
  beforeEach(() => {
    wizard.state.stepData = {};
    wizard.state.session = {
      user: {
        id: "user-1",
        name: "Session Name",
        email: "session@example.com",
      },
    };

    wizard.state.saveStepData.mockReset();
    wizard.state.saveStepData.mockResolvedValue(undefined);
    wizard.state.saveStepDataToServer.mockReset();
    wizard.state.saveStepDataToServer.mockResolvedValue(true);
    wizard.state.loadStepData.mockReset();
    wizard.state.loadStepData.mockResolvedValue(null);
    wizard.state.validateFieldOnBlur.mockReset();
    wizard.state.validateFieldOnBlur.mockResolvedValue(undefined);
    wizard.state.clearErrorFields.mockReset();
  });

  it("loads server data, normalizes the phone, and resolves designations", async () => {
    wizard.state.loadStepData.mockResolvedValue({
      name: "Server Name",
      email: "",
      organizationEmail: "org@example.com",
      phone: "+1 (213) 588-8888",
      phoneExtension: "12",
      title: "Advisor",
      designations: ["cfp"],
      headshot: "r2/headshot.jpg",
      primaryServiceCategories: ["retirement"],
    });

    render(<Step4UserSetup />);

    await waitFor(() =>
      expect(screen.getByTestId("user-setup-section")).toHaveAttribute(
        "data-name",
        "Server Name",
      ),
    );

    const section = screen.getByTestId("user-setup-section");
    // A blank server email falls back to the signed-in account email.
    expect(section).toHaveAttribute("data-email", "session@example.com");
    expect(section).toHaveAttribute("data-organization-email", "org@example.com");
    expect(section).toHaveAttribute("data-phone", "2135888888");
    expect(section).toHaveAttribute("data-title", "Advisor");

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({
          name: "Server Name",
          email: "session@example.com",
          phone: "2135888888",
          designations: ["CFP"],
          headshotFileName: "Server Name.jpg",
        }),
        true,
      ),
    );
  });

  it("falls back to session data when the server has none", async () => {
    render(<Step4UserSetup />);

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({
          name: "Session Name",
          email: "session@example.com",
          organizationEmail: "",
          headshot: "",
        }),
        false,
      ),
    );

    expect(screen.getByTestId("user-setup-section")).toHaveAttribute(
      "data-organization-email",
      "",
    );
  });

  it("falls back to session data when loading throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    wizard.state.loadStepData.mockRejectedValue(new Error("load failed"));

    render(<Step4UserSetup />);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading step data:",
        expect.any(Error),
      ),
    );
    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({ name: "Session Name" }),
        false,
      ),
    );
  });

  it("forwards error fields and clears stale errors on mount", () => {
    render(<Step4UserSetup errorFields={["name", "title"]} />);

    expect(screen.getByTestId("user-setup-section")).toHaveAttribute(
      "data-error-fields",
      "name,title",
    );
    expect(wizard.state.clearErrorFields).toHaveBeenCalledTimes(1);
  });

  it("saves name edits immediately, then reloads the server copy", async () => {
    render(<Step4UserSetup />);
    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalled(),
    );

    wizard.state.saveStepData.mockClear();
    wizard.state.saveStepDataToServer.mockClear();
    wizard.state.loadStepData.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "change-name" }));

    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({ name: "Ada" }),
      ),
    );
    expect(wizard.state.saveStepData).toHaveBeenCalledWith(
      "userSetup",
      expect.objectContaining({ name: "Ada" }),
      false,
    );
    expect(wizard.state.loadStepData).toHaveBeenCalledWith("userSetup", true);
  });

  it("validates a field on blur with the live form values", async () => {
    render(<Step4UserSetup />);
    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalled(),
    );

    await userEvent.click(screen.getByRole("button", { name: "change-name" }));
    await userEvent.click(screen.getByRole("button", { name: "blur-title" }));

    await waitFor(() =>
      expect(wizard.state.validateFieldOnBlur).toHaveBeenCalledWith(
        4,
        "title",
        expect.objectContaining({
          userSetup: expect.objectContaining({ name: "Ada" }),
        }),
      ),
    );
  });

  it("batches headshot edits into a single server save", async () => {
    render(<Step4UserSetup />);
    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalled(),
    );

    wizard.state.saveStepDataToServer.mockClear();

    await userEvent.click(
      screen.getByRole("button", { name: "change-headshot" }),
    );

    await waitFor(() =>
      expect(wizard.state.saveStepDataToServer).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({ headshot: "data:image/png;base64,h" }),
      ),
    );
  });

  it("flushes edited values when the step unmounts", async () => {
    const { unmount } = render(<Step4UserSetup />);
    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalled(),
    );

    await userEvent.click(screen.getByRole("button", { name: "change-phone" }));

    wizard.state.saveStepData.mockClear();
    unmount();

    await waitFor(() =>
      expect(wizard.state.saveStepData).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({ phone: "2135888888" }),
        true,
      ),
    );
  });
});
