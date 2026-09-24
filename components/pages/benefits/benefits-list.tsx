"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandingImage } from "@/components/ui/branding-image";
import {
  PlanSearchBar,
  type PlanSearchBarPlan,
} from "@/components/plan-selector/plan-search-bar";
import { OrgServiceCategories } from "@/components/pages/benefits/org-service-categories";
import {
  getRecentPlanIds,
  persistPlanSelection,
} from "@/lib/plan-selector-storage";
import { isActiveClientStatus } from "@/lib/active-client-status";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import { Loader2, Pencil, Plus } from "lucide-react";

interface BenefitRow {
  planId: string;
  planName: string;
  planSlug: string | null;
  planStatus: string | null;
  category: string;
  label: string;
  visibilityKey: string;
  title: string;
  partnerLogo: string | null;
  isEnabled: boolean;
  exists: boolean;
  planVisibility: Record<string, boolean>;
  /** Setup completeness, matching the wizard's check. */
  isComplete: boolean;
  /** What is still missing when `isComplete` is false. */
  missingInfo: string[];
}

/**
 * The Create Benefits wizard stores the Messaging **Intro Headline** in `Benefit.title`
 * — by default `Welcome to <org/company>!` — so a row headlined with `title` showed
 * participant-facing welcome copy rather than the name of the benefit. Rows are now
 * headlined with the benefit's own name (`row.label`); a title the advisor genuinely
 * customised is still worth surfacing, so it is kept as a secondary note.
 */
