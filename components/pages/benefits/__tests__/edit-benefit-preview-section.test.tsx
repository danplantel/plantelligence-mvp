import React from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditBenefitPreviewSection } from "@/components/pages/benefits/edit-benefit-preview-section";

/**
 * Edit Benefit → Preview tab.
 *
 * The portal header, the portal preview, the mobile frame and the inline editor
 * panel are stubbed. These tests pin the section's own orchestration: the
 * editor auto-opens and toggles, the header events fire, desktop/mobile
 * switching, the full-row fallback read, logo/brand resolution, typography
 * application + cleanup, and the preview scroll bridge.
 */

const mocks = vi.hoisted(() => {
  let listeners = new Set<() => void>();
  let cached: any = null;
  const state: any = { stepData: { step1: {} } };

  const emit = () => {
    cached = { ...state };
    listeners.forEach((listener) => listener());
  };
  const getSnapshot = () => cached;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const reset = (step1: Record<string, unknown>) => {
    state.stepData = { step1 };
    state.saveStepData = vi.fn((step: number, data: any) => {
      state.stepData = { ...state.stepData, [`step${step}`]: data };
      emit();
    });
    cached = { ...state };
    emit();
  };

  return {
    state,
    reset,
    subscribe,
    getSnapshot,
    fetchClientOnce: vi.fn(async (): Promise<any> => null),
    applyTypography: vi.fn(() => vi.fn()),
  };
});

vi.mock("@/lib/benefits-wizard-store", async () => {
  const React = await import("react");
  const useStore = (selector?: (value: any) => unknown) => {
    const snapshot = React.useSyncExternalStore(
      mocks.subscribe,
      mocks.getSnapshot,
      mocks.getSnapshot,
    );
    return selector ? selector(snapshot) : snapshot;
  };
  return {
    useBenefitsWizardStore: Object.assign(useStore, {
      getState: () => mocks.state,
    }),
  };
});

vi.mock("@/lib/fetch-client", () => ({
  fetchClientOnce: mocks.fetchClientOnce,
}));

vi.mock("@/lib/typography-themes", () => ({
  applyTypographyToElement: mocks.applyTypography,
}));

vi.mock("@/lib/preview-editor-layout", () => ({
  usePreviewEditorLayout: vi.fn(),
  PREVIEW_EDITOR_PANEL_WIDTH: "36rem",
}));

vi.mock("@/components/pages/client-portal/sections/portal-header", () => ({
  PortalHeader: (props: any) => (
    <div
      data-testid="portal-header"
      data-logo={props.companyData?.companyLogo ?? ""}
      data-brand={props.brandColor}
      data-client={props.clientId}
      data-scale={String(props.scale)}
    />
  ),
}));

vi.mock("@/components/wizard/benefits-steps/benefit-portal-preview", () => ({
  BenefitPortalPreview: (props: any) => (
    <div
      data-testid="benefit-preview"
      data-mobile={String(Boolean(props.mobile))}
      data-brand={props.brandColor}
      data-secondary={props.secondaryColor}
    />
  ),
}));

vi.mock("@/components/wizard/benefits-steps/benefits-editor-panel", () => ({
  BenefitsEditorPanel: (props: any) => (
    <div
      data-testid="editor-panel"
      data-open={String(props.isOpen)}
      data-animating={String(props.isAnimating)}
      data-company={props.planCompanyName}
      data-website={props.companyWebsite}
    >
      <button type="button" onClick={props.onClose}>
        stub-close
      </button>
    </div>
  ),
}));

vi.mock("@/components/wizard/benefits-steps/step-2", () => ({
  MobilePreviewFrame: (props: any) => (
    <div data-testid="mobile-frame" data-theme={props.themeKey}>
      {props.children}
    </div>
  ),
}));

const baseStep1 = (overrides: Record<string, any> = {}) => ({
  planId: "plan-1",
  benefitCategory: "Retirement",
  selectedPlan: {
    id: "plan-1",
    companyName: "Acme Corp",
    brandColor: "#111111",
    secondaryColor: "#222222",
    companyLogo: { url: "org/logo.png" },
    companyWebsite: "https://acme.com",
    employeePortalPreview: { benefits: [] },
  },
  ...overrides,
});

