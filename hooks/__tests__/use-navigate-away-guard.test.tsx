import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigateAwayGuard } from "../use-navigate-away-guard";

const push = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  message: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast }));

type GuardOptions = Parameters<typeof useNavigateAwayGuard>[0];

function Harness(props: Partial<GuardOptions>) {
  const guard = useNavigateAwayGuard({
    enabled: true,
    hasUnsavedChanges: true,
    ...props,
  });

  return (
    <div>
      <a href="/dashboard">dashboard link</a>
      <a href="/dashboard?tab=1#section">dashboard with query</a>
      <a href="/">current page</a>
      <a href="https://external.example/path">external</a>
      <a href="/download" download>
        download
      </a>
      <a href="/blank" target="_blank">
        new tab
      </a>
      <a href="/ignored">ignored</a>
      <button type="button" data-nav-href="/settings">
        settings nav
      </button>
      <button type="button" data-nav-href="ftp://invalid">
        invalid nav
      </button>
      <button type="button" data-nav-href="/">
        current nav
      </button>

      <span data-testid="dialog-open">{String(guard.dialogOpen)}</span>
      <span data-testid="is-saving">{String(guard.isSaving)}</span>
      <span data-testid="is-discarding">{String(guard.isDiscarding)}</span>
      <button type="button" onClick={guard.stayAndKeepEditing}>
        stay
      </button>
      <button type="button" onClick={guard.saveAndExit}>
        save-exit
      </button>
      <button type="button" onClick={guard.discardWithoutSaving}>
        discard
      </button>
      <button type="button" onClick={() => guard.dialogOnOpenChange(false)}>
        close-dialog
      </button>
      <button type="button" onClick={guard.suppressStayOnNextClose}>
        suppress-stay
      </button>
    </div>
  );
}

function renderGuard(props: Partial<GuardOptions> = {}) {
  return render(<Harness {...props} />);
}

function clickLink(name: string) {
  return fireEvent.click(screen.getByRole("link", { name }));
}

describe("useNavigateAwayGuard", () => {
  beforeEach(() => {
    push.mockClear();
    toast.error.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("registers beforeunload only while there are unsaved changes", () => {
    const { unmount } = renderGuard();
    const guarded = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(guarded);
    expect(guarded.defaultPrevented).toBe(true);
    unmount();

    renderGuard({ hasUnsavedChanges: false });
    const unguarded = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unguarded);
    expect(unguarded.defaultPrevented).toBe(false);
  });

  it("does nothing when the guard is disabled", () => {
    renderGuard({ enabled: false });

    expect(clickLink("dashboard link")).toBe(true);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("intercepts an internal link and opens the dialog", () => {
    renderGuard();

    expect(clickLink("dashboard link")).toBe(false);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores modifier clicks", () => {
    renderGuard();

    const prevented = fireEvent.click(
      screen.getByRole("link", { name: "dashboard link" }),
      { ctrlKey: true },
    );

    expect(prevented).toBe(true);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("ignores non-primary buttons", () => {
    renderGuard();

    const prevented = fireEvent.click(
      screen.getByRole("link", { name: "dashboard link" }),
      { button: 1 },
    );

    expect(prevented).toBe(true);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("ignores external links, new tabs, downloads, and the current URL", () => {
    renderGuard();

    expect(clickLink("external")).toBe(true);
    expect(clickLink("new tab")).toBe(true);
    expect(clickLink("download")).toBe(true);
    expect(clickLink("current page")).toBe(true);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("honors shouldIgnoreHref", () => {
    const shouldIgnoreHref = vi.fn((href: string) => href === "/ignored");
    renderGuard({ shouldIgnoreHref });

    expect(clickLink("ignored")).toBe(true);
    expect(shouldIgnoreHref).toHaveBeenCalledWith("/ignored");
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("intercepts data-nav-href buttons", () => {
    renderGuard();

    const prevented = fireEvent.click(
      screen.getByRole("button", { name: "settings nav" }),
    );

    expect(prevented).toBe(false);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
  });

  it("ignores malformed or current data-nav-href values", () => {
    renderGuard();

    expect(
      fireEvent.click(screen.getByRole("button", { name: "invalid nav" })),
    ).toBe(true);
    expect(
      fireEvent.click(screen.getByRole("button", { name: "current nav" })),
    ).toBe(true);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("stay closes the dialog and keeps editing", () => {
    renderGuard();
    clickLink("dashboard link");

    fireEvent.click(screen.getByRole("button", { name: "stay" }));

    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
    expect(push).not.toHaveBeenCalled();
  });

  it("closing through dialogOnOpenChange behaves like Stay", () => {
    renderGuard();
    clickLink("dashboard link");

    fireEvent.click(screen.getByRole("button", { name: "close-dialog" }));

    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("suppressStayOnNextClose keeps the dialog open for a discard", () => {
    renderGuard();
    clickLink("dashboard link");

    fireEvent.click(screen.getByRole("button", { name: "suppress-stay" }));
    fireEvent.click(screen.getByRole("button", { name: "close-dialog" }));

    expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
  });

  it("save-and-exit saves, then navigates to the pending href", async () => {
    const onSaveAndExit = vi.fn(async () => undefined);
    renderGuard({ onSaveAndExit });
    clickLink("dashboard with query");

    fireEvent.click(screen.getByRole("button", { name: "save-exit" }));

    await waitFor(
      () => expect(push).toHaveBeenCalledWith("/dashboard?tab=1#section"),
      { timeout: 2500 },
    );
    expect(onSaveAndExit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  it("keeps the dialog open and toasts when saving fails", async () => {
    const onSaveAndExit = vi.fn(async () => {
      throw new Error("Could not save");
    });
    renderGuard({ onSaveAndExit });
    clickLink("dashboard link");

    fireEvent.click(screen.getByRole("button", { name: "save-exit" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not save"),
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
  });

  it("discard runs onDiscard and navigates", async () => {
    const onDiscard = vi.fn(async () => undefined);
    renderGuard({ onDiscard });
    clickLink("dashboard link");

    fireEvent.click(screen.getByRole("button", { name: "discard" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open and toasts when discard fails", async () => {
    const onDiscard = vi.fn(async () => {
      throw new Error("Could not discard");
    });
    renderGuard({ onDiscard });
    clickLink("dashboard link");

    fireEvent.click(screen.getByRole("button", { name: "discard" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not discard"),
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
  });

  it("guards browser back and resumes history when discarded", async () => {
    const back = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => {});
    renderGuard();

    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() =>
      expect(screen.getByTestId("dialog-open")).toHaveTextContent("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "discard" }));

    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

});
