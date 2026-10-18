"use client";

/**
 * team-members-dialog — "who works on this benefit?" answered from the comments rail.
 *
 * The rail already knows which plan (and, for a benefit surface, which category) it is attached
 * to. This dialog turns that surface into the roster the reader can act on: the Owner, the
 * organization's team members, and every collaborator the plan is shared with.
 *
 * The list comes from `/comments/team`, NOT from `/comments/mentionable` directly. The mentionable
 * read only knows people with a LOGIN who can currently open the surface — so a collaborator whose
 * invitation is still pending vanished from the roster even though the benefit's Contacts tab
 * listed them. The team route merges that access-filtered list with the plan's assignments and
 * carries each person's `state`, which is what lets a pending invite be shown (and labelled)
 * instead of being silently dropped. The caller's own view access is still resolved first, through
 * the same gate every comment read uses.
 *
 * Deliberately read-only. Clicking an accepted person hands off to the rail's existing profile card
 * (`useUserProfile`), which is where the reader gets their title, standing, organization email and
 * the Message action. Nothing about membership is re-implemented here.
 */

import useSWR from "swr";
import { Loader2, RefreshCw, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import { cn } from "@/lib/utils";
import type {
  CommentTargetType,
  SurfaceTeamMember,
} from "@/lib/comments/types";
import { useUserProfile } from "./user-profile-context";

interface TeamResponse {
  success?: boolean;
  members?: SurfaceTeamMember[];
  error?: string;
}

/**
 * Throwing on a failure is load-bearing: SWR only retries what it considers a failed request.
 * The database's transient `P1001` refusals (the Neon pooler) used to arrive as a 200-shaped
 * `{ error }` body, which SWR treated as success — so the modal showed the raw Prisma sentence
 * and never tried again. A rejected fetch gets the automatic backoff, and the reader also gets
 * an explicit "Try again".
 */
async function fetchTeam(url: string): Promise<{ members: SurfaceTeamMember[] }> {
  const response = await fetch(url, { credentials: "same-origin" });
  const payload = (await response.json().catch(() => null)) as TeamResponse | null;
  if (!response.ok || !payload || !Array.isArray(payload.members)) {
    throw new Error(
      payload?.error ??
        "The team list couldn't be loaded right now. Please try again.",
    );
  }
  return { members: payload.members };
}

/** Only the non-active states need saying out loud; an active member is the norm. */
const PENDING_LABELS: Record<string, string> = {
  invited: "Invited",
  contact: "Contact",
};

export function TeamMembersDialog({
  open,
  onOpenChange,
  clientId,
  targetType,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan the rail is attached to. An empty id keeps the dialog empty. */
  clientId: string;
  /** A benefit surface narrows the roster to that category. */
  targetType: CommentTargetType;
  category: string | null;
}) {
  // Same query shape as `/comments/mentionable` and `/comments/assignable`: `targetType` plus the
  // real category only for a benefit surface.
  const query = new URLSearchParams({ targetType });
  if (targetType === "benefit" && category) query.set("category", category);
  const key =
    open && clientId
      ? `/api/clients/${encodeURIComponent(clientId)}/comments/team?${query.toString()}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{
    members: SurfaceTeamMember[];
  }>(key, fetchTeam, {
    revalidateOnFocus: false,
    // A connection that is still waking up (Neon pauses idle computes) usually succeeds on the
    // next attempt, so give the roster a couple of automatic retries before showing the message.
    errorRetryCount: 2,
    errorRetryInterval: 1200,
  });

  const { open: openProfile } = useUserProfile();
  const members = data?.members ?? [];
  const failure =
    error instanceof Error
      ? error.message
      : error
        ? "The team list couldn't be loaded right now. Please try again."
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-blue" />
            Team
          </DialogTitle>
          <DialogDescription>
            {targetType === "benefit" && category
              ? `Everyone with access to ${category} on this plan.`
              : "Everyone with access to this plan."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1">
          {isLoading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          ) : failure ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{failure}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => void mutate()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No one is attached to this{" "}
              {targetType === "benefit" ? "benefit" : "plan"} yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const pendingLabel = PENDING_LABELS[member.state] ?? null;
                // Captured so the click closure keeps the narrowing TS already proved above.
                const userId = member.userId;
                const body = (
                  <>
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      <Headshot
                        src={member.headshot}
                        alt={member.name}
                        monogramName={member.name}
                        wrapperClassName="rounded-full"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {member.name}
                        </span>
                        {pendingLabel ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            {pendingLabel}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                  </>
                );
                const rowClass =
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left";

                // A pending invitation has no account to look up, so its row is a statement rather
                // than a door; accepted members open the rail's profile card.
                return (
                  <li key={member.email}>
                    {userId ? (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          openProfile(userId);
                        }}
                        title={`View ${member.name}'s profile`}
                        className={cn(
                          rowClass,
                          "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                      >
                        {body}
                      </button>
                    ) : (
                      <div
                        className={rowClass}
                        title="This invitation has not been accepted yet"
                      >
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
