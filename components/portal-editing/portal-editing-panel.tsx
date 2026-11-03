"use client";

import { PortalEditorShell } from "@/components/portal-editing/portal-editor-shell";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { PortalHomeEditor } from "@/components/portal-editing/editors/portal-home-editor";
import { PortalBenefitEditor } from "@/components/portal-editing/editors/portal-benefit-editor";
import { PortalTeamEditor } from "@/components/portal-editing/editors/portal-team-editor";
import { PortalEmployeeResourcesEditor } from "@/components/portal-editing/editors/portal-employee-resources-editor";
import { PortalNewsEditor } from "@/components/portal-editing/editors/portal-news-editor";

function EditorForPage() {
  const { target } = usePortalEditing();
  switch (target?.page) {
    case "team":
      return <PortalTeamEditor />;
    // The `documents` target is the Employee Resources page: it owns that hub's
    // hero background and the plan's document rows.
    case "documents":
      return <PortalEmployeeResourcesEditor />;
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

  // Benefit hubs render the exact Create/Edit Benefits panel, which owns its own
  // `EditorPanelWrapper`. Remount per category so the store hydration is clean.
  if (target.page === "benefit" || target.page === "videos") {
    return <PortalBenefitEditor key={`benefit:${target.category ?? ""}`} />;
  }

  // News & Events owns its panel too, because it carries the page's hero
  // background and its own draft Save/Cancel bar.
  if (target.page === "news") {
    return <PortalNewsEditor />;
  }

  return (
    <PortalEditorShell>
      <EditorForPage />
    </PortalEditorShell>
  );
}
