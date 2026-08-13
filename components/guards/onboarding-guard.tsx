"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const router = useRouter();

  // React StrictMode (dev) runs mount effects twice; guard against firing the
  // onboarding-status request twice on a single mount.
  const statusCheckedRef = useRef(false);

  useEffect(() => {
    if (statusCheckedRef.current) return;
    statusCheckedRef.current = true;

    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch(
          "/api/onboarding-wizard/onboarding-status",
        );
        const data = await response.json();

        if (data.completed) {
          setIsOnboardingComplete(true);
        } else {
          // Redirect to onboarding if not completed
          router.push("/new/onboarding");
        }
      } catch (error) {
        console.error(
          "OnboardingGuard: Error checking onboarding status:",
          error,
        );
        // On error, redirect to onboarding to be safe
        router.push("/new/onboarding");
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isOnboardingComplete) {
    return null; // Will redirect to onboarding
  }

  return <>{children}</>;
}
