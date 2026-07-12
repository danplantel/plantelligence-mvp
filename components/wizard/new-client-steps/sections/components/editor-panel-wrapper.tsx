"use client";

import { CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
        Section {number}: {title}
      </h3>
      <div className="h-px w-12 bg-border mt-2" />
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
}: EditorPanelWrapperProps) {
  if (!isOpen && !isAnimating) return null;

  const isInline = variant === 'inline';

  return (
    <div
      className={
        isInline
          ? `w-full h-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden transition-opacity duration-300 ${
              isAnimating ? "opacity-100" : "opacity-0"
            }`
          : `fixed left-0 top-0 bottom-4 w-full max-w-xl bg-white dark:bg-gray-900 z-[51] flex flex-col rounded-lg overflow-hidden transition-transform ${
              isAnimating
                ? "translate-x-0 duration-300"
                : "-translate-x-full duration-200"
            }`
      }
      style={{
        marginTop: isInline ? undefined : "0",
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between px-4 py-4 border-b shadow-md dark:border-gray-700">
        <div className="flex flex-col gap-1">
          <Label className="text-xs uppercase text-muted-foreground tracking-wide font-medium dark:text-gray-400">
            Plan Branding & Messaging
          </Label>
          <Label className="text-lg font-semibold text-foreground mt-1 dark:text-gray-100">
            Editing Panel
          </Label>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="dark:text-gray-300 dark:hover:bg-gray-800">
          <X className="w-5 h-5" />
        </Button>
      </CardHeader>
      <div
        ref={editorScrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0"
        data-lenis-wrapper
      >
        <div data-lenis-content className="space-y-4">
          {sections
            ? sections.map((section, i) => (
                <div key={i}>
                  <SectionHeader number={i + 1} title={section.title} />
                  {section.content}
                </div>
              ))
            : children}
        </div>
      </div>
      {footer != null ? (
        <div className="flex-shrink-0 border-t bg-white dark:bg-gray-800 dark:border-gray-700 px-4 py-3 flex justify-end">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
