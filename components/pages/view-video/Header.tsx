"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const { theme = "system" } = useTheme();
  const [themeMode, setThemeMode] = useState("");
  const { id } = useParams();
  const pathname = usePathname();

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  const navigationLinks = [
    { href: `/view/${id}/401k-plan-materials`, label: "Plan Materials" },
    { href: `/view/${id}/financial-planning`, label: "Financial Planning" },
    {
      href: `/view/${id}/rollovers-distributions`,
      label: "Rollovers & Distributions",
    },
    {
      href: `/view/${id}/meetings-announcements`,
      label: "Meetings & Announcements",
    },
  ];

  return (
    <div className="fixed top-0 px-4 md:px-8 mx-auto bg-[#fbfbfb] dark:bg-[#121212] left-0 right-0 z-20 border-b h-auto md:h-[64px] pt-[16px] md:pt-1">
      <nav className="flex items-start md:items-center md:justify-between mx-4 md:mx-0 h-14 gap-[12px] flex-col md:!flex-row">
        <div className="flex items-center justify-between w-full md:w-auto gap-[18px]">
          <div className="">
            <Link href={"#"} target="_blank">
              <div className="relative z-20 max-w-[200px]">
                <img
                  src={
                    themeMode === "dark" || themeMode === "system"
                      ? "/pt_web_dark.png"
                      : "/pt_web_light.png"
                  }
                  className="w-[200px]"
                  alt="PlanTelligence"
                />
              </div>
            </Link>
          </div>
          <div className="items-center gap-[6px] hidden md:flex">
            <p className="text-[12px] text-[#959595]">Presented by</p>
            <p className="text-sm font-bold text-[#2B334C] dark:text-white">
              (Presenter)
            </p>
          </div>

          {/* Mobile Menu Button */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-4 mt-8">
                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "text-[14px] font-medium transition-colors hover:text-primary",
                      pathname === link.href
                        ? "text-primary"
                        : "text-[#2B334C] dark:text-[#959595]",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="https://waypointfas.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4"
                >
                  <Button
                    size="lg"
                    variant="default"
                    className="w-full px-4 py-3 text-sm font-medium"
                  >
                    Schedule Appointment
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6 text-[14px] text-[#2B334C] dark:text-[#959595] font-medium">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-primary"
                  : "text-[#2B334C] dark:text-[#959595]",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="https://go.oncehub.com/WFAParticipantInquiry"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              variant="default"
              className="px-4 py-3 text-sm font-medium"
            >
              Schedule Appointment
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
