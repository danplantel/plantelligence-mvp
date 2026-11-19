"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import {
  PortalVisibilitySwitch,
  usePortalPublishAccess,
} from "@/components/portal-editing/portal-visibility-switch";
import { usePortalEditing } from "@/components/portal-editing/portal-editing-provider";

/**
 * Employee Resources — the "Hidden / Published" control its panel renders as
 * Section 1, above the Typography Theme.
 *
 * The fifth hub is opt-in per plan (`Client.employeeResourcesEnabled`). Standing on
 * the page itself, the advisor can see whether employees can reach it and flip it
 * without leaving the panel.
 *
 * It reads the SAME cache entry the page and the panel already share
 * (`employeeResourcesReadKey`, or the portal's `?forPortal=1` read), so the label can
 * never disagree with the page beside it — and a toggle here repaints both. Writing
 * goes through the hub's own endpoint, exactly like the dashboard switch; enabling
 * it also seeds the starter questions server-side.
 */

interface HubVisibility {
  enabled?: boolean;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then((response) => response.json());

export function PortalEmployeeResourcesVisibilityToggle() {
  const { planId, employeeResourcesReadKey } = usePortalEditing();
  const { mayPublish } = usePortalPublishAccess();

  /**
   * The read the page and the panel already share — never a second request for the
   * same payload. On the dashboard the host supplies the builder read; on the portal
   * this is the participant read, which answers `enabled` either way.
   */
  const readKey = planId
    ? employeeResourcesReadKey ??
      `/api/clients/${planId}/employee-resources?forPortal=1`
    : null;

  const { data, mutate } = useSWR<HubVisibility>(
    mayPublish ? readKey : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );

  const [saving, setSaving] = useState(false);

  // Nothing to offer: the viewer cannot publish this hub.
  if (!mayPublish) return null;

  const enabled = data?.enabled === true;
  const writeUrl = planId
    ? `/api/clients/${planId}/employee-resources`
    : null;

  const toggle = async (checked: boolean) => {
    if (!readKey || !writeUrl || saving) return;
    setSaving(true);
    // Optimistic: the switch answers immediately; a failure re-reads the truth.
    void mutate({ ...(data ?? {}), enabled: checked }, { revalidate: false });

    try {
      const response = await fetch(writeUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Could not save this setting.");
      }

      toast.success(
        checked ? "Employee Resources published" : "Employee Resources hidden",
        {
          description: checked
            ? "Participants reach it from this plan's portal header."
            : "The page is hidden. Nothing has been deleted.",
        },
      );
      await mutate();
    } catch (error: any) {
      toast.error("Failed to save visibility", {
        description: error?.message,
      });
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalVisibilitySwitch
      enabled={enabled}
      saving={saving}
      publishedDescription="Participants reach Employee Resources from this plan's portal header."
      hiddenDescription="Participants see no Employee Resources link. Nothing has been deleted."
      onChange={(next) => void toggle(next)}
    />
  );
}
