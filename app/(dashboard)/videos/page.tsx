"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlanOption = {
  id: string;
  name: string;
  videoIds: string[];
  allPlanIds?: string[]; // All plan IDs for this client
};

type PlanVideo = {
  id?: string; // Unique video ID from database
  planId: string;
  planName: string;
  videoUrl: string | null;
  videoProviderId: string | null;
  videoStatus: string | null;
  pagePlacement?: string | null; // "retirement" | "health-insurance" | "life-insurance" | "wellness-programs" | null
  pageIndex?: number | null; // Index/order of video on the page
  isChecking: boolean;
};

const PLANS: PlanOption[] = [
  { id: "plan-a", name: "Retirement Planning Essentials", videoIds: [] },
  { id: "plan-b", name: "Health Plan Essentials", videoIds: [] },
  { id: "plan-c", name: "Life Insurance Essentials", videoIds: [] },
  { id: "plan-d", name: "Wealth Builder Custom", videoIds: [] },
];

const PLAN_VIDEO_MAPPING: Record<string, string[]> = {
  "plan-a": ["top5", "decision", "charting", "price"],
  "plan-b": ["medicare", "shouldGo", "social"],
  "plan-c": ["lifeInsurance", "top5", "social"],
  "plan-d": ["top5", "decision", "shouldGo", "lifeInsurance", "charting"],
};

const EDUCATIONAL_VIDEOS = [
  {
    id: "top5",
    title: "The Top 5 Reasons People Can't Retire",
    image: "/content-library/Top5ReasonsPeopleDontSave.png",
    category: "educational",
  },
  {
    id: "decision",
    title: "The Decision: Roth vs Traditional",
    image: "/content-library/TheDecision.png",
    category: "educational",
  },
  {
    id: "shouldGo",
    title: "Should I Stay or Should I Go?",
    image: "/content-library/ShouldIStay.png",
    category: "educational",
  },
  {
    id: "social",
    title: "Social Security Benefits",
    image: "/content-library/SocialSecurity.png",
    category: "educational",
  },
  {
    id: "lifeInsurance",
    title: "Life Insurance Do's & Don'ts",
    image: "/content-library/3.jpg",
    category: "educational",
  },
  {
    id: "charting",
    title: "Charting Your Course",
    image: "/content-library/2.jpg",
    category: "educational",
  },
  {
    id: "medicare",
    title: "Medicare 101",
    image: "/content-library/1.jpg",
    category: "educational",
  },
  {
    id: "price",
    title: "The Price Is Wrong",
    image: "/content-library/ThePriceisWrong.png",
    category: "educational",
  },
];

const DEFAULT_PLAN_OPTIONS: PlanOption[] = PLANS.map((plan) => ({
  ...plan,
  videoIds: PLAN_VIDEO_MAPPING[plan.id] || [],
}));

const parseEducationalVideoIds = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseEducationalVideoIds(parsed);
    } catch (error) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, any>)
      .filter(([, isSelected]) => Boolean(isSelected))
      .map(([key]) => key);
  }

  return [];
};

