import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The write loop behind every portal panel's Save button — one debounced PUT per
 * quiet period, serialised, and quiet after a failure.
 */

import { usePortalAutosave } from "@/components/portal-editing/use-portal-autosave";

/** The edit the host hands the test, so a test can "type" without a form. */
const controls: { edit?: () => void } = {};

function Harness({
  save,
  delayMs = 100,
}: {
  save: () => Promise<boolean>;
  delayMs?: number;
}) {
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);

  controls.edit = () => {
    setDirty(true);
    setVersion((value) => value + 1);
  };
  usePortalAutosave({ isDirty: dirty, version, save, delayMs });

  return null;
}

describe("usePortalAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    controls.edit = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes once, after the typing stops", () => {
    const save = vi.fn(async () => true);
    render(<Harness save={save} />);

    act(() => controls.edit!());
    act(() => controls.edit!());
    act(() => controls.edit!());

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(save).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("stops after a write the server refused, until the next edit", async () => {
    const save = vi.fn(async () => false);
    render(<Harness save={save} />);

    act(() => controls.edit!());
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // Same draft, more time: a failing endpoint is not hammered in a loop.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // A new edit is a new attempt.
    act(() => controls.edit!());
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("runs one write at a time, then the edit made meanwhile", async () => {
    let finishFirst: (accepted: boolean) => void = () => {};
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishFirst = resolve;
        }),
    );
    render(<Harness save={save} />);

    act(() => controls.edit!());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // An edit lands while the request is in flight, and its debounce expires.
    act(() => controls.edit!());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishFirst(true);
    });

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("writes a draft that is still pending when the panel closes", () => {
    const save = vi.fn(async () => true);
    const { unmount } = render(<Harness save={save} />);

    act(() => controls.edit!());
    expect(save).not.toHaveBeenCalled();

    unmount();

    expect(save).toHaveBeenCalledTimes(1);
  });
});
