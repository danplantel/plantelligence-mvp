"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { GripVertical, X } from "lucide-react";

export interface ChipTypeaheadOption {
  value: string;
  label: string;
  /**
   * Extra strings a typed query may match (e.g. a designation acronym like
   * "SHRM-CP" so "shrm cp" resolves). Compared case/punctuation-insensitively.
   */
  keywords?: string[];
}

/** Lowercase and strip everything but letters/digits: "shrm cp" === "SHRM-CP". */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Gap between the input and its list, in px. */
const LIST_GAP = 4;
/** The list's own cap (`max-h-64`) and the minimum height worth drawing. */
const LIST_MAX_PX = 256;
const LIST_MIN_PX = 96;

/** A chip's place on screen, with the value it stands for. */
interface ChipMeasure {
  value: string;
  index: number;
  rect: DOMRect;
}

/**
 * Where a drop would land: `index` is the insertion GAP (`0..selectedValues.length`, where `length`
 * means "after the last chip") and `side` is which of that gap's two edges to mark — `before` the
 * chip at `index`, or `after` the chip at `index - 1`.
 */
interface DropMark {
  index: number;
  side: "before" | "after";
}

/**
 * Which insertion gap a pointer at `clientX` is aiming at, for the chip whose box is `rect`, and
 * which of that gap's two edges the pointer is nearer.
 *
 * The chip's horizontal midpoint is the boundary: its left half means "insert before this chip",
 * its right half "insert after it". So the gap is always `index` or `index + 1`, and the edge is
 * simply whichever half the pointer is in. The caller still contributes the "past the last chip"
 * case (`length`), which is what the container's own space reports.
 */
const dropMarkAt = (
  clientX: number,
  rect: DOMRect,
  index: number,
): DropMark =>
  clientX > rect.left + rect.width / 2
    ? { index: index + 1, side: "after" }
    : { index, side: "before" };

/**
 * How long the "you are at the cap" notice stays up. Long enough to read once, short enough that it
 * does not turn into a permanent error state for something that is not an error.
 */
const LIMIT_NOTICE_MS = 2600;

/**
 * Whether a drag event came from a chip, or from anything inside one.
 *
 * Chips carry `data-chip` for this. A chip's own handler answers with the gap at its edges, while
 * everything else in the component is the parent's box — the gaps between pills, the space past a
 * row's last pill, the counter, the field — and all of those resolve through `markAtPointer`.
 */
const isChipEvent = (target: EventTarget | null) =>
  target instanceof Element && target.closest("[data-chip]") !== null;

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * The reorder glide has to start BEFORE the browser paints the chips in their new places. Under
 * `useEffect` there is one frame of the finished order on screen, and only then do the chips slide
 * out of positions they were just seen in — a flash rather than a glide. There is nothing to measure
 * on the server, and calling `useLayoutEffect` during SSR logs a warning, so the server gets the
 * harmless variant.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The reorder glide: long enough to read as movement, short enough not to lag the drop. */
const REORDER_MS = 220;

/**
 * The insertion marker's look, shared by the leading and trailing cases.
 *
 * Centred with `inset-y-0 my-auto` rather than `top-1/2 -translate-y-1/2` deliberately: the enter
 * animation writes a `transform`, which would overwrite a translate utility and drop the marker's
 * centring for the length of the animation.
 */
const MARKER_CLASS =
  "pointer-events-none absolute inset-y-0 my-auto h-5 w-0.5 rounded-full bg-accent-blue animate-in fade-in zoom-in-50 duration-150";

/** One shared check — the glide and the chip entrance ask the same question. */
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ChipTypeaheadProps {
  options: ChipTypeaheadOption[];
  /** Selected VALUES (ids for dictionary options, free text for customs). */
  selectedValues: string[];
  onChange: (values: string[]) => void;
  /** Map a stored value to its display label (used for matches + fallback). */
  valueLabel?: (value: string) => string;
  /**
   * Optional short form for the selected CHIPS only (e.g. a designation
   * acronym). Falls back to `valueLabel` when omitted. The match list always
   * uses the full `label` so users can see what an acronym means.
   */
  chipLabel?: (value: string) => string;
  placeholder?: string;
  /** Offer the typed text as a custom (free-text) value when nothing matches. */
  allowCustom?: boolean;
  /** Row label for the custom option; receives the trimmed query. */
  customOptionLabel?: (query: string) => string;
  maxSelections?: number;
  disabled?: boolean;
  id?: string;
  /** `data-field` attribute, for wizard scroll-to-error targeting. */
  dataField?: string;
  /** Paint a red outline (validation state). */
  destructive?: boolean;
  className?: string;
}

