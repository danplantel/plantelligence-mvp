"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounceValue } from "usehooks-ts";
import { toast } from "sonner";
import {
  ChevronsUpDown,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BrandingImage } from "@/components/ui/branding-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useViewerAccess } from "@/hooks/useViewerAccess";
import { withCommentsRail } from "@/lib/comments/portal-surface";
import { getBenefitsHubOpenPortalUrl } from "@/lib/marketing/hub-url";
import { cn } from "@/lib/utils";

/**
 * Employee Resources — the dashboard table of plans and their fifth hub (TF-6).
 *
 * The table itself is the View Plans table
 * ([`ClientsListDashboardPage`](../clients-list-dashboard.tsx:112)): same search,
 * sorting, pagination and row rendering. What changes is the two right-hand columns —
 * Quick Actions is replaced by the hub's own controls.
 *
 *   Show Page           Published / Hidden + the publish switch
 *   Actions             Create Page until the hub exists, then Edit Page (the
 *                       plan-scoped editor) and Open Portal (the live page)
 *
 * Publishing is the plan's own `employeeResourcesEnabled` flag, written through
 * `/api/clients/{id}/employee-resources` — the hub has no `Benefit` row, so there is
 * no category endpoint to toggle. "Create Page" and "Edit Page" both open
 * `/employee-resources/{id}`, not an Edit Benefit page, for the same reason: the
 * editor seeds the location the first time it mounts, which is what "creates" the
 * page. `employeeResourcesCreated` (a single placement's existence, from the
 * `view=table` projection) is what tells the two apart.
 */

/** One row of the `view=table` projection, plus this page's two facts. */
interface PlanRow {
  id: string;
  slug?: string | null;
  companyName?: string;
  companyLogo?: string | null;
  brandColor?: string | null;
  status?: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  /** TF-6: has this plan published the portal's fifth hub? */
  employeeResourcesEnabled?: boolean;
  /** TF-6: has the hub ever been set up (any placement in that location)? */
  employeeResourcesCreated?: boolean;
}

type SortColumn =
  | "companyName"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "type";
type SortDirection = "asc" | "desc";

const COLUMN_COUNT = 7;

// `cache: "no-store"` keeps the browser's HTTP cache from answering the list with a
// stale body; SWR's own cache is what makes a revisit instant.
const jsonFetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

/** mm/dd/yy — the format the View Plans table prints. */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

