import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWizardInit } from "../useWizardInit";

const store = vi.hoisted(() => ({
  loadAllWizardData: vi.fn(async () => ({})),
  resetWizard: vi.fn(),
  currentStep: 3,
}));

vi.mock("@/lib/onboarding-wizard-store", () => ({
  useOnboardingWizardStore: () => store,
}));

describe("useWizardInit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.loadAllWizardData.mockReset();
    store.loadAllWizardData.mockResolvedValue({});
    store.resetWizard.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advance(ms = 100) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("loads data once and reports initialization", async () => {
    const { result } = renderHook(() => useWizardInit());

    expect(result.current.isInitialized).toBe(false);
    expect(store.loadAllWizardData).not.toHaveBeenCalled();

    await advance();

    expect(store.loadAllWizardData).toHaveBeenCalledTimes(1);
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.currentStep).toBe(3);
  });

  it("resets the wizard when loading fails", async () => {
    store.loadAllWizardData.mockRejectedValue(new Error("load failed"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useWizardInit());
    await advance();

    expect(consoleError).toHaveBeenCalledWith(
      "useWizardInit: Error loading wizard data:",
      expect.any(Error),
    );
    expect(store.resetWizard).toHaveBeenCalledTimes(1);
    expect(result.current.isInitialized).toBe(true);
  });

  it("does not load twice across re-renders", async () => {
    const { rerender, result } = renderHook(() => useWizardInit());

    await advance();
    rerender();
    await advance(500);

    expect(store.loadAllWizardData).toHaveBeenCalledTimes(1);
    expect(result.current.isInitialized).toBe(true);
  });
});
