"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  PortalVisibilitySwitch,
  usePortalPublishAccess,
} from "@/components/portal-editing/portal-visibility-switch";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  benefitCategoryToVisibilityKey,
  getCategoryPortalVisibility,
} from "@/lib/portal-category-visibility";

/**
 * A benefit hub's "Hidden / Published" control, rendered as Section 1 of its panel.
 *
 * The switch is the plan's `categoryPortalVisibility` — the same flag the Benefits
 * table toggles and the portal's home hub list filters on — so the two can never
 * disagree. Writing mirrors that table's call: the plan PUT carries the new map, and
 * the Benefit row's own `isEnabled` is kept in step so a reader that checks the row
 * (rather than the category) reaches the same answer.
 *
 * `category` is the stored API category ("Retirement", "Group Health", "Group Life",
 * "Company / Plan Sponsor"), which `benefitCategoryToVisibilityKey` maps to the
 * canonical visibility key ("Other" for the custom hub).
 */

export function PortalBenefitVisibilityToggle({ category }: { category: string }) {
  const { planId, refetchPortal } = usePortalEditing();
  const { clientData } = useClientPortal();
  const { mayPublish } = usePortalPublishAccess();
  const [saving, setSaving] = useState(false);

  // Nothing to offer: the viewer cannot publish this hub.
  if (!mayPublish) return null;

  const visibilityKey = benefitCategoryToVisibilityKey(category);
  const visibility = getCategoryPortalVisibility(
    (clientData as { categoryPortalVisibility?: unknown } | null)
      ?.categoryPortalVisibility,
  );
  // The table treats a missing row as visible, and so does the hub list.
  const enabled = visibility[visibilityKey] !== false;
  const label = category === "Company / Plan Sponsor" ? "Custom Benefit" : category;

  const toggle = async (checked: boolean) => {
    if (!planId || saving) return;
    setSaving(true);
    try {
      const [planResponse] = await Promise.all([
        fetch(`/api/clients/${planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryPortalVisibility: {
              ...visibility,
              [visibilityKey]: checked,
            },
          }),
        }),
        // Same dual write the Benefits table makes. Best-effort: the category map is
        // what hides the hub, so a failure here is logged and not surfaced.
        fetch(
          `/api/clients/${planId}/benefits/${encodeURIComponent(category)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isEnabled: checked }),
          },
        ).catch(() => null),
      ]);

      if (!planResponse.ok) {
        throw new Error("Failed to save visibility");
      }

      toast.success(checked ? `${label} published` : `${label} hidden`, {
        description: checked
          ? "This benefit is now visible on the Benefits Hub."
          : "This benefit is now hidden on the Benefits Hub.",
      });
      // Pull the saved plan back so the page beside the panel (and this switch)
      // reflect the stored map rather than the optimistic guess.
      await refetchPortal();
    } catch (error: any) {
      toast.error("Failed to save visibility", {
        description: error?.message,
      });
      await refetchPortal();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalVisibilitySwitch
      enabled={enabled}
      saving={saving}
      publishedDescription="Participants reach this benefit from the Benefits Hub."
      hiddenDescription="This benefit is removed from the Benefits Hub. Nothing has been deleted."
      onChange={(next) => void toggle(next)}
    />
  );
}
