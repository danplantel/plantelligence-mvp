import React from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsStep5 } from "@/components/wizard/benefits-steps/step-5";

/**
 * Create Benefit → Step 5 (Footer Disclosures).
 *
 * The disclosure editor is stubbed to expose its props and fire its callbacks;
 * the two single-flight loaders and the plan-record PUT are mocked. These tests
 * cover the seed ladder (plan → fetched row → profile → default), the per-
 * category key mapping, the inline editor's debounced persist, the apply-all
 * switch, footer background persistence, and both timer cleanups.
 */

const mocks = vi.hoisted(() => {
  const state: any = { stepData: { step1: {}, step5: {} } };
  const reset = (
    step1: Record<string, unknown> = {},
    step5: Record<string, unknown> = {},
  ) => {
    state.stepData = { step1, step5 };
    state.saveStepData = vi.fn((step: number, data: any) => {
      state.stepData = { ...state.stepData, [`step${step}`]: data };
    });
  };
  return {
    state,
    reset,
    fetchProfileOnce: vi.fn(async (): Promise<any> => null),
    fetchClientOnce: vi.fn(async (): Promise<any> => null),
    invalidateClientCache: vi.fn(),
    consoleError: vi.fn(),
  };
});

vi.mock("@/lib/benefits-wizard-store", () => ({
  useBenefitsWizardStore: () => mocks.state,
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
}));

vi.mock("@/lib/fetch-client", () => ({
  fetchClientOnce: mocks.fetchClientOnce,
  invalidateClientCache: mocks.invalidateClientCache,
}));

vi.mock("@/components/wizard/steps/sections/disclosure-footer-editor", () => ({
  DisclosureFooterEditor: (props: any) => (
    <div data-testid="editor">
      <span data-testid="mode">{props.mode}</span>
      <span data-testid="text">{props.text}</span>
      <span data-testid="default-text">{props.defaultText}</span>
      <span data-testid="org">{props.organizationName}</span>
      <span data-testid="company">{props.companyName}</span>
      <span data-testid="preview-label">{props.previewLabel}</span>
      <span data-testid="brand">{props.primaryColor}</span>
      <span data-testid="footer-bg-mode">{props.footerBgMode}</span>
      <span data-testid="footer-bg-custom">{props.footerBgCustomColor}</span>
      <button
        type="button"
        onClick={() => props.onTextChange("Custom disclosure text")}
      >
        type-custom
      </button>
      <button type="button" onClick={() => props.onModeChange("custom")}>
        choose-custom
      </button>
      <button type="button" onClick={() => props.onModeChange("default")}>
        choose-default
      </button>
      <button
        type="button"
        onClick={() => props.onFooterBgModeChange("secondary")}
      >
        secondary-bg
      </button>
      <button
        type="button"
        onClick={() => props.onFooterBgModeChange("custom")}
      >
        custom-bg
      </button>
      <button
        type="button"
        onClick={() => props.onFooterBgCustomColorChange("#ABCDEF")}
      >
        set-bg-color
      </button>
    </div>
  ),
}));

const planStep1 = (overrides: Record<string, unknown> = {}) => ({
  planId: "plan-1",
  benefitCategory: "Retirement",
  selectedPlan: {
    companyName: "Acme Corp",
    brandColor: "#111111",
    secondaryColor: "#222222",
    branding: { organizationName: "Acme Holdings" },
  },
  ...overrides,
});

function renderStep() {
  return render(<BenefitsStep5 />);
}

async function waitForEditor() {
  return screen.findByTestId("editor");
}

const storedRetirement = (
  text: string,
  extra: Record<string, unknown> = {},
) => ({
  id: "d-1",
  text,
  locations: ["Retirement Plan"],
  customLocation: "",
  scope: "plan",
  apply_all_benefits_categories: false,
  ...extra,
});

