"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formNow } from "@/lib/date";
import { videos } from "@/constants/data";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BrandingImage } from "@/components/ui/branding-image";
import { useEffect, useState, useMemo } from "react";
import { useDebounceValue } from "usehooks-ts";
import { PlanDropdownMenu } from "./PlanDropdownMenu";
import { SkeletonTableRow } from "./SkeletonTableRow";
import {
  Search,
  FileText,
  ChevronsUpDown,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { IPlan } from "@/types/schema";

interface PlanItem {
  title: string;
  image: string;
  advisorImage?: string;
  eligibility: {
    waiting_period: string;
  };
  employee_contributions: {
    auto_enrollment: string;
    auto_increase: string;
    safe_harbor: string;
    after_tax_contributions: string;
    mandatory_contributions: string;
    roth_contributions: string;
  };
  employer_contributions: {
    hasContributions: boolean;
    contributionTypes: string[];
    companyMatch?: {
      isPrimary: boolean;
      formula: string;
      limit: string;
      vesting: string;
    };
    safeHarbor?: {
      isPrimary: boolean;
      type: string;
      formula: string;
      limit: string;
      vesting: string;
    };
    fixedAmount?: {
      isPrimary: boolean;
      amount: string;
      details: string;
      vesting: string;
    };
    profitSharing?: {
      isPrimary: boolean;
      details: string;
      conditions: string;
      vesting: string;
    };
  };
  vesting_and_operations: {
    vesting: string;
    operations: string;
  };
  data: any[];
}

interface Plan extends Omit<IPlan, "idIndex"> {
  id: string;
  idIndex: number;
  clientName: string;
  clientLogo: string;
  updatedAt: string;
  lastModified?: string;
  items?: PlanItem;
  isLegacyPlan?: boolean;
  externalLink?: string;
  isNewlyGenerated?: boolean;
  deletedAt?: string;
  video?: {
    videoUrl?: string | null;
    title?: string | null;
    videoStatus?: string | null;
  };
}

const menus = [
  {
    label: "Edit Plan",
    icon: "edit",
  },
  {
    label: "Embed Code",
    icon: "copy",
  },
  {
    label: "Download Video",
    icon: "download",
  },
  {
    label: "Plan Analytics",
    icon: "chart",
    screen: "plan-analytics",
  },
  {
    label: "Plan Specs",
    icon: "view",
    screen: "plan-specs",
  },
  {
    label: "Delete Plan",
    icon: "delete",
  },
];

type SortColumn =
  | "clientName"
  | "participantVideo"
  | "planCollateral"
  | "updatedAt"
  | null;
type SortDirection = "asc" | "desc";

export function PlanListDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce] = useDebounceValue(searchQuery, 300);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newlyGeneratedPlans, setNewlyGeneratedPlans] = useState<Plan[]>([]);
  const [trashPlans, setTrashPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  const { data: session } = useSession();

  const handleGetPlans = async () => {
    setIsLoading(true);
    try {
      // Get hardcoded plans
      const filteredHardcodedPlans = videos.filter((video) => {
        return video.clientName
          .toLowerCase()
          .includes(searchDebounce.toLowerCase());
      });

      const formattedHardcodedPlans: Plan[] = filteredHardcodedPlans.map(
        (video) => ({
          id: video.videoId,
          idIndex: parseInt(video.videoId, 10),
          clientName: video.clientName,
          clientLogo: video.image,
          updatedAt: new Date().toISOString(),
          lastModified: video.lastModified,
          items: video.items as unknown as PlanItem,
          isLegacyPlan: video.isLegacyPlan,
          externalLink: video.externalLink,
          video: video.videoUrl
            ? {
                videoUrl: video.videoUrl,
                title: video.clientName,
                videoStatus: "completed",
              }
            : undefined,
          isNewlyGenerated: false,
        }),
      );

      let newlyGeneratedPlans: Plan[] = [];

      // Get newly generated plans from API
      try {
        // const response = await fetch('/api/plans/get-newly-generated')
        const response = await fetch(
          "/api/plans/get-list-plan?videoStatus=completed",
        );
        const data = await response.json();
        const formattedNewPlans: Plan[] = data.data.map((plan: any) => ({
          ...plan,
          idIndex:
            typeof plan.idIndex === "string"
              ? parseInt(plan.idIndex, 10)
              : plan.idIndex,
          isNewlyGenerated: true,
        }));
        newlyGeneratedPlans = formattedNewPlans;
        // setNewlyGeneratedPlans(formattedNewPlans)
      } catch (error) {
        console.error("Error fetching newly generated plans:", error);
      }

      // Combine both lists
      setPlans([...formattedHardcodedPlans, ...newlyGeneratedPlans]);
    } catch (error) {
      console.error("handleGetPlans", error);
    }
    setIsLoading(false);
  };

  const handleGetTrashPlans = async () => {
    setIsTrashLoading(true);
    try {
      setTimeout(() => {
        setTrashPlans([]);
        setIsTrashLoading(false);
      }, 500);
    } catch (error) {
      setIsTrashLoading(false);
    }
  };

  const handleRestorePlan = async (planId: string) => {
    try {
      setTrashPlans(trashPlans.filter((plan) => plan.id !== planId));
    } catch (error) {
      console.error("handleRestorePlan", error);
    }
  };

  const handlePermanentDelete = async (planId: string) => {
    try {
      setTrashPlans(trashPlans.filter((plan) => plan.id !== planId));
    } catch (error) {
      console.error("handlePermanentDelete", error);
    }
  };

  useEffect(() => {
    handleGetPlans();
  }, [searchDebounce]);

  useEffect(() => {
    if (isTrashOpen) {
      handleGetTrashPlans();
    }
  }, [isTrashOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder="Search all plans"]',
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedPlans = useMemo(() => {
    if (!sortColumn) return plans;

    return [...plans].sort((a, b) => {
      if (sortColumn === "clientName") {
        const nameA = a.clientName?.toLowerCase() || "";
        const nameB = b.clientName?.toLowerCase() || "";

        if (sortDirection === "asc") {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      } else if (sortColumn === "participantVideo") {
        const nameA = a.clientName?.toLowerCase() || "";
        const nameB = b.clientName?.toLowerCase() || "";

        if (sortDirection === "asc") {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      } else if (sortColumn === "planCollateral") {
        const nameA = a.clientName?.toLowerCase() || "";
        const nameB = b.clientName?.toLowerCase() || "";

        if (sortDirection === "asc") {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      } else if (sortColumn === "updatedAt") {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();

        if (sortDirection === "asc") {
          return dateA - dateB;
        } else {
          return dateB - dateA;
        }
      }
      return 0;
    });
  }, [plans, sortColumn, sortDirection]);

  return (
    <ScrollArea className="h-full">
      <div className="flex-1 p-4 pt-6 space-y-4 md:px-8">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl text-[#2B334C] dark:text-white font-semibold tracking-tighter">
            Welcome{" "}
            {session?.user?.name ? `${session.user.name} 👋` : "Guest 👋"}
          </h2>
          <div className="items-center hidden space-x-2 md:flex">
            <div className="relative min-w-[200px]">
              <Search className="absolute w-4 h-4 -translate-y-1/2 left-2 top-1/2 text-muted-foreground" />
              <Input
                className="pl-8 pr-10 focus:outline-none border-[#efefef] mr-1"
                placeholder="Search all plans"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                /
              </div>
            </div>
            <Link href="/create-new-plan">
              <Button className="min-w-[146px]">Create new plan</Button>
            </Link>
          </div>
        </div>

        <Card className="bg-transparent border-none rounded-none shadow-none">
          {isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center">
                      Client Name
                      <ChevronsUpDown className="w-4 h-4 ml-1 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Benefits Portal
                      <ChevronsUpDown className="w-4 h-4 ml-1 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Plan Collateral
                      <ChevronsUpDown className="w-4 h-4 ml-1 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Last Modified
                      <ChevronsUpDown className="w-4 h-4 ml-1 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(Math.min(plans.length || 2, 5))].map((_, index) => (
                  <SkeletonTableRow key={index} />
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && sortedPlans.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer group"
                    onClick={() => handleSort("clientName")}
                  >
                    <div className="flex items-center">
                      Client Name
                      <ChevronsUpDown
                        className={`w-4 h-4 ml-1 ${
                          sortColumn === "clientName"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer group"
                    onClick={() => handleSort("participantVideo")}
                  >
                    <div className="flex items-center">
                      Benefits Portal
                      <ChevronsUpDown
                        className={`w-4 h-4 ml-1 ${
                          sortColumn === "participantVideo"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer group"
                    onClick={() => handleSort("planCollateral")}
                  >
                    <div className="flex items-center">
                      Plan Collateral
                      <ChevronsUpDown
                        className={`w-4 h-4 ml-1 ${
                          sortColumn === "planCollateral"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer group"
                    onClick={() => handleSort("updatedAt")}
                  >
                    <div className="flex items-center">
                      Last Modified
                      <ChevronsUpDown
                        className={`w-4 h-4 ml-1 ${
                          sortColumn === "updatedAt"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlans.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="min-w-[300px]">
                      <div className="flex items-center justify-start gap-2">
                        <div className="flex items-center justify-center h-[46px] w-[46px] overflow-hidden rounded-lg shrink-0">
                          {item?.clientLogo ? (
                            <BrandingImage
                              src={item.clientLogo}
                              alt=""
                              fillContainer
                            />
                          ) : (
                            <div className="h-[46px] w-[46px] rounded-[8px] bg-transparent flex items-center justify-center">
                              <div className="h-[28px] w-[28px] rounded-[8px] bg-[#e6e6e6] dark:bg-[#0e0e0e]" />
                            </div>
                          )}
                        </div>
                        <div>{item.clientName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={
                          item.isLegacyPlan && item.externalLink
                            ? item.externalLink
                            : `/view/${item.idIndex}`
                        }
                        target="_blank"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                        >
                          View
                        </Button>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/content-library?client=${item.idIndex}&lang=en`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                        >
                          View
                        </Button>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {item.lastModified || formNow(item.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <PlanDropdownMenu
                        plan={item}
                        onDeleteSuccess={handleGetPlans}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && sortedPlans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-muted">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">No clients yet</h3>
              <p className="max-w-xs mb-4 text-sm text-muted-foreground">
                You haven&apos;t created any plans yet. Get started by creating
                your first plan.
              </p>
              <Link href="/create-new-plan">
                <Button>Create new plan</Button>
              </Link>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between">
          {!isLoading && sortedPlans.length > 0 && (
            <p className="text-sm text-gray-500">{sortedPlans.length} plans</p>
          )}
          {!isLoading && sortedPlans.length > 0 && (
            <Sheet open={isTrashOpen} onOpenChange={setIsTrashOpen}>
              <SheetTrigger asChild>
                <div className="p-2 rounded-full flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#161616]">
                  <Trash2 className="w-4 h-4 text-gray-500" />
                  <p className="text-xs text-gray-500">Trash</p>
                </div>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
                <SheetHeader className="px-6 py-4 border-b">
                  <SheetTitle className="text-left">Trash</SheetTitle>
                </SheetHeader>
                <div className="px-6 py-4">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Plans in trash will be permanently deleted after 30 days.
                  </p>

                  {isTrashLoading ? (
                    <div className="flex flex-col gap-3">
                      {[...Array(3)].map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-md animate-pulse"
                        >
                          <div className="w-[180px] h-4 bg-muted rounded"></div>
                          <div className="w-[80px] h-4 bg-muted rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : trashPlans.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {trashPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between p-3 border rounded-md"
                        >
                          <div>
                            <p className="font-medium">{plan.clientName}</p>
                            <p className="text-xs text-muted-foreground">
                              Deleted {formNow(plan.deletedAt)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleRestorePlan(plan.id)}
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handlePermanentDelete(plan.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-muted">
                        <Trash2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="mb-1 text-base font-medium">
                        Trash is empty
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        No plans have been deleted yet.
                      </p>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
