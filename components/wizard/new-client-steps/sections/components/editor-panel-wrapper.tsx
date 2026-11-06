"use client";

import { useEffect, useRef } from "react";

import { CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { portalSectionId } from "@/lib/portal-editor-sections";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] dark:text-gray-400">
        Section {number}: {title}
      </h3>
      <div className="h-px w-12 bg-border dark:bg-gray-600 mt-2" />
    </div>
  );
}

export interface EditorSection {
  title: string;
  content: React.ReactNode;
}

interface EditorPanelWrapperProps {
  isOpen: boolean;
  isAnimating: boolean;
  editorScrollContainerRef?: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  children?: React.ReactNode;
  /** Structured sections with headers — if provided, renders each section with a SectionHeader */
  sections?: EditorSection[];
  /** Optional footer (e.g. Save button) — fixed at bottom of panel, always visible */
  footer?: React.ReactNode;
  /**
   * Layout variant:
   * - 'fixed' (default): slides in from the left as a fixed overlay panel
   * - 'inline': renders as a full-height inline panel for side-by-side Elementor-style layouts
   */
  variant?: 'fixed' | 'inline';
  /** Optional top offset for fixed variant (e.g. to clear page headers) */
  topOffset?: number;
  /**
   * Optional left offset for the fixed variant. Used by the Preview pages so the
   * panel sits *beside* the sidebar instead of painting over it; omitted by the
   * wizard usages, which keep the class-level `left-0`.
   */
  leftOffset?: string;
  /** Optional extra content rendered to the right of the "Editing Panel" title (e.g. the benefit category badge) */
  headerBadge?: React.ReactNode;
  /** Small label above the panel title. Defaults to the dashboard's wording. */
  eyebrow?: string;
  /** Panel title. Defaults to "Editing Panel". */
  title?: string;
  /**
   * Background surface for the panel and its footer. Defaults to the dashboard's
   * white. The portal passes a light grey so the editor reads as its own tool
   * column against the white participant page.
   */
  surfaceClassName?: string;
  /**
   * A request to scroll to one of `sections`, addressed by
   * [`portalSectionId`](../../../../lib/portal-editor-sections.ts:14).
   *
   * The portal's page raises it when the advisor clicks the blue edit affordance
   * on the part of the page they want to change; `nonce` makes a second click on
   * the same region scroll again.
   */
  focusRequest?: { id: string; nonce: number } | null;
}

export function EditorPanelWrapper({
  isOpen,
  isAnimating,
  editorScrollContainerRef,
  onClose,
  children,
  sections,
  footer,
  variant = 'fixed',
  topOffset = 0,
  leftOffset,
  headerBadge,
  eyebrow = "Plan Branding & Messaging",
  title = "Editing Panel",
  surfaceClassName,
  focusRequest,
}: EditorPanelWrapperProps) {
  /**
   * The scroll container the focus effect drives. Callers may hand one in; when
   * they do not, this is the panel's own.
   */
  const innerScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = editorScrollContainerRef ?? innerScrollRef;

  /**
   * Scroll to the section the page asked for.
   *
   * Placed before the `isOpen` guard below because hooks cannot follow a return.
   * The effect measures the section against the container rather than trusting
   * `offsetTop`, so it lands the same whether the panel is the fixed overlay or an
   * inline column.
   */
  useEffect(() => {
    if (!isOpen || !focusRequest?.id) return;
    const container = scrollRef.current;
    if (!container) return;
    // A section first; then an anchor INSIDE one, for a region edited by a card
    // part-way down a section (the Featured Image sits in "Mission Statement").
    const target =
      container.querySelector<HTMLElement>(
        `[data-section-id="${focusRequest.id}"]`,
      ) ??
      container.querySelector<HTMLElement>(
        `[data-edit-anchor="${focusRequest.id}"]`,
      );
    if (!target) return;

    const frame = requestAnimationFrame(() => {
      const top =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      container.scrollTo({ top, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
    // `nonce` re-runs this when the same region is clicked again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, focusRequest?.id, focusRequest?.nonce]);

  if (!isOpen && !isAnimating) return null;

  const isInline = variant === 'inline';
  const panelSurface = surfaceClassName ?? "bg-white dark:bg-gray-900";

  return (
    <div
      className={cn(
        isInline
          ? "w-full h-full flex flex-col overflow-hidden transition-opacity duration-300"
          : "fixed left-0 top-0 bottom-4 w-full max-w-xl z-[51] flex flex-col rounded-lg overflow-hidden transition-transform",
        panelSurface,
        isInline
          ? isAnimating
            ? "opacity-100"
            : "opacity-0"
          : isAnimating
            ? "translate-x-0 duration-300"
            : "-translate-x-full duration-200",
      )}
      style={{
        marginTop: isInline ? undefined : `${topOffset}px`,
        left: isInline ? undefined : leftOffset,
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between px-4 py-4 border-b shadow-md dark:border-gray-700 dark:shadow-gray-950/60">
        <div className="flex flex-col gap-1">
          <Label className="text-xs uppercase text-muted-foreground tracking-wide font-medium dark:text-gray-400">
            {eyebrow}
          </Label>
          <div className="flex items-center gap-2 mt-1">
            <Label className="text-lg font-semibold text-foreground dark:text-gray-100">
              {title}
            </Label>
            {headerBadge}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="dark:text-gray-300 dark:hover:bg-gray-800">
          <X className="w-5 h-5" />
        </Button>
      </CardHeader>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0 dark:text-gray-200 dark:bg-gray-900"
        data-lenis-wrapper
      >
        <div data-lenis-content className="space-y-4 dark:text-gray-200">
          {sections
            ? sections.map((section, i) => (
                <div
                  key={i}
                  data-section-index={i}
                  // The address the page beside the panel scrolls to — derived from
                  // the title, so a page and the panel cannot disagree.
                  data-section-id={portalSectionId(section.title)}
                >
                  <SectionHeader number={i + 1} title={section.title} />
                  {section.content}
                </div>
              ))
            : children}
        </div>
      </div>
      {footer != null ? (
        <div
          className={cn(
            "flex-shrink-0 border-t dark:border-gray-700 px-4 py-3 flex justify-end dark:text-gray-200",
            panelSurface,
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
