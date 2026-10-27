"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { readableColor, transparentize } from "polished";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { computeCaretPosition } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { portalRadiusValue } from "@/lib/typography-themes";
import { cn } from "@/lib/utils";
import type { LifeEventPayload } from "@/lib/life-events/server";

/**
 * "Something Changed? Start Here." — the Life Events strip (TF-8).
 *
 * It behaves like "How Can We Help You Today?": a tile grid with ONE checklist open at a
 * time, rendered inline BENEATH the row the tile belongs to, with a single caret at the
 * section level pointing at the tile that opened it. The caret maths is the same helper
 * the help cards use (`computeCaretPosition`), so a plan's typography theme, browser
 * zoom and the editor's scaled preview all behave identically on both sections.
 *
 * The caret SNAPS onto its target when the open tile changes and only animates on a
 * later reflow: its position is a percentage of the container, and opening a checklist
 * makes that container taller, so a value measured before the panel existed points
 * somewhere else entirely.
 *
 * The CONTENT is a checklist, not an answer: a deadline banner when the event has a
 * qualifying-event window, the numbered steps the plan actually supports, and the
 * footer CTA. Steps are links into the hub that owns them, so a step can never open
 * something this plan does not have.
 *
 * Events whose steps all drop out arrive already filtered, and an empty list renders
 * nothing at all — no header, no empty band.
 */

const EVENTS_PER_ROW = 4;

