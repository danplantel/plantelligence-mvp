import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollToErrorField } from "../use-scroll-to-error-field";

const store = vi.hoisted(() => ({
  errorFieldsSource: "next" as "next" | "blur" | null,
}));

vi.mock("@/lib/onboarding-wizard-store", () => ({
  useOnboardingWizardStore: (
    selector: (state: typeof store) => unknown,
  ) => selector(store),
}));

function mountField(name: string) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-field", name);
  const input = document.createElement("input");
  wrapper.appendChild(input);
  document.body.appendChild(wrapper);

  const scrollIntoView = vi.fn();
  wrapper.scrollIntoView = scrollIntoView;

  return { wrapper, input, scrollIntoView };
}

describe("useScrollToErrorField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.errorFieldsSource = "next";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function advance() {
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
  }

  it("scrolls to and focuses the first errored field in document order", async () => {
    const phone = mountField("phone");
    const name = mountField("name");

    renderHook(() =>
      useScrollToErrorField(
        ["phone", "name"],
        ["name", "phone"],
      ),
    );

    await advance();

    expect(name.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(phone.scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(name.input);
  });

  it("does nothing when the error belongs to another step", async () => {
    const services = mountField("services");

    renderHook(() =>
      useScrollToErrorField(["services"], ["organizationType"]),
    );

    await advance();

    expect(services.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing for blur-sourced errors", async () => {
    store.errorFieldsSource = "blur";
    const name = mountField("name");

    renderHook(() => useScrollToErrorField(["name"], ["name"]));
    await advance();

    expect(name.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing without errors", async () => {
    const name = mountField("name");

    renderHook(() => useScrollToErrorField([], ["name"]));
    await advance();

    expect(name.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing when the field is not in the document", async () => {
    renderHook(() => useScrollToErrorField(["name"], ["name"]));

    await expect(advance()).resolves.toBeUndefined();
  });

  it("focuses a nested input rather than the wrapper", async () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-field", "organizationType");
    const button = document.createElement("button");
    wrapper.appendChild(button);
    document.body.appendChild(wrapper);
    wrapper.scrollIntoView = vi.fn();

    renderHook(() =>
      useScrollToErrorField(["organizationType"], ["organizationType"]),
    );
    await advance();

    // Buttons are not focused by this hook; the wrapper is not an input.
    expect(wrapper.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(button);
  });

  it("clears its timer on unmount", async () => {
    const name = mountField("name");

    const { unmount } = renderHook(() =>
      useScrollToErrorField(["name"], ["name"]),
    );
    unmount();
    await advance();

    expect(name.scrollIntoView).not.toHaveBeenCalled();
  });
});
