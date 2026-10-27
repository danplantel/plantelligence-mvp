"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QuickAnswersBuilder } from "@/components/wizard/benefits-steps/quick-answers-builder";
import { TOPIC_LOCATION_LABELS } from "@/lib/topic-locations";

/**
 * Employee Resources — the admin surface for the fifth hub (TF-6).
 *
 * It lives in the PLAN flow, not in Browse Benefits: the hub has no Benefit row, so it
 * has nothing to attach to in Create/Edit Benefit, and an advisor meets it where they
 * set the plan up instead.
 *
 * Two things live here:
 *
 *  1. **The enable toggle.** Opt-in per plan. Turning it on seeds the location from the
 *     shipped library on the server, so the page has content the moment it is reachable.
 *     Turning it off does NOT delete anything: the placements stay, so switching back on
 *     restores the advisor's work.
 *  2. **The board** (`variant="full"` only). `QuickAnswersBuilder` is the same component
 *     the benefit editor uses, pointed at `employee_resources`. There is no second
 *     builder. `variant="compact"` swaps it for a link, which is what the New Plan
 *     wizard shows — a setup step should not become a content editor.
 *
 * Permission is the `"Employee Resources"` scope, so a collaborator granted only this
 * location reaches this card and nothing else on the plan.
 */

const LOCATION = "employee_resources" as const;

/** How much of the hub the host surface wants. */
export type EmployeeResourcesVariant = "full" | "compact";

interface EmployeeResourcesState {
  enabled: boolean;
  /**
   * The plan's portal slug. The public hub is addressed as `/<slug>/employee-resources`,
   * so the preview link must never be built from the plan ID.
   */
  slug?: string | null;
}

const fetcher = async (url: string): Promise<EmployeeResourcesState> => {
  const response = await fetch(url, { credentials: "same-origin" });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Could not load Employee Resources.");
  }
  return body as EmployeeResourcesState;
};

export function EmployeeResourcesEditor({
  planId,
  variant = "full",
}: {
  planId: string;
  /**
   * `full` mounts the question board (Edit Plan). `compact` shows the toggle and a
   * single "Manage questions" link (the New Plan wizard), so a setup step stays short.
   */
  variant?: EmployeeResourcesVariant;
}) {
  const key = planId ? `/api/clients/${planId}/employee-resources` : null;
  const { data, error, isLoading, mutate } = useSWR<EmployeeResourcesState>(
    key,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const enabled = data?.enabled === true;

  const setEnabled = async (next: boolean) => {
    if (!key) return;
    setSaving(true);
    setSaveError(null);
    // Optimistic: the switch responds immediately; a failure restores the old value.
    // Spread the previous payload so `slug` survives the optimistic write.
    void mutate({ ...(data ?? { enabled }), enabled: next }, { revalidate: false });

    try {
      const response = await fetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Could not save this setting.");
      }
      // Re-read so the board below matches what the server just seeded.
      await mutate();
    } catch (toggleError) {
      setSaveError(
        toggleError instanceof Error
          ? toggleError.message
          : "Could not save this setting.",
      );
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load this hub."}
      </p>
    );
  }

  return (
    <Card className="dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-gray-100">
          Employee Resources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-gray-400">
          A fifth hub for HR topics — pay, time off, policies, employment. It reuses the
          same topics and the same page template as a benefit, but it is not a benefit
          category: it does not count toward your four categories and does not affect
          whether Create Benefits is complete.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-muted p-3">
          <div className="min-w-0">
            <Label htmlFor="employee-resources-enabled" className="text-sm">
              Show Employee Resources in the portal
            </Label>
            <p className="mt-0.5 text-xs text-neutral-500">
              {enabled
                ? "Live in the portal. Participants reach it from the header."
                : "Hidden. Nothing is deleted if you switch it off later."}
            </p>
          </div>
          <Switch
            id="employee-resources-enabled"
            checked={enabled}
            disabled={isLoading || saving}
            onCheckedChange={(checked) => void setEnabled(checked === true)}
          />
        </div>

        {saveError && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {saveError}
          </p>
        )}

        {enabled && (
          <>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">
                {TOPIC_LOCATION_LABELS[LOCATION]} questions
              </Label>
              <Button asChild variant="outline" size="sm">
                {/* The portal is addressed by SLUG, so the id would produce a URL the
                    public hub does not use. */}
                <Link
                  href={`/${data?.slug || planId}/employee-resources`}
                  target="_blank"
                >
                  Preview
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {variant === "full" ? (
              /* The same builder the benefit editor mounts, pointed at this location. */
              <QuickAnswersBuilder planId={planId} location={LOCATION} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-muted p-3">
                <p className="text-xs text-neutral-600 dark:text-gray-400">
                  The recommended HR questions are already in place. Edit them on the
                  Employee Resources page.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/employee-resources/${planId}`}>
                    Manage questions
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
