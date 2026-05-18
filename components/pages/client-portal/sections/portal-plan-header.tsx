"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { toR2BrandingKey } from "@/lib/branding-image-url";

interface PortalPlanHeaderProps {
  companyData?: {
    companyLogo?: string;
  };
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  appointmentLink?: string | null;
}

const navigationConfig = [
  { label: "401(k) Plan Materials", path: "/401k-plan-materials" },
  { label: "Financial Planning", path: "/financial-planning" },
  { label: "Rollovers & Distributions", path: "/rollovers-distributions" },
  { label: "Meetings & Announcements", path: "/meetings-announcements" },
];

export function PortalPlanHeader({
  companyData,
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  clientId,
  appointmentLink,
}: PortalPlanHeaderProps) {
  const pathname = usePathname();
  const [headerHeight, setHeaderHeight] = useState(120);
  const { url: resolvedLogoUrl } = useBrandingImageUrl(companyData?.companyLogo ?? null);

  const baseUrl = clientId ? `/new/view/${clientId}` : "";

  const navLinks = useMemo(
    () =>
      navigationConfig.map((item) => ({
        ...item,
        href: `${baseUrl}${item.path}`,
      })),
    [baseUrl],
  );

  useEffect(() => {
    const raw = companyData?.companyLogo ?? null;
    if (!raw) return;
    const isR2 = toR2BrandingKey(raw) != null;
    const src = isR2 ? resolvedLogoUrl : (resolvedLogoUrl ?? raw);
    if (!src) return;

    const img = new Image();
    img.src = src;
    img.onload = () => {
      const aspectRatio = img.width / img.height;

      if (aspectRatio >= 1.4) setHeaderHeight(96);
      else if (aspectRatio >= 1.0) setHeaderHeight(108);
      else if (aspectRatio >= 0.85) setHeaderHeight(120);
      else setHeaderHeight(136);
    };
  }, [companyData?.companyLogo, resolvedLogoUrl]);

  const isActive = (href: string) => pathname === href;

  const handleAppointmentClick = () => {
    const url =
      appointmentLink?.trim() || "https://go.oncehub.com/WFAParticipantInquiry";
    window.open(url, "_blank");
  };

  const getNavLinkStyle = (href: string) =>
    !isActive(href) ? { color: secondaryColor } : undefined;

  return (
    <header className="bg-white px-4 py-3 shadow-sm transition-all duration-300 sm:px-6 lg:px-20">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={baseUrl || "#"}
          className="flex items-center gap-4 overflow-hidden"
        >
          {companyData?.companyLogo && (
            <BrandingImage
              src={companyData.companyLogo}
              alt="Company logo"
              className="object-contain"
              style={{ maxHeight: `${headerHeight}px` }}
            />
          )}
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                isActive(link.href)
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              )}
              style={getNavLinkStyle(link.href)}
            >
              {link.label}
            </Link>
          ))}
          <Button
            style={{ background: brandColor }}
            className="text-white"
            onClick={handleAppointmentClick}
          >
            Schedule Appointment
          </Button>
        </nav>

        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[18rem] sm:w-[22rem]">
            <div className="mt-10 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-base font-medium transition-colors duration-200",
                    isActive(link.href)
                      ? "text-gray-900"
                      : "text-gray-600 hover:text-gray-900",
                  )}
                  style={getNavLinkStyle(link.href)}
                >
                  {link.label}
                </Link>
              ))}
              <Button
                className="mt-4"
                style={{ background: brandColor, color: "#fff" }}
                onClick={handleAppointmentClick}
              >
                Book Appointment
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