const VIDEO_TYPES = [
  { id: "all", name: "All Types" },
  { id: "educational", name: "Educational" },
  { id: "summary", name: "Summary" },
  { id: "custom", name: "Custom" },
];

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ContentLibraryPage() {
  const [selectedPlan, setSelectedPlan] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [planOptions, setPlanOptions] =
    useState<PlanOption[]>(DEFAULT_PLAN_OPTIONS);
  const [isFetchingPlans, setIsFetchingPlans] = useState(false);
  const [summaryVideos, setSummaryVideos] = useState<PlanVideo[]>([]);
  const [isCheckingVideos, setIsCheckingVideos] = useState(false);
  // Track videos that are currently being checked to avoid duplicate checks
  const checkingVideosRef = useRef<Set<string>>(new Set());
  // Track previous selectedPlan for video checking useEffect
  const prevSelectedPlanForCheckingRef = useRef<string>("all");
  // Keep current summaryVideos in ref to access latest value without dependency
  const summaryVideosRef = useRef<PlanVideo[]>([]);

  // SWR: clients + plans — cached so revisiting the page shows data instantly
  const { data: clientsData } = useSWR(
    "/api/clients?search=&status=all",
    jsonFetcher,
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );
  const { data: plansData } = useSWR(
    "/api/plans/get-list-plan",
    jsonFetcher,
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );

  // Helper function to fetch ALL videos for a plan (NO CACHING)
  const fetchVideoForPlan = useCallback(async (planId: string) => {
    const planIdStr = String(planId);


    try {
      const response = await fetch(
        `/api/videos/get-detail-video?planId=${planIdStr}`,
      );

      if (!response.ok) {
        
        return null;
      }

      const payload = await response.json();

      // ✅ Use videos array (ALL videos) instead of single video
      const videosArray = payload?.videos || [];

      // Fallback to single video for backward compatibility
      const latestVideo =
        payload?.latestVideo || payload?.video || payload?.data;

      if (videosArray.length === 0 && !latestVideo) {
        return null;
      }

      // Process ALL videos from the array
      const processedVideos = videosArray
        .filter((videoData: any) => {
          // ✅ Filter out videos without database ID (required field)
          if (!videoData.id) {
            console.warn("⚠️ Skipping video without database ID:", {
              videoProviderId: videoData.videoProviderId,
              planId: planIdStr,
              videoData,
            });
            return false;
          }
          return true;
        })
        .map((videoData: any) => {
          // ✅ videoData.id is from database (MongoDB ObjectId)
          // Extract videoUrl from multiple possible locations
          const videoUrl =
            videoData.videoUrl ||
            videoData.heygen?.data?.video_url ||
            videoData.heygen?.data?.url ||
            videoData.heygen?.video_url ||
            videoData.synthesia?.download_url ||
            null;

          const videoProviderId =
            videoData.videoProviderId ||
            videoData.heygen?.data?.video_id ||
            videoData.synthesia?.id ||
            null;

          const videoStatus =
            videoData.videoStatus ||
            videoData.heygen?.data?.status ||
            videoData.synthesia?.status ||
            videoData.status ||
            null;

          return {
            id: videoData.id, // ✅ Database ID (required, always present)
            planId: String(planIdStr), // ✅ Include planId
            planName: videoData.planName || "Unnamed Plan", // ✅ Include planName (will be set later if needed)
            videoUrl,
            videoProviderId, // HeyGen/Synthesia ID (for status checking)
            videoStatus,
            pagePlacement: videoData.pagePlacement || null, // ✅ Include pagePlacement
            pageIndex: videoData.pageIndex ?? null, // ✅ Include pageIndex
            rawData: videoData,
          };
        });

      // If we have videos array, return all of them
      // Otherwise, fallback to latestVideo
      const result =
        videosArray.length > 0
          ? {
              videos: processedVideos,
              latestVideo: processedVideos[0] || null,
              allVideos: processedVideos,
            }
          : latestVideo
          ? {
              videos: [
                {
                  id: latestVideo.id,
                  planId: String(planIdStr),
                  planName: latestVideo.planName || "Unnamed Plan",
                  videoUrl: latestVideo.videoUrl || null,
                  videoProviderId: latestVideo.videoProviderId || null,
                  videoStatus: latestVideo.videoStatus || null,
                  pagePlacement: latestVideo.pagePlacement || null,
                  pageIndex: latestVideo.pageIndex ?? null,
                  rawData: latestVideo,
                },
              ],
              latestVideo: {
                id: latestVideo.id,
                planId: String(planIdStr),
                planName: latestVideo.planName || "Unnamed Plan",
                videoUrl: latestVideo.videoUrl || null,
                videoProviderId: latestVideo.videoProviderId || null,
                videoStatus: latestVideo.videoStatus || null,
                pagePlacement: latestVideo.pagePlacement || null,
                pageIndex: latestVideo.pageIndex ?? null,
                rawData: latestVideo,
              },
              allVideos: [
                {
                  id: latestVideo.id,
                  planId: String(planIdStr),
                  planName: latestVideo.planName || "Unnamed Plan",
                  videoUrl: latestVideo.videoUrl || null,
                  videoProviderId: latestVideo.videoProviderId || null,
                  videoStatus: latestVideo.videoStatus || null,
                  pagePlacement: latestVideo.pagePlacement || null,
                  pageIndex: latestVideo.pageIndex ?? null,
                  rawData: latestVideo,
                },
              ],
            }
          : null;

      if (!result) {
        return null;
      }

      

      return result;
    } catch (error) {
      console.error(`❌ Error fetching videos for plan ${planIdStr}:`, error);
      return null;
    }
  }, []);

  // Process SWR data whenever clients or plans data arrives/updates
  useEffect(() => {
    // Wait until both SWR responses are available
    if (!clientsData || !plansData) return;

    let isMounted = true;

    const fetchPlans = async () => {
      setIsFetchingPlans(true);
      try {
        if (!clientsData.success || !Array.isArray(clientsData.data)) {
          throw new Error("Invalid clients data");
        }

        // Filter out clients with "Draft" status (use SWR cached data)
        const activeClients = clientsData.data.filter(
          (client: any) => (client.status || "").toLowerCase() !== "draft",
        );

        // Filter out plans with "Draft" status (use SWR cached data)
        const allPlans = (plansData?.data || []).filter(
          (plan: any) => (plan.status || "").toLowerCase() !== "draft",
        );

        // Match plans with clients by companyName/clientName
        const clientPlansMap = new Map<string, any[]>();
        allPlans.forEach((plan: any) => {
          const planClientName = plan.clientName || plan.companyName || "";
          if (planClientName) {
            if (!clientPlansMap.has(planClientName)) {
              clientPlansMap.set(planClientName, []);
            }
            clientPlansMap.get(planClientName)!.push(plan);
          }
        });
        

        // Format plans for dropdown (use active clients as base)
        // Store all plan IDs for each client to match videos correctly
        const clientToPlanIdsMap = new Map<string, string[]>();
        allPlans.forEach((plan: any) => {
          const planClientName = plan.clientName || plan.companyName || "";
          if (planClientName && plan.id) {
            if (!clientToPlanIdsMap.has(planClientName)) {
              clientToPlanIdsMap.set(planClientName, []);
            }
            clientToPlanIdsMap.get(planClientName)!.push(String(plan.id));
          }
        });

        // Also collect plan IDs from videos that might not be in allPlans
        const videoPlanIdsMap = new Map<string, string[]>();
        allPlans.forEach((plan: any) => {
          // Check both plan.video (singular) and plan.videos (plural)
          const videos = plan.videos || (plan.video ? [plan.video] : []);
          videos.forEach((video: any) => {
            if (video && video.planId) {
              const planClientName = plan.clientName || plan.companyName || "";
              if (planClientName) {
                if (!videoPlanIdsMap.has(planClientName)) {
                  videoPlanIdsMap.set(planClientName, []);
                }
                videoPlanIdsMap.get(planClientName)!.push(String(video.planId));
              }
            }
          });
        });

        // Merge both maps to get all plan IDs for each client
        clientToPlanIdsMap.forEach((planIds, clientName) => {
          const videoPlanIds = videoPlanIdsMap.get(clientName) || [];
          const allIds = Array.from(new Set([...planIds, ...videoPlanIds]));
          clientToPlanIdsMap.set(clientName, allIds);
        });

        // Add any video plan IDs that weren't in the original map
        videoPlanIdsMap.forEach((planIds, clientName) => {
          if (!clientToPlanIdsMap.has(clientName)) {
            clientToPlanIdsMap.set(clientName, planIds);
          }
        });

        

        const formattedPlans: PlanOption[] = activeClients
          .map((client: any) => {
            const clientPlans = clientPlansMap.get(client.companyName) || [];
            // Use the first plan's ID or client ID
            const planId = clientPlans[0]?.id || client.id || client.videoId;
            if (!planId) {
              return null;
            }

            // Get all plan IDs for this client
            const allPlanIdsForClient = clientToPlanIdsMap.get(
              client.companyName,
            ) || [String(planId)];

            return {
              id: String(planId), // Use first plan ID as the main ID for selection
              name: client.companyName || "Unnamed Plan",
              videoIds:
                clientPlans.length > 0
                  ? parseEducationalVideoIds(clientPlans[0].educationalVideos)
                  : [],
              // Store all plan IDs for this client to match videos
              allPlanIds: allPlanIdsForClient,
            };
          })
          .filter(Boolean);

        if (isMounted && formattedPlans.length > 0) {
          setPlanOptions(formattedPlans as PlanOption[]);
        }

        // Create a set of active client names for filtering
        const activeClientNames = new Set(
          activeClients.map((client: any) => client.companyName),
        );

        // Log all plans with their video status
        allPlans.forEach((plan: any) => {
          const videosCount = plan.videos?.length || 0;
          
        });

        // Fetch summary videos for all plans
        // Use plan.videos array to get ALL videos for each plan
        const videosData: PlanVideo[] = [];

        allPlans.forEach((plan: any) => {
          const planId = plan.id || plan.videoId;
          const planName =
            plan.clientName || plan.companyName || plan.title || "Unnamed Plan";

          if (!planId) {
            return;
          }

          // Use plan.videos array (plural) to get ALL videos for this plan
          const planVideos = plan.videos || [];

          if (planVideos.length === 0) {
            // Fallback: if no videos array, try plan.video (singular) for backward compatibility
            if (plan.video) {
              const videoData: PlanVideo = {
                id: plan.video.id, // Unique video ID from database
                planId: String(planId),
                planName,
                videoUrl: plan.video.videoUrl || null,
                videoProviderId: plan.video.videoProviderId || null,
                videoStatus: plan.video.videoStatus || null,
                pagePlacement: plan.video.pagePlacement || null,
                pageIndex: (plan.video as any).pageIndex ?? null,
                isChecking: false,
              };
              // ✅ Add ALL videos (even if they don't have videoUrl yet)
              videosData.push(videoData);
              
            }
            return;
          }

          // Process ALL videos from the videos array
          planVideos.forEach((video: any) => {
            const videoData: PlanVideo = {
              id: video.id, // Unique video ID from database
              planId: String(planId),
              planName,
              videoUrl: video.videoUrl || null,
              videoProviderId: video.videoProviderId || null,
              videoStatus: video.videoStatus || null,
              pagePlacement: video.pagePlacement || null,
              pageIndex: (video as any).pageIndex ?? null,
              isChecking: false,
            };

            // ✅ Add ALL videos (even if they don't have videoUrl yet - they might be in progress)
            // This ensures all videos from the API response are displayed
            videosData.push(videoData);
          });

          
        });

        
        

        if (isMounted) {
          setSummaryVideos(videosData);
        }
      } catch (error) {
        console.error("Failed to load plans for content library:", error);
      } finally {
        if (isMounted) {
          setIsFetchingPlans(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, [fetchVideoForPlan, clientsData, plansData]);

  // Update ref when summaryVideos changes
  useEffect(() => {
    summaryVideosRef.current = summaryVideos;
  }, [summaryVideos]);

  // Check videos that don't have videoUrl but have videoProviderId
  useEffect(() => {
    // Skip if selectedPlan hasn't changed
    if (prevSelectedPlanForCheckingRef.current === selectedPlan) {
      return;
    }
    prevSelectedPlanForCheckingRef.current = selectedPlan;

    // ✅ Skip checking when "all" is selected - videos are already loaded via get-list-plan
    if (selectedPlan === "all") {
      
      return;
    }

    const checkVideos = async () => {
      // Filter videos based on selected plan
      // Also check if video is already being checked using ref
      let videosToCheck = summaryVideosRef.current.filter((video) => {
        if (video.videoUrl || !video.videoProviderId) {
          return false;
        }

        // ✅ Always use video.id from database (required field)
        if (!video.id) {
          console.warn("⚠️ Video missing database ID, skipping:", video);
          return false;
        }

        const videoKey = video.id; // ✅ Use only database ID
        if (checkingVideosRef.current.has(videoKey)) {
          return false;
        }

        // Check if marked as checking in state
        if (video.isChecking) {
          return false;
        }

        return true;
      });

      // ✅ Only check videos for the selected plan (we already skip if "all")
      const selectedPlanOption = planOptions.find(
        (option) => option.id === selectedPlan,
      );
      const planIdsToMatch = selectedPlanOption?.allPlanIds || [selectedPlan];
      const planIdsToMatchStr = planIdsToMatch.map((id) => String(id));

      videosToCheck = videosToCheck.filter((video) => {
        const videoPlanIdStr = String(video.planId);
        return (
          planIdsToMatchStr.includes(videoPlanIdStr) ||
          String(selectedPlan) === videoPlanIdStr
        );
      });

      if (videosToCheck.length === 0) {
        return;
      }

      setIsCheckingVideos(true);

      // Check videos one by one (sequentially)
      for (const video of videosToCheck) {
        // ✅ Always use video.id from database (required field)
        if (!video.id) {
          console.warn("⚠️ Video missing database ID, skipping:", video);
          continue;
        }

        const videoKey = video.id; // ✅ Use only database ID

        // Skip if already checking
        if (checkingVideosRef.current.has(videoKey)) {
          continue;
        }

        // Add to checking set
        checkingVideosRef.current.add(videoKey);

        try {
          setSummaryVideos((prev) =>
            prev.map((v) => {
              // ✅ Use only database ID for comparison
              return v.id === videoKey ? { ...v, isChecking: true } : v;
            }),
          );

          
          const videoResult = await fetchVideoForPlan(video.planId);

          if (
            !videoResult ||
            !videoResult.videos ||
            videoResult.videos.length === 0
          ) {
            // Video not found or error
            checkingVideosRef.current.delete(videoKey);
            setSummaryVideos((prev) =>
              prev.map((v) => {
                // ✅ Use only database ID for comparison
                return v.id === videoKey ? { ...v, isChecking: false } : v;
              }),
            );
            return;
          }

          // ✅ Process ALL videos from the result
          const allVideosFromApi = videoResult.videos || [];

          // Update summaryVideos with all videos from API
          setSummaryVideos((prev) => {
            // ✅ Remove all existing videos for this plan first
            const planIdStr = String(video.planId);
            const filtered = prev.filter((v) => String(v.planId) !== planIdStr);

            // Add all videos from API for this plan
            const newVideos: PlanVideo[] = [];

            allVideosFromApi.forEach((apiVideo: any) => {
              const videoData: PlanVideo = {
                id: apiVideo.id,
                planId: video.planId,
                planName: video.planName,
                videoUrl: apiVideo.videoUrl || null,
                videoProviderId: apiVideo.videoProviderId || null,
                videoStatus: apiVideo.videoStatus || null,
                pagePlacement: apiVideo.pagePlacement || null,
                pageIndex: apiVideo.pageIndex ?? null,
                isChecking: false,
              };

              // Only add if it has videoProviderId or videoUrl
              if (videoData.videoProviderId || videoData.videoUrl) {
                newVideos.push(videoData);
              }
            });

            // Combine filtered (videos from other plans) with new videos (from this plan)
            const updated = [...filtered, ...newVideos];

            

            return updated;
          });

          // Remove from checking set after successful update
          checkingVideosRef.current.delete(videoKey);

          // Add delay between requests to avoid overwhelming the API
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(
            `Failed to check video for plan ${video.planId}:`,
            error,
          );
          // Remove from checking set on error
          checkingVideosRef.current.delete(videoKey);
          setSummaryVideos((prev) =>
            prev.map((v) => {
              // ✅ Use only database ID for comparison
              return v.id === videoKey ? { ...v, isChecking: false } : v;
            }),
          );
        }
      }

      setIsCheckingVideos(false);
    };

    // Delay to avoid too many requests at once
    const timeoutId = setTimeout(() => {
      checkVideos();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selectedPlan, planOptions, fetchVideoForPlan]);

  useEffect(() => {
    if (selectedPlan === "all") {
      return;
    }

    const exists = planOptions.some((plan) => plan.id === selectedPlan);
    if (!exists) {
      setSelectedPlan("all");
    }
  }, [planOptions, selectedPlan]);

  // Check video for selected plan when plan changes
  useEffect(() => {

    if (selectedPlan === "all") {
      return;
    }

    const checkSelectedPlanVideo = async () => {
      const selectedPlanOption = planOptions.find(
        (option) => option.id === selectedPlan,
      );

      if (!selectedPlanOption) {
        return;
      }

      // Get all plan IDs for the selected client
      const planIdsToCheck = selectedPlanOption.allPlanIds || [selectedPlan];

      

      // ✅ Collect ALL videos from ALL plan IDs first, then update state once
      const allNewVideos: PlanVideo[] = [];
      const planOption = planOptions.find((p) => p.id === selectedPlan);
      const planName = planOption?.name || "Unnamed Plan";

      // Check each plan ID for videos (using cached function)
      for (const planId of planIdsToCheck) {
        try {
          const videoResult = await fetchVideoForPlan(planId);

          if (
            !videoResult ||
            !videoResult.videos ||
            videoResult.videos.length === 0
          ) {
            continue;
          }

          // ✅ Process ALL videos from the result
          const allVideosFromApi = videoResult.videos || [];

          

          // Collect all videos from this plan
          // videoResult.videos already contains processed videos with all fields
          allVideosFromApi.forEach((processedVideo: any) => {
            const videoId = processedVideo.id;

            // Check if this video already exists in our collection
            const alreadyExists = allNewVideos.some(
              (v) => v.id && v.id === videoId,
            );

            if (alreadyExists) {
              
              return;
            }

            // Use processedVideo fields (they already have planId, planName, pagePlacement from fetchVideoForPlan)
            const videoData: PlanVideo = {
              id: videoId,
              planId: processedVideo.planId || String(planId),
              planName: processedVideo.planName || planName,
              videoUrl: processedVideo.videoUrl || null,
              videoProviderId: processedVideo.videoProviderId || null,
              videoStatus: processedVideo.videoStatus || null,
              pagePlacement: processedVideo.pagePlacement || null,
              pageIndex: processedVideo.pageIndex ?? null,
              isChecking: false,
            };

            // ✅ Add ALL videos (even if they don't have videoUrl yet - they might be in progress)
            // This ensures all videos from the API response are displayed
            allNewVideos.push(videoData);
            
          });
        } catch (error) {
          console.error(`❌ Error checking videos for plan ${planId}:`, error);
        }
      }

      // ✅ First, remove ALL videos for selected plan before adding new ones
      setSummaryVideos((prev) => {
        // Remove existing videos for these plans (to avoid duplicates)
        const planIdsToRemove = planIdsToCheck.map((pid) => String(pid));
        const filtered = prev.filter(
          (v) => !planIdsToRemove.includes(String(v.planId)),
        );

        

        // If we have new videos, add them; otherwise just return filtered (empty for this plan)
        if (allNewVideos.length > 0) {
          // Combine filtered (videos from other plans) with new videos (from selected plan)
          const updated = [...filtered, ...allNewVideos];

          

          return updated;
        } else {
          // No new videos, just return filtered (all videos for this plan removed)
          
          return filtered;
        }
      });
    };

    // Delay to avoid too many requests
    const timeoutId = setTimeout(() => {
      checkSelectedPlanVideo();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedPlan, planOptions, fetchVideoForPlan]);

  const filteredVideos = useMemo(() => {
    const matchesBaseFilters = (video: (typeof EDUCATIONAL_VIDEOS)[number]) =>
      video.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedType === "all" || video.category === selectedType);

    const videosByBaseFilters = EDUCATIONAL_VIDEOS.filter(matchesBaseFilters);

    if (selectedPlan === "all") {
      return videosByBaseFilters;
    }

    const plan = planOptions.find((option) => option.id === selectedPlan);
    const allowedIds = plan?.videoIds?.length
      ? plan.videoIds
      : PLAN_VIDEO_MAPPING[selectedPlan] || [];

    if (!allowedIds.length) {
      return videosByBaseFilters;
    }

    return videosByBaseFilters.filter((video) => allowedIds.includes(video.id));
  }, [planOptions, searchTerm, selectedPlan, selectedType]);

  return (
    <div className="p-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                All Videos
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                View and manage all available videos across all plans
              </p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-8">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search videos, files, or plans..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>

                {PLANS.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger
                className="w-48"
                aria-busy={isFetchingPlans ? "true" : undefined}
              >
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {planOptions.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
                {planOptions.length === 0 && (
                  <SelectItem value="__placeholder" disabled>
                    {isFetchingPlans
                      ? "Loading plans..."
                      : "No plans available"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Videos Section */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Summary Videos
              </p>
              <h3 className="text-xl font-semibold text-gray-900">
                Plan Summary Videos
              </h3>
            </div>
            {(() => {
              // Filter videos based on selected plan
              let filteredSummaryVideos: PlanVideo[];

              if (selectedPlan === "all") {
                filteredSummaryVideos = summaryVideos.filter((video) =>
                  video.planName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()),
                );
              } else {
                // Find the selected plan option to get all plan IDs for this client
                const selectedPlanOption = planOptions.find(
                  (option) => option.id === selectedPlan,
                );

                // If we have allPlanIds, match against all of them
                // Otherwise, match against the selected plan ID
                let planIdsToMatch = selectedPlanOption?.allPlanIds || [
                  selectedPlan,
                ];

                // Also try to find plan IDs by matching client name
                if (selectedPlanOption) {
                  const clientName = selectedPlanOption.name;
                  // Find all videos for this client name and get their plan IDs
                  const videosForClient = summaryVideos.filter(
                    (video) => video.planName === clientName,
                  );
                  const planIdsFromVideos = videosForClient.map(
                    (v) => v.planId,
                  );

                  // Merge with existing plan IDs
                  planIdsToMatch = Array.from(
                    new Set([...planIdsToMatch, ...planIdsFromVideos]),
                  );

                  
                }

                

                filteredSummaryVideos = summaryVideos.filter((video) => {
                  // ✅ Convert both to strings for reliable comparison
                  const videoPlanIdStr = String(video.planId);
                  const planIdsToMatchStr = planIdsToMatch.map((id) =>
                    String(id),
                  );

                  // Check if video's planId matches any of the plan IDs for the selected plan
                  const planIdMatches =
                    planIdsToMatchStr.includes(videoPlanIdStr);

                  // Also check if selectedPlan itself matches (for direct plan selection)
                  const directMatch = String(selectedPlan) === videoPlanIdStr;

                  const matches =
                    (planIdMatches || directMatch) &&
                    video.planName
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase());

                  if (!matches) {
                    
                  } else {
                    
                  }

                  return matches;
                });

                
              }

              if (filteredSummaryVideos.length === 0) {
                return (
                  <div className="w-full rounded-2xl border border-dashed bg-gray-50 py-10 text-center text-gray-500">
                    <p className="font-semibold text-gray-900">
                      No summary video generated
                    </p>
                    <p className="text-sm">
                      Generate one by uploading the Plan Summary or using the
                      Benefits Builder
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSummaryVideos.map((video) => {
                    

                    // Check if video URL is valid (starts with http/https)
                    const hasValidVideoUrl =
                      video.videoUrl &&
                      typeof video.videoUrl === "string" &&
                      (video.videoUrl.startsWith("http://") ||
                        video.videoUrl.startsWith("https://"));

                    const handleDelete = async () => {
                      // ✅ Always use database ID (MongoDB ObjectId)
                      const videoDbId = video.id;

                      if (!videoDbId) {
                        console.error(
                          "❌ Cannot delete video: missing database ID",
                          {
                            video,
                            videoProviderId: video.videoProviderId,
                          },
                        );
                        alert(
                          "Cannot delete video: missing ID. Please refresh the page.",
                        );
                        return;
                      }

                      

                      if (
                        !confirm(
                          `Are you sure you want to delete this video for ${video.planName}?`,
                        )
                      ) {
                        return;
                      }

                      try {
                        // ✅ Use database ID (MongoDB ObjectId) for deletion
                        const response = await fetch(
                          `/api/videos?id=${encodeURIComponent(videoDbId)}`,
                          {
                            method: "DELETE",
                          },
                        );

                        const responseData = await response.json();

                        if (!response.ok) {
                          console.error("❌ Delete failed:", {
                            status: response.status,
                            error: responseData.error,
                            videoDbId,
                          });
                          throw new Error(
                            responseData.error || "Failed to delete video",
                          );
                        }

                        

                        // Remove video from state using database ID
                        setSummaryVideos((prev) =>
                          prev.filter((v) => v.id !== videoDbId),
                        );
                      } catch (error: any) {
                        console.error("❌ Error deleting video:", {
                          error,
                          videoDbId,
                          message: error?.message,
                        });
                        alert(
                          `Failed to delete video: ${
                            error?.message || "Unknown error"
                          }. Please try again.`,
                        );
                      }
                    };

                    const handlePlacementChange = async (
                      placement: string | null,
                    ) => {
                      if (!video.id) {
                        console.error("Cannot update placement: no ID");
                        return;
                      }

                      try {
                        // Calculate new pageIndex: find max index for this placement and add 1
                        // If placement is null, set index to null as well
                        let newPageIndex: number | null = null;
                        if (placement) {
                          const videosWithSamePlacement = summaryVideos.filter(
                            (v) =>
                              v.pagePlacement === placement &&
                              v.id !== video.id &&
                              v.pageIndex !== null &&
                              v.pageIndex !== undefined,
                          );
                          const maxIndex =
                            videosWithSamePlacement.length > 0
                              ? Math.max(
                                  ...videosWithSamePlacement.map(
                                    (v) => v.pageIndex || 0,
                                  ),
                                )
                              : -1;
                          newPageIndex = maxIndex + 1;
                        }

                        // Update both placement and index
                        const [placementResponse, indexResponse] =
                          await Promise.all([
                            fetch(`/api/videos/modify-video`, {
                              method: "PATCH",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                videoId: video.id,
                                pagePlacement: placement,
                                planId: video.planId, // ✅ Pass planId from frontend
                              }),
                            }),
                            fetch(`/api/videos/update-page-index`, {
                              method: "PATCH",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                videoId: video.id,
                                pageIndex: newPageIndex,
                                planId: video.planId, // ✅ Pass planId from frontend
                              }),
                            }),
                          ]);

                        if (!placementResponse.ok) {
                          throw new Error("Failed to update placement");
                        }

                        if (!indexResponse.ok) {
                          throw new Error("Failed to update page index");
                        }

                        // Update video in state
                        setSummaryVideos((prev) =>
                          prev.map((v) =>
                            v.id === video.id
                              ? {
                                  ...v,
                                  pagePlacement: placement,
                                  pageIndex: newPageIndex,
                                }
                              : v,
                          ),
                        );

                        
                      } catch (error) {
                        console.error("Error updating placement:", error);
                        alert("Failed to update placement. Please try again.");
                      }
                    };

                    return (
                      <div
                        key={video.id} // ✅ Always use database ID as key
                        className="relative overflow-hidden rounded-3xl border bg-card shadow-sm"
                      >
                        {/* Menu button in top right corner */}
                        <div className="absolute right-2 top-2 z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>
                                Place on Page
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  handlePlacementChange("retirement")
                                }
                              >
                                Retirement
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handlePlacementChange("health-insurance")
                                }
                              >
                                Health Insurance
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handlePlacementChange("life-insurance")
                                }
                              >
                                Life Insurance
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handlePlacementChange("wellness-programs")
                                }
                              >
                                Wellness Programs
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePlacementChange(null)}
                              >
                                Remove from Pages
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={handleDelete}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Video
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="relative aspect-video w-full bg-gray-100">
                          {hasValidVideoUrl ? (
                            <iframe
                              src={video.videoUrl || ""}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title={`Video for ${video.planName}`}
                              onError={(e) => {
                                console.error(
                                  `❌ Error loading iframe for plan ${video.planId}:`,
                                  e,
                                );
                              }}
                              onLoad={() => {
                                
                              }}
                            />
                          ) : video.isChecking ? (
                            <div className="flex h-full items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center bg-gray-50 p-4 text-center">
                              <p className="text-sm font-medium text-gray-900">
                                {video.planName}
                              </p>
                              <p className="mt-2 text-xs text-gray-500">
                                {video.videoStatus === "completed"
                                  ? "Video is ready, loading..."
                                  : "Video is not available yet"}
                              </p>
                              {video.videoStatus && (
                                <p className="mt-1 text-xs text-gray-400">
                                  Status: {video.videoStatus}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="border-t px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">
                            {video.planName}
                          </p>
                          {hasValidVideoUrl && (
                            <p className="mt-1 text-xs text-gray-500">
                              Summary Video
                            </p>
                          )}
                          {video.videoStatus && (
                            <p className="mt-1 text-xs text-gray-400">
                              {video.videoStatus === "completed"
                                ? "✓ Completed"
                                : `Status: ${video.videoStatus}`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Educational content
              </p>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Available videos
              </h3>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="overflow-hidden rounded-3xl border bg-card shadow-sm"
                >
                  <div className="relative aspect-video w-full bg-gray-100">
                    <img
                      src={video.image}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="border-t px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {video.title}
                    </p>
                  </div>
                </div>
              ))}

              {filteredVideos.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed bg-gray-50 py-10 text-center text-sm text-gray-500">
                  No videos match your search.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
