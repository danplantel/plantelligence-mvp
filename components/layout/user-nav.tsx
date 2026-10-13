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
import {
  fetchHeaderProfileOnce,
  type HeaderProfile,
} from "@/lib/fetch-header-profile";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, LayoutDashboard, FileText, LogOut, Bell, AlertTriangle, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNameMonogram } from "@/lib/name-monogram";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { clearAllPlanSelections } from "@/lib/plan-selector-storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function UserNav({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    // Clear all persisted plan selections so the user starts fresh on next login
    clearAllPlanSelections();
    setIsLoggingOut(true);
    // Keep the loading overlay visible for at least 2 seconds
    // so the user clearly sees "Logging out" before redirect
    setTimeout(() => {
      signOut({ callbackUrl: "/signin" });
    }, 2000);
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  // The header needs a name, an email, a title and an avatar. It reads them from
  // the slim /api/profile/header payload instead of GET /api/profile, which
  // carries the wizard sessions and branding JSON and took seconds on every
  // dashboard page. fetchHeaderProfileOnce caches the payload, so navigating
  // between dashboard pages no longer re-requests it.
  const [headerProfile, setHeaderProfile] = useState<HeaderProfile | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchHeaderProfileOnce();
      if (!cancelled) {
        if (data) setHeaderProfile(data);
        setIsLoading(false);
      }
    };
    void loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only load once on mount

  // Prefer the presigned URL; if it is missing or fails to render — presigned
  // URLs are documented to fail in <img> for some bucket setups — drop to the
  // same-origin proxy so the avatar never disappears.
  const preferredAvatar =
    headerProfile?.avatarUrl || headerProfile?.avatarFallbackUrl || "";
  const [avatarSrc, setAvatarSrc] = useState("");
  useEffect(() => {
    setAvatarSrc(preferredAvatar);
  }, [preferredAvatar]);

  const handleAvatarError = () => {
    const fallback = headerProfile?.avatarFallbackUrl;
    if (fallback && avatarSrc !== fallback) setAvatarSrc(fallback);
  };

  // Session values keep the header rendering if the payload fails.
  const userImage = avatarSrc || session?.user?.image || "";
  const userName = headerProfile?.name || session?.user?.name || "";
  const userEmail = headerProfile?.email || session?.user?.email || "";
  const userTitle = headerProfile?.title || "";
  // The role badge above the name. Optional on purpose (see `HeaderProfile.roleLabel`): a failed
  // lookup, or a payload from an older build of the route, omits the row rather than drawing an
  // empty pill.
  const userRole = headerProfile?.roleLabel || "";

  if (session) {
    // Show skeleton while loading
    if (isLoading) {
      return (
        <div className="relative flex items-center gap-3 h-12 px-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex flex-col items-start gap-1">
            {/* Three rows, matching the real control, so the header does not grow when the
                payload lands — the role badge is why there is a third one. */}
            <div className="h-3 w-16 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                // The badge is a third row, which is why the name and title step down a size —
                // together they still fit the control's own height. `group` lets the badge
                // restyle itself on hover: the trigger's hover paints accent-blue, which is
                // exactly the badge's resting colour.
                "group relative flex items-center gap-3 h-12 rounded-lg hover:bg-accent-blue hover:text-white min-w-0",
                compact ? "shrink-0 px-2" : "px-3",
              )}
            >
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage
                  src={userImage}
                  alt={userName}
                  onError={handleAvatarError}
                />
                <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                  {getNameMonogram(userName)}
                </AvatarFallback>
              </Avatar>
              {!compact && (
                <div className="flex flex-col items-start min-w-0">
                  {/* The role, ABOVE the name: the one line that says what this account IS rather
                      than who they are. Deliberately tiny (`text-[9px]`) and shrink-wrapped —
                      it is a label, so the name below stays the loudest thing in the control.
                      `group-hover:bg-white/25` keeps it readable when the trigger turns
                      accent-blue on hover; without it the pill would be accent-on-accent and
                      vanish exactly when the pointer is over it. */}
                  {userRole && (
                    <span
                      className="mb-0.5 w-fit max-w-[200px] truncate rounded-full bg-accent-blue px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-3 tracking-wide text-white group-hover:bg-white/25"
                      title={userRole}
                    >
                      {userRole}
                    </span>
                  )}
                  <span
                    className="text-xs font-medium truncate max-w-[200px]"
                    title={userName}
                  >
                    {userName}
                  </span>
                  {userTitle && (
                    <span
                      className="text-[10px] truncate max-w-[200px]"
                      title={userTitle}
                    >
                      {userTitle}
                    </span>
                  )}
                </div>
              )}
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
            <DropdownMenuItem onClick={handleLogoutClick}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Logout confirmation dialog */}
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be redirected to the sign-in page. Any unsaved changes may be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
              <AlertDialogCancel className="flex-1 m-0" onClick={handleLogoutCancel}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogoutConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
              >
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <LoadingOverlay isLoading={isLoggingOut} message="Logging out" hideLogo className="[&>div]:scale-150" />
      </>
    );
  }

  return null;
}