const LAYOUT_TRANSITION = {
  layout: {
    duration: 0.32,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
};

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export interface LifeEventsSectionProps {
  clientId?: string;
  brandColor?: string;
  secondaryColor?: string;
  className?: string;
}

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server. The pre-paint placement
 * MUST run before paint, but React warns if `useLayoutEffect` is reached during a server
 * render — and this client component is still rendered on the server once.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Group the strip into the rows the grid actually draws.
 *
 * `perRow` must match the live column count — 4 at `lg`, 2 at `sm`, 1 on a phone. It is
 * measured rather than fixed at 4 because the panel renders INSIDE its row: on a phone
 * a "row" of four would stack four tiles and put the checklist under all of them, so
 * the tapped tile's answer would appear three cards away from the tile itself.
 */
function chunkEvents(
  events: LifeEventPayload[],
  perRow: number,
): LifeEventPayload[][] {
  const size = Math.max(1, perRow);
  const rows: LifeEventPayload[][] = [];
  for (let index = 0; index < events.length; index += size) {
    rows.push(events.slice(index, index + size));
  }
  return rows;
}

export function LifeEventsSection({
  clientId,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  className,
}: LifeEventsSectionProps) {
  const { data } = useSWR<{ events?: LifeEventPayload[] }>(
    clientId ? `/api/clients/${clientId}/life-events?forPortal=1` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const events = useMemo(() => data?.events ?? [], [data]);

  /**
   * How many tiles the grid draws side by side. The grid is `1 / 2 / 4` columns, so the
   * row grouping has to follow it: on a phone every tile is its own row, which is what
   * puts its checklist directly beneath it.
   *
   * `serverFallback: true` keeps the first render desktop-shaped, so hydration and the
   * server agree; the real width is applied on the next tick.
   */
  const isLg = useMediaQuery(`(min-width: 1024px)`, true);
  const isSm = useMediaQuery(`(min-width: 640px)`, true);
  const perRow = isLg ? EVENTS_PER_ROW : isSm ? 2 : 1;
  const rows = useMemo(() => chunkEvents(events, perRow), [events, perRow]);

  // `undefined` = nothing chosen yet (every tile closed); a key opens that checklist.
  const [openKey, setOpenKey] = useState<string | null>(null);

  // ── The caret, exactly as the help cards measure it ──
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());
  /**
   * `instant` travels WITH the position because the two are set together: the caret
   * must SNAP onto its target the moment an event is opened, and only animate on a
   * later reflow (a resize, or the editor preview's scale landing after mount).
   */
  const [caret, setCaret] = useState<{
    xPercent: number;
    yPercent: number;
    instant: boolean;
  } | null>(null);
  /** Which tile the caret is currently aimed at. */
  const caretTargetRef = useRef<string | null>(null);
  /** One element per row, so opening a tile can bring its row to the top. */
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  /**
   * Set by `toggle` and consumed once the panel is in the DOM: the scroll has to wait
   * for the row to grow, or it would stop short of the place the reader is looking at.
   */
  const pendingScrollRef = useRef<string | null>(null);

  /** A stable dependency: the tiles that exist, in order. */
  const tileOrderKey = events.map((event) => event.key).join("|");

  const measureCaret = () => {
    const container = rowsContainerRef.current;
    const tile = openKey ? tileRefs.current.get(openKey) : undefined;
    const panel = panelRef.current;
    if (!container || !tile || !panel) return null;
    return computeCaretPosition({
      containerRect: container.getBoundingClientRect(),
      tileRect: tile.getBoundingClientRect(),
      panelRect: panel.getBoundingClientRect(),
    });
  };

  /**
   * Pre-paint placement — this is what stops the caret flying in from nowhere.
   *
   * The position is a PERCENTAGE of the container, and opening a checklist makes that
   * container taller (the panel sits inside the row). A position measured before the
   * panel mounted therefore describes a different point: the top of the card, the
   * middle, somewhere below. Measuring in `useLayoutEffect` runs AFTER the DOM update
   * but BEFORE paint, so the first frame already shows the caret where it belongs, and
   * the transition is switched off for that one update so it does not animate from the
   * stale spot.
   */
  useIsomorphicLayoutEffect(() => {
    const changedTarget = caretTargetRef.current !== openKey;
    caretTargetRef.current = openKey;
    const next = measureCaret();
    setCaret(next ? { ...next, instant: changedTarget } : null);

    /**
     * Bring the row that was just opened to the top of the viewport, clear of the fixed
     * portal header.
     *
     * Done here (not in the click handler) because the panel is inside the row: until it
     * is in the DOM the row has not grown, and scrolling early would leave the reader
     * halfway down their own checklist. `scroll-mt-*` on the row is what keeps it below
     * the header — the same offsets the rest of the portal uses for `scroll-mt`.
     */
    const pending = pendingScrollRef.current;
    if (pending) {
      pendingScrollRef.current = null;
      const index = events.findIndex((entry) => entry.key === pending);
      if (index >= 0) {
        // On a phone `perRow` is 1, so this is the tapped tile's own row and the
        // checklist it just opened sits immediately beneath it.
        const row = rowRefs.current.get(Math.floor(index / perRow));
        row?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    // `measureCaret` closes over `openKey`, which is the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, tileOrderKey, perRow]);

  /**
   * Post-paint re-measure for reflows only. The editor preview scales this section with
   * a transform applied AFTER mount, which changes neither the layout box nor fires
   * `resize`, so a caret measured at scale 1 would sit off its tile.
   */
  useEffect(() => {
    const remeasure = () => {
      const next = measureCaret();
      setCaret((prev) => {
        if (!next) return prev === null ? prev : null;
        if (
          prev &&
          !prev.instant &&
          prev.xPercent === next.xPercent &&
          prev.yPercent === next.yPercent
        ) {
          return prev;
        }
        // A settled measurement enables the transition again, so a genuine reflow
        // glides while a new target has already snapped.
        return { ...next, instant: false };
      });
    };

    window.addEventListener("resize", remeasure);

    let frame = 0;
    const tick = () => {
      remeasure();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", remeasure);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, tileOrderKey]);

  if (events.length === 0) return null;

  const onPrimary = readableColor(brandColor);
  const onPrimaryMuted = transparentize(0.25, onPrimary);

  const toggle = (key: string) => {
    const next = openKey === key ? null : key;
    // Only an OPEN asks for a scroll; collapsing leaves the reader where they are.
    if (next) pendingScrollRef.current = next;
    setOpenKey(next);
  };

  const checklistNode = (inGrid: boolean) => {
    const event = openKey ? events.find((entry) => entry.key === openKey) : null;
    if (!event) return null;

    return (
      <div
        key={`life-event-${event.key}`}
        id={`life-event-${event.key}`}
        ref={panelRef}
        // A single-column phone grid has no second column to span: the panel simply
        // takes the row it is in. From `sm` up it spans its visual row, and at `lg` it
        // moves below all four tiles.
        className={
          inGrid && perRow > 1
            ? "col-span-2 lg:col-span-4 lg:order-last"
            : undefined
        }
      >
        <div
          role="region"
          aria-label={event.title}
          className="animate-in fade-in-0 slide-in-from-top-1 rounded-2xl border bg-neutral-50 p-5 shadow-sm duration-200 sm:p-7"
          style={{ borderColor: brandColor }}
        >
          <div className="flex items-start justify-between gap-4">
            <h3
              className="font-dm-serif text-xl leading-snug sm:text-2xl"
              style={{ color: brandColor }}
            >
              {event.title}: your checklist
            </h3>
            <button
              type="button"
              onClick={() => setOpenKey(null)}
              aria-label={`Close ${event.title}`}
              className="shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {event.deadlineText && (
            <p
              className="mt-3 inline-block px-3 py-1.5 font-red-hat text-[13px] font-semibold"
              style={{
                backgroundColor: `${brandColor}14`,
                color: brandColor,
                borderRadius: portalRadiusValue(),
              }}
            >
              {event.deadlineText}
            </p>
          )}

          <ol className="mt-4 space-y-2">
            {event.steps.map((step, index) => (
              <li key={step.id}>
                <a
                  href={step.href || "#"}
                  className="group flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300"
                  style={{ borderRadius: portalRadiusValue(1) }}
                >
                  <span
                    className="mt-0.5 shrink-0 font-dm-serif text-[15px] font-semibold tabular-nums"
                    style={{ color: brandColor }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 font-red-hat text-[15px] leading-relaxed text-neutral-800">
                    {step.label}
                  </span>
                  {step.isActionHub && (
                    <span
                      className="shrink-0 font-red-hat text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: secondaryColor }}
                    >
                      Applies to several
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ol>

          {/* Phone: the CTA is the panel's primary action, so it becomes a full-width
              bar the thumb can hit. From `sm` up it shrinks back to a content-width
              button sitting inline. `items-stretch` is what lets the button fill the
              column — `items-center` would collapse it width-wise. */}
          <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              className="w-full justify-center rounded-lg px-5 py-4 text-sm font-semibold uppercase tracking-[0.08em] shadow-sm hover:opacity-90 sm:w-auto sm:py-3"
              style={{
                backgroundColor: brandColor,
                color: onPrimary,
                borderRadius: portalRadiusValue(),
              }}
            >
              {event.ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className={cn(
        "bg-white px-4 py-16 sm:px-6 lg:px-20 lg:py-20",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-dm-serif text-gray-900 text-3xl leading-tight sm:text-4xl lg:text-[40px]">
            Something Changed? Start Here.
          </h2>
          <p className="mt-2 font-red-hat text-base text-gray-600 sm:text-lg">
            Step-by-step checklists across all your benefits.
          </p>
        </div>

        <div ref={rowsContainerRef} className="relative space-y-4">
          {/* One caret for the whole section. It SNAPS when the open tile changes
              (`instant`, set with the position in the same update) and animates only on
              a later reflow, so it never travels in from a stale spot. */}
          <span
            aria-hidden
            data-testid="life-event-caret"
            className="pointer-events-none absolute z-10 h-3.5 w-3.5 rounded-[2px] border-l border-t bg-neutral-50"
            style={{
              left: `${caret?.xPercent ?? 0}%`,
              top: `${caret?.yPercent ?? 0}%`,
              transform: "translate(-50%, -50%) rotate(45deg)",
              opacity: caret ? 1 : 0,
              transition: caret?.instant
                ? "opacity 120ms ease"
                : "left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease",
              borderColor: brandColor,
            }}
          />

          {rows.map((row, rowIndex) => (
            <motion.div
              key={rowIndex}
              layout
              initial={false}
              transition={LAYOUT_TRANSITION}
              // `scroll-mt-*` mirrors the offsets the rest of the portal uses, so
              // `scrollIntoView` parks this row just under the fixed header.
              ref={(element) => {
                if (element) rowRefs.current.set(rowIndex, element);
                else rowRefs.current.delete(rowIndex);
              }}
              className="w-full space-y-4 scroll-mt-24 sm:scroll-mt-28 lg:scroll-mt-32"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {row.map((event) => {
                  const isOpen = event.key === openKey;
                  return (
                    <motion.button
                      key={event.key}
                      type="button"
                      layout
                      initial={false}
                      transition={LAYOUT_TRANSITION}
                      whileHover={{ y: -2 }}
                      ref={(element) => {
                        if (element) tileRefs.current.set(event.key, element);
                        else tileRefs.current.delete(event.key);
                      }}
                      onClick={() => toggle(event.key)}
                      aria-expanded={isOpen}
                      aria-controls={`life-event-${event.key}`}
                      className={cn(
                        // Phone: full width and a taller row — the strip is a
                        // one-column list there, so each tile is its own line and wants
                        // a comfortable tap target. From `sm` up it tightens back to the
                        // compact 4-up height, and `px-4` gives the larger label room.
                        "group flex min-h-[84px] w-full items-center justify-between gap-3 border px-5 py-5 text-left transition-all duration-200 sm:min-h-[72px] sm:px-4 sm:py-4",
                        // A grid item does not stretch a `<button>` on every engine, and
                        // the tile only shares its line with others from `sm` up. So at
                        // ONE column it claims the whole track explicitly.
                        perRow === 1 && "col-span-full justify-self-stretch",
                        // CLOSED = OUTLINE, OPEN = SOLID fill. The hover tint only
                        // matters while closed; an open tile's fill is inline.
                        isOpen
                          ? "shadow-md"
                          : "bg-white shadow-none hover:bg-neutral-50",
                      )}
                      style={{
                        backgroundColor: isOpen ? brandColor : undefined,
                        borderColor: brandColor,
                        // Outline: the label is drawn in the brand colour. Solid: it
                        // switches to the readable colour for that fill, and rings in
                        // it too, since a brand ring would vanish on a brand fill.
                        color: isOpen ? onPrimary : brandColor,
                        boxShadow: isOpen ? `0 0 0 2px ${onPrimary}` : undefined,
                        borderRadius: portalRadiusValue(1.5),
                      }}
                    >
                      {/* One size up, and never wrapped: `truncate` keeps the row at a
                          single line on the narrowest 4-up width, with the full label
                          still available as a tooltip. */}
                      <span
                        className="min-w-0 truncate font-red-hat text-base font-medium sm:text-[15px]"
                        title={event.title}
                      >
                        {event.title}
                      </span>
                      <ChevronDown
                        className={cn(
                          // A size up on phones, in step with the taller tile.
                          "h-5 w-5 shrink-0 transition-transform duration-200 sm:h-4 sm:w-4",
                          isOpen && "rotate-180",
                        )}
                        style={{ color: isOpen ? onPrimaryMuted : brandColor }}
                        aria-hidden="true"
                      />
                    </motion.button>
                  );
                })}
              </div>

              {/* Below the phone line the open tile sits on — and below the whole row
                  on desktop, via `lg:order-last`. */}
              {row.some((event) => event.key === openKey) ? checklistNode(true) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LifeEventsSection;
