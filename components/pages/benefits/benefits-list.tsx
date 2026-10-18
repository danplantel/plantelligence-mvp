"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandingImage } from "@/components/ui/branding-image";
import {
  PlanSearchBar,
  type PlanSearchBarPlan,
} from "@/components/plan-selector/plan-search-bar";
import { OrgServiceCategories } from "@/components/pages/benefits/org-service-categories";
import {
  getLastPlanId,
  getRecentPlanIds,
  persistPlanSelection,
} from "@/lib/plan-selector-storage";
import { isActiveClientStatus } from "@/lib/active-client-status";
import {
  getBenefitPortalSegment,
  getBenefitsHubOpenPortalUrl,
} from "@/lib/marketing/hub-url";
import { withCommentsRail } from "@/lib/comments/portal-surface";
import { categoryToSlug } from "@/lib/benefit-category-slug";
import {
  normalizeBenefitCategoryKey,
  toApiBenefitCategory,
} from "@/lib/benefit-draft";
import { readPersistedBenefitsDraft } from "@/lib/benefits-wizard-store";
import { Headshot } from "@/components/ui/headshot";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import {
  AlertCircle,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";

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
  /**
   * The plan's Key Contact for this category, resolved by `/api/benefits` from the
   * plan's authored `keyContacts`. Present even when `exists` is false, so a section
   * can name the person who owns it before its benefit page is built.
   */
  keyContact?: { id: string; name: string; headshot: string | null } | null;
  isEnabled: boolean;
  exists: boolean;
  planVisibility: Record<string, boolean>;
  /** Setup completeness, matching the wizard's check. */
  isComplete: boolean;
  /** What is still missing when `isComplete` is false. */
  missingInfo: string[];
}

/**
 * One person's assignment on the selected plan, flattened by
 * `/api/teammates/plan-assignments`. Mirrors `PlanAssignmentRow` in
 * lib/teammates/invites.server.ts — the card needs the person AND the assignment.
 */
