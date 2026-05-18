"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { signOut, useSession } from "next-auth/react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, LayoutDashboard, FileText, LogOut, Bell, AlertTriangle, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNameMonogram } from "@/lib/name-monogram";

export function UserNav() {
  const { data: session } = useSession();
  const { stepData, loadStepData } = useOnboardingWizardStore();
  const [isLoading, setIsLoading] = useState(true);

  // Load only user-related data (branding and userSetup) - only once on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadStepData("branding"), loadStepData("userSetup")]);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only load once on mount

  // R2 keys are stored as "org/…"; raw <img src> on /new/… pages resolves to /new/org/… → 404.
  const rawUserImage =
    stepData.branding?.aiAvatar ||
    stepData.userSetup?.headshotData?.avatar?.["64"] ||
    stepData.userSetup?.headshotData?.circle?.["400"] ||
    stepData.userSetup?.headshotData?.square?.["400"] ||
    stepData.userSetup?.headshot ||
    session?.user?.image ||
    "";

  const { url: resolvedUserImage } = useBrandingImageUrl(
    rawUserImage !== "" ? rawUserImage : null,
  );
  const userImage =
    resolvedUserImage ??
    (rawUserImage !== "" && !isR2BrandingKey(rawUserImage)
      ? rawUserImage
      : "");

  // Get user name from wizard data with fallback to session
  const userName = stepData.userSetup?.name || session?.user?.name || "";
  const userEmail = stepData.userSetup?.email || session?.user?.email || "";
  const userTitle = stepData.userSetup?.title || "";

  if (session) {
    // Show skeleton while loading
    if (isLoading) {
      return (
        <div className="relative flex items-center gap-3 h-12 px-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex flex-col items-start gap-1">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative flex items-center gap-3 h-12 px-3 rounded-lg hover:bg-gray-100"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={userImage} alt={userName} />
              <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                {getNameMonogram(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{userName}</span>
              {userTitle && (
                <span className="text-xs text-muted-foreground">
                  {userTitle}
                </span>
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/signin" })}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
}
