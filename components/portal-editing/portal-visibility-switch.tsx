"use client";

import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import { cn } from "@/lib/utils";

/**
 * Publishing a portal hub is the plan's `create_benefits: edit` decision — the
 * permission every publish endpoint enforces — and a Collaborator never publishes.
 *
 * Shared by the hub panels' "Hidden / Published" sections so the Employee Resources
 * and benefit hubs cannot drift apart on who is offered the control. A page's own
 * `canEdit` is a WEAKER gate (it is what lets a documents/video teammate open a
 * panel), so it is deliberately not used: a control the server would refuse must
 * not be offered.
 */
export function usePortalPublishAccess(): {
  mayPublish: boolean;
  isLoading: boolean;
} {
  const { can, isCollaborator, isLoading } = useViewerAccess();
  return {
    mayPublish:
      !isLoading && !isCollaborator && can("create_benefits", "edit"),
    isLoading,
  };
}

interface PortalVisibilitySwitchProps {
  enabled: boolean;
  /** A save is in flight — the switch waits rather than accepting a second click. */
  saving?: boolean;
  disabled?: boolean;
  /** Shown under "Published". */
  publishedDescription?: string;
  /** Shown under "Hidden". */
  hiddenDescription?: string;
  onChange: (next: boolean) => void;
  className?: string;
}

/**
 * The "Hidden / Published" control a hub panel renders as its first section.
 *
 * Presentational only: each hub owns its own read/write (Employee Resources has its
 * own flag; a benefit hub writes the plan's `categoryPortalVisibility`), so this
 * holds the ONE look and the one sentence each state deserves.
 */
export function PortalVisibilitySwitch({
  enabled,
  saving = false,
  disabled = false,
  publishedDescription = "Participants can reach this page from the portal header.",
  hiddenDescription = "Participants cannot reach this page. Nothing has been deleted.",
  onChange,
  className,
}: PortalVisibilitySwitchProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-muted bg-white p-4 dark:bg-gray-800",
        className,
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold",
            enabled ? "text-green-600" : "text-gray-500 dark:text-gray-400",
          )}
        >
          {enabled ? "Published" : "Hidden"}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          {enabled ? publishedDescription : hiddenDescription}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
        <Switch
          checked={enabled}
          disabled={saving || disabled}
          aria-label="Publish this page in the portal"
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      </div>
    </div>
  );
}