describe("BenefitsStep5", () => {
  beforeEach(() => {
    mocks.reset(planStep1(), {});
    mocks.fetchProfileOnce.mockResolvedValue({
      organizationName: "Profile Org",
      disclaimer: null,
    });
    mocks.fetchClientOnce.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    vi.spyOn(console, "error").mockImplementation(mocks.consoleError);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("seeding the current category", () => {
    it("uses the selected plan's stored disclaimer without fetching the row", async () => {
      mocks.reset(
        planStep1({
          selectedPlan: {
            companyName: "Acme Corp",
            disclaimers: {
              byCategory: {
                Retirement: storedRetirement("Stored retirement disclosure"),
              },
            },
          },
        }),
      );
      renderStep();
      await waitForEditor();

      expect(screen.getByTestId("text")).toHaveTextContent(
        "Stored retirement disclosure",
      );
      expect(mocks.fetchClientOnce).not.toHaveBeenCalled();
    });

    it("falls back to the plan row when the picker copy has no disclaimers", async () => {
      mocks.fetchClientOnce.mockResolvedValue({
        disclaimers: {
          byCategory: {
            Retirement: storedRetirement("Fetched plan disclosure"),
          },
        },
      });
      renderStep();
      await waitForEditor();

      await waitFor(() =>
        expect(screen.getByTestId("text")).toHaveTextContent(
          "Fetched plan disclosure",
        ),
      );
      expect(mocks.fetchClientOnce).toHaveBeenCalledWith("plan-1");
    });

    it("inherits the profile disclaimer when the plan has none", async () => {
      mocks.fetchProfileOnce.mockResolvedValue({
        organizationName: "Profile Org",
        disclaimer: [
          {
            id: "p-1",
            text: "Profile defaults for [Organization Name] and [Company Name]",
            locations: ["Global"],
          },
        ],
      });
      renderStep();
      await waitForEditor();

      await waitFor(() =>
        expect(screen.getByTestId("text")).toHaveTextContent(
          "Profile defaults for Profile Org and Acme Corp",
        ),
      );
      expect(screen.getByTestId("org")).toHaveTextContent("Profile Org");
    });

    it("builds the default disclosure when nothing is stored", async () => {
      renderStep();
      await waitForEditor();

      expect(screen.getByTestId("text").textContent).toContain(
        "separate and unaffiliated entities",
      );
      expect(screen.getByTestId("mode")).toHaveTextContent("default");
    });

    it("seeds a legacy flat disclaimers array into the current category", async () => {
      mocks.fetchClientOnce.mockResolvedValue({
        disclaimers: {
          disclaimers: [storedRetirement("Legacy flat disclosure")],
        },
      });
      renderStep();
      await waitForEditor();

      await waitFor(() =>
        expect(screen.getByTestId("text")).toHaveTextContent(
          "Legacy flat disclosure",
        ),
      );
    });

    it("never leaks another category's disclaimer into the current one", async () => {
      mocks.fetchClientOnce.mockResolvedValue({
        disclaimers: {
          byCategory: {
            "Group Health": storedRetirement("Group health only disclosure"),
          },
        },
      });
      renderStep();
      await waitForEditor();

      await waitFor(() =>
        expect(mocks.fetchClientOnce).toHaveBeenCalledWith("plan-1"),
      );
      expect(screen.getByTestId("text")).not.toHaveTextContent(
        "Group health only disclosure",
      );
      expect(screen.getByTestId("text").textContent).toContain(
        "separate and unaffiliated entities",
      );
    });

    it("still initializes when the profile lookup fails", async () => {
      mocks.fetchProfileOnce.mockRejectedValue(new Error("offline"));
      renderStep();
      await waitForEditor();

      expect(screen.getByTestId("text").textContent).toContain(
        "separate and unaffiliated entities",
      );
    });
  });

  describe("category mapping", () => {
    it("maps Group Life to the life portal label", async () => {
      mocks.reset(planStep1({ benefitCategory: "Group Life" }));
      renderStep();
      await waitForEditor();

      expect(screen.getByTestId("preview-label")).toHaveTextContent(
        "Group Life / Disability — Employee Portal",
      );
      expect(screen.getByText("Group Life Hub")).toBeInTheDocument();
    });

    it("maps Custom to the wellness (Other) label", async () => {
      mocks.reset(planStep1({ benefitCategory: "Custom" }));
      renderStep();
      await waitForEditor();

      expect(screen.getByTestId("preview-label")).toHaveTextContent(
        "Wellness Programs — Employee Portal",
      );
      expect(screen.getByText("Other Hub")).toBeInTheDocument();
    });
  });

  describe("inline editing", () => {
    it("tracks typed text locally, stores it, and persists once after the debounce", async () => {
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "type-custom" }));

      expect(screen.getByTestId("text")).toHaveTextContent(
        "Custom disclosure text",
      );
      expect(screen.getByTestId("mode")).toHaveTextContent("custom");
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(5, {
        byCategory: expect.objectContaining({
          Retirement: expect.objectContaining({
            text: "Custom disclosure text",
          }),
        }),
      });
      expect(fetch).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String((fetch as any).mock.calls[0][1].body));
      expect(body.disclaimers.byCategory.Retirement.text).toBe(
        "Custom disclosure text",
      );
      expect(mocks.invalidateClientCache).toHaveBeenCalledWith("plan-1");
    });

    it("coalesces rapid footer background changes into one PUT", async () => {
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "secondary-bg" }));
      fireEvent.click(screen.getByRole("button", { name: "custom-bg" }));

      expect(screen.getByTestId("footer-bg-mode")).toHaveTextContent("custom");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(650);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String((fetch as any).mock.calls[0][1].body));
      expect(body.disclaimers.footerBackground).toEqual({
        mode: "custom",
        customColor: "",
      });
    });

    it("persists a custom footer colour after the debounce", async () => {
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "custom-bg" }));
      fireEvent.click(screen.getByRole("button", { name: "set-bg-color" }));

      expect(screen.getByTestId("footer-bg-custom")).toHaveTextContent(
        "#ABCDEF",
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(650);
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String((fetch as any).mock.calls[0][1].body));
      expect(body.disclaimers.footerBackground).toEqual({
        mode: "custom",
        customColor: "#ABCDEF",
      });
    });

    it("switches between the default and custom editor modes", async () => {
      renderStep();
      await waitForEditor();

      expect(screen.getByTestId("mode")).toHaveTextContent("default");

      fireEvent.click(screen.getByRole("button", { name: "choose-custom" }));
      expect(screen.getByTestId("mode")).toHaveTextContent("custom");

      fireEvent.click(screen.getByRole("button", { name: "choose-default" }));
      expect(screen.getByTestId("mode")).toHaveTextContent("default");
    });

    it("applies the disclosure to every category", async () => {
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("switch"));

      expect(screen.getByText("All Categories")).toBeInTheDocument();
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(5, {
        byCategory: expect.objectContaining({
          Retirement: expect.objectContaining({
            apply_all_benefits_categories: true,
          }),
        }),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
      });
      const body = JSON.parse(String((fetch as any).mock.calls[0][1].body));
      expect(
        body.disclaimers.byCategory.Retirement.apply_all_benefits_categories,
      ).toBe(true);
    });

    it("includes the Step 1 brand images alongside the disclaimers", async () => {
      mocks.reset(
        planStep1({
          brandImages: { header: { url: "org/header.jpg" } },
        }),
      );
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "type-custom" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
      });

      const body = JSON.parse(String((fetch as any).mock.calls[0][1].body));
      expect(body.brandImages).toEqual({ header: { url: "org/header.jpg" } });
    });

    it("cancels a pending inline save when the step unmounts", async () => {
      const view = renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "type-custom" }));
      view.unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("cancels a pending footer background save when the step unmounts", async () => {
      const view = renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "secondary-bg" }));
      view.unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(650);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("does not write to the plan when no plan is selected", async () => {
      mocks.reset({
        benefitCategory: "Retirement",
        selectedPlan: { companyName: "Acme Corp" },
      });
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "type-custom" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps the local edit when persisting fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("offline");
        }),
      );
      renderStep();
      await waitForEditor();
      vi.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "type-custom" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
      });

      expect(screen.getByTestId("text")).toHaveTextContent(
        "Custom disclosure text",
      );
      expect(mocks.consoleError).toHaveBeenCalledWith(
        "Failed to persist disclaimer to plan:",
        expect.any(Error),
      );
    });
  });
});
