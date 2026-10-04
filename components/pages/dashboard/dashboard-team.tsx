"use client";

import Link from "next/link";
import useSWR from "swr";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Headshot } from "@/components/ui/headshot";
import {
  PRESET_ROLE_LABELS,
  type TeammateAssignmentRole,
} from "@/types/teammate";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const SWR_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
} as const;

interface DashboardTeamRow {
  id: string;
  name: string;
  headshot?: string | null;
  role?: TeammateAssignmentRole | null;
}

interface DashboardTeamResponse {
  team?: DashboardTeamRow[];
}

/** How many avatars the stack shows before the rest collapse into a "+N" chip. */
const MAX_AVATARS = 5;

/**
 * Compact team panel for the dashboard's top row, in the space the organization logo used to
 * occupy.
 *
 * Owner/Admin only: **the caller gates it** on `org_settings` (Owner and Admin hold it; every
 * other role is `no_access`, and a collaborator can never hold it), so the roster is never shown
 * to someone who may not manage the team.
 *
 * It reads the same `/api/teammates/team` payload Settings → People & Access renders — reduced
 * here to an avatar stack, the seat count and a link — so the dashboard and the full list cannot
 * disagree about who is on the team.
 */
export function DashboardTeam() {
  const { data, isLoading } = useSWR<DashboardTeamResponse>(
    "/api/teammates/team",
    jsonFetcher,
    SWR_OPTS,
  );

  const team = data?.team ?? [];
  const shown = team.slice(0, MAX_AVATARS);
  const extra = Math.max(0, team.length - shown.length);

  return (
    <Card className="px-5 bg-transparent">
      <CardContent className="flex h-full flex-col justify-center gap-2 p-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-accent-blue" />
          <span className="text-sm font-semibold dark:text-gray-100">
            Team Members
          </span>
          <Badge variant="secondary">{team.length}</Badge>
        </div>

        {isLoading ? (
          <div className="flex -space-x-2">
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={index}
                className="size-8 animate-pulse rounded-full border-2 border-background bg-gray-200 dark:bg-gray-700"
              />
            ))}
          </div>
        ) : team.length === 0 ? (
          <p className="text-xs text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="flex -space-x-2">
            {shown.map((member) => (
              <span
                key={member.id}
                className="size-8 overflow-hidden rounded-full border-2 border-background bg-muted"
                title={
                  member.role
                    ? `${member.name} · ${PRESET_ROLE_LABELS[member.role]}`
                    : member.name
                }
              >
                <Headshot
                  src={member.headshot ?? undefined}
                  monogramName={member.name}
                  alt={member.name}
                />
              </span>
            ))}
            {extra > 0 ? (
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                +{extra}
              </span>
            ) : null}
          </div>
        )}

        {/* Deep-links straight to the People & Access tab (see the Settings page's `?tab=`
            handling); `/settings` alone would land on Profile. */}
        <Link
          href="/settings?tab=members"
          className="text-xs font-medium text-accent-blue hover:underline"
        >
          View all
        </Link>
      </CardContent>
    </Card>
  );
}
