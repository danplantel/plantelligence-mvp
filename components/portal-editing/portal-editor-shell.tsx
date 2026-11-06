"use client";

import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import type { EditorSection } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";

interface PortalEditorShellProps {
  children?: React.ReactNode;
  /** Structured sections (Home uses the exact Step 2 / Edit Client list). */
  sections?: EditorSection[];
  /** Optional status footer (e.g. the Home editor's save indicator). */
  footer?: React.ReactNode;
  /** Title shown in the panel header. */
  title?: string;
  /** Small label above the title. */
  eyebrow?: string;
  /** Badge rendered beside the title. */
  headerBadge?: React.ReactNode;
}

/**
 * The portal's inline Editing Panel chrome.
 *
 * Kept in one place so the Home editor (which renders the shared plan-preview
 * sections) and the page-specific editors share the same panel surface, close
 * behaviour and position.
 */
export function PortalEditorShell({
  children,
  sections,
  footer,
  title,
  eyebrow,
  headerBadge,
}: PortalEditorShellProps) {
  const { isOpen, closePanel, target, focusRequest } = usePortalEditing();
  if (!target) return null;

  return (
    <EditorPanelWrapper
      isOpen={isOpen}
      isAnimating={isOpen}
      onClose={closePanel}
      eyebrow={eyebrow ?? "Portal Editing"}
      title={title ?? target.label}
      // A light grey tool surface makes the panel distinct from the white portal.
      surfaceClassName="bg-gray-100 dark:bg-gray-900"
      headerBadge={
        headerBadge ?? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Live
          </span>
        )
      }
      sections={sections}
      footer={footer}
      // The page's blue edit affordances ask the provider to open the panel at a
      // section; the wrapper owns the scrolling.
      focusRequest={focusRequest}
    >
      {children}
    </EditorPanelWrapper>
  );
}
