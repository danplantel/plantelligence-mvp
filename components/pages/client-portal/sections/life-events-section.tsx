"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { readableColor, transparentize } from "polished";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { computeCaretPosition } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { portalRadiusValue } from "@/lib/typography-themes";
import { cn } from "@/lib/utils";
import type { LifeEventPayload } from "@/lib/life-events/server";

/**
 * "Something Changed? Start Here." — the Life Events strip (TF-8).
 *
 * It behaves like "How Can We Help You Today?": a tile grid with ONE answer open at a
 * time, rendered inline BENEATH the row the tile belongs to, with a single caret at the
 * section level sliding across the grid to point at the tile that opened it. The caret
 * maths is the same helper the help cards use (`computeCaretPosition`), so a plan's
 * typography theme, browser zoom and the editor's scaled preview all behave identically
 * on both sections.
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

/** Split the strip into rows of four; phones show two, so rows stay readable. */
function chunkEvents(events: LifeEventPayload[]): LifeEventPayload[][] {
  const rows: LifeEventPayload[][] = [];
  for (let index = 0; index < events.length; index += EVENTS_PER_ROW) {
    rows.push(events.slice(index, index + EVENTS_PER_ROW));
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
  const rows = useMemo(() => chunkEvents(events), [events]);

  // `undefined` = nothing chosen yet (every tile closed); a key opens that checklist.
  const [openKey, setOpenKey] = useState<string | null>(null);

  // ── The caret, exactly as the help cards measure it ──
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());
  const [caretPosition, setCaretPosition] = useState<{
    xPercent: number;
    yPercent: number;
  } | null>(null);

  /** A stable dependency: the tiles that exist, in order. */
  const tileOrderKey = events.map((event) => event.key).join("|");

  useEffect(() => {
    const measure = () => {
      const container = rowsContainerRef.current;
      const tile = openKey ? tileRefs.current.get(openKey) : undefined;
      const panel = panelRef.current;
      if (!container || !tile || !panel) {
        setCaretPosition((prev) => (prev === null ? prev : null));
        return;
      }

      const next = computeCaretPosition({
        containerRect: container.getBoundingClientRect(),
        tileRect: tile.getBoundingClientRect(),
        panelRect: panel.getBoundingClientRect(),
      });
      setCaretPosition((prev) =>
        prev &&
        prev.xPercent === next.xPercent &&
        prev.yPercent === next.yPercent
          ? prev
          : next,
      );
    };

    measure();
    window.addEventListener("resize", measure);

    // Re-measure while a checklist is open: the editor preview scales this section with
    // a transform applied AFTER mount, which changes neither the layout box nor fires
    // `resize`, so a caret measured at scale 1 would sit off its tile.
    let frame = 0;
    const tick = () => {
      measure();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [openKey, tileOrderKey]);

  if (events.length === 0) return null;

  const onPrimary = readableColor(brandColor);
  const onPrimaryMuted = transparentize(0.25, onPrimary);

  const toggle = (key: string) =>
    setOpenKey((prev) => (prev === key ? null : key));

  const checklistNode = (inGrid: boolean) => {
    const event = openKey ? events.find((entry) => entry.key === openKey) : null;
    if (!event) return null;

    return (
      <div
        key={`life-event-${event.key}`}
        id={`life-event-${event.key}`}
        ref={panelRef}
        className={inGrid ? "col-span-2 lg:col-span-4 lg:order-last" : undefined}
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

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="rounded-lg px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] shadow-sm hover:opacity-90"
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
          {/* One caret for the whole section, so choosing another event slides it
              across the grid instead of drawing a new one. */}
          <span
            aria-hidden
            data-testid="life-event-caret"
            className="pointer-events-none absolute z-10 h-3.5 w-3.5 rounded-[2px] border-l border-t bg-neutral-50"
            style={{
              left: `${caretPosition?.xPercent ?? 0}%`,
              top: `${caretPosition?.yPercent ?? 0}%`,
              transform: "translate(-50%, -50%) rotate(45deg)",
              opacity: caretPosition ? 1 : 0,
              transition:
                "left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease",
              borderColor: brandColor,
            }}
          />

          {rows.map((row, rowIndex) => (
            <motion.div
              key={rowIndex}
              layout
              initial={false}
              transition={LAYOUT_TRANSITION}
              className="space-y-4"
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
                        "group flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md",
                        isOpen && "border-transparent",
                      )}
                      style={{
                        backgroundColor: brandColor,
                        borderColor: brandColor,
                        color: isOpen ? onPrimary : onPrimary,
                        boxShadow: isOpen ? `0 0 0 2px ${onPrimary}` : undefined,
                        borderRadius: portalRadiusValue(1.5),
                      }}
                    >
                      <span className="font-red-hat text-sm font-medium">
                        {event.title}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200",
                          isOpen && "rotate-180",
                        )}
                        style={{ color: onPrimaryMuted }}
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
