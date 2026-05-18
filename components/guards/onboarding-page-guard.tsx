"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface OnboardingPageGuardProps {
  children: React.ReactNode;
}

export function OnboardingPageGuard({ children }: OnboardingPageGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch(
          "/api/onboarding-wizard/onboarding-status",
        );
        const data = await response.json();

        if (data.completed) {
          router.push("/new/dashboard");
        } else {
          // Add a small delay to ensure the page is ready
          setTimeout(() => {
            setShouldShowOnboarding(true);
          }, 100);
        }
      } catch (error) {
        console.error(
          "OnboardingPageGuard: Error checking onboarding status:",
          error,
        );
        // On error, show onboarding page to be safe
        setTimeout(() => {
          setShouldShowOnboarding(true);
        }, 100);
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

  if (!shouldShowOnboarding) {
    return null; // Will redirect to dashboard
  }

  return <>{children}</>;
}