export function EmployeeResourcesListPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();
  const { isCollaborator, can } = useViewerAccess();

  /**
   * Publishing is the same `create_benefits: edit` decision the hub's own API enforces
   * (it resolves the "Employee Resources" category scope), and a Collaborator never
   * publishes — that block is stated in words rather than offered as a disabled switch.
   */
  const mayPublish = can("create_benefits", "edit") && !isCollaborator;

  useEffect(() => {
    setTitle("Employee Resources");
  }, [setTitle]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce] = useDebounceValue(searchQuery, 300);
  const [sortColumn, setSortColumn] = useState<SortColumn>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  /** Plans whose publish write is in flight, keyed by plan id. */
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // `view=table` is the slim projection: identity, branding swatch, status/type,
  // timestamps, a pre-computed contact count, and the hub flag. It deliberately omits
  // `employeePortalPreview` and the `keyContacts` JSON (base64 headshots).
  const swrKey = useMemo(() => {
    const params = new URLSearchParams({
      view: "table",
      search: searchDebounce,
      page: currentPage.toString(),
      limit: itemsPerPage.toString(),
      sortColumn,
      sortDirection,
    });
    return `/api/clients?${params.toString()}`;
  }, [
    searchDebounce,
    currentPage,
    itemsPerPage,
    sortColumn,
    sortDirection,
  ]);

  const {
    data: swrData,
    error: listError,
    isLoading,
    mutate: refreshPlans,
  } = useSWR(swrKey, jsonFetcher, {
    keepPreviousData: true,
    dedupingInterval: 2_000,
    revalidateOnFocus: true,
  });

  const plans: PlanRow[] = swrData?.data ?? [];
  const total: number = swrData?.pagination?.total ?? 0;
  const totalPages = Math.ceil(total / itemsPerPage);

  // A new search or page size is a new result set, so it always starts at page 1.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchDebounce, itemsPerPage]);

  // A plan deleted elsewhere can leave the table asking for a page that no longer
  // exists; clamp back to the last real page once the fresh total arrives.
  useEffect(() => {
    if (!swrData) return;
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [swrData, totalPages, currentPage]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  /**
   * Publish / hide one plan's hub.
   *
   * Optimistic per ROW, not per page: the switch flips immediately and only that plan's
   * flag is rewritten in the cached payload, so twenty other rows do not re-render as
   * "not published" while the write is in flight. A failure re-reads the list.
   */
  const handleToggle = async (plan: PlanRow, checked: boolean) => {
    setToggling((prev) => ({ ...prev, [plan.id]: true }));

    void refreshPlans(
      (current: any) =>
        current
          ? {
              ...current,
              data: current.data.map((row: PlanRow) =>
                row.id === plan.id
                  ? { ...row, employeeResourcesEnabled: checked }
                  : row,
              ),
            }
          : current,
      false,
    );

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(plan.id)}/employee-resources`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: checked }),
        },
      );
      const body = await response.json();
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
      // Re-read so the row reflects what the server just seeded (and its own flag).
      await refreshPlans();
    } catch (toggleError: any) {
      toast.error("Failed to save visibility", {
        description: toggleError?.message,
      });
      await refreshPlans();
    } finally {
      setToggling((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
    }
  };

  const openPortal = (plan: PlanRow) => {
    const base = getBenefitsHubOpenPortalUrl(plan.slug || plan.id);
    // The flag wraps the FINISHED url, page segment and all.
    window.open(
      withCommentsRail(`${base}/employee-resources`),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="mx-auto max-w-7xl">
        <Card>
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10"
                  aria-label="Search plans"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px] px-3 py-4">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("companyName")}
                          className="h-auto p-0 font-semibold"
                        >
                          Plan
                          <ChevronsUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-4">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("status")}
                          className="h-auto p-0 font-semibold"
                        >
                          Client Status
                          <ChevronsUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-4">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("type")}
                          className="h-auto p-0 font-semibold"
                        >
                          Type
                          <ChevronsUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-4">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("createdAt")}
                          className="h-auto p-0 font-semibold"
                        >
                          Created
                          <ChevronsUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-4">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("updatedAt")}
                          className="h-auto p-0 font-semibold"
                        >
                          Updated
                          <ChevronsUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-4">Show Page</TableHead>
                      <TableHead className="py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [1, 2, 3, 4, 5].map((row) => (
                        <TableRow key={row}>
                          <TableCell className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : listError ? (
                      // A failed read must not read as "your plans are gone".
                      <TableRow>
                        <TableCell
                          colSpan={COLUMN_COUNT}
                          className="h-24 text-center"
                        >
                          <p className="text-sm text-muted-foreground">
                            {"Couldn't load plans. Please try again."}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => refreshPlans()}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Try again
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : plans.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={COLUMN_COUNT}
                          className="h-24 text-center"
                        >
                          No plans found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      plans.map((plan) => {
                        const planName =
                          plan.companyName?.trim() || "Untitled plan";
                        const published =
                          plan.employeeResourcesEnabled === true;
                        // No placement yet = the page has never been created, so there
                        // is nothing to edit and no portal page to open.
                        const pageCreated =
                          plan.employeeResourcesCreated === true;
                        const isToggling = toggling[plan.id] === true;
                        const normalizedStatus = (
                          plan.status || "active"
                        ).toLowerCase();
                        const statusLabel =
                          normalizedStatus === "active"
                            ? "Active"
                            : normalizedStatus === "draft"
                              ? "Draft"
                              : plan.status || "Active";
                        const statusClasses =
                          normalizedStatus === "draft"
                            ? "border-orange-200 bg-orange-50 text-orange-700"
                            : normalizedStatus === "active"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-gray-200 bg-gray-50 text-gray-700";
                        return (
                          <TableRow key={plan.id}>
                            <TableCell className="px-3 py-4 font-medium">
                              <div className="flex items-center space-x-2">
                                {plan.companyLogo ? (
                                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                                    <BrandingImage
                                      src={plan.companyLogo}
                                      alt={planName}
                                      fillContainer
                                      objectFit="contain"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                                    style={{
                                      backgroundColor:
                                        plan.brandColor || "#64748b",
                                    }}
                                  >
                                    {planName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-2 font-medium">
                                    {planName}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge
                                variant="outline"
                                className={statusClasses}
                              >
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge
                                variant="outline"
                                className={
                                  plan.type === "prospect"
                                    ? "border-orange-200 text-orange-700"
                                    : "border-green-200 text-green-700"
                                }
                              >
                                {plan.type === "prospect"
                                  ? "Prospect"
                                  : "Client"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 text-sm text-muted-foreground">
                              {formatDate(plan.createdAt)}
                            </TableCell>
                            <TableCell className="py-4 text-sm text-muted-foreground">
                              {formatDate(plan.updatedAt)}
                            </TableCell>
                            <TableCell className="py-4">
                              {mayPublish ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-[11px] font-semibold",
                                      published
                                        ? "text-green-600"
                                        : "text-gray-400",
                                    )}
                                  >
                                    {published ? "Published" : "Hidden"}
                                  </span>
                                  {isToggling ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : null}
                                  <Switch
                                    checked={published}
                                    disabled={isToggling}
                                    aria-label={`Publish Employee Resources for ${planName}`}
                                    onCheckedChange={(checked) =>
                                      void handleToggle(plan, checked === true)
                                    }
                                  />
                                </div>
                              ) : (
                                /* Publishing is a Collaborator's hard block, so the
                                   state is stated with no control to change it. */
                                <span
                                  className={cn(
                                    "text-[11px] font-semibold",
                                    published
                                      ? "text-green-600"
                                      : "text-gray-400",
                                  )}
                                >
                                  {published ? "Published" : "Hidden"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-4">
                              {!pageCreated ? (
                                /* Nothing exists yet: one action, and it is the one
                                   that creates the page (the editor seeds the location
                                   when it mounts). Offering "Open Portal" here would
                                   only lead to a hub that has no content. */
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() =>
                                    router.push(
                                      `/employee-resources/${encodeURIComponent(
                                        plan.id,
                                      )}`,
                                    )
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                  Create Page
                                </Button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {/* The plan-scoped editor. `/edit-benefit/…` is the
                                      benefit editor and has no category to open here —
                                      this hub has no Benefit row. */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() =>
                                      router.push(
                                        `/employee-resources/${encodeURIComponent(
                                          plan.id,
                                        )}`,
                                      )
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit Page
                                  </Button>

                                  {/* Only a PUBLISHED hub has a portal page worth
                                      opening; a hidden one answers "not available
                                      yet". */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={!published}
                                    title={
                                      published
                                        ? "Open Portal"
                                        : "Publish the hub first"
                                    }
                                    onClick={() => openPortal(plan)}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Open Portal
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {total > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t px-1 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) =>
                      setItemsPerPage(Number(value))
                    }
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    per page
                  </span>
                </div>

                <span className="text-sm text-muted-foreground">
                  Showing{" "}
                  {Math.min((currentPage - 1) * itemsPerPage + 1, total)} to{" "}
                  {Math.min(currentPage * itemsPerPage, total)} of {total} plans
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
