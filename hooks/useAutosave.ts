"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * How long the form waits after the last keystroke before it writes.
 *
 * Long enough that typing a sentence is ONE request rather than twenty, short
 * enough that someone who pauses to read the preview sees "Saved" before they
 * move on. The portal panels and the Edit Plan form share the rhythm so the two
 * surfaces never feel like different products.
 */
export const AUTOSAVE_DELAY = 700;

export interface UseAutosaveOptions {
  /** The draft differs from what the server last returned. */
  isDirty: boolean;
  /**
   * Moves on every edit — a counter, a serialised draft, any value whose
   * identity or content changes when the draft does.
   *
   * The debounce restarts whenever this changes, so a steady stream of keystrokes
   * writes once the advisor pauses instead of on every character. `isDirty`
   * alone cannot do that: it is already `true` for the second keystroke, so it
   * never changes again and the timer would never restart.
   */
  version: unknown;
  /**
   * Persist the draft, resolving `true` when the server accepted it.
   *
   * A `false` (or a rejection) LATCHES the hook: the same draft is never retried
   * on its own, because a failing endpoint would otherwise be hammered once per
   * debounce forever. Whatever reports the failure keeps it on screen, and the
   * next edit — a new `version` — clears the latch and tries again.
   */
  save: () => Promise<boolean>;
  /** Override the quiet period (suites shrink it). */
  delayMs?: number;
}

/**
 * Write a draft by itself, a beat after the last edit.
 *
 * Both the portal's inline panels and the dashboard's Edit Plan form already
 * preview their draft and already know how to persist it; this hook is the
 * missing "when". It replaces the Save button, so the rules it enforces matter:
 *
 *  - one write per quiet period, not per keystroke;
 *  - one write at a time — a save that is still in flight makes the next one
 *    wait, and run straight after, so two requests can never race each other;
 *  - a failure stops the loop until the advisor edits again (see `save`);
 *  - leaving the surface does not lose the last edit: unmount flushes a pending
 *    draft instead of waiting for a timer that no longer exists.
 *
 * The hook never writes the SAME draft twice in a row, because `save` is
 * expected to move the caller's baseline to what it sent — that is what makes
 * `isDirty` false again and this loop quiet.
 */
export function useAutosave({
  isDirty,
  version,
  save,
  delayMs = AUTOSAVE_DELAY,
}: UseAutosaveOptions) {
  // The latest values for the timer callback, which must not close over a stale
  // render (a keystroke and the timer firing can land in the same tick).
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const saveRef = useRef(save);
  saveRef.current = save;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A write is in flight. */
  const runningRef = useRef(false);
  /** An edit arrived while that write was in flight. */
  const queuedRef = useRef(false);
  /** The last write failed; do not retry the same draft. */
  const latchedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const flush = useCallback(async () => {
    if (runningRef.current) {
      // Serialise: the in-flight write finishes first, then this edit goes.
      queuedRef.current = true;
      return;
    }
    if (!dirtyRef.current) return;

    runningRef.current = true;
    let accepted = false;
    try {
      accepted = await saveRef.current();
    } catch {
      // The caller reports its own failure; swallowing it here only keeps the
      // timer loop alive.
      accepted = false;
    } finally {
      runningRef.current = false;
    }

    if (!accepted) {
      latchedRef.current = true;
      return;
    }

    if (queuedRef.current) {
      queuedRef.current = false;
      // The advisor typed while the request was in flight: that draft is still
      // dirty (the caller only moved its baseline to what it sent), so write it.
      if (dirtyRef.current) await flush();
    }
  }, []);

  // (Re)start the quiet period on every edit.
  useEffect(() => {
    clearTimer();
    if (!isDirty) return;

    // A fresh edit is a fresh attempt: the previous failure no longer applies.
    latchedRef.current = false;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, delayMs);

    return clearTimer;
  }, [version, isDirty, delayMs, flush]);

  // Leaving with a pending draft writes it rather than dropping it.
  useEffect(
    () => () => {
      clearTimer();
      if (dirtyRef.current && !latchedRef.current) void flush();
    },
    [flush],
  );
}
