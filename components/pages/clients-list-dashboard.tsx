"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formNow } from "@/lib/date";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BrandingImage } from "@/components/ui/branding-image";
import { useRouter } from "next/navigation";
import { useState, useMemo, useRef, useCallback } from "react";
import { useDebounceValue } from "usehooks-ts";
import useSWR from "swr";
import {
  Search,
  FileText,
  ChevronsUpDown,
  Trash2,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Globe,
  Calendar,
  FileText as FileTextIcon,
  Megaphone,
  Filter,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { storePendingDraftSelection } from "@/lib/draft-utils";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import {
  getBenefitsHubAbsoluteUrl,
  getBenefitsHubPath,
} from "@/lib/marketing/hub-url";

interface Client {
  id: string;
  slug?: string;
  companyName: string;
  companyWebsite?: string;
  companyLogo?: string;
  logoFileName?: string;
  brandColor: string;
  secondaryColor: string;
  missionHeadline?: string;
  status: string; // "Draft", "Active", "Archived"
  type: string; // "client", "prospect"
  createdAt: string;
  updatedAt: string;
  /** Create Plan wizard step (1–5) persisted on draft client */
  currentStep?: number;
  keyContacts?: any[] | { contacts: any[]; displayStyle?: number | null };
}

type SortColumn = "companyName" | "createdAt" | "updatedAt" | "status" | "type";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "active" | "draft";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

export function ClientsListDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce] = useDebounceValue(searchQuery, 300);
  const [sortColumn, setSortColumn] = useState<SortColumn>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all"); // "all", "client", "prospect"
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const isInitialLoad = useRef(true);

  // Build the SWR key from current filter/sort/page state.
  // SWR caches each unique key — navigating back shows cached data instantly.
  const swrKey = useMemo(() => {
    const params = new URLSearchParams({
      search: searchDebounce,
      status: statusFilter === "all" ? "all" : statusFilter,
      type: planTypeFilter,
      page: currentPage.toString(),
      limit: itemsPerPage.toString(),
      sortColumn,
      sortDirection,
    });
    return `/api/clients?${params.toString()}`;
  }, [searchDebounce, statusFilter, planTypeFilter, currentPage, itemsPerPage, sortColumn, sortDirection]);

  const { data: swrData, isLoading, isValidating, mutate: refreshClients } = useSWR(
    swrKey,
    jsonFetcher,
    {
      keepPreviousData: true,   // show stale data while revalidating — no blank flash
      dedupingInterval: 2_000,  // allow refetch after 2s (was 60s, hiding new drafts)
      revalidateOnFocus: true,  // refetch when user returns to this tab
    },
  );

  const clients: Client[] = swrData?.data ?? [];
  const totalClients: number = swrData?.pagination?.total ?? 0;

  const { data: session } = useSession();
  const router = useRouter();

  // Fetch the advisor's subdomain for building portal URLs
  const { data: profileData } = useSWR(
    "/api/profile",
    jsonFetcher,
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const userSubdomain: string | undefined = profileData?.subdomain || undefined;

  // Format date as mm/dd/yy
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  // Get plan type badge details
  const getPlanTypeBadge = (type?: string, status?: string) => {
    const clientType = type || "client";
    const clientStatus = status || "Active";

    if (clientType === "prospect") {
      return {
        color: "bg-orange-100 text-orange-800 hover:bg-orange-100",
        label: clientStatus === "Draft" ? "Prospect (Draft)" : "Prospect",
      };
    }

    return {
      color: "bg-green-100 text-green-800 hover:bg-green-100",
      label: clientStatus === "Draft" ? "Client (Draft)" : "Client",
    };
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    // Reset to page 1 when sorting changes
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalClients / itemsPerPage);

  // Reset to page 1 when filters change
  const prevFiltersRef = useRef({ planTypeFilter, statusFilter, searchDebounce });
  useMemo(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.planTypeFilter !== planTypeFilter ||
      prev.statusFilter !== statusFilter ||
      prev.searchDebounce !== searchDebounce
    ) {
      setCurrentPage(1);
      prevFiltersRef.current = { planTypeFilter, statusFilter, searchDebounce };
    }
  }, [planTypeFilter, statusFilter, searchDebounce]);

  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/clients/${clientToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete client");
      }

      const result = await response.json();
      if (result.success) {
        toast.success("Client deleted successfully");

        // Clear the Create Plan wizard's localStorage data AND in-memory Zustand
        // state so the user doesn't see stale draft info if they navigate to
        // /new/new-client afterwards.  The Zustand store is a module-level singleton
        // that survives client-side navigations — merely clearing localStorage is
        // not enough because persist.rehydrate() does not clear existing in-memory
        // state when storage is empty.
        // This runs for ALL deleted clients (not just drafts) because the wizard
        // may have been autosaving data that was never fully committed as a draft.
        try {
          useNewClientWizardStore.getState().resetWizard();
        } catch {
          // Ignore errors — fall back to manual localStorage removal
          try {
            localStorage.removeItem("new-client-wizard");
            localStorage.removeItem("new-client-wizard-saved-at");
          } catch {
            // Ignore localStorage errors
          }
        }

        // Revalidate SWR cache so the list refreshes without a full reload
        refreshClients();
      } else {
        throw new Error("Failed to delete client");
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Failed to delete client");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleViewClient = (clientId: string) => {
    // If a slug is available (stored on the client object), prefer it
    window.open(`/new/view/${clientId}`, "_blank");
  };

  const handleEditClient = (clientId: string) => {
    router.prefetch(`/new/edit-client/${clientId}`);
    router.push(`/new/edit-client/${clientId}`);
  };

  const handleFinishSetup = (client: Client) => {
    storePendingDraftSelection(client.id);
    const step =
      typeof client.currentStep === "number" &&
      client.currentStep >= 1 &&
      client.currentStep <= 5
        ? client.currentStep
        : null;
    router.push(
      step != null ? `/new/new-client?step=${step}` : "/new/new-client",
    );
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="mx-auto max-w-7xl">
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-sm shrink-0">
                    <Filter className="mr-2 h-4 w-4" />
                    Advanced Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as StatusFilter)
                    }
                  >
                    <DropdownMenuRadioItem value="all">
                      All statuses
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="active">
                      Active
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="draft">
                      Draft
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>Plan Type</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={planTypeFilter}
                    onValueChange={(value) => setPlanTypeFilter(value)}
                  >
                    <DropdownMenuRadioItem value="all">
                      All plans
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="client">
                      Client
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="prospect">
                      Prospect
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setStatusFilter("all");
                      setPlanTypeFilter("all");
                    }}
                  >
                    Reset filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={planTypeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setPlanTypeFilter("all")}
              >
                All
              </Button>
              <Button
                variant={planTypeFilter === "client" ? "default" : "outline"}
                size="sm"
                onClick={() => setPlanTypeFilter("client")}
                className={
                  planTypeFilter === "client"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }
              >
                Client
              </Button>
              <Button
                variant={planTypeFilter === "prospect" ? "default" : "outline"}
                size="sm"
                onClick={() => setPlanTypeFilter("prospect")}
                className={
                  planTypeFilter === "prospect"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : ""
                }
              >
                Prospect
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                <Button onClick={() => refreshClients()} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Link href="/new/new-client">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Plan
                  </Button>
                </Link>
              </div>
            </div>

          <div className="rounded-md border overflow-hidden">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] px-3 py-4">
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
                        Status
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
                    <TableHead className="py-4">Key Contacts</TableHead>
                    <TableHead className="py-4">Quick Actions</TableHead>
                    <TableHead className="py-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Skeleton Loader
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <TableRow key={i}>
                          {/* Plan */}
                          <TableCell className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
                              <div className="space-y-2 flex-1">
                                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                                <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
                              </div>
                            </div>
                          </TableCell>
                          {/* Status */}
                          <TableCell className="py-4">
                            <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                          </TableCell>
                          {/* Type */}
                          <TableCell className="py-4">
                            <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
                          </TableCell>
                          {/* Created */}
                          <TableCell className="py-4">
                            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                          </TableCell>
                          {/* Updated */}
                          <TableCell className="py-4">
                            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                          </TableCell>
                          {/* Key Contacts */}
                          <TableCell className="py-4">
                            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
                          </TableCell>
                          {/* Quick Actions */}
                          <TableCell className="py-4">
                            <div className="flex items-center space-x-1">
                              {[1, 2, 3, 4, 5, 6].map((j) => (
                                <div
                                  key={j}
                                  className="h-8 w-8 bg-gray-200 rounded animate-pulse"
                                />
                              ))}
                            </div>
                          </TableCell>
                          {/* Finish Setup */}
                          <TableCell className="py-4">
                            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ) : clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No plans found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client) => {
                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium px-3 py-4">
                            <div className="flex items-center space-x-2">
                              {client.companyLogo ? (
                                <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                  <BrandingImage
                                    src={client.companyLogo}
                                    alt={client.companyName}
                                    fillContainer
                                    objectFit="contain"
                                  />
                                </div>
                              ) : (
                                <div
                                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold shrink-0"
                                  style={{ backgroundColor: client.brandColor }}
                                >
                                  {client.companyName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium line-clamp-2">
                                  {client.companyName}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            {(() => {
                              const normalizedStatus = (
                                client.status || "active"
                              ).toLowerCase();
                              const statusLabel =
                                normalizedStatus === "active"
                                  ? "Active"
                                  : normalizedStatus === "draft"
                                  ? "Draft"
                                  : client.status || "Active";
                              const statusClasses =
                                normalizedStatus === "draft"
                                  ? "border-orange-200 text-orange-700 bg-orange-50"
                                  : normalizedStatus === "active"
                                  ? "border-green-200 text-green-700 bg-green-50"
                                  : "border-gray-200 text-gray-700 bg-gray-50";

                              return (
                                <Badge
                                  variant="outline"
                                  className={statusClasses}
                                >
                                  {statusLabel}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              variant="outline"
                              className={
                                client.type === "prospect"
                                  ? "border-orange-200 text-orange-700"
                                  : "border-green-200 text-green-700"
                              }
                            >
                              {client.type === "prospect"
                                ? "Prospect"
                                : "Client"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground py-4">
                            {formatDate(client.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground py-4">
                            {formatDate(client.updatedAt)}
                          </TableCell>
                          <TableCell className="py-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/new/edit-client/${client.id}?tab=contacts`,
                                )
                              }
                              className="text-sm hover:text-primary"
                            >
                              {(() => {
                                // Handle both old format (array) and new format (object with contacts)
                                let contactsCount = 0;
                                if (client.keyContacts) {
                                  if (Array.isArray(client.keyContacts)) {
                                    // Old format: just an array
                                    contactsCount = client.keyContacts.length;
                                  } else if (
                                    typeof client.keyContacts === "object" &&
                                    client.keyContacts !== null &&
                                    "contacts" in client.keyContacts
                                  ) {
                                    // New format: { contacts: [...], displayStyle: ... }
                                    const contactsArray = Array.isArray(
                                      (client.keyContacts as any).contacts,
                                    )
                                      ? (client.keyContacts as any).contacts
                                      : [];
                                    contactsCount = contactsArray.length;
                                  }
                                }
                                return contactsCount;
                              })()}{" "}
                              contacts
                            </Button>
                          </TableCell>
                          <TableCell className="py-4">
                            <TooltipProvider>
                              <div className="flex items-center space-x-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const slug = client.slug || client.id;
                                        // In development, route to the localhost
                                        // version instead of the production subdomain
                                        // URL (e.g. https://waypoint.plantel.pro/new/view/...).
                                        const url =
                                          process.env.NODE_ENV === "development"
                                            ? `${window.location.origin}${getBenefitsHubPath(slug)}`
                                            : getBenefitsHubAbsoluteUrl(
                                                slug,
                                                userSubdomain,
                                              );
                                        window.open(url, "_blank");
                                      }}
                                    >
                                      <Globe className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Hub</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const searchParams =
                                          new URLSearchParams({
                                            company: client.companyName,
                                          });
                                        router.push(
                                          `/new/documents?${searchParams.toString()}`,
                                        );
                                      }}
                                    >
                                      <FileTextIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Documents</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const searchParams =
                                          new URLSearchParams({
                                            client: client.companyName,
                                            clientId: client.id,
                                          });
                                        router.push(
                                          `/new/communications?${searchParams.toString()}`,
                                        );
                                      }}
                                    >
                                      <Calendar className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Meetings</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        toast.info(
                                          "Marketing feature will be implemented soon",
                                        )
                                      }
                                    >
                                      <Megaphone className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Marketing</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEditClient(client.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleDeleteClient(client)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="py-4">
                            {(client.status || "active").toLowerCase() ===
                            "draft" ? (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleFinishSetup(client)}
                                className="h-8"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Finish Setup
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalClients > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
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
                <span className="text-sm text-muted-foreground">per page</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing{" "}
                  {totalClients > 0
                    ? Math.min(
                        (currentPage - 1) * itemsPerPage + 1,
                        totalClients,
                      )
                    : 0}{" "}
                  to {Math.min(currentPage * itemsPerPage, totalClients)} of{" "}
                  {totalClients} plans
                </span>
              </div>

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
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          </div>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>{clientToDelete?.companyName}</strong>? This action cannot
                be undone and will also delete all associated documents.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteClient}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Deleting
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
