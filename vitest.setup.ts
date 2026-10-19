import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// React Testing Library does not auto-cleanup when Vitest globals are disabled,
// so unmount every rendered tree between tests.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia. Components such as DesktopOnlyGate read
// it during render, so provide a default "no match" implementation. Tests that
// care about the result can override `window.matchMedia` themselves.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom does not implement these browser APIs used by scroll/focus helpers.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

// Radix primitives used by dialogs/selects probe pointer capture.
if (typeof window.Element.prototype.hasPointerCapture !== "function") {
  window.Element.prototype.hasPointerCapture = () => false;
}
if (typeof window.Element.prototype.setPointerCapture !== "function") {
  window.Element.prototype.setPointerCapture = () => {};
}
if (typeof window.Element.prototype.releasePointerCapture !== "function") {
  window.Element.prototype.releasePointerCapture = () => {};
}

// jsdom leaves scrolling unimplemented; the wizard resets scroll on every step.
window.scrollTo = vi.fn();
if (typeof window.Element.prototype.scrollTo !== "function") {
  window.Element.prototype.scrollTo = vi.fn();
}

if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number;
  window.cancelAnimationFrame = (handle: number) =>
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
