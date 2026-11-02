"use client";

import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { PortalHomeEditor } from "@/components/portal-editing/editors/portal-home-editor";
import { PortalBenefitEditor } from "@/components/portal-editing/editors/portal-benefit-editor";
import { PortalTeamEditor } from "@/components/portal-editing/editors/portal-team-editor";
import { PortalDocumentsEditor } from "@/components/portal-editing/editors/portal-documents-editor";
import { PortalNewsEditor } from "@/components/portal-editing/editors/portal-news-editor";

function EditorForPage() {
  const { target } = usePortalEditing();
  switch (target?.page) {
    case "home":
      return <PortalHomeEditor />;
    case "benefit":
    case "videos":
      return <PortalBenefitEditor />;
    case "team":
      return <PortalTeamEditor />;
    case "documents":
      return <PortalDocumentsEditor />;
    case "news":
      return <PortalNewsEditor />;
    default:
      return null;
  }
}

/** The portal's inline Editing Panel, rendered beside the live page. */
export function PortalEditingPanel() {
  const { isOpen, closePanel, target, canEdit } = usePortalEditing();
  if (!target || !canEdit) return null;

  return (
    <EditorPanelWrapper
      isOpen={isOpen}
      isAnimating={isOpen}
      onClose={closePanel}
      eyebrow="Portal Editing"
      title={target.label}
      // A light grey tool surface makes the panel distinct from the white portal.
      surfaceClassName="bg-gray-100 dark:bg-gray-900"
      headerBadge={
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Live
        </span>
      }
    >
      <EditorForPage />
    </EditorPanelWrapper>
  );
}
