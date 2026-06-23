"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, Calendar, Info, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getCategoryPortalVisibility } from "@/lib/portal-category-visibility";
import { BrandingImage } from "@/components/ui/branding-image";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";

/** Nav label -> visibility key in categoryPortalVisibility */
const BENEFITS_NAV_TO_VISIBILITY_KEY: Record<string, string> = {
  Retirement: "Retirement",
  "Health Insurance": "Group Health",
  "Life Insurance": "Group Life",
  "Wellness Programs": "Other",
};

/** Nav label -> benefit id in employeePortalPreview.benefits (Step 5) */
const BENEFITS_NAV_TO_BENEFIT_ID: Record<string, string> = {
  Retirement: "retirement",
  "Health Insurance": "health",
  "Life Insurance": "life",
  "Wellness Programs": "wellness",
};

interface PortalHeaderProps {
  companyData?: {
    companyLogo?: string;
  };
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  enableNavigation?: boolean;
  showAlertBanner?: boolean;
  enableLogoHover?: boolean;
  onLogoClick?: () => void;
  /** Per-category show/hide in portal; keys: Retirement, Group Life, Group Health, Other */
  categoryPortalVisibility?: Record<string, boolean> | null;
  /** Benefits from Step 5 (employeePortalPreview.benefits); if a benefit has isEnabled: false, its nav item is hidden */
  benefits?: { id?: string; isEnabled?: boolean }[] | null;
}

