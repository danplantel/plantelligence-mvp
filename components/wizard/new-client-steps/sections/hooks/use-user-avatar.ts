import { useState, useEffect } from "react";
import axios from "axios";

export function useUserAvatar() {
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);

  useEffect(() => {
    const fetchUserAvatar = async () => {
      setIsLoadingAvatar(true);
      try {
        const response = await axios.get("/api/profile");
        const profile = response.data;

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
        setIsLoadingAvatar(false);
      }
    };

    fetchUserAvatar();
  }, []);

  return {
    userAvatar,
    isLoadingAvatar,
  };
}

