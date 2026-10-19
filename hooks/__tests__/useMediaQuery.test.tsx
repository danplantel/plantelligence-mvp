import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "../useMediaQuery";

type Listener = (event: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialMatches,
    media: "(min-width: 1024px)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_: string, listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_: string, listener: Listener) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  };

  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

  return {
    mql,
    setMatches(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((listener) =>
        listener({ matches } as MediaQueryListEvent),
      );
    },
    listenerCount: () => listeners.size,
  };
}

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Each test installs its own matchMedia implementation.
  });

  it("returns the current match state", () => {
    installMatchMedia(true);

    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)"),
    );

    expect(result.current).toBe(true);
  });

  it("updates when the media query changes", () => {
    const media = installMatchMedia(true);

    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)"),
    );

    act(() => media.setMatches(false));

    expect(result.current).toBe(false);
  });

  it("falls back when matchMedia is unavailable", () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;

    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)"),
    );

    expect(result.current).toBe(true);
  });

  it("honors a custom server fallback", () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;

    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)", false),
    );

    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const media = installMatchMedia(true);

    const { unmount } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)"),
    );
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });
});
