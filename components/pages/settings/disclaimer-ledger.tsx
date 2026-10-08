"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { History, CheckCircle2, CircleDashed } from "lucide-react";

/**
 * Settings → Organization › Disclaimers — the Disclaimer Ledger.
 *
 * Shows every immutable disclosure revision and the confirmation that covers it,
 * newest first: which revision, when it was written, by whom, where it came from
 * (Onboarding / Settings / Plan) and whether it was confirmed.
 *
 * Expanding a row reveals the revision's content, with a "Show Changes" toggle
 * between:
 *   - **Changes** — a git-commit style line diff against the previous revision
 *     (removed lines in red, added lines in green, unchanged as context); and
 *   - **Updated value** — the revision's raw ("Your Disclosure") text per surface.
 *
 * Read-only. Revisions are written by the editor beside it (and by 5b during
 * onboarding), never here.
 */

interface LedgerSurface {
  location: string;
  label: string;
  text: string;
}

interface LedgerDiffSegment {
  type: "added" | "removed" | "context";
  text: string;
}

interface LedgerChange {
  label: string;
  segments: LedgerDiffSegment[];
  added: number;
  removed: number;
}

interface LedgerEntry {
  version: number;
  createdAt: string;
  context: string;
  planId: string | null;
  templateVersion: number;
  createdByName: string | null;
  attestedAt: string | null;
  attestedByName: string | null;
  attestationVersion: number | null;
  surfaces: LedgerSurface[];
  changes: LedgerChange[];
}

interface Ledger {
  organizationId: string;
  currentVersion: number;
  reviewed: boolean;
  reviewedAt: string | null;
  canReview: boolean;
  entries: LedgerEntry[];
}

const CONTEXT_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  settings: "Settings",
  plan: "Plan",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** One revision's diff block for a single surface. */
function ChangeBlock({ change }: { change: LedgerChange }) {
  const unchanged = change.added === 0 && change.removed === 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {change.label}
        </p>
        {!unchanged && (
          <span className="text-[11px] font-medium">
            <span className="text-green-600 dark:text-green-500">
              +{change.added}
            </span>{" "}
            <span className="text-red-600 dark:text-red-500">
              −{change.removed}
            </span>
          </span>
        )}
      </div>
      {unchanged ? (
        <p className="text-xs text-muted-foreground">No changes.</p>
      ) : (
        // Word-level, so a one-word edit highlights that word only — the rest of
        // the paragraph stays as unhighlighted context.
        <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 text-xs leading-relaxed dark:border-gray-700">
          {change.segments.map((segment, index) =>
            segment.type === "added" ? (
              <span
                key={index}
                className="rounded bg-green-100 px-0.5 font-medium text-green-900 dark:bg-green-950/40 dark:text-green-300"
              >
                {segment.text}
              </span>
            ) : segment.type === "removed" ? (
              <span
                key={index}
                className="rounded bg-red-100 px-0.5 text-red-900 line-through dark:bg-red-950/40 dark:text-red-300"
              >
                {segment.text}
              </span>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      )}
    </div>
  );
}

/** One revision's raw ("Updated value") block for a single surface. */
function RawBlock({ surface }: { surface: LedgerSurface }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {surface.label} — Your Disclosure
      </p>
      <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        {surface.text || "—"}
      </p>
    </div>
  );
}

export function DisclaimerLedger() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  // Per-open revision: show the diff (default) or the raw updated value.
  const [showChanges, setShowChanges] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/organization/disclosures-ledger", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as Ledger;
        if (!cancelled) setLedger(body);
      } catch {
        // Best-effort — the ledger simply stays hidden on failure.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Only reviewers see the audit trail; everyone else gets no ledger at all.
  if (!ledger?.canReview) return null;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent-blue" />
              Disclaimer Ledger
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Every disclosure revision and its confirmation.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge variant="secondary">Version {ledger.currentVersion}</Badge>
            {ledger.reviewed ? (
              <Badge className="border-transparent bg-accent-blue text-white">
                Reviewed
              </Badge>
            ) : (
              <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Not reviewed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {ledger.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No disclosure versions recorded yet. Saving your disclosures records
            the first revision.
          </p>
        ) : (
          <ul className="space-y-2">
            {ledger.entries.map((entry) => {
              const isOpen = expanded === entry.version;
              const isCurrent = entry.version === ledger.currentVersion;
              const added = entry.changes.reduce((sum, c) => sum + c.added, 0);
              const removed = entry.changes.reduce(
                (sum, c) => sum + c.removed,
                0,
              );

              return (
                <li
                  key={entry.version}
                  className="overflow-hidden rounded-lg border dark:border-gray-700"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(isOpen ? null : entry.version);
                      setShowChanges(true);
                    }}
                    className="flex w-full items-start justify-between gap-3 p-3 text-left transition hover:bg-muted/40"
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          Version {entry.version}
                        </span>
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className="border-accent-blue text-accent-blue"
                          >
                            Current
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {CONTEXT_LABELS[entry.context] ?? entry.context}
                        </Badge>
                        {(added > 0 || removed > 0) && (
                          <span className="text-[11px] font-medium">
                            <span className="text-green-600 dark:text-green-500">
                              +{added}
                            </span>{" "}
                            <span className="text-red-600 dark:text-red-500">
                              −{removed}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {formatDateTime(entry.createdAt)}
                        {entry.createdByName ? ` by ${entry.createdByName}` : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {entry.attestedAt ? (
                        <>
                          <span className="flex items-center justify-end gap-1 text-xs font-medium text-accent-blue">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirmed
                          </span>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDateTime(entry.attestedAt)}
                            {entry.attestedByName
                              ? ` · ${entry.attestedByName}`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <span className="flex items-center justify-end gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                          <CircleDashed className="h-3.5 w-3.5" />
                          Not confirmed
                        </span>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t p-3 dark:border-gray-700">
                      {/* Changes ⇄ Updated value */}
                      <div className="flex items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                          <Switch
                            checked={showChanges}
                            onCheckedChange={setShowChanges}
                            aria-label="Show changes"
                          />
                          Show Changes
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          {showChanges ? "Changes" : "Updated value"}
                        </span>
                      </div>

                      {showChanges
                        ? entry.changes.map((change) => (
                            <ChangeBlock key={change.label} change={change} />
                          ))
                        : entry.surfaces.map((surface) => (
                            <RawBlock
                              key={surface.location}
                              surface={surface}
                            />
                          ))}

                      <p className="text-[11px] text-muted-foreground">
                        Template v{entry.templateVersion}
                        {entry.attestationVersion != null
                          ? ` · Attestation v${entry.attestationVersion}`
                          : ""}
                        {entry.planId ? ` · Plan ${entry.planId}` : ""}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