interface PlanAssignmentRow {
  assignmentId: string;
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  role: string;
  categoryScope: "all" | "selected";
  categories: string[];
  /** `contact` for a Key Contact mirrored onto the plan; `invited`/`active` otherwise. */
  state?: string;
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
 * The picker's own read. `summary=1` is load-bearing: the picker uses only
 * id/companyName/slug/status, and the default response ships every plan's `keyContacts`
 * + legacy `employeePortalPreview` mirror (base64 images) — measured at 8.3 MB / 6.6 s
 * for a 7-plan account.
 */
const PLAN_LIST_KEY =
  "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc&summary=1";

/**
 * The states the plan card can be in. A union rather than nested ternaries in the JSX,
 * because the interesting part of this page is the ORDER these resolve in, and that is
 * easier to read as a ladder than as brackets.
 */
type ContentState =
  | "loading"
  | "plans-failed"
  | "benefits-failed"
  | "no-plans"
  | "no-active-plans"
  | "ready";

/**
 * What the plan card shows while it is being resolved.
 *
 * Mirrors the card's own shape — header, then rows — so the reveal is a fade rather than
 * a relayout. Its job is to own the first paint: before it existed, the empty state was
 * rendered for a plan that was merely still arriving.
 */
function PlanBenefitsSkeleton() {
  return (
    <Card aria-busy="true" aria-live="polite" className="dark:bg-gray-800">
      <CardContent className="p-4 sm:p-6">
        <span className="sr-only">Loading this plan&rsquo;s benefits…</span>
        <div className="mb-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 py-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A read that failed, stated as such and with a way out.
 *
 * Both of this page's reads can fail on their own, and SWR reports that as `error` with
 * `isLoading` back to false. Without this state the page either sits on a skeleton
 * forever or — worse, and this is what it used to do — claims the account has no plans.
 */
function LoadFailedCard({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Every plan is Draft or Archived, so the picker has nothing it may offer — the plan
 * search lists Active plans only (see `PlanSearchBar`). Saying so beats the previous
 * "Select a plan above to view its benefits", which pointed at a list that was empty by
 * construction.
 */
function NoActivePlansCard({ onViewPlans }: { onViewPlans: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          No active plans. A plan has to be Active before its benefit pages can be
          published — Draft and Archived plans are not offered above.
        </p>
        <Button variant="outline" onClick={onViewPlans}>
          View Plans
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Browse Benefits — a plan picker scopes the view to one plan's four benefit
 * pages, each with a Portal Visibility toggle and an action that opens the
 * inline editor (mirrors the "View Plans" list for the plan flow).
 */
export function BenefitsListPage({
  orgCategories,
}: {
  /**
   * The organization strip's labels, resolved by the page on the SERVER — see
   * app/(dashboard)/benefits/page.tsx. Server-resolved on purpose: this strip sits above
   * the plan card, so a read of its own here would race the card and could paint after it.
   */
  orgCategories: string[];
}) {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();
  const { isCollaborator, can } = useViewerAccess();

  /**
   * A Collaborator never publishes — that is a hard block, not a preset default (spec Part
   * B item 2, §3) — and a read-only Collaborator (Viewer / Reviewer) may not create or save
   * a benefit either. So both the row's publish control and its action are chosen from this
   * flag, and the page offers only what the assignment already grants.
   *
   * The read is the chrome-level union (`useViewerAccess`), server-seeded so the first paint
   * cannot show the wrong affordance: `true` for an Owner or Team Member, and for a
   * Collaborator the union of their assignments — exact for the ordinary one-plan invite.
   * The per-plan decision still belongs to the page that writes (`/edit-benefit/…`), which
   * enforces the grid against the plan actually selected.
   */
  const mayEditBenefits = can("create_benefits", "edit");

  /**
   * May this viewer be sent into the Create Benefit wizard?
   *
   * No Collaborator may — `/new-benefits` is hidden and refused for them whatever their grid says
   * (see `NAV_ACCESS_REQUIREMENTS`), so an "Add" button would point at a page the layout would then
   * refuse with `NoAccessNotice`. The grid row stays granted because the benefit editor saves under
   * the same function; what a Collaborator does not do is create a benefit from scratch, so a
   * section with no row yet has no action for them rather than a dead end.
   */
  const mayCreateBenefit = mayEditBenefits && !isCollaborator;

  // The page's own title, kept with the component it labels — the same arrangement
  // Dashboard and Edit Benefit use. It lives here so `page.tsx` can stay a Server
  // Component and hand the strip's data straight down.
  useEffect(() => {
    setTitle("Benefits");
  }, [setTitle]);

  /* ── The two client reads behind this page ──
     `benefits` is keyed on the endpoint alone: it returns EVERY plan's rows, so changing the
     selected plan never refetches it. `plans` is the picker's list, and without it nothing
     can be selected at all — which is why "no plan selected" is not the same question as
     "no plans exist". The organization strip is NOT part of this: the server already
     resolved it, so it is on screen before either read returns. */
  const {
    data: benefitsData,
    isLoading: isBenefitsLoading,
    error: benefitsError,
    mutate,
  } = useSWR("/api/benefits", fetcher, {
    // A benefit's NAME is edited on the Edit Benefit page and read here, and the two are often
    // visited back-to-back. SWR's default 2s dedupe window served this page's previous payload for
    // that whole window, so a renamed Custom benefit kept its old name until the window lapsed.
    // Refetch on every mount instead — one cheap read — so the list is never a stale snapshot.
    dedupingInterval: 0,
    revalidateOnMount: true,
    revalidateOnFocus: false,
  });

  // A save on the Edit Benefit page dispatches `benefits-updated` (see lib/save-benefit.ts). When
  // THIS page is mounted (a second tab, or a retained instance), refresh so the new name lands
  // without a manual reload.
  useEffect(() => {
    const onUpdated = () => void mutate();
    window.addEventListener("benefits-updated", onUpdated);
    return () => window.removeEventListener("benefits-updated", onUpdated);
  }, [mutate]);
  const {
    data: planListData,
    isLoading: isPlanListLoading,
    error: planListError,
    mutate: mutatePlanList,
  } = useSWR(PLAN_LIST_KEY, fetcher, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  /* ── Drafts ──
     A Benefit row is created only by an explicit publish, so a category the advisor has
     started and not published has no row for `/api/benefits` to report — its whole state
     is the wizard draft persisted to localStorage. Read once on mount (the wizard store is
     `skipHydration`, so it is empty on this page) so those rows can be labelled "Draft"
     rather than reading as untouched. */
  const [draftTarget, setDraftTarget] = useState<{
    planId: string;
    benefitCategory: string;
  } | null>(null);

  useEffect(() => {
    setDraftTarget(readPersistedBenefitsDraft());
  }, []);

  /**
   * Is this row the plan + category that draft belongs to?
   *
   * Both sides are compared through the API's category naming: the wizard calls the
   * plan-sponsor hub "Custom" while the API stores and returns "Company / Plan Sponsor".
   * A draft for another plan or another category must not label this row, and
   * `!row.exists` is the other half of the definition — once a row is published, its own
   * state ("Published" / "Hidden") is the truth.
   */
  const isDraftRow = (row: BenefitRow): boolean =>
    !row.exists &&
    !!draftTarget &&
    draftTarget.planId === row.planId &&
    normalizeBenefitCategoryKey(
      toApiBenefitCategory(draftTarget.benefitCategory),
    ) === normalizeBenefitCategoryKey(row.category);

  const rows: BenefitRow[] = benefitsData?.benefits ?? [];
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
  /**
   * The plans this page may offer — two views of the same access-scoped list.
   *
   * An advisor is choosing among plans they own, so the picker stays Active-only: a Draft
   * plan's hubs are not live. A Collaborator was invited TO a plan and does not publish, so
   * the Active filter would hide the very plan they were invited to work on. They see every
   * plan they hold an assignment for; `/api/clients` has already dropped the rest, and
   * `/api/benefits` narrows each plan to the sections they were given.
   */
  const selectablePlans = useMemo(
    () =>
      isCollaborator
        ? plans
        : plans.filter((p) => isActiveClientStatus(p.status)),
    [plans, isCollaborator],
  );

  /**
   * Restore the plan this page was last on.
   *
   * Precedence: this module's own last pick → a plan touched anywhere (the shared MRU) →
   * the first selectable plan. The per-module key is the one the picker itself persists,
   * so coming back to Benefits restores the plan you were working on rather than whichever
   * plan another module touched most recently.
   */
  useEffect(() => {
    if (selectedPlanId || selectablePlans.length === 0) return;
    const sticky = getLastPlanId("benefits");
    const remembered =
      (sticky && selectablePlans.some((p) => p.id === sticky) ? sticky : null) ??
      getRecentPlanIds().find((id) => selectablePlans.some((p) => p.id === id)) ??
      selectablePlans[0].id;
    setSelectedPlanId(remembered);
  }, [selectedPlanId, selectablePlans]);

  /* ── What is known, so far ──
     SWR's `isLoading` is true only for the first read of a key, and goes back to false
     once an `error` is set — which is what lets a failure become a Retry instead of a
     permanent skeleton. */
  const plansSettled = !isPlanListLoading;
  const hasPlans = plans.length > 0;
  const hasSelectablePlans = selectablePlans.length > 0;
  // The auto-selection above runs in an effect, so there is exactly one render where the
  // plan list is known and nothing is chosen yet. Counting that as "loading" is what stops
  // "No plans yet. Create a plan first…" from flashing on every cold load.
  const isSelectingPlan = !selectedPlanId && hasSelectablePlans;

  const isPlanContentLoading = isBenefitsLoading || isSelectingPlan;

  /* ── Which state the plan card renders ──
     Order matters. What is known beats what is loading, so an account with no plans is
     told so at once rather than behind the strip's placeholder. A failure is only shown
     for the read that would have produced this content — and never in place of a plan
     list we already hold, since `keepPreviousData` keeps the picker usable. */
  const contentState: ContentState = !plansSettled
    ? "loading"
    : planListError && !hasPlans
      ? "plans-failed"
      : !hasPlans
        ? "no-plans"
        : !hasSelectablePlans
          ? "no-active-plans"
          : isPlanContentLoading
            ? "loading"
            : benefitsError && !benefitsData
              ? "benefits-failed"
              : "ready";

  const failure =
    contentState === "plans-failed"
      ? {
          title: "Couldn't load your plans",
          description:
            "The plan list did not come back, so there is nothing to select yet. Check your connection and try again.",
          onRetry: () => void mutatePlanList(),
        }
      : contentState === "benefits-failed"
        ? {
            title: "Couldn't load this plan's benefits",
            description:
              "The plan list loaded, but the benefit pages did not. Check your connection and try again.",
            onRetry: () => void mutate(),
          }
        : null;

  const planRows = useMemo(
    () => rows.filter((row) => row.planId === selectedPlanId),
    [rows, selectedPlanId],
  );

  // Who is assigned to the selected plan (T4 Part A item 6). Scoped to one plan so
  // the card can show "Assigned to Jane" without the page loading every assignment
  // in the organization.
  const { data: assignmentData } = useSWR(
    selectedPlanId
      ? `/api/teammates/plan-assignments?planId=${encodeURIComponent(selectedPlanId)}`
      : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  /**
   * Category → EVERY person assigned to it.
   *
   * A Map to a single row was the bug: two or three people can hold an assignment on the same
   * plan — one per scope — and the old `if (!map.has(key))` kept only the first, so a card read
   * "Assigned to Jane" while Bob and Cara were assigned too.
   *
   * Explicit per-category scope is listed first. An assignment covering "all categories" applies
   * to every one of the plan's cards, so it is ADDED to each (not used only as a fallback for
   * unclaimed cards): the person really is assigned to that category, and the list is now meant to
   * show everyone. De-duplicated by assignment id so the two passes can never double-list a row.
   */
  const assigneesByCategory = useMemo(() => {
    // Collaborators only (invited or active). A mirrored Key Contact holds an assignment so
    // the Benefits Hub can render their card, but they are not somebody the BENEFIT is
    // assigned to — naming them here read as plan access. Key Contacts are surfaced from
    // the plan's authored contact list instead (`row.keyContact`), which also covers a
    // category with no Benefit row yet.
    const assignments: PlanAssignmentRow[] = (
      (assignmentData?.assignments ?? []) as PlanAssignmentRow[]
    ).filter((person) => person.state !== "contact");
    const normalize = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, " ");
    const map = new Map<string, PlanAssignmentRow[]>();

    const add = (key: string, assignment: PlanAssignmentRow) => {
      const list = map.get(key) ?? [];
      if (!list.some((a) => a.assignmentId === assignment.assignmentId)) {
        list.push(assignment);
        map.set(key, list);
      }
    };

    for (const assignment of assignments) {
      if (assignment.categoryScope === "all") continue;
      for (const category of assignment.categories) {
        add(normalize(category), assignment);
      }
    }

    for (const assignment of assignments) {
      if (assignment.categoryScope !== "all") continue;
      for (const row of planRows) {
        add(normalize(row.category), assignment);
      }
    }

    return map;
  }, [assignmentData, planRows]);

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

      {/* Plan picker — the ONE plan-selection control on this page, for every role.
          It used to branch: an advisor got this searchable picker, while a Collaborator got a
          bare row of plan-name buttons (or no picker at all with a single assignment). That
          made the surface flicker between two different pickers as `isCollaborator` resolved,
          and left /benefits with two different "choose a plan" UIs depending on the account.
          `selectablePlans` already carries the right list for the viewer — Active-only for an
          advisor, every assigned plan (Draft included) for a Collaborator — so the same picker
          can serve both; `activeOnly` keeps the Collaborator's Draft assignments selectable. */}
      <Card className="mb-6 shadow-sm dark:bg-gray-800">
        <CardContent className="p-6">
          <PlanSearchBar
            plans={selectablePlans}
            value={selectedPlanId}
            onChange={handleSelectPlan}
            title="Benefits"
            module="benefits"
            disabled={selectablePlans.length === 0}
            activeOnly={!isCollaborator}
          />
        </CardContent>
      </Card>
      
      {/* Organization-wide context: the benefits this advisor's organization offers.
          Plan-independent, permanent, and server-rendered — it is on screen before any of
          the reads below return. See the component.

          Deliberately omitted for a Collaborator. The labels are the OWNER's answer, and a
          login created by accepting an invitation owns only its own personal organization, so
          the server's fallback finds no other owner and this strip would read "No service
          categories selected yet." to a guest of a firm that plainly does offer benefits —
          wrong, and also beside the point, since the plan below already states what it has. */}
      {!isCollaborator && <OrgServiceCategories categories={orgCategories} />}

      {contentState === "loading" ? (
        <PlanBenefitsSkeleton />
      ) : failure ? (
        <LoadFailedCard
          title={failure.title}
          description={failure.description}
          onRetry={failure.onRetry}
        />
      ) : contentState === "no-plans" ? (
        isCollaborator ? (
          /* A Collaborator cannot create a plan — the invitation is the only way in — so the
             advisor's "Create Plan" call to action is replaced by the one action that is
             actually theirs: waiting for (or asking for) an invitation. */
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                You haven&rsquo;t been added to a plan yet. An advisor has to invite you to a
                plan before its benefit pages appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No plans yet. Create a plan first, then add its benefits.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push("/new-client")}
                >
                  Create Plan
                </Button>
                <Button className="gap-2" onClick={() => router.push("/new-benefits")}>
                  <Plus className="h-4 w-4" />
                  Create Benefit
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      ) : contentState === "no-active-plans" ? (
        <NoActivePlansCard onViewPlans={() => router.push("/clients")} />
      ) : (
        <Card className="dark:bg-gray-800">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {planRows[0]?.planName || "Plan Benefits"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isCollaborator
                    ? "The benefit sections you have access to on this plan."
                    : "Publish, hide, and edit this plan’s benefit pages."}
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {planRows.map((row) => {
                const key = `${row.planId}::${row.category}`;
                const isToggling = toggling[key] === true;
                // T4 Part A item 6: who is already on this section, and how much of
                // it is still missing. The count is the SAME `missingInfo` the amber
                // chips below render, so the two lines cannot disagree.
                const assignees =
                  assigneesByCategory.get(
                    row.category.trim().toLowerCase().replace(/\s+/g, " "),
                  ) ?? [];
                // The plan's Key Contact for this category — authored in Create Client,
                // so it is named even while the benefit is still "Not created". The Custom
                // hub never carries one (`/api/benefits` resolves none for it).
                const keyContact = row.keyContact ?? null;
                const assigneeLabels = [
                  ...assignees.map((a) => a.name),
                  ...(keyContact ? [keyContact.name] : []),
                ];
                const assignmentMissingFields =
                  assignees.length > 0 && row.exists && !row.isComplete
                    ? row.missingInfo.length
                    : 0;
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
                // The benefit's own page on the participant-facing portal — the deep link the
                // plan-level "Open Portal" button has no way to express.
                //
                // `customTitle`, never the raw `title`: for the Custom hub the segment IS the
                // advisor's name for the benefit, and `title` also carries the wizard's intro
                // headline ("Welcome to Acme!"), which slugged would link to a segment that does
                // not exist. `null` falls back to the legacy alias, which is where an unnamed hub
                // genuinely lives — the same rule the portal's own nav uses.
                const portalSegment = getBenefitPortalSegment(
                  row.category,
                  customTitle,
                );
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
                          missing-item list, one chip per item rather than a
                          "·"-joined sentence, so several gaps read as a set at a
                          glance instead of a run-on line.
                          `variant="outline"` + amber overrides: `Badge` merges
                          className through `cn()`, so these win over the variant's
                          own colours. Padding/size are tightened to keep the row
                          height unchanged from the plain-text version. */}
                      {/* T4 Part A item 6: who is already on this section. The
                          missing-field count is the same `missingInfo` the chips
                          above render, so the two cannot disagree. */}
                      {assigneeLabels.length > 0 ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          {/* Overlapping headshots — the row is the whole team on this section, not
                              one person. Beyond three, a "+N" keeps the line from running away. */}
                          <span className="flex shrink-0 -space-x-1.5">
                            {assignees.slice(0, 3).map((assignee) => (
                              <span
                                key={assignee.assignmentId}
                                className="block h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-background"
                              >
                                <Headshot
                                  src={assignee.headshot}
                                  alt={assignee.name}
                                  monogramName={assignee.name}
                                  wrapperClassName="rounded-full"
                                />
                              </span>
                            ))}
                            {keyContact ? (
                              <span
                                key={`key-contact-${keyContact.id}`}
                                className="block h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-background"
                              >
                                <Headshot
                                  src={keyContact.headshot}
                                  alt={keyContact.name}
                                  monogramName={keyContact.name}
                                  wrapperClassName="rounded-full"
                                />
                              </span>
                            ) : null}
                            {assignees.length > 3 && (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-background">
                                +{assignees.length - 3}
                              </span>
                            )}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            Assigned to {assigneeLabels.join(", ")}
                            {assignmentMissingFields > 0
                              ? ` · ${assignmentMissingFields} field${
                                  assignmentMissingFields === 1 ? "" : "s"
                                } missing`
                              : ""}
                          </span>
                        </div>
                      ) : null}
                      {row.exists &&
                        !row.isComplete &&
                        row.missingInfo.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {row.missingInfo.map((item, index) => (
                              <Badge
                                // Index-qualified: the list is stable per render, and
                                // a bare `item` key would collide if two entries ever
                                // shared a label.
                                key={`${item}-${index}`}
                                variant="outline"
                                className="border-amber-300/70 bg-amber-50 px-1.5 py-0 text-[11px] font-medium leading-4 text-amber-700 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                {item}
                              </Badge>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Portal visibility only means something once the benefit
                        exists. `/api/benefits` derives `isEnabled` from the plan's
                        `categoryPortalVisibility`, which defaults to visible for a
                        category with no row — so rendering the switch regardless
                        showed it ON (reading as "Published") beside an "Add benefit"
                        button that cannot publish anything. */}
                    {row.exists ? (
                      isCollaborator ? (
                        /* Publishing is a Collaborator's HARD BLOCK (spec Part B item 2, §3) —
                           not a preset default that "Customize access" can re-grant. The state
                           is therefore stated in the same words as the owner's, with no control
                           to change it; offering a greyed-out switch would imply the block is a
                           matter of degree. */
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-semibold",
                            row.isEnabled ? "text-green-600" : "text-gray-400",
                          )}
                        >
                          {row.isEnabled ? "Published" : "Hidden"}
                        </span>
                      ) : (
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
                      )
                    ) : isDraftRow(row) ? (
                      <span className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Draft
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                        Not created
                      </span>
                    )}

                    {row.exists ? (
                      <div className="flex shrink-0 items-center gap-2">
                        {/* A row's primary action opens the benefit page. Inviting a
                            collaborator belongs to the benefit itself (Create/Edit
                            Benefit → Contacts → Add Collaborator), where the scope they
                            are being given is on screen next to the section it applies
                            to — not on a list row where the category is implied. */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            router.push(
                              `/edit-benefit/${encodeURIComponent(
                                row.planId,
                              )}/${categoryToSlug(row.category)}`,
                            )
                          }
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {/* One label for everyone: the action opens the benefit page
                              for viewing. `/edit-benefit/…` itself gates saving on the
                              grid, so a read-only Collaborator (Viewer / Reviewer) still
                              reaches the same destination and simply cannot write. */}
                          View
                        </Button>
                        {/* A Collaborator is editing a page they would otherwise never see as a
                            participant does, and the plan-level "Open Portal" button belongs to
                            the picker they do not get. This opens THIS section, so the editor and
                            the page it produces are one click apart.
                            Only for a benefit that EXISTS: before a row is created there is no
                            page to open, which is the same reason the publish control is absent
                            above. A Hidden section is still offered — hiding removes it from the
                            hub's own navigation, it does not remove the page. */}
                        {isCollaborator ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            aria-label={`Open the portal page for ${displayName}`}
                            onClick={() => {
                              const base = getBenefitsHubOpenPortalUrl(
                                row.planSlug || row.planId,
                              );
                              // The flag wraps the FINISHED url, segment and all.
                              window.open(
                                withCommentsRail(
                                  portalSegment ? `${base}/${portalSegment}` : base,
                                ),
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Portal
                          </Button>
                        ) : null}
                      </div>
                    ) : mayCreateBenefit ? (
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
                        {/* Same destination either way — the wizard rehydrates the draft for
                            this plan + category — so only the wording changes: "Continue"
                            when there is work to return to, "Add" when there is none. */}
                        {isDraftRow(row) ? "Continue" : "Add"}
                      </Button>
                    ) : null}
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
