"use client";

import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { Footer } from "@/components/layout/footer";
import {
  ClientPortalProvider,
  useClientPortal,
} from "@/contexts/client-portal-context";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PortalPopUpOverlay } from "@/components/pages/client-portal/sections/portal-popup-overlay";
import { AnimatePresence, motion } from "framer-motion";
import {
  resolveDefaultDisclosuresText,
  resolveOrgOnlyDisclaimerText,
} from "@/lib/disclaimer-constants";

interface BannerAsset {
  id: string;
  headline: string;
  body?: string;
  ctaText?: string;
  bgColor: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

function ClientViewLayoutContent({ children }: { children: React.ReactNode }) {
  const { clientData } = useClientPortal();
  // Logged-in user's organization name — used as a fallback when the
  // advisor's onboarding branding org name is empty, so the footer's
  // [Organization Name] doesn't collapse to the plan's company name.
  const { data: session } = useSession();
  const params = useParams();
  const clientId = params.id as string;
  const pathname = usePathname();
  const [previousPage, setPreviousPage] = useState(true);
  const [banner, setBanner] = useState<BannerAsset | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const fixedHeaderRef = useRef<HTMLDivElement>(null);
  const [fixedHeaderHeight, setFixedHeaderHeight] = useState(0);

  // Fetch published top banners (portal-notice type only)
  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/marketing/assets/public?clientId=${clientId}&type=portal-notice`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setBanner(res.data[0]);
        }
      })
      .catch(() => {});
  }, [clientId]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);
  const brandColor = clientData?.brandColor || "#1F3A60";
  const secondaryColor = clientData?.secondaryColor || "#6B7280";

  // Resolve portal footer background color from the plan's footerBackground
  // preference (selected during plan creation wizard Step 5a). Falls back to
  // brandColor (primary) when no custom footer background is configured.
  const footerBgColor = (() => {
    try {
      const raw = (clientData as any)?.disclaimers;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const fb = parsed?.footerBackground;
      if (!fb) return brandColor;
      if (fb.mode === "secondary") return secondaryColor;
      if (fb.mode === "custom" && fb.customColor?.trim()) return fb.customColor.trim();
    } catch { /* ignore parse errors */ }
    return brandColor;
  })();
  const organizationName =
    (clientData as any)?.branding?.organizationName ||
    session?.user?.organizationName ||
    clientData?.companyName ||
    "";
  const basePath = clientId ? `/${clientId}` : "";

  useEffect(() => {
    const prev = sessionStorage.getItem("previousPage");
    setPreviousPage(false);

    if (prev) {
      setPreviousPage(true);
      sessionStorage.removeItem("previousPage");
    }
  }, []);

  // Portal pages are always light-branded — they must NOT respond to the
  // dashboard's dark-mode preference. The dashboard sets a global `.dark`
  // class on <html> via next-themes, which activates every `dark:` utility in
  // portal components. While a portal route is mounted, remove `.dark` so the
  // whole portal stays light; restore it when leaving so the advisor's
  // dashboard dark-mode setting is preserved.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const prevColorScheme = root.style.colorScheme;

    root.classList.remove("dark");
    root.style.colorScheme = "light";

    return () => {
      root.classList.toggle("dark", hadDark);
      root.style.colorScheme = prevColorScheme;
    };
  }, []);

  const onClick = () => {
    window.location.href = `/edit-client/${clientId}`;
  };

  // Determine current category from pathname
  const getCurrentCategory = () => {
    if (pathname?.includes("/retirement")) return "Retirement Plan";
    if (pathname?.includes("/health-insurance")) return "Group Health / Dental / Vision";
    if (pathname?.includes("/life-insurance")) return "Group Life / Disability";
    if (pathname?.includes("/wellness-programs")) return "Wellness Programs";
    return "Benefits Hub / Client Website"; // Default to hub for main page or other plan pages
  };

  // Map a portal page label → canonical per-category disclaimer key
  const getCurrentCategoryKey = () => {
    const category = getCurrentCategory();
    if (category === "Retirement Plan") return "Retirement";
    if (category === "Group Health / Dental / Vision") return "Group Health";
    if (category === "Group Life / Disability") return "Group Life";
    if (category === "Wellness Programs") return "Other";
    return null; // Benefits Hub main page is not a per-category disclaimer
  };

  // Parse and filter disclaimers based on priority
  const getDisclosuresText = () => {
    // Note: clientData might not have 'branding' sub-object in this context
    const orgName = (clientData as any)?.branding?.organizationName
      || session?.user?.organizationName
      || clientData?.companyName
      || "[Organization Name]";
    const compName = clientData?.companyName || "[Company Name]";

    // Universal disclaimer text with placeholders resolved. Only the Benefits Hub
    // pages (Retirement, Group Life, Group Health, Other) include a [Company Name];
    // the Landing Page, News and Events, etc. use the organization name only.
    const isCategoryHub = !!getCurrentCategoryKey();
    const universalText = resolveDefaultDisclosuresText(
      orgName,
      compName,
      isCategoryHub,
    );

    if (!clientData?.disclaimers) {
      // No client disclaimers → fall back to the advisor's profile disclaimer,
      // then to the universal text.
      const advisorFallback = (clientData as any)?.advisorDisclaimer;
      if (advisorFallback) {
        const resolved = isCategoryHub
          ? advisorFallback
              .replace(/\[Organization Name\]/g, orgName)
              .replace(/\[Company Name\]/g, compName)
          : resolveOrgOnlyDisclaimerText(advisorFallback, orgName);
        return resolved
          .replace(/\\n/g, "\n")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");
      }
      return universalText;
    }

    let disclaimersArray: any[] = [];
    let savedDisclosuresText: string | null = null;
    let useDefaultDisclosures = false;
    let byCategory: Record<string, any> | null = null;

    try {
      const parsed = typeof clientData.disclaimers === "string"
        ? JSON.parse(clientData.disclaimers)
        : clientData.disclaimers;

      if (parsed && typeof parsed === "object") {
        disclaimersArray = Array.isArray(parsed.disclaimers) ? parsed.disclaimers : [];
        savedDisclosuresText = parsed.disclosuresText || null;
        useDefaultDisclosures = !!parsed.useDefaultDisclosures;
        byCategory =
          parsed.byCategory && typeof parsed.byCategory === "object"
            ? parsed.byCategory
            : null;
      }
    } catch (e) {
      console.warn("Failed to parse disclaimers:", e);
      // Fallback to treating as string if it's not JSON
      if (typeof clientData.disclaimers === "string") {
        return clientData.disclaimers;
      }
      return universalText;
    }

    const currentCategory = getCurrentCategory();
    const currentCategoryKey = getCurrentCategoryKey();

    // 0. Per-category disclaimer (byCategory) — highest priority on category pages.
    // Each benefit category (Retirement, Group Life, Group Health, Other) can have
    // its own disclaimer configured in the Create Benefit Flow (BenefitsStep5),
    // mapped to that category's portal hub page:
    //   Retirement   → /retirement
    //   Group Life   → /life-insurance
    //   Group Health → /health-insurance
    //   Other        → /wellness-programs
    const perCategoryDisclaimer = currentCategoryKey
      ? byCategory?.[currentCategoryKey]
      : null;
    if (perCategoryDisclaimer?.text) {
      // Normalize any literal backslash-n / Windows line endings defensively
      // so newlines always render in the footer even if the text arrived
      // double-encoded, and resolve any leftover placeholders so a stored
      // [Organization Name] / [Company Name] never renders literally.
      return perCategoryDisclaimer.text
        .replace(/\\n/g, "\n")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\[Organization Name\]/g, orgName)
        .replace(/\[Company Name\]/g, compName);
    }

    // ── Home Page footer disclaimer (created in Step 5a) ──
    // On the Benefits Hub main page (no category selected) the footer must use
    // the dedicated "Home Page" footer disclaimer. Prefer a disclaimer whose
    // location is "Home Page" or "Global" (or one marked apply-all), and
    // resolve [Organization Name] / [Company Name] so the placeholder never
    // renders literally.
    if (!currentCategoryKey) {
      const homePageDisclaimers = disclaimersArray.filter((d: any) =>
        d?.text &&
        (d.locations?.includes("Home Page") ||
          d.locations?.includes("Global") ||
          d.apply_all_benefits_categories === true)
      );
      if (homePageDisclaimers.length > 0) {
        const homeText = homePageDisclaimers[0].text;
        return homeText
          .replace(/\\n/g, "\n")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .replace(/\[Organization Name\]/g, orgName)
          .replace(/\[Company Name\]/g, compName);
      }
    }

    // The footer disclosures come from the advisor's profile (User.disclaimer)
    // when available. This is resolved server-side in GET /api/clients/[id] and
    // attached as advisorDisclaimer, so it works for both the logged-in dashboard
    // flow and the public subdomain portal. On the Benefits Hub main page (no
    // per-category disclaimer) and as a fallback for category pages without a
    // per-category disclaimer, the advisor's disclosures remain the source.
    const advisorDisclaimer = (clientData as any)?.advisorDisclaimer;
    if (advisorDisclaimer) {
      // Resolve any leftover placeholders (hub pages include the company name;
      // the Landing Page / News and Events use the organization name only) and
      // normalize newlines defensively.
      const resolved = isCategoryHub
        ? advisorDisclaimer
            .replace(/\[Organization Name\]/g, orgName)
            .replace(/\[Company Name\]/g, compName)
        : resolveOrgOnlyDisclaimerText(advisorDisclaimer, orgName);
      return resolved
        .replace(/\\n/g, "\n")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
    }

    // 1. Category-specific disclaimers (apply_all = false, matches category)
    // Note: If user selected "Benefits Hub" and apply_all = false, it only shows on the Hub main page ("benefits_hub").
    const categorySpecific = disclaimersArray.filter((d: any) =>
      !d.apply_all_benefits_categories &&
      (d.locations?.includes(currentCategory) ||
        d.locations?.includes("global") ||
        (!currentCategory && d.locations?.includes("Home Page")))
    );

    // 2. All-categories disclaimers (apply_all = true)
    // These appear across all categories regardless of the specific category selected in locations,
    // as long as they are targeted at the Hub/Portal components.
    const allCategories = disclaimersArray.filter((d: any) =>
      d.apply_all_benefits_categories === true
    );

    // Resolve any leftover [Organization Name] / [Company Name] placeholders in
    // a disclaimer text so a stored template never renders literally.
    const resolvePlaceholders = (t: string): string =>
      t
        .replace(/\\n/g, "\n")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\[Organization Name\]/g, orgName)
        .replace(/\[Company Name\]/g, compName);

    // Combine following priority: Per-category > Category-specific > All-categories > Universal
    // (We include universal if useDefaultDisclosures is true OR if it's the final fallback)
    const prioritizedTexts = [
      ...(perCategoryDisclaimer?.text ? [resolvePlaceholders(perCategoryDisclaimer.text)] : []),
      ...categorySpecific.map(d => resolvePlaceholders(d.text)),
      ...allCategories.map(d => resolvePlaceholders(d.text))
    ];

    // Add universal disclaimer if enabled or as final priority
    if (useDefaultDisclosures || prioritizedTexts.length === 0) {
      prioritizedTexts.push(universalText);
    } else if (savedDisclosuresText && disclaimersArray.length === 0) {
      // Legacy support for single string
      return savedDisclosuresText;
    }

    if (prioritizedTexts.length > 0) {
      // Remove exactly duplicate texts (case-insensitive trim) and join
      const uniqueTexts = Array.from(new Set(prioritizedTexts.map(t => t?.trim()).filter(Boolean)));
      return uniqueTexts.join("\n\n");
    }

    return universalText;
  };

  // ── Countdown logic for countdown-type banners ──
  const bannerData = banner?.data ?? {};
  const noticeType = bannerData.noticeType as string | undefined;
  const countdownTarget = bannerData.countdownTarget as string | undefined;
  const ctaText = banner?.ctaText || (bannerData.ctaText as string | undefined);
  const rawPortalCtaUrl = bannerData.portalCtaUrl as string | undefined;
  const portalCtaUrl = rawPortalCtaUrl && !rawPortalCtaUrl.startsWith("http://") && !rawPortalCtaUrl.startsWith("https://")
    ? `https://${rawPortalCtaUrl}`
    : rawPortalCtaUrl;

  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0, expired: false });
  useEffect(() => {
    if (noticeType !== "countdown" || !countdownTarget) return;
    const target = new Date(countdownTarget).getTime();
    if (isNaN(target)) return;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown({ d: 0, h: 0, m: 0, s: 0, expired: true }); return; }
      const totalSec = Math.floor(diff / 1000);
      setCountdown({
        d: Math.floor(totalSec / 86400),
        h: Math.floor((totalSec % 86400) / 3600),
        m: Math.floor((totalSec % 3600) / 60),
        s: totalSec % 60,
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [noticeType, countdownTarget]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const showBanner = banner && !bannerDismissed;

  const disclosuresText = getDisclosuresText();

  // ── Measure fixed header+banner height so main content stays below it ──
  useEffect(() => {
    if (fixedHeaderRef.current) {
      setFixedHeaderHeight(fixedHeaderRef.current.offsetHeight);
    }
    const onResize = () => {
      if (fixedHeaderRef.current) {
        setFixedHeaderHeight(fixedHeaderRef.current.offsetHeight);
      }
    };
    window.addEventListener("resize", onResize);
    // Re-measure after a small delay to account for font/image loading
    const timer = setTimeout(onResize, 300);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [showBanner]);

  return (
    <div className="min-h-screen bg-white portal-root">
      <div ref={fixedHeaderRef} className="fixed top-0 left-0 w-full z-50">
        {/* Published Top Banner — rendered above the header */}
        {showBanner && (
          <div
            className="relative w-full flex items-center justify-between gap-2 px-3 py-1.5 text-white shadow-sm sm:px-4 sm:py-2.5 sm:justify-center"
            style={{ background: banner.bgColor || "#23919c" }}
          >
            {/* Centered group: headline + countdown */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:gap-4 sm:justify-center sm:text-center sm:flex-1">
              {noticeType === "countdown" && countdownTarget ? (
                <>
                  <span className="text-[10px] font-medium whitespace-nowrap sm:text-sm">{banner.headline || "Countdown"}</span>
                  {countdown.expired ? (
                    <span className="text-[10px] font-bold whitespace-nowrap sm:text-base">Expired</span>
                  ) : (
                    <div className="flex items-center gap-0.5 text-[10px] font-bold tabular-nums tracking-wider whitespace-nowrap sm:gap-2 sm:text-base">
                      {countdown.d > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-black/25 px-0.5 py-0.5 sm:gap-1 sm:px-2 sm:py-1">
                          <span>{countdown.d}</span>
                          <span className="text-[8px] opacity-80 sm:text-sm">d</span>
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-md bg-black/25 px-0.5 py-0.5 sm:px-2 sm:py-1">{pad(countdown.h)}</span>
                      <span className="text-xs opacity-50 sm:text-lg sm:-mx-0.5">:</span>
                      <span className="inline-flex items-center rounded-md bg-black/25 px-0.5 py-0.5 sm:px-2 sm:py-1">{pad(countdown.m)}</span>
                      <span className="text-xs opacity-50 sm:text-lg sm:-mx-0.5">:</span>
                      <span className="inline-flex items-center rounded-md bg-black/25 px-0.5 py-0.5 sm:px-2 sm:py-1">{pad(countdown.s)}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[10px] font-medium truncate sm:text-sm sm:font-medium">{banner.headline || "Announcement"}</span>
              )}
            </div>
            {/* Right side: CTA + dismiss */}
            <div className="flex items-center gap-1 shrink-0 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:gap-2">
              {ctaText && (
                <>
                  {portalCtaUrl ? (
                    <a
                      href={portalCtaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity sm:px-4 sm:py-1.5 sm:text-xs"
                      style={{ background: `rgba(0,0,0,0.25)` }}
                    >
                      {ctaText}
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-lg px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm sm:px-4 sm:py-1.5 sm:text-xs"
                      style={{ background: `rgba(0,0,0,0.25)` }}
                    >
                      {ctaText}
                    </span>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={dismissBanner}
                className="rounded-full p-0.5 transition-colors hover:bg-white/20 sm:p-1"
                aria-label="Dismiss banner"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 sm:h-5 sm:w-5" aria-hidden="true">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {previousPage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
            <Button
              onClick={() => (window.location.href = `/dashboard`)}
              className="px-10 mr-3 py-4 text-lg bg-[#1F3A60] text-white font-semibold rounded-full shadow-xl hover:bg-[#2c4b80] hover:scale-105 transition-all duration-200"
            >
              ← Go back to dashboard
            </Button>

            <Button
              onClick={onClick}
              className="px-10 py-4 text-lg bg-[#1F3A60] text-white font-semibold rounded-full shadow-xl hover:bg-[#2c4b80] hover:scale-105 transition-all duration-200"
            >
              ← Go back to editing
            </Button>
          </div>
        )}
        <PortalHeader
          companyData={{
            companyLogo: clientData?.companyLogo,
          }}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          clientId={clientId}
          categoryPortalVisibility={(clientData as any)?.categoryPortalVisibility}
          benefits={(clientData as any)?.employeePortalPreview?.benefits}
        />
      </div>

      <div
        style={
          {
            "--brand-color": brandColor,
            "--secondary-color": secondaryColor,
            paddingTop: fixedHeaderHeight || undefined,
          } as React.CSSProperties
        }
      >
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </div>

      {/* Pop-Up Overlay — displays published pop-up marketing assets across all portal pages */}
      <PortalPopUpOverlay
        clientId={clientId}
        companyName={clientData?.companyName}
        companyLogo={clientData?.companyLogo}
      />

      <Footer
        brandColor={footerBgColor}
        disclosuresText={disclosuresText}
        organizationName={organizationName}
        companyName={clientData?.companyName || ""}
      />
    </div>
  );
}

export default function ClientViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientPortalProvider>
      <ClientViewLayoutContent>{children}</ClientViewLayoutContent>
    </ClientPortalProvider>
  );
}