export function PortalHeader({
  companyData,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  clientId,
  enableNavigation = true,
  showAlertBanner = true,
  enableLogoHover = false,
  onLogoClick,
  categoryPortalVisibility: categoryPortalVisibilityRaw,
  benefits: benefitsFromStep5,
}: PortalHeaderProps) {
  const visibility = getCategoryPortalVisibility(categoryPortalVisibilityRaw);
  const benefitsNavItems: { label: string; path: string }[] = [
    { label: "Retirement", path: "/retirement" },
    { label: "Health Insurance", path: "/health-insurance" },
    { label: "Life Insurance", path: "/life-insurance" },
    { label: "Wellness Programs", path: "/wellness-programs" },
  ].filter((item) => {
    if (visibility[BENEFITS_NAV_TO_VISIBILITY_KEY[item.label]] === false) return false;
    const benefitId = BENEFITS_NAV_TO_BENEFIT_ID[item.label];
    if (benefitId && Array.isArray(benefitsFromStep5) && benefitsFromStep5.length > 0) {
      const benefit = benefitsFromStep5.find((b) => (b.id || "") === benefitId);
      if (benefit && benefit.isEnabled === false) return false;
    }
    return true;
  });
  const [showBanner, setShowBanner] = useState(showAlertBanner);
  const [headerHeight, setHeaderHeight] = useState(140);
  const [showTallTip, setShowTallTip] = useState(false);
  const [isBenefitsOpen, setIsBenefitsOpen] = useState(false);
  const [isTeamHovered, setIsTeamHovered] = useState(false);
  const [isNewsEventsHovered, setIsNewsEventsHovered] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const pathname = usePathname();
  const { url: resolvedLogoUrl } = useBrandingImageUrl(companyData?.companyLogo ?? null);

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const newsEventsHoverTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const logoHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isActive = (path: string) => pathname?.includes(path);
  const baseUrl = clientId ? `/new/view/${clientId}` : "";
  const isBenefitsActive = () =>
    [
      "/retirement",
      "/health-insurance",
      "/life-insurance",
      "/wellness-programs",
    ].some((path) => isActive(path));

  // Sync showBanner with showAlertBanner prop
  useEffect(() => {
    setShowBanner(showAlertBanner);
  }, [showAlertBanner]);

  useEffect(() => {
    const raw = companyData?.companyLogo ?? null;
    if (!raw) return;
    // Never assign raw org/… keys to Image() — resolves as /new/org/… and 404s.
    const isR2 = toR2BrandingKey(raw) != null;
    const src = isR2 ? resolvedLogoUrl : (resolvedLogoUrl ?? raw);
    if (!src) return;

    const img = new Image();
    img.src = src;

    img.onload = () => {
      const ar = img.width / img.height;

      if (ar >= 1.4) setHeaderHeight(76);
      else if (ar >= 1.0 && ar < 1.4) setHeaderHeight(83);
      else if (ar >= 0.85 && ar < 1.0) setHeaderHeight(90);
      else {
        setHeaderHeight(98);
        setShowTallTip(true);
      }
    };
  }, [companyData?.companyLogo, resolvedLogoUrl]);

  const handleBenefitsMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsBenefitsOpen(true);
  };

  const handleBenefitsMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsBenefitsOpen(false);
    }, 250);
  };
  const handleTeamMouseEnter = () => {
    if (teamHoverTimeoutRef.current) {
      clearTimeout(teamHoverTimeoutRef.current);
      teamHoverTimeoutRef.current = null;
    }
    setIsTeamHovered(true);
  };

  const handleTeamMouseLeave = () => {
    teamHoverTimeoutRef.current = setTimeout(() => {
      setIsTeamHovered(false);
    }, 250);
  };

  const handleNewsEventsMouseEnter = () => {
    if (newsEventsHoverTimeoutRef.current) {
      clearTimeout(newsEventsHoverTimeoutRef.current);
      newsEventsHoverTimeoutRef.current = null;
    }
    setIsNewsEventsHovered(true);
  };

  const handleNewsEventsMouseLeave = () => {
    newsEventsHoverTimeoutRef.current = setTimeout(() => {
      setIsNewsEventsHovered(false);
    }, 250);
  };

  const handleLogoMouseEnter = () => {
    if (logoHoverTimeoutRef.current) {
      clearTimeout(logoHoverTimeoutRef.current);
      logoHoverTimeoutRef.current = null;
    }
    if (enableLogoHover) {
      setIsLogoHovered(true);
    }
  };

  const handleLogoMouseLeave = () => {
    if (enableLogoHover) {
      logoHoverTimeoutRef.current = setTimeout(() => {
        setIsLogoHovered(false);
      }, 250);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    
    if (enableLogoHover && onLogoClick) {
      e.preventDefault();
      e.stopPropagation();
      onLogoClick();
    }
  };

  return (
    <>
      {/* Top Banner */}
      {showAlertBanner && showBanner && (
        <div
          className="relative px-4 py-3 text-center text-white"
          style={{ background: brandColor }}
        >
          <span className="font-medium">Enrollment has ended</span>
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transform rounded-full p-1 transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-md transition-all duration-300 sm:px-6 lg:px-20">
        <div className="flex h-full items-center justify-between">
          {/* Logo */}
          {enableNavigation ? (
            <Link
              href={baseUrl}
              className="flex h-full items-center gap-4 overflow-hidden"
            >
              {companyData?.companyLogo && (
                <BrandingImage
                  src={companyData.companyLogo}
                  alt="Company Logo"
                  className="object-contain"
                  style={{ maxHeight: `${headerHeight}px` }}
                />
              )}
            </Link>
          ) : (
            <div
              className={`relative flex h-full items-center gap-4 ${
                enableLogoHover ? "cursor-pointer" : "cursor-default"
              }`}
              onClick={handleLogoClick}
              onMouseEnter={handleLogoMouseEnter}
              onMouseLeave={handleLogoMouseLeave}
            >
              {companyData?.companyLogo && (
                <>
                  <BrandingImage
                    src={companyData.companyLogo}
                    alt="Company Logo"
                    className={`object-contain transition-all ${
                      isLogoHovered ? "ring-2 border-1 border-blue-500/50" : ""
                    }`}
                    style={{ maxHeight: `${headerHeight}px` }}
                  />
                  {enableLogoHover && isLogoHovered && (
                    <div className="absolute top-[-6px] left-[-6px] z-20 bg-blue-500 rounded-full p-1.5 shadow-lg">
                      <Pencil
                        className="w-3 h-3 text-white"
                        strokeWidth={2.5}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            {/* Your Benefits dropdown: only show when at least one category is visible */}
            {benefitsNavItems.length > 0 && (
              <div
                className="relative"
                onMouseEnter={handleBenefitsMouseEnter}
                onMouseLeave={handleBenefitsMouseLeave}
              >
                <DropdownMenu
                  open={isBenefitsOpen}
                  onOpenChange={(open) => {
                    setIsBenefitsOpen(open);
                    if (!open && hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`font-medium transition-colors duration-200 ${
                        isBenefitsActive()
                          ? "text-gray-900"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                      style={
                        isBenefitsOpen
                          ? { background: brandColor, color: "#fff" }
                          : undefined
                      }
                    >
                      Your Benefits <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 animate-in fade-in-0 zoom-in-95 duration-200"
                  >
                    {enableNavigation ? (
                      <>
                        {benefitsNavItems.map((item) => (
                          <Link key={item.path} href={`${baseUrl}${item.path}`}>
                            <DropdownMenuItem>{item.label}</DropdownMenuItem>
                          </Link>
                        ))}
                      </>
                    ) : (
                      <>
                        {benefitsNavItems.map((item) => (
                          <DropdownMenuItem
                            key={item.path}
                            onClick={(e) => e.preventDefault()}
                            className="cursor-default"
                          >
                            {item.label}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div
              className="relative"
              onMouseEnter={handleNewsEventsMouseEnter}
              onMouseLeave={handleNewsEventsMouseLeave}
            >
              {enableNavigation ? (
                <Link href={`${baseUrl}/news-events`}>
                  <Button
                    variant="ghost"
                    className={`font-medium transition-colors duration-200 ${
                      isActive("/news-events")
                        ? ""
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                    style={
                      isActive("/news-events") || isNewsEventsHovered
                        ? {
                            background: brandColor,
                            color: "white",
                          }
                        : undefined
                    }
                  >
                    News & Events
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  className={`font-medium transition-colors duration-200 cursor-default ${
                    isActive("/news-events")
                      ? ""
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                  style={
                    isActive("/news-events") || isNewsEventsHovered
                      ? {
                          background: brandColor,
                          color: "white",
                        }
                      : undefined
                  }
                  onClick={(e) => e.preventDefault()}
                >
                  News & Events
                </Button>
              )}
            </div>

            <div
              className="relative"
              onMouseEnter={handleTeamMouseEnter}
              onMouseLeave={handleTeamMouseLeave}
            >
              {enableNavigation ? (
                <Link href={`${baseUrl}/my-benefits-team`}>
                  <Button
                    variant="ghost"
                    className={`font-medium transition-colors duration-200 ${
                      isActive("/my-benefits-team")
                        ? ""
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                    style={
                      isActive("/my-benefits-team") || isTeamHovered
                        ? {
                            background: brandColor,
                            color: "white",
                          }
                        : undefined
                    }
                  >
                    My Benefits Team
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  className={`font-medium transition-colors duration-200 cursor-default ${
                    isActive("/my-benefits-team")
                      ? ""
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                  style={
                    isActive("/my-benefits-team") || isTeamHovered
                      ? {
                          background: brandColor,
                          color: "white",
                        }
                      : undefined
                  }
                  onClick={(e) => e.preventDefault()}
                >
                  My Benefits Team
                </Button>
              )}
            </div>
          </nav>
        </div>

        {/* Optional tip for tall logos */}
        {showTallTip && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Info className="mr-1 h-4 w-4" />
            Stacked marks can appear cramped in headers. Consider a horizontal
            version.
          </div>
        )}
      </header>
    </>
  );
}
