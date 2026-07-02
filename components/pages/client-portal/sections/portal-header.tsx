"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, Calendar, Info, Pencil, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

      {/* Header */}
      <header className="bg-white px-4 py-2 sm:py-4 shadow-md transition-all duration-300 sm:px-6 lg:px-20">
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
                  style={{ maxHeight: `min(${headerHeight}px, 48px)` }}
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
                    style={{ maxHeight: `min(${headerHeight}px, 48px)` }}
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

          {/* Mobile hamburger button */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          {/* Desktop Navigation */}
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

      {/* Mobile side nav drawer with animation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[200] md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-[280px] bg-white shadow-2xl flex flex-col"
            >
            {/* Drawer header — logo removed, compact */}
            <div className="flex items-center justify-end px-4 py-1.5 border-b min-h-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer navigation links — tighter spacing */}
            <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
              {/* Home */}
              <Link
                href={baseUrl}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === baseUrl || (pathname && !isActive("/retirement") && !isActive("/health-insurance") && !isActive("/life-insurance") && !isActive("/wellness-programs") && !isActive("/news-events") && !isActive("/my-benefits-team"))
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                style={
                  pathname === baseUrl || (pathname && !isActive("/retirement") && !isActive("/health-insurance") && !isActive("/life-insurance") && !isActive("/wellness-programs") && !isActive("/news-events") && !isActive("/my-benefits-team"))
                    ? { backgroundColor: brandColor }
                    : undefined
                }
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Home
              </Link>

              {/* Your Benefits sub-links */}
              {benefitsNavItems.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600">
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Your Benefits
                  </div>
                  <div className="ml-4 space-y-0.5 border-l border-gray-200 pl-3">
                    {benefitsNavItems.map((item) => (
                      <Link
                        key={item.path}
                        href={`${baseUrl}${item.path}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive(item.path)
                            ? "text-white font-medium"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                        style={
                          isActive(item.path)
                            ? { backgroundColor: brandColor }
                            : undefined
                        }
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* News & Events */}
              <Link
                href={`${baseUrl}/news-events`}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive("/news-events")
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                style={
                  isActive("/news-events")
                    ? { backgroundColor: brandColor }
                    : undefined
                }
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                News & Events
              </Link>

              {/* My Benefits Team */}
              <Link
                href={`${baseUrl}/my-benefits-team`}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive("/my-benefits-team")
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                style={
                  isActive("/my-benefits-team")
                    ? { backgroundColor: brandColor }
                    : undefined
                }
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                My Benefits Team
              </Link>
            </nav>

            {/* Drawer footer close button — compact */}
            <div className="px-4 py-2.5 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>
  );
}
