import { useState, useEffect } from "react";
import { fetchProfileOnce } from "@/lib/fetch-profile";

export function useUserAvatar() {
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchUserAvatar = async () => {
      setIsLoadingAvatar(true);
      try {
        // Reuse the single-flight, TTL-cached profile fetcher so this hook does
        // NOT fire a redundant GET /api/profile when Step 2 mounts — the page
        // already fetched the profile via SWR on mount. The previous raw axios
        // call here bypassed that cache and re-hit the slow /api/profile route
        // (~2.7s), which made the step-1 → step-2 transition feel slow.
        const profile = await fetchProfileOnce();
        if (cancelled || !profile) return;

        if (profile?.wizardSessions?.[0]?.userSetup) {
          const userSetup = profile.wizardSessions[0].userSetup;
          const avatar =
            userSetup?.headshotData?.circle?.["400"] ||
            userSetup?.headshotData?.square?.["400"] ||
            userSetup?.headshot ||
            null;

          setUserAvatar(avatar);
        }
      } catch (error) {
        console.error("Failed to fetch user avatar:", error);
      } finally {
        if (!cancelled) setIsLoadingAvatar(false);
      }
    };

    fetchUserAvatar();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    userAvatar,
    isLoadingAvatar,
  };
}