/**
 * Typeahead chip input.
 *
 * The user types, matching options appear, Enter adds a chip. When nothing
 * matches, an inline "add as custom" row is offered (when `allowCustom`), so
 * free-text values no longer need a separate field.
 *
 * Chips are shown in display order (the order of `selectedValues`), can be
 * dragged to reorder — a chip drops into the GAP the pointer is over, so it can
 * be placed between two others — and render through `valueLabel` so the UI never
 * shows a bare id. When `maxSelections` is set, an "x of N" counter is shown.
 *
 * At that cap the picker stops opening and says so briefly, because every
 * remaining row would be refused on pick anyway. Removing a chip — its X, or
 * Backspace on the empty field — frees the slot and the list comes back.
 */
export function ChipTypeahead({
  options,
  selectedValues,
  onChange,
  valueLabel,
  chipLabel,
  placeholder = "Type to search…",
  allowCustom = false,
  customOptionLabel = (query) => `Add "${query}"`,
  maxSelections,
  disabled = false,
  id,
  dataField,
  destructive = false,
  className,
}: ChipTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /**
   * Where the drag would drop: `index` is the insertion GAP (`0..selectedValues.length`, where
   * `length` means "after the last chip"), and `side` says which chip's edge carries the marker —
   * `before` the chip at `index`, or `after` the chip at `index - 1`.
   *
   * The side is not cosmetic once the chips wrap. The gap between the last chip of one row and the
   * first chip of the next is a SINGLE gap, but it has two edges on screen, on two different lines.
   * Knowing which one the pointer is nearest draws the marker where the user is actually looking
   * instead of jumping to the line below.
   *
   * The gap itself replaced a `dragOverIndex` (the index of the chip being hovered), because back
   * then a drop could only move a chip to where another chip already sat — "land on C to take C's
   * place" — so "put it between C and D" was not expressible at all.
   */
  const [dropMark, setDropMark] = useState<DropMark | null>(null);
  /**
   * Bumped every time an attempt is refused at the cap; `0` means there is nothing to say. The value
   * doubles as the notice's React `key`, so repeating the attempt replays its entrance instead of
   * leaving up a static message that reads as though the click was ignored.
   */
  const [limitNotice, setLimitNotice] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** The list is portalled (see the render), so "is this click inside?" has two answers. */
  const listRef = useRef<HTMLUListElement>(null);
  /** One entry per chip, in render order, so a chip can be measured before and after a reorder. */
  const chipRefs = useRef<Array<HTMLSpanElement | null>>([]);
  /** Each chip's box from the last commit, keyed by value (`undefined` means newly added). */
  const chipBoxesRef = useRef<Map<string, DOMRect>>(new Map());
  /** In-flight glide animations, so a fast second reorder cancels rather than compounds them. */
  const glideAnimationsRef = useRef<Animation[]>([]);
  /** The cap notice's dismissal timer, so a second refusal restarts the countdown. */
  const limitNoticeTimerRef = useRef<number | null>(null);

  /** Every chip's box as it is right now, in render order. The one place chips are measured. */
  const measureChips = () => {
    const chips: ChipMeasure[] = [];
    for (let index = 0; index < selectedValues.length; index += 1) {
      const el = chipRefs.current[index];
      if (el) {
        chips.push({
          value: selectedValues[index],
          index,
          rect: el.getBoundingClientRect(),
        });
      }
    }
    return chips;
  };

  /**
   * Record where every chip is, immediately BEFORE a change that moves them.
   *
   * That is the only moment the old positions are still readable. The drag case is the important one:
   * the picked-up chip is scaled, so a snapshot taken while it is lifted would record an inflated box
   * and send it gliding in from the wrong place on drop.
   */
  const snapshotChips = () => {
    const boxes = new Map<string, DOMRect>();
    measureChips().forEach(({ value, rect }) => boxes.set(value, rect));
    chipBoxesRef.current = boxes;
  };

  /**
   * The mark for a pointer that is over the container's own space rather than over a chip.
   *
   * That space is not only the tail of a row: the 8px `gap-2` BETWEEN two pills belongs to the
   * container as well, because a chip's box ends at its own border. So the instant the pointer
   * reached the very gap the marker was pointing at, the event stopped coming from a chip, this
   * handler took over, and the position collapsed to "end of the row" — which for a pill dragged in
   * from further right was a no-op, so the marker vanished and nothing moved.
   *
   * The fix is to apply the same horizontal midpoint rule as `dropMarkAt`, but to the pills of the
   * row the pointer is in: take the gap before the first pill whose midpoint is still to the right of
   * the pointer, or the gap after the row's last pill when there is none. Every position along a row
   * therefore reports the gap underneath it, whether the pointer is over a pill or between two.
   */
  const markAtPointer = (clientX: number, clientY: number): DropMark => {
    const chips = measureChips();
    if (chips.length === 0) return { index: 0, side: "before" };

    // The nearest row wins, and the distance is measured to a chip's BOX rather than to its centre,
    // so the strip of container space BETWEEN two wrapped rows still resolves to a row rather than
    // to nothing.
    let nearest = Number.POSITIVE_INFINITY;
    let rowTop = chips[0].rect.top;
    for (const chip of chips) {
      const { rect } = chip;
      const distance =
        clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0;
      if (distance < nearest) {
        nearest = distance;
        rowTop = rect.top;
      }
    }

    // The pills of that row, left to right — chips are already in render order. The 1px slack
    // absorbs sub-pixel layout; sharing a line means sharing a `top`.
    const row = chips.filter((chip) => Math.abs(chip.rect.top - rowTop) <= 1);

    for (let position = 0; position < row.length; position += 1) {
      const chip = row[position];
      const midpoint = chip.rect.left + chip.rect.width / 2;
      if (clientX < midpoint) {
        // The gap before this pill. Mark whichever of the gap's two bounding edges is nearer, so
        // crossing the gap carries the marker with the pointer instead of flipping it behind.
        const previous = position > 0 ? row[position - 1] : null;
        const closerToPrevious =
          previous !== null && clientX - previous.rect.right < chip.rect.left - clientX;
        return { index: chip.index, side: closerToPrevious ? "after" : "before" };
      }
    }

    // Right of every midpoint on this row: past its last chip, which is the end of a line — and, for
    // the last row, the end of the list.
    return { index: row[row.length - 1].index + 1, side: "after" };
  };

  /**
   * Where the portalled list is pinned, in VIEWPORT coordinates.
   *
   * The list used to be an `absolute` child of this container. An absolutely positioned box is
   * still part of its scrolling ancestor's overflow, so opening a list that hangs BELOW the input
   * made the page taller and gave the wizard's scroll region somewhere new to scroll to — focusing
   * the field moved the page. `fixed` content is outside that calculation, so the list floats over
   * the form rather than extending it.
   *
   * Measured when the list OPENS rather than during render: opening is a user gesture, the input is
   * on screen by definition, and it puts the first paint in the right place instead of a frame at
   * the top-left corner. The reposition effect keeps it current afterwards.
   */
  const [listRect, setListRect] = useState<{
    left: number;
    top: number;
    bottom: number;
    width: number;
  } | null>(null);

  const measureInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return null;
    const rect = input.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
    };
  }, []);

  /** Measure, then open — every path that opens the list goes through here. */
  const openList = () => {
    const rect = measureInput();
    if (rect) setListRect(rect);
    setOpen(true);
  };

  const labelFor = (value: string) => {
    if (valueLabel) return valueLabel(value);
    return options.find((o) => o.value === value)?.label ?? value;
  };

  /** Chips show the short form when provided, otherwise the full label. */
  const chipLabelFor = (value: string) =>
    chipLabel ? chipLabel(value) : labelFor(value);

  const matches = useMemo(() => {
    const nq = squash(query);
    const selected = new Set(selectedValues);
    const pool = options.filter((o) => !selected.has(o.value));
    if (!nq) return pool;
    return pool
      .filter(
        (o) =>
          squash(o.label).includes(nq) ||
          squash(o.value).includes(nq) ||
          (o.keywords ?? []).some((k) => squash(k).includes(nq)),
      )
      .slice(0, 8);
  }, [options, query, selectedValues]);

  const trimmedQuery = query.trim();
  const exactMatch = useMemo(() => {
    const nq = squash(trimmedQuery);
    if (!nq) return false;
    return options.some(
      (o) =>
        squash(o.value) === nq ||
        squash(o.label) === nq ||
        (o.keywords ?? []).some((k) => squash(k) === nq) ||
        (valueLabel ? squash(valueLabel(o.value)) === nq : false),
    );
  }, [options, trimmedQuery, valueLabel]);

  const alreadySelected = selectedValues.some(
    (v) => v.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  const showCustom =
    allowCustom && trimmedQuery.length > 0 && !exactMatch && !alreadySelected;

  const rows = useMemo<Array<{ value: string; label: string; isCustom: boolean }>>(
    () => [
      ...matches.map((o) => ({
        value: o.value,
        label: o.label,
        isCustom: false,
      })),
      ...(showCustom
        ? [
            {
              value: trimmedQuery,
              label: customOptionLabel(trimmedQuery),
              isCustom: true,
            },
          ]
        : []),
    ],
    [matches, showCustom, trimmedQuery, customOptionLabel],
  );

  const atMax =
    typeof maxSelections === "number" && selectedValues.length >= maxSelections;

  /** Say why the picker will not open, then take the message away again. */
  const showLimitNotice = () => {
    setLimitNotice((n) => n + 1);
    if (limitNoticeTimerRef.current !== null) {
      window.clearTimeout(limitNoticeTimerRef.current);
    }
    limitNoticeTimerRef.current = window.setTimeout(() => {
      limitNoticeTimerRef.current = null;
      setLimitNotice(0);
    }, LIMIT_NOTICE_MS);
  };

  /**
   * Open the list — or, at the cap, refuse and say why.
   *
   * Every way in goes through here: click, focus, typing and ArrowDown. One gate, so no path can
   * quietly reopen a list whose every row `commit` would then turn down.
   */
  const requestListOpen = () => {
    if (atMax) {
      showLimitNotice();
      return;
    }
    openList();
  };

  // Moving the highlight to the first row whenever the row set changes keeps
  // Enter predictable (Enter adds the highlighted row).
  useEffect(() => {
    setHighlighted(0);
  }, [query, rows.length]);

  // Close on outside click. TWO containers now: the field, and the portalled list — which is a
  // child of <body>, so `containerRef` alone would read a click on a ROW as an outside click. It
  // happens to still work, because React's own handler runs before the document listener and
  // commits first; relying on that ordering is precisely the kind of thing that breaks silently.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  /**
   * Keep the list attached to its input while anything scrolls, or the window resizes.
   *
   * A `fixed` list does not travel with the page, so without this it would sit still while the
   * field it belongs to scrolled away from it. The scroll listener is registered in the CAPTURE
   * phase deliberately: scroll does not bubble, so a listener on `window` alone would miss the
   * wizard's own scroll container — which is the container this whole change is about.
   */
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = measureInput();
      if (rect) setListRect(rect);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, measureInput]);

  /**
   * The reorder glide — a FLIP. Chips are measured as they were before this commit painted, then
   * animated from those old boxes to their new ones, so a drop settles instead of teleporting.
   *
   * Hand-rolled rather than reaching for framer-motion, which is already a dependency: the drag is
   * the browser's native drag-and-drop, and framer's `Reorder` would replace that model wholesale —
   * including the gap-based drop that makes "between these two chips" addressable at all.
   * `Element.animate` costs nothing and leaves the drag alone.
   */
  useIsomorphicLayoutEffect(() => {
    // Mid-drag the chips are deliberately out of their resting places — the picked-up one is scaled
    // — so a re-render triggered by something else would measure a box that is not the real one and
    // poison the baseline for the drop. A drop clears `dragIndex` in the same commit as the reorder,
    // so this can never skip the glide it exists to draw.
    if (dragIndex !== null) return;

    // React has already detached the refs of any chips removed in this commit.
    chipRefs.current.length = selectedValues.length;

    const previous = chipBoxesRef.current;
    const next = new Map<string, DOMRect>();
    const added: HTMLSpanElement[] = [];
    const glided: Array<{ el: HTMLSpanElement; dx: number; dy: number }> = [];

    selectedValues.forEach((value, index) => {
      const el = chipRefs.current[index];
      if (!el) return;
      const box = el.getBoundingClientRect();
      next.set(value, box);

      const before = previous.get(value);
      if (!before) {
        added.push(el);
        return;
      }
      // Sub-pixel drift is not a move; animating it would leave chips permanently mid-glide.
      const dx = before.left - box.left;
      const dy = before.top - box.top;
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) glided.push({ el, dx, dy });
    });

    const hadChips = previous.size > 0;
    chipBoxesRef.current = next;

    // Recorded above either way — the next reorder still needs a baseline to measure against.
    if (prefersReducedMotion()) return;

    glideAnimationsRef.current.forEach((animation) => animation.cancel());
    glideAnimationsRef.current = [
      ...glided.map(({ el, dx, dy }) =>
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: REORDER_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ),
      ),
      // A chip that did not exist before has nowhere to glide from, so it fades up in place.
      // Skipped on the first pass, where every chip is "new" and popping the whole row up on mount
      // would be noise rather than feedback.
      ...(hadChips
        ? added.map((el) =>
            el.animate(
              [
                { transform: "scale(0.85)", opacity: 0 },
                { transform: "scale(1)", opacity: 1 },
              ],
              { duration: REORDER_MS, easing: "ease-out" },
            ),
          )
        : []),
    ];
  }, [selectedValues, dragIndex]);

  // Nothing here may outlive the component: glides running against detached nodes, and the cap
  // notice's timer, which would otherwise fire into a component that is no longer mounted.
  useEffect(
    () => () => {
      glideAnimationsRef.current.forEach((animation) => animation.cancel());
      if (limitNoticeTimerRef.current !== null) {
        window.clearTimeout(limitNoticeTimerRef.current);
      }
    },
    [],
  );

  const commit = (value: string) => {
    if (!value || atMax) return;
    if (selectedValues.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setQuery("");
      return;
    }
    snapshotChips();
    onChange([...selectedValues, value]);
    setQuery("");
    setOpen(false);
  };

  const remove = (value: string) => {
    snapshotChips();
    onChange(selectedValues.filter((v) => v !== value));
  };

  /**
   * Move the chip at `from` to the insertion point `insertAt`, preserving display order.
   *
   * `insertAt` is a GAP index (`0..length`, where `length` appends) rather than a chip index, so
   * inserting between two chips is expressible. Removing the chip first shifts everything after it
   * down by one, which is exactly what the `insertAt > from` correction pays back.
   */
  const move = (from: number, insertAt: number) => {
    // Dropping a chip onto itself, or into the gap straight after itself, changes nothing.
    if (insertAt === from || insertAt === from + 1) return;
    const next = [...selectedValues];
    const [moved] = next.splice(from, 1);
    next.splice(insertAt > from ? insertAt - 1 : insertAt, 0, moved);
    onChange(next);
  };

  /**
   * The mark to draw, or null when there is nothing worth showing.
   *
   * "Before myself" and "after myself" both resolve to the chip's current position, so marking them
   * would advertise a move that `move` then declines to make.
   */
  const activeDropMark =
    dropMark !== null &&
    dragIndex !== null &&
    dropMark.index !== dragIndex &&
    dropMark.index !== dragIndex + 1
      ? dropMark
      : null;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      requestListOpen();
      setHighlighted((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlighted];
      if (row) commit(row.value);
      else if (showCustom) commit(trimmedQuery);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (
      e.key === "Backspace" &&
      query === "" &&
      selectedValues.length > 0
    ) {
      remove(selectedValues[selectedValues.length - 1]);
    }
  };

  const listboxId = `${id ?? "chip-typeahead"}-listbox`;

  /**
   * Which way the list opens, and how tall it may be.
   *
   * Measured against the VIEWPORT, because the list is `fixed` now — what matters is how much
   * screen is left on each side, not where it sits in the document. Opening upward is expressed as
   * a `bottom` offset so the list's own height is never needed to place it, only to cap it, which
   * keeps this to one pass rather than render → measure → re-render.
   */
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const spaceBelow = listRect ? viewportHeight - listRect.bottom - LIST_GAP : 0;
  const spaceAbove = listRect ? listRect.top - LIST_GAP : 0;
  const opensUpward =
    listRect != null &&
    spaceBelow < LIST_MIN_PX + LIST_GAP &&
    spaceAbove > spaceBelow;
  const listMaxHeight = Math.max(
    LIST_MIN_PX,
    Math.min(LIST_MAX_PX, opensUpward ? spaceAbove : spaceBelow),
  );

  return (
    /**
     * The WHOLE component is the drop zone, not just the row of pills.
     *
     * The row is only ~24px tall and the marker is drawn inside a gap on that row, so a pointer that
     * drifted a few pixels above or below it — or onto the field underneath — was over an element with
     * no drag handlers at all. The browser then refuses the drop entirely (`drop` only fires where the
     * last `dragover` was cancelled), and because nothing updated `dropMark`, the marker from the last
     * good position stayed on screen: the line was visible, and the pill did not move. That is the
     * "only works when the pill is touching the line" report.
     *
     * Everything inside the component now resolves, except a chip, which still answers more precisely
     * for the pointer being directly over it.
     */
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onDragOver={(e) => {
        if (dragIndex === null || isChipEvent(e.target)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropMark(markAtPointer(e.clientX, e.clientY));
      }}
      onDrop={(e) => {
        if (dragIndex === null || isChipEvent(e.target)) return;
        e.preventDefault();
        move(dragIndex, markAtPointer(e.clientX, e.clientY).index);
        setDragIndex(null);
        setDropMark(null);
      }}
      // Leaving the component takes the marker with it, so it can never sit there promising a drop the
      // browser would refuse. `relatedTarget` keeps this to a real exit: `dragleave` also fires when
      // the pointer crosses from one child to another.
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropMark(null);
      }}
    >
      {/* Selected chips (display order) + counter */}
      {(selectedValues.length > 0 || typeof maxSelections === "number") && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {selectedValues.map((value, index) => (
            <span
              key={value}
              data-chip=""
              ref={(el) => {
                chipRefs.current[index] = el;
              }}
              draggable={!disabled}
              onDragStart={(e) => {
                // Taken BEFORE the pick-up lift renders, so the chip's own box is still its resting
                // one and the drop glide starts from where the user actually saw it.
                snapshotChips();
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                // Some browsers require data to be set for the drag to start.
                e.dataTransfer.setData("text/plain", value);
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                // Report the GAP the pointer is over, not the chip: a chip's left half means
                // "before it", its right half "after it". This is what makes dropping BETWEEN two
                // chips possible at all.
                setDropMark(
                  dropMarkAt(
                    e.clientX,
                    e.currentTarget.getBoundingClientRect(),
                    index,
                  ),
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex === null) return;
                // Recomputed from the event rather than read back from `dropMark`: where the pointer
                // actually was is the honest answer, and it does not depend on which state flush
                // happened to land first. Only the gap is needed here — the side is just the marker.
                move(
                  dragIndex,
                  dropMarkAt(
                    e.clientX,
                    e.currentTarget.getBoundingClientRect(),
                    index,
                  ).index,
                );
                setDragIndex(null);
                setDropMark(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDropMark(null);
              }}
              className={cn(
                // `accent-blue-light` is a mode-aware token (pale teal in light,
                // deep teal in dark), so one class covers both themes.
                // `relative` anchors the insertion marker, which is absolutely positioned so that
                // showing it never nudges the very chips it is pointing between. The existing
                // `transition` is what turns the pick-up below into a lift rather than a jump.
                "relative inline-flex select-none items-center gap-1 rounded-full border border-accent-blue/30 bg-accent-blue-light px-2.5 py-1 text-xs font-medium text-accent-blue transition duration-150 dark:text-white",
                !disabled && "cursor-grab active:cursor-grabbing",
                // Picked up: rise above its neighbours, grow a little, and leave a faded footprint
                // in the slot it came from. `z-10` keeps the lift over the chips either side.
                dragIndex === index && "z-10 scale-[1.03] opacity-60 shadow-lg",
                // Quiet idle affordance, so a draggable chip reads as draggable. A background tint
                // rather than the scale/shadow lift used while dragging: at rest the chip should
                // hint that it can be picked up without moving under the cursor. Suppressed during
                // a drag, where every chip tinting under the pointer would just be noise.
                //
                // `color-mix` rather than `hover:bg-accent-blue/15`, because the accent tokens are
                // plain `var()` colours — the Tailwind config gives them no `<alpha-value>`
                // placeholder, so an opacity modifier on them compiles to no rule at all (verified
                // by compiling the CSS and finding nothing). Mixing into `accent-blue-light` keeps
                // the tint in the same family and follows the dark palette automatically.
                !disabled &&
                  dragIndex === null &&
                  "hover:bg-[color-mix(in_srgb,var(--accent-blue)_14%,var(--accent-blue-light))]",
              )}
            >
              {!disabled && (
                <GripVertical
                  className="h-3 w-3 shrink-0 opacity-60"
                  aria-hidden="true"
                />
              )}
              {chipLabelFor(value)}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(value)}
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-accent-blue/15"
                  aria-label={`Remove ${labelFor(value)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {/*
                The insertion marker — the drop is promised in the same gap the reorder then fills,
                drawn on the edge the pointer is nearest. It grows in (see MARKER_CLASS) rather than
                appearing, so dragging along the row reads as one travelling cue instead of a series
                of pops. Its exit is instant: the marker belongs to a chip, so when the gap moves on,
                the old element is simply unmounted.
              */}
              {activeDropMark?.side === "before" &&
                activeDropMark.index === index && (
                  <span
                    aria-hidden="true"
                    className={cn(MARKER_CLASS, "-left-[5px]")}
                  />
                )}
              {activeDropMark?.side === "after" &&
                activeDropMark.index - 1 === index && (
                  <span
                    aria-hidden="true"
                    className={cn(MARKER_CLASS, "-right-[5px]")}
                  />
                )}
            </span>
          ))}
          {typeof maxSelections === "number" && (
            <span className="ml-auto text-xs text-muted-foreground">
              {selectedValues.length} of {maxSelections}
            </span>
          )}
        </div>
      )}

      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        data-field={dataField}
        disabled={disabled}
        value={query}
        placeholder={atMax ? "Maximum reached" : placeholder}
        ref={inputRef}
        onChange={(e) => {
          // At the cap the character is not accepted either — a field that swallowed text and then
          // showed no list would read as broken rather than as capped. The re-render this triggers is
          // also what pushes the DOM back to the empty `query`, which is what actually keeps the text
          // out; a controlled input with no state change would drift out of sync.
          if (atMax) {
            showLimitNotice();
            return;
          }
          setQuery(e.target.value);
          openList();
        }}
        onFocus={requestListOpen}
        /**
         * Clicking the field reopens the list, and this is NOT redundant with `onFocus`.
         *
         * A row commits on `mousedown` with `preventDefault` — deliberately, so that clicking a row
         * does not blur the input before the click lands. The side effect is that the input HOLDS
         * focus through a mouse selection, so the `commit` that just closed the list is followed by
         * clicks that produce no focus event at all. The list could then only be reopened by
         * genuinely blurring the field first — click somewhere else, then back — which is the
         * "I pick a designation, click the box again, and nothing appears for ages" report.
         */
        onClick={requestListOpen}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-9 w-full rounded-lg border bg-white px-3 py-1 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800",
          destructive
            ? "border-red-500"
            : "border-gray-300 dark:border-gray-600",
        )}
      />

      {/*
        The cap notice. In the flow rather than floating: it is a line of explanation and the field
        already sits in a stack of hints, so pushing the next line down by one is better than
        overlapping it. `role="status"` announces it without stealing focus, and the `key` restarts
        its entrance on every refused attempt.
      */}
      {limitNotice > 0 && (
        <p
          key={limitNotice}
          role="status"
          className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
        >
          Maximum of {maxSelections} reached. Remove one to change your selection.
        </p>
      )}

      {/*
        Portalled to <body> and pinned with fixed coordinates. Inline, the list added its own height
        to the page's scrollable area the moment the field was focused; outside the form entirely, it
        cannot. See `listRect`.
      */}
      {open &&
        !atMax &&
        !disabled &&
        listRect &&
        (rows.length > 0 || query.trim().length > 0) &&
        createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{
              position: "fixed",
              left: listRect.left,
              width: listRect.width,
              maxHeight: listMaxHeight,
              ...(opensUpward
                ? { bottom: viewportHeight - listRect.top + LIST_GAP }
                : { top: listRect.bottom + LIST_GAP }),
            }}
            className="z-50 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
          >
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <li
                  key={`${row.isCustom ? "custom:" : ""}${row.value}`}
                  role="option"
                  aria-selected={index === highlighted}
                  className={cn(
                    "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5",
                    index === highlighted && "bg-accent",
                  )}
                  onMouseEnter={() => setHighlighted(index)}
                  onMouseDown={(e) => {
                    // Prevent the input from blurring before the click registers.
                    e.preventDefault();
                    commit(row.value);
                  }}
                >
                  {row.isCustom ? (
                    <span className="text-muted-foreground">{row.label}</span>
                  ) : (
                    row.label
                  )}
                </li>
              ))
            ) : (
              <li className="px-2 py-1.5 text-muted-foreground">No matches</li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
