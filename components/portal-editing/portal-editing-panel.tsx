"use client";

import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { PortalHomeEditor } from "@/components/portal-editing/editors/portal-home-editor";
import { PortalBenefitEditor } from "@/components/portal-editing/editors/portal-benefit-editor";
import { PortalTeamEditor } from "@/components/portal-editing/editors/portal-team-editor";
import { PortalDocumentsEditor } from "@/components/portal-editing/editors/portal-documents-editor";
import { PortalNewsEditor } from "@/components/portal-editing/editors/portal-news-editor";

function EditorForPage() {
  const { target } = usePortalEditing();
  switch (target?.page) {
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
  const { target, canEdit } = usePortalEditing();
  if (!target || !canEdit) return null;

  // Home renders the exact Create Plan Step 2 / Edit Client Preview sections, so
  // it owns its own panel shell (it needs to pass sections rather than children).
  if (target.page === "home") {
    return <PortalHomeEditor />;
  }

  return (
    <PortalEditorShell>
      <EditorForPage />
    </PortalEditorShell>
  );
}
