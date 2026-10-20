import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewClientStep1 } from "../step-1-company-basics";

/**
 * Create Plan step 1 (company basics / branding).
 *
 * The image editors and the two branding sections are mocked — they have their
 * own suites — so these tests cover the form logic this screen owns: the plan
 * type radio, the company-name → portal-slug derivation, the manual-edit latch,
 * website normalisation, and the `__step1FlushFormToStore` hook the wizard
 * calls before validating Next.
 */

const mocks = vi.hoisted(() => {
  const state: any = {};
  const resetState = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, {
      stepData: {},
      saveStepDataLocally: vi.fn(async () => {}),
      loadDraftById: vi.fn(async () => {}),
      currentStep: 1,
      draftClientId: null,
      saveAsDraft: vi.fn(async () => ({})),
      ...overrides,
    });
    return state;
  };
  return {
    state,
    resetState,
    deleteFromR2: vi.fn(async () => {}),
    fetch: vi.fn(),
  };
});

vi.mock("@/lib/new-client-wizard-store", () => {
  const useNewClientWizardStore = Object.assign(
    (selector?: (value: any) => unknown) =>
      selector ? selector(mocks.state) : mocks.state,
    { getState: () => mocks.state },
  );
  return { useNewClientWizardStore };
});

vi.mock("../sections/brand-images-section", () => ({
  BrandImagesSection: () => <div data-testid="brand-images-section" />,
}));

vi.mock("../sections/brand-colors-section", () => ({
  BrandColorsSection: () => <div data-testid="brand-colors-section" />,
}));

vi.mock("../sections/welcome-mission-section", () => ({
  WelcomeMissionSection: () => <div data-testid="welcome-mission-section" />,
}));

vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: () => null,
}));

vi.mock("@/lib/upload-to-r2", () => ({
  deleteFromR2: mocks.deleteFromR2,
}));

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as any;
}

/** The Portal URL label is a card heading, not a `<label for>`, so query by id. */
function portalUrlInput(): HTMLInputElement {
  const element = document.getElementById(
    "portalUrl",
  ) as HTMLInputElement | null;
  if (!element) throw new Error("portalUrl input not found");
  return element;
}

beforeEach(() => {
  mocks.resetState();
  mocks.fetch.mockReset().mockResolvedValue(jsonResponse({}));
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.deleteFromR2.mockReset().mockResolvedValue(undefined);
});

describe("NewClientStep1", () => {
  it("renders the plan type choices and the company fields", () => {
    render(<NewClientStep1 />);

    expect(screen.getByRole("radio", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Prospect" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Company Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company Website/)).toBeInTheDocument();
    expect(portalUrlInput()).toBeInTheDocument();
    expect(screen.getByTestId("brand-colors-section")).toBeInTheDocument();
    expect(screen.getByTestId("brand-images-section")).toBeInTheDocument();
  });

  it("persists the chosen plan type", async () => {
    const user = userEvent.setup();
    render(<NewClientStep1 />);

    await user.click(screen.getByRole("radio", { name: "Prospect" }));

    await waitFor(() =>
      expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
        "companyBasics",
        expect.objectContaining({ planType: "prospect" }),
      ),
    );
  });

  it("derives the portal slug from the company name until it is edited by hand", async () => {
    const user = userEvent.setup();
    render(<NewClientStep1 />);
    const name = screen.getByLabelText(/Company Name/);
    const portalUrl = portalUrlInput();

    await user.type(name, "Acme Corp");

    await waitFor(() => expect(portalUrl).toHaveValue("acme-corp"));

    await user.clear(portalUrl);
    await user.type(portalUrl, "my-portal");
    await user.type(name, " LLC");

    expect(portalUrl).toHaveValue("my-portal");

    await waitFor(() =>
      expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
        "companyBasics",
        expect.objectContaining({
          companyName: "Acme Corp LLC",
          portalUrl: "my-portal",
        }),
      ),
    );
  });

  it("strips the protocol from the website on blur", async () => {
    const user = userEvent.setup();
    render(<NewClientStep1 />);
    const website = screen.getByLabelText(/Company Website/);

    await user.type(website, "https://www.acme.com");
    await user.tab();

    // `normalizeCleanDomain` removes the scheme; `www.` is preserved.
    expect(website).toHaveValue("www.acme.com");
    await waitFor(() =>
      expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
        "companyBasics",
        expect.objectContaining({ companyWebsite: "www.acme.com" }),
      ),
    );
  });

  it("flushes the current form into the store for the wizard's Next validation", async () => {
    const user = userEvent.setup();
    render(<NewClientStep1 />);

    await user.type(screen.getByLabelText(/Company Name/), "Acme");
    await waitFor(() => expect(portalUrlInput()).toHaveValue("acme"));

    const flush = (window as any).__step1FlushFormToStore;
    expect(typeof flush).toBe("function");

    await flush();

    expect(mocks.state.saveStepDataLocally).toHaveBeenCalledWith(
      "companyBasics",
      expect.objectContaining({
        companyName: "Acme",
        portalUrl: "acme",
      }),
    );
  });

  it("removes the flush hook on unmount", () => {
    const { unmount } = render(<NewClientStep1 />);
    expect(typeof (window as any).__step1FlushFormToStore).toBe("function");

    unmount();

    expect((window as any).__step1FlushFormToStore).toBeUndefined();
  });

  it("never saves UI-only colour-picker state", async () => {
    const user = userEvent.setup();
    render(<NewClientStep1 />);

    await user.click(screen.getByRole("radio", { name: "Client" }));

    await waitFor(() =>
      expect(mocks.state.saveStepDataLocally).toHaveBeenCalled(),
    );
    const [, savedData] = mocks.state.saveStepDataLocally.mock.calls.at(-1)!;
    expect(savedData).not.toHaveProperty("isPrimaryColorPickerOpen");
    expect(savedData).not.toHaveProperty("isSecondaryColorPickerOpen");
  });
});