describe("EditBenefitPreviewSection", () => {
  beforeEach(() => {
    mocks.reset(baseStep1());
    mocks.fetchClientOnce.mockResolvedValue(null);
    mocks.applyTypography.mockReturnValue(vi.fn());
    // The global setup stubs are file-scoped; re-provide the one this component
    // needs on every test so a previous test's cleanup cannot remove it.
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("editor panel", () => {
    it("auto-opens the inline panel on mount", async () => {
      render(<EditBenefitPreviewSection />);

      const panel = await screen.findByTestId("editor-panel");
      expect(panel).toHaveAttribute("data-open", "true");
      await waitFor(() =>
        expect(screen.getByTestId("editor-panel")).toHaveAttribute(
          "data-animating",
          "true",
        ),
      );
    });

    it("announces the panel state to the app header", async () => {
      const listener = vi.fn();
      window.addEventListener("step5EditorStateChange", listener);

      render(<EditBenefitPreviewSection />);

      await waitFor(() => {
        const details = listener.mock.calls.map(
          (call) => call[0].detail.isOpen,
        );
        expect(details.at(-1)).toBe(true);
      });

      window.removeEventListener("step5EditorStateChange", listener);
    });

    it("closes and reopens from the toolbar", async () => {
      render(<EditBenefitPreviewSection />);
      await screen.findByTestId("editor-panel");
      // Let the mount animation timer fire first, so it cannot re-open the panel
      // after the close.
      await waitFor(() =>
        expect(screen.getByTestId("editor-panel")).toHaveAttribute(
          "data-animating",
          "true",
        ),
      );

      fireEvent.click(screen.getByRole("button", { name: /Close Edit Panel/ }));
      await waitFor(() =>
        expect(screen.queryByTestId("editor-panel")).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: /Open Edit Panel/ }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Open Edit Panel/ }));
      expect(await screen.findByTestId("editor-panel")).toHaveAttribute(
        "data-open",
        "true",
      );
    });

    it("passes the plan's name and website to the panel", async () => {
      render(<EditBenefitPreviewSection />);
      const panel = await screen.findByTestId("editor-panel");

      expect(panel).toHaveAttribute("data-company", "Acme Corp");
      expect(panel).toHaveAttribute("data-website", "https://acme.com");
    });
  });

  describe("preview modes", () => {
    it("switches to the mobile phone frame and back", async () => {
      render(<EditBenefitPreviewSection />);

      expect(screen.queryByTestId("mobile-frame")).not.toBeInTheDocument();
      expect(screen.getByTestId("benefit-preview")).toHaveAttribute(
        "data-mobile",
        "false",
      );

      fireEvent.click(screen.getByRole("button", { name: /Mobile Preview/ }));

      expect(screen.getByTestId("mobile-frame")).toBeInTheDocument();
      expect(screen.getAllByTestId("benefit-preview")[0]).toHaveAttribute(
        "data-mobile",
        "true",
      );
      expect(
        screen.getByRole("button", { name: /Desktop Preview/ }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Desktop Preview/ }));
      expect(screen.queryByTestId("mobile-frame")).not.toBeInTheDocument();
    });

    it("renders the portal header in desktop mode only", () => {
      render(<EditBenefitPreviewSection />);

      expect(screen.getAllByTestId("portal-header")).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: /Mobile Preview/ }));
      // One header in the desktop tree is gone; the mobile frame renders its own.
      expect(screen.getAllByTestId("portal-header")).toHaveLength(1);
    });
  });

  describe("plan details", () => {
    it("uses the store's full plan row without fetching", () => {
      render(<EditBenefitPreviewSection />);

      expect(mocks.fetchClientOnce).not.toHaveBeenCalled();
      const header = screen.getByTestId("portal-header");
      expect(header).toHaveAttribute("data-logo", "org/logo.png");
      expect(header).toHaveAttribute("data-brand", "#111111");
    });

    it("fetches the plan row when the store only has the thin picker copy", async () => {
      mocks.reset(
        baseStep1({
          selectedPlan: { id: "plan-1", companyName: "Acme Corp" },
        }),
      );
      mocks.fetchClientOnce.mockResolvedValue({
        companyName: "Acme Corp",
        companyWebsite: "https://fetched.example",
        brandColor: "#00FF00",
        secondaryColor: "#0000FF",
        companyLogo: "org/fetched.png",
      });

      render(<EditBenefitPreviewSection />);

      await waitFor(() =>
        expect(screen.getByTestId("portal-header")).toHaveAttribute(
          "data-brand",
          "#00FF00",
        ),
      );
      expect(mocks.fetchClientOnce).toHaveBeenCalledWith("plan-1");
      expect(screen.getByTestId("portal-header")).toHaveAttribute(
        "data-logo",
        "org/fetched.png",
      );
    });

    it("does not fetch when there is no plan", () => {
      mocks.reset({
        benefitCategory: "Retirement",
        selectedPlan: { companyName: "Acme Corp" },
      });

      render(<EditBenefitPreviewSection />);
      expect(mocks.fetchClientOnce).not.toHaveBeenCalled();
    });

    it("prefills the plan's saved typography theme into an empty store", async () => {
      mocks.reset(
        baseStep1({
          selectedPlan: { id: "plan-1", companyName: "Acme Corp" },
          typographyTheme: undefined,
        }),
      );
      mocks.fetchClientOnce.mockResolvedValue({
        companyName: "Acme Corp",
        brandColor: "#123456",
        typographyTheme: "modern-serif",
      });

      render(<EditBenefitPreviewSection />);

      await waitFor(() =>
        expect(mocks.state.saveStepData).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            planId: "plan-1",
            typographyTheme: "modern-serif",
          }),
        ),
      );
    });

    it("keeps a theme this session already chose", async () => {
      mocks.reset(
        baseStep1({
          selectedPlan: { id: "plan-1", companyName: "Acme Corp" },
          typographyTheme: "classic",
        }),
      );
      mocks.fetchClientOnce.mockResolvedValue({
        companyName: "Acme Corp",
        brandColor: "#123456",
        typographyTheme: "modern-serif",
      });

      render(<EditBenefitPreviewSection />);

      expect(mocks.state.saveStepData).not.toHaveBeenCalled();
      expect(mocks.applyTypography).toHaveBeenCalledWith(
        expect.anything(),
        "classic",
      );
    });

    it("restores typography on unmount", () => {
      const cleanup = vi.fn();
      mocks.applyTypography.mockReturnValue(cleanup);

      const view = render(<EditBenefitPreviewSection />);
      view.unmount();

      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe("preview scroll bridge", () => {
    it("scrolls the preview container to the field's marker", () => {
      const scrollTo = vi.fn();
      const container = document.createElement("div");
      container.setAttribute("data-preview-scroll-container", "");
      Object.defineProperty(container, "scrollTo", { value: scrollTo });
      Object.defineProperty(container, "clientHeight", { value: 400 });
      Object.defineProperty(container, "scrollHeight", { value: 800 });
      container.getBoundingClientRect = () =>
        ({ top: 0, height: 400, bottom: 400 }) as DOMRect;
      document.body.appendChild(container);

      const target = document.createElement("div");
      target.setAttribute("data-preview-field", "benefitTitle");
      target.getBoundingClientRect = () =>
        ({ top: 300, height: 40, bottom: 340 }) as DOMRect;
      document.body.appendChild(target);

      render(<EditBenefitPreviewSection />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent("benefitsPreviewScrollTo", {
            detail: { field: "benefitTitle" },
          }),
        );
      });

      expect(scrollTo).toHaveBeenCalled();
    });

    it("scrolls to the Account Access card for the account fields", () => {
      // These nodes are appended by hand (RTL only cleans up its own render root),
      // so clear any left by an earlier case before adding this one.
      document
        .querySelectorAll(
          '[data-help-card="account-access"], [data-preview-scroll-container]',
        )
        .forEach((node) => node.remove());

      const scrollTo = vi.fn();
      const container = document.createElement("div");
      container.setAttribute("data-preview-scroll-container", "");
      Object.defineProperty(container, "scrollTo", { value: scrollTo });
      Object.defineProperty(container, "clientHeight", { value: 400 });
      Object.defineProperty(container, "scrollHeight", { value: 800 });
      container.getBoundingClientRect = () =>
        ({ top: 0, height: 400, bottom: 400 }) as DOMRect;
      document.body.appendChild(container);

      // The card the three account fields are edited on.
      const card = document.createElement("div");
      card.setAttribute("data-help-card", "account-access");
      card.getBoundingClientRect = () =>
        ({ top: 100, height: 200, bottom: 300 }) as DOMRect;
      container.appendChild(card);

      render(<EditBenefitPreviewSection />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent("benefitsPreviewScrollTo", {
            detail: { field: "insuranceLoginUrl" },
          }),
        );
      });

      expect(scrollTo).toHaveBeenCalled();
      // Centred on the card (100 + 100 - 200), i.e. not clamped to the container end.
      expect(scrollTo.mock.calls[0][0]).toMatchObject({ top: 0 });
    });

    it("scrolls the container that holds the marker, not the first one", () => {
      // Drop the markers the previous case appended — the handler resolves the
      // marker document-wide, so a stale one would be picked up instead.
      document
        .querySelectorAll(
          '[data-help-card="account-access"], [data-preview-scroll-container]',
        )
        .forEach((node) => node.remove());

      const decoyScroll = vi.fn();
      const decoy = document.createElement("div");
      decoy.setAttribute("data-preview-scroll-container", "");
      Object.defineProperty(decoy, "scrollTo", { value: decoyScroll });
      Object.defineProperty(decoy, "clientHeight", { value: 400 });
      Object.defineProperty(decoy, "scrollHeight", { value: 4000 });
      decoy.getBoundingClientRect = () =>
        ({ top: 0, height: 400, bottom: 400 }) as DOMRect;
      document.body.appendChild(decoy);

      // The second preview (the phone frame) is the one holding the card.
      const realScroll = vi.fn();
      const real = document.createElement("div");
      real.setAttribute("data-preview-scroll-container", "");
      Object.defineProperty(real, "scrollTo", { value: realScroll });
      Object.defineProperty(real, "clientHeight", { value: 400 });
      Object.defineProperty(real, "scrollHeight", { value: 1200 });
      real.getBoundingClientRect = () =>
        ({ top: 0, height: 400, bottom: 400 }) as DOMRect;
      document.body.appendChild(real);

      const card = document.createElement("div");
      card.setAttribute("data-help-card", "account-access");
      card.getBoundingClientRect = () =>
        ({ top: 500, height: 100, bottom: 600 }) as DOMRect;
      real.appendChild(card);

      render(<EditBenefitPreviewSection />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent("benefitsPreviewScrollTo", {
            detail: { field: "insurancePlanId" },
          }),
        );
      });

      expect(realScroll).toHaveBeenCalled();
      expect(decoyScroll).not.toHaveBeenCalled();
    });
  });
});