function isCustomBenefitTitle(
  title: string | null | undefined,
  label: string,
  category: string,
): boolean {
  const t = (title || "").trim();
  if (!t) return false;
  // Wizard default: "Welcome to <name>!" / "Welcome to Your Benefits Hub!".
  if (/^welcome to\b/i.test(t)) return false;
  // The wizard also defaults the title to the category name; that adds nothing.
  if (t === label || t === category) return false;
  return true;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Browse Benefits — a plan picker scopes the view to one plan's four benefit
 * pages, each with a Portal Visibility toggle and an action that opens the
 * inline editor (mirrors the "View Plans" list for the plan flow).
 */
export function BenefitsListPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR("/api/benefits", fetcher);
  const { data: planListData } = useSWR(
    "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc",
    fetcher,
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const rows: BenefitRow[] = data?.benefits ?? [];
  const plans: PlanSearchBarPlan[] = useMemo(
    () =>
      ((planListData?.data as PlanSearchBarPlan[] | undefined) ?? []).map((p) => ({
        id: p.id,
        companyName: p.companyName,
        slug: p.slug,
        status: p.status,
      })),
    [planListData],
  );
  // The selector only offers Active plans, so default to one of those.
  const selectablePlans = useMemo(
    () => plans.filter((p) => isActiveClientStatus(p.status)),
    [plans],
  );

  // Default to the most recent plan the user has worked on, else the first.
  useEffect(() => {
    if (selectedPlanId || selectablePlans.length === 0) return;
    const recentId = getRecentPlanIds().find((id) =>
      selectablePlans.some((p) => p.id === id),
    );
    setSelectedPlanId(recentId || selectablePlans[0].id);
  }, [selectedPlanId, selectablePlans]);

  const planRows = useMemo(
    () => rows.filter((row) => row.planId === selectedPlanId),
    [rows, selectedPlanId],
  );

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    persistPlanSelection("benefits", planId);
  };

  const handleToggle = async (row: BenefitRow, checked: boolean) => {
    const key = `${row.planId}::${row.category}`;
    setToggling((prev) => ({ ...prev, [key]: true }));

    // Optimistic update for this row.
    mutate(
      (current: any) =>
        current
          ? {
              ...current,
              benefits: current.benefits.map((r: BenefitRow) =>
                r.planId === row.planId && r.category === row.category
                  ? { ...r, isEnabled: checked }
                  : r,
              ),
            }
          : current,
      false,
    );

    try {
      const categoryPortalVisibility = {
        ...row.planVisibility,
        [row.visibilityKey]: checked,
      };

      const [clientRes, benefitRes] = await Promise.all([
        fetch(`/api/clients/${row.planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryPortalVisibility }),
        }),
        fetch(
          `/api/clients/${row.planId}/benefits/${encodeURIComponent(row.category)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isEnabled: checked }),
          },
        ),
      ]);

      if (!clientRes.ok) throw new Error("Failed to save visibility");
      if (!benefitRes.ok) {
        console.warn("Benefit isEnabled save returned", benefitRes.status);
      }

      toast.success(checked ? `${row.label} published` : `${row.label} hidden`, {
        description: checked
          ? "This benefit is now visible on the Benefits Hub."
          : "This benefit is now hidden on the Benefits Hub.",
      });
      mutate();
    } catch (error: any) {
      toast.error("Failed to save visibility", { description: error.message });
      mutate();
    } finally {
      setToggling((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">

      {/* Plan picker — decides which plan's benefits are shown below. */}
      <Card className="mb-6 shadow-sm dark:bg-gray-800">
        <CardContent className="p-6">
          <PlanSearchBar
            plans={plans}
            value={selectedPlanId}
            onChange={handleSelectPlan}
            title="Benefits"
            module="benefits"
            disabled={plans.length === 0}
          />
        </CardContent>
      </Card>
      
      {/* Organization-wide context: the benefits this advisor's organization
          offers. Plan-independent, and permanent — see the component. */}
      <OrgServiceCategories />
      
      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ) : !selectedPlanId ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {plans.length === 0
                ? "No plans yet. Create a plan first, then add its benefits."
                : "Select a plan above to view its benefits."}
            </p>
            <div className="flex gap-2">
              {plans.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/new-client")}
                >
                  Create Plan
                </Button>
              )}
              <Button className="gap-2" onClick={() => router.push("/new-benefits")}>
                <Plus className="h-4 w-4" />
                Create Benefit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="dark:bg-gray-800">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {planRows[0]?.planName || "Plan Benefits"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Publish, hide, and edit this plan&rsquo;s benefit pages.
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {planRows.map((row) => {
                const key = `${row.planId}::${row.category}`;
                const isToggling = toggling[key] === true;
                // Headline is the benefit's own name — see isCustomBenefitTitle().
                const customTitle = isCustomBenefitTitle(
                  row.title,
                  row.label,
                  row.category,
                )
                  ? row.title
                  : null;
                // The plan-sponsor hub is the wizard's "Custom" benefit. "Wellness
                // Programs" is only its default label — the wizard asks the advisor for
                // a "Custom Category Name" (persisted as `Benefit.title`), so show that
                // saved name, or "Custom" while none has been saved.
                const isCustomHub =
                  row.category === "Company / Plan Sponsor" ||
                  row.visibilityKey === "Other";
                const displayName = isCustomHub
                  ? customTitle ?? "Custom"
                  : row.label;
                return (
                  <div key={key} className="flex items-center gap-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-900">
                      {row.partnerLogo ? (
                        <BrandingImage
                          src={row.partnerLogo}
                          alt={displayName}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {displayName}
                        </p>
                        {/* For the custom hub the saved name IS the headline, so only
                            the standard categories need it repeated as a note. */}
                        {customTitle && !isCustomHub && (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {customTitle}
                          </span>
                        )}
                        {row.exists && (
                          <span
                            className={cn(
                              "shrink-0 text-[11px] font-semibold",
                              row.isComplete
                                ? "text-green-600"
                                : "text-amber-600",
                            )}
                          >
                            {row.isComplete ? "Complete" : "Incomplete"}
                          </span>
                        )}
                      </div>
                      {/* Why the benefit is incomplete — the wizard's own
                          missing-item list, shown inline instead of a tooltip. */}
                      {row.exists &&
                        !row.isComplete &&
                        row.missingInfo.length > 0 && (
                          <p className="mt-0.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                            {row.missingInfo.join(" · ")}
                          </p>
                        )}
                    </div>

                    {/* Portal visibility only means something once the benefit
                        exists. `/api/benefits` derives `isEnabled` from the plan's
                        `categoryPortalVisibility`, which defaults to visible for a
                        category with no row — so rendering the switch regardless
                        showed it ON (reading as "Published") beside an "Add benefit"
                        button that cannot publish anything. */}
                    {row.exists ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            row.isEnabled ? "text-green-600" : "text-gray-400",
                          )}
                        >
                          {row.isEnabled ? "Published" : "Hidden"}
                        </span>
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                        <Switch
                          checked={row.isEnabled}
                          disabled={isToggling}
                          onCheckedChange={(checked) =>
                            handleToggle(row, checked === true)
                          }
                        />
                      </div>
                    ) : (
                      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                        Not created
                      </span>
                    )}

                    {row.exists ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        onClick={() =>
                          router.push(
                            `/edit-benefit/${encodeURIComponent(
                              row.planId,
                            )}/${categoryToSlug(row.category)}`,
                          )
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5"
                        onClick={() =>
                          router.push(
                            `/new-benefits?planId=${encodeURIComponent(
                              row.planId,
                            )}&category=${encodeURIComponent(row.category)}`,
                          )
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    )}
                  </div>
                );
              })}

              {planRows.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No benefits found for this plan.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
