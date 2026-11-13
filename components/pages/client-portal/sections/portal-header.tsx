"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, ChevronDown, Calendar, Pencil, Menu, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  benefitCategoryToVisibilityKey,
  getCategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import {
  customBenefitNameToSlug,
  isPlaceholderBenefitName,
} from "@/lib/benefit-custom-name";
import { BrandingImage } from "@/components/ui/branding-image";
import { mix, readableColor } from "polished";
import {
  HAVE_QUESTIONS_SECTION_ID,
  HOW_CAN_WE_HELP_SECTION_ID,
  scrollToPortalSection,
} from "@/lib/portal-section-anchors";
import {
  normalizePortalHeaderCta,
  portalHeaderCtaLabel,
  resolvePortalHeaderCtaHref,
} from "@/lib/portal-header-cta";
import {
  getPortalThemeCssVars,
  portalRadiusValue,
} from "@/lib/typography-themes";
import {
  COMMENTS_RAIL_PARAM,
  COMMENTS_RAIL_VALUE,
  wantsCommentsRail,
} from "@/lib/comments/portal-surface";

/** Nav label -> visibility key in categoryPortalVisibility */
const BENEFITS_NAV_TO_VISIBILITY_KEY: Record<string, string> = {
  Retirement: "Retirement",
  "Health Insurance": "Group Health",
  "Life Insurance": "Group Life",
  "Wellness Programs": "Other",
};

/** The four benefit hub links. Static, so it lives outside the component. */
const BENEFITS_NAV_ITEMS: { label: string; path: string }[] = [
  { label: "Retirement", path: "/retirement" },
  { label: "Health Insurance", path: "/health-insurance" },
  { label: "Life Insurance", path: "/life-insurance" },
  { label: "Wellness Programs", path: "/wellness-programs" },
];

/**
 * The logo band on the MOBILE header/nav — everything below `md`, where the
 * desktop nav collapses into the hamburger and its drawer — is 20% smaller
 * than the desktop band.
 *
 * The values are CSS variables rather than Tailwind `max-h-*` utilities on
 * purpose: `BrandingImage` pins its wrapper to the `maxHeight` it is handed
 * (`height` + `minHeight`, see `r2StableBoxStyle`), and it resolves that even
 * when the value is a variable. The variables are declared here because this
 * file is in Tailwind's content paths; from `md` up they restore the full
 * desktop band.
 *
 * Desktop values mirror `HEADER_LOGO_BAND_PX` (48) and
 * `HEADER_LOGO_MAX_WIDTH_PX` (220) in `lib/header-logo-band`; mobile is
 * 48 × 0.8 ≈ 38 and 220 × 0.8 = 176.
 */
const HEADER_LOGO_BAND_CLASS =
  "[--portal-logo-band:38px] [--portal-logo-max-w:176px] md:[--portal-logo-band:48px] md:[--portal-logo-max-w:220px]";

/**
 * Consumed by `BrandingImage` as `maxHeight`/`maxWidth`, so the wrapper keeps a
 * definite height. The fallbacks are the desktop band: if the utility classes
 * above ever fail to compile, the header renders exactly as it did before.
 */
const HEADER_LOGO_BAND_STYLE: React.CSSProperties = {
  maxHeight: "var(--portal-logo-band, 48px)",
  maxWidth: "var(--portal-logo-max-w, 220px)",
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
  /** Per-category show/hide in portal; keys: Retirement, Group Health, Group Life, Other */
  categoryPortalVisibility?: Record<string, boolean> | null;
  /**
   * The plan's Benefit rows, as returned by `GET /api/clients/[id]?forPortal=1`
   * (`benefitHubs`) — which hub categories exist, and whether each is published.
   *
   * This is the authoritative counterpart of the dashboard's Published/Hidden switch:
   * when it is supplied, a link renders only if a Benefit row exists for the hub
   * (`isEnabled !== false`) and the category is not hidden in
   * `categoryPortalVisibility` — the same predicate `GET /api/benefits` reports for
   * `/benefits`. When it is absent (the wizards' preview chrome, which has no plan
   * data), only the visibility map filters, so those previews keep every hub.
   */
  benefitHubs?:
    | { category?: string; isEnabled?: boolean; title?: string | null }[]
    | null;
  /**
   * Legacy `employeePortalPreview.benefits` mirror.
   *
   * No longer read: it also carries Step 5 template entries for categories the advisor
   * never created (each `isEnabled: false`), so it cannot answer "does this plan have
   * this hub?" — see `benefitHubs`. Kept in the signature only so the preview call
   * sites that still pass it don't have to change.
   */
  benefits?: { id?: string; isEnabled?: boolean }[] | null;
  /**
   * TF-6: has this plan published the Employee Resources hub?
   *
   * The fifth location is opt-in and is NOT a benefit category, so it cannot be
   * derived from `benefitHubs` or the visibility map — the plan's own flag is the
   * only answer. When false the nav link does not render at all.
   */
  employeeResourcesEnabled?: boolean;
  /**
   * The plan's Portal Header button — `employeePortalPreview.headerCta`, chosen in
   * Section 1 of the editing panel (see `lib/portal-header-cta`).
   *
   *  - `login` (default) — the original Login button, shown on Benefit Hub pages
   *    only, scrolling to that hub's Account Access card.
   *  - `schedule` — a booking button, also shown on Benefit Hub pages only.
   *  - `none` — no button.
   *
   * Typed loosely because it arrives as JSON; anything unrecognized falls back to
   * `login`, so existing plans are untouched.
   */
  headerCta?: unknown;
  /**
   * When < 1, proportionally scales the header's content *and* height to match
   * the scaled preview beneath it — e.g. while the editing panel narrows the
   * available width. 1 (default) renders at natural size.
   */
  scale?: number;
  /** Design width the header content is laid out at before being scaled. */
  referenceWidth?: number;
  /**
   * The plan's typography theme.
   *
   * The live portal already publishes these variables on `.portal-root`, but an
   * editor preview mounts the header BESIDE its preview root rather than inside
   * it — so the plan's corner treatment reached everything on the page except
   * the header's own buttons and links. Passing the theme makes the header
   * theme-aware wherever it is mounted.
   */
  typographyTheme?: string | null;
}

/**
 * A portal that `AnimatePresence` can see.
 *
 * `AnimatePresence` only tracks React ELEMENTS, and `createPortal` returns a
 * portal object, which `isValidElement` rejects — a bare `createPortal(...)`
 * child is silently dropped, which is exactly what left the drawer failing to
 * open. Wrapping the call in a component keeps it in the presence tree, so the
 * slide-out still runs when the menu closes.
 */
function PortalInto({
  host,
  children,
}: {
  host: HTMLElement;
  children: ReactNode;
}) {
  return createPortal(children, host);
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
  benefitHubs,
  employeeResourcesEnabled = false,
  headerCta,
  scale = 1,
  referenceWidth = 1400,
  typographyTheme,
}: PortalHeaderProps) {
  const visibility = getCategoryPortalVisibility(categoryPortalVisibilityRaw);

  /**
   * The plan's theme, scoped to the header itself.
   *
   * `fontFamily` rides along because the theme's `ui` role owns navigation,
   * buttons and labels: the live portal sets it on `.portal-root`, and without
   * it here a preview's header would fall back to the app's font while the page
   * beneath it used the plan's.
   */
  const themeStyle = typographyTheme
    ? ({
        ...getPortalThemeCssVars(typographyTheme),
        fontFamily: "var(--font-ui)",
      } as React.CSSProperties)
    : undefined;

  // ── The header's one call to action ──
  // Both modes render only on a Benefit Hub page (see `showHeaderCta` below);
  // `none` renders nothing at all.
  const headerCtaSetting = normalizePortalHeaderCta(headerCta);
  const headerCtaText = portalHeaderCtaLabel(headerCtaSetting);
  const headerCtaHref = resolvePortalHeaderCtaHref(headerCtaSetting.url);
  /** Login has a destination (the Account Access card); a booking button without a
   *  URL falls back to the contact card in "Have Questions?". */
  const handleHeaderCtaClick = () =>
    scrollToPortalSection(
      headerCtaSetting.mode === "login"
        ? HOW_CAN_WE_HELP_SECTION_ID
        : HAVE_QUESTIONS_SECTION_ID,
    );
  const headerCtaClass =
    "order-1 gap-2 px-4 text-xs font-semibold shadow-sm transition-opacity hover:opacity-90 sm:text-sm md:order-2";
  const headerCtaStyle = {
    backgroundColor: brandColor,
    color: readableColor(brandColor),
    // The theme's corner treatment at the CTA's own weight: a `round` plan keeps
    // it pill-like, a `sharp` plan squares it off. `rounded-full` used to pin
    // the header's most prominent button to one shape for every plan, which is
    // why changing the theme appeared to leave the header untouched.
    borderRadius: portalRadiusValue(2),
  };
  // `showHeaderCta` / `headerCtaAsLink` are derived further down, once
  // `isBenefitsActive` exists — they need it.

  /**
   * A hub link renders only for a hub this plan actually published — the same three
   * questions `GET /api/benefits` answers for the dashboard's switch:
   *
   *  1. a Benefit row exists (no row ⇒ "Not created" ⇒ no link, whatever its
   *     visibility key happens to say — there has to be something to publish),
   *  2. that row is not disabled (`isEnabled === false` ⇒ "Hidden"),
   *  3. the category is not hidden in `categoryPortalVisibility` (checked below).
   *
   * Hubs are matched by CATEGORY, never by the legacy mirror's `id`: the dual-write
   * derives ids from the category ("group-health", "company-/-plan-sponsor"), so the
   * Step 5 ids this used to compare against ("health", "life", "wellness") never
   * matched and the per-benefit check was skipped — which is why a hub with no
   * benefit at all still produced a link whenever its visibility key was true.
   *
   * With no `benefitHubs` (preview chrome) nothing is hidden beyond the visibility
   * map, so those previews keep showing every hub.
   */
  const benefitHubsList = Array.isArray(benefitHubs) ? benefitHubs : null;

  /**
   * The advisor's OWN name for the Custom benefit, which labels AND addresses the
   * "Wellness Programs" link.
   *
   * A Custom benefit is stored under "Company / Plan Sponsor" and its name lives in
   * `Benefit.title` — the wizard's "Custom Category Name". That category maps to the
   * "Other" visibility key, so this is the title of the very hub the "Wellness
   * Programs" link opens. Placeholder titles (the storage label, or the "Welcome to …"
   * headline default) mean the benefit was never named, so the link keeps the generic
   * label and the legacy `/wellness-programs` path.
   */
  const customHubTitle = (() => {
    if (!benefitHubsList) return null;
    const hub = benefitHubsList.find(
      (h) =>
        benefitCategoryToVisibilityKey(String(h?.category || "")) === "Other",
    );
    const title = String(hub?.title || "").trim();
    return title && !isPlaceholderBenefitName(title) ? title : null;
  })();
  // The Custom benefit's own route segment — its name, slugified. The legacy
  // `/wellness-programs` segment still resolves, but new links carry the name.
  const customHubPath = customHubTitle
    ? `/${customBenefitNameToSlug(customHubTitle)}`
    : null;

  const benefitsNavItems: { label: string; path: string }[] =
    BENEFITS_NAV_ITEMS.filter((item) => {
      const key = BENEFITS_NAV_TO_VISIBILITY_KEY[item.label];
      // Hidden by the plan's Portal Visibility map — the /benefits switch writes it.
      if (visibility[key] === false) return false;
      if (!benefitHubsList) return true;
      const hub = benefitHubsList.find(
        (h) =>
          benefitCategoryToVisibilityKey(String(h?.category || "")) === key,
      );
      if (!hub) return false; // not created yet
      return hub.isEnabled !== false; // created but Hidden
    }).map((item) =>
      BENEFITS_NAV_TO_VISIBILITY_KEY[item.label] === "Other" &&
      customHubTitle &&
      customHubPath
        ? { ...item, label: customHubTitle, path: customHubPath }
        : item,
    );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(showAlertBanner);
  // The logo band is a fixed contract (see lib/header-logo-band), so the logo
  // never sizes the header.
  const [isBenefitsOpen, setIsBenefitsOpen] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const pathname = usePathname();

  // Preserve the Comments/Editing-Panel flag across the portal's own navigation.
  // The links below are Next `Link`s, which do not inherit the current query, so a
  // click from `?comments=on` used to land on the plain portal and close the rail.
  // Read the query in an effect rather than `useSearchParams` so the header does
  // not need a Suspense boundary.
  const [portalQuerySuffix, setPortalQuerySuffix] = useState("");
  useEffect(() => {
    setPortalQuerySuffix(
      wantsCommentsRail(window.location.search)
        ? `?${COMMENTS_RAIL_PARAM}=${COMMENTS_RAIL_VALUE}`
        : "",
    );
  }, [pathname]);
  const withPortalQuery = (href: string) => `${href}${portalQuerySuffix}`;

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Proportional scaling ──
  // When the editing panel narrows the preview (scale < 1), lay the header
  // content out at `referenceWidth` and shrink it with a CSS transform, then
  // clamp the header's height to the scaled content height so the sticky
  // header (and the preview beneath it) stays flush.
  const isScaled = scale < 1;
  const headerContentRef = useRef<HTMLDivElement>(null);
  const [naturalHeaderHeight, setNaturalHeaderHeight] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const el = headerContentRef.current;
    if (!el) return;
    const update = () => setNaturalHeaderHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isActive = (path: string) => pathname?.includes(path);
  const baseUrl = clientId ? `/${clientId}` : "";
  // Every path that belongs to the "Your Benefits" group: the three canonical hubs,
  // the legacy Custom segment, and the Custom benefit's own slug when it has a name.
  const benefitsPaths = [
    "/retirement",
    "/health-insurance",
    "/life-insurance",
    "/wellness-programs",
    ...(customHubPath ? [customHubPath] : []),
  ];
  const isBenefitsActive = benefitsPaths.some((path) => isActive(path));

  /**
   * Preview chrome — the editors' `enableNavigation={false}` — has no routes, so
   * `isBenefitsActive` cannot answer "are we on a benefit page?", and every editor
   * preview IS previewing one. So previews show the Login button as well, which is
   * what makes the Section 1 choice visible in the preview at the moment it is made.
   *
   * A booking link is drawn as an inert button there instead of an anchor: the
   * advisor is editing, and a stray new tab would interrupt them.
   */
  const isPreviewChrome = !enableNavigation;
  // The header CTA belongs to the Benefit Hub pages only: the landing page's hero
  // carries its own call to action, and no other portal page has something for the
  // header's button to point at. Preview chrome keeps it so Section 1's choice is
  // visible while the advisor edits.
  const showHeaderCta =
    headerCtaSetting.mode !== "none" &&
    (isBenefitsActive || isPreviewChrome);
  const headerCtaAsLink =
    headerCtaSetting.mode === "schedule" &&
    Boolean(headerCtaHref.href) &&
    !isPreviewChrome;
  // Every hub route that owns its own link. A path in this list marks that link
  // instead of Home's — the drawer lists Home beside the hubs, so a hub the list
  // forgets lights up two rows at once. `/employee-resources` was exactly that.
  const hubPaths = [
    ...benefitsPaths,
    "/news-events",
    "/employee-resources",
    "/my-benefits-team",
  ];
  // "Home" is the landing page: not one of the hubs, news, resources, or team.
  const isHomeActive =
    pathname === baseUrl ||
    (!!pathname && !hubPaths.some((path) => isActive(path)));

  /**
   * The desktop nav's link treatment: an UNDERLINE in the plan's primary colour
   * on the current page.
   *
   * It deliberately does not fill the link. The header carries exactly one
   * filled button — the plan's call to action (Login / Schedule an appointment) —
   * and a brand-coloured pill beside it read as a second, competing CTA. The
   * underline marks where you are without claiming to be an action.
   */
  const navLinkClass = (active: boolean) =>
    cn(
      "h-auto border-b-2 px-2 py-1.5 font-medium transition-colors duration-200",
      active
        ? "text-gray-900"
        : "border-transparent bg-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900",
    );
  /**
   * The link's surface: corner treatment, underline and tint.
   *
   * The radius comes from `portalRadiusValue()` — the plan's Typography Theme —
   * so a "sharp" plan squares these links off exactly like the cards and buttons
   * below them, and a "round" plan softens them. Set inline rather than with a
   * `rounded-*` class because the Button's own `rounded-lg` would otherwise win
   * on source order and pin every plan to one radius.
   */
  const navLinkStyle = (active: boolean) => ({
    borderRadius: portalRadiusValue(),
    ...(active
      ? {
          borderBottomColor: brandColor,
          // A wash of the plan's primary colour, not the colour itself: the
          // link reads as "current page" while the header's only strong fill
          // stays its call to action.
          backgroundColor: mix(0.88, "#ffffff", brandColor),
        }
      : {}),
  });
  /**
   * The mobile drawer repeats the desktop treatment on a full-width row — the
   * same underline in the plan's colour over the same wash of it, with the same
   * theme-driven corners — so "where am I" never means one thing on desktop and
   * another on mobile. `nested` is the benefit group's own list, which sits one
   * indent deeper and a step smaller.
   */
  const drawerLinkClass = (active: boolean, nested = false) =>
    cn(
      navLinkClass(active),
      // `navLinkClass` styles the desktop links, which are `Button`s and so
      // already `inline-flex`. The drawer's rows are plain links and divs, so
      // the display utility has to be stated here — without it they fall back
      // to inline and flow beside each other, wrapping into one another.
      "flex w-full items-center px-3",
      nested
        ? cn("py-2 text-sm", active ? "font-medium" : "font-normal")
        : "py-2.5 text-sm",
    );

  /**
   * Where the mobile drawer is drawn.
   *
   * It is opened from the header, and the header lives inside the layout's
   * `fixed z-50` wrapper — which is a stacking context. Anything drawn inside
   * one is capped at its ancestor's z-index, no matter its own, which is why the
   * chatbot's `z-[60]` pill painted over the open drawer despite the drawer's
   * `z-[200]`. Rendering the drawer into `.portal-root` (the layout's root,
   * which is not a stacking context) puts it on the chatbot's own footing and
   * lets its z-index win.
   *
   * `.portal-root` rather than `document.body` so the drawer keeps inheriting
   * the plan's theme variables — the corner radius above is one of them.
   * `document.body` is the fallback for the wizard previews, which render this
   * header outside a portal root.
   */
  const headerRef = useRef<HTMLElement | null>(null);
  const [drawerHost, setDrawerHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setDrawerHost(
      headerRef.current?.closest<HTMLElement>(".portal-root") ?? document.body,
    );
  }, []);

  // Sync showBanner with showAlertBanner prop
  useEffect(() => {
    setShowBanner(showAlertBanner);
  }, [showAlertBanner]);

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
      <header
        ref={headerRef}
        className="bg-white shadow-md transition-all duration-300 overflow-hidden"
        style={
          isScaled && naturalHeaderHeight != null
            ? { ...themeStyle, height: naturalHeaderHeight * scale }
            : themeStyle
        }
      >
        {/* Content is laid out at `referenceWidth` and scaled down when the
            editing panel narrows the preview, so the nav never overflows. */}
        <div
          ref={headerContentRef}
          className="px-4 py-2 sm:py-4 sm:px-6 lg:px-20"
          style={
            isScaled
              ? {
                  width: `${referenceWidth}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }
              : undefined
          }
        >
          <div className="flex h-full items-center justify-between">
            {/* Logo */}
            {enableNavigation ? (
              <Link
                href={withPortalQuery(baseUrl)}
                className="flex h-full items-center gap-4 overflow-hidden"
              >
                {companyData?.companyLogo && (
                  <BrandingImage
                    src={companyData.companyLogo}
                    alt="Company Logo"
                    className={`object-contain ${HEADER_LOGO_BAND_CLASS}`}
                    style={HEADER_LOGO_BAND_STYLE}
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
                      className={`object-contain transition-all ${HEADER_LOGO_BAND_CLASS} ${
                        isLogoHovered
                          ? "ring-2 border-1 border-blue-500/50"
                          : ""
                      }`}
                      style={HEADER_LOGO_BAND_STYLE}
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

            {/* Right side: mobile menu, desktop navigation, and the ask CTA.
              Kept in ONE cluster so the CTA is always the last thing in the header and
              the hamburger can never be stranded mid-header — which is what happens in
              the scaled editing previews, where `md:` measures the panel, not referenceWidth. */}
            <div className="flex items-center gap-3 md:gap-6">
              {/* Mobile hamburger button. Sits AFTER the Ask CTA on mobile (see the
                  `order-*` utilities below) and is pulled back to its original place
                  from `md:` up, where the desktop nav sits between it and the CTA. */}
              <div className="order-2 md:order-1 md:hidden">
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
                          // An open menu marks the group too, so the trigger
                          // reads as "this is where you are" while browsing.
                          className={navLinkClass(
                            isBenefitsActive || isBenefitsOpen,
                          )}
                          style={navLinkStyle(
                            isBenefitsActive || isBenefitsOpen,
                          )}
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
                              <Link
                                key={item.path}
                                href={withPortalQuery(`${baseUrl}${item.path}`)}
                              >
                                <DropdownMenuItem>
                                  {item.label}
                                </DropdownMenuItem>
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

                {enableNavigation ? (
                  <Link href={withPortalQuery(`${baseUrl}/news-events`)}>
                    <Button
                      variant="ghost"
                      className={navLinkClass(isActive("/news-events"))}
                      style={navLinkStyle(isActive("/news-events"))}
                    >
                      News & Events
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    className={cn(
                      navLinkClass(isActive("/news-events")),
                      "cursor-default",
                    )}
                    style={navLinkStyle(isActive("/news-events"))}
                    onClick={(e) => e.preventDefault()}
                  >
                    News & Events
                  </Button>
                )}

                {/* Employee Resources (TF-6): after the categories, and only when the
                    plan has published the hub. */}
                {employeeResourcesEnabled && (
                  <Link href={withPortalQuery(`${baseUrl}/employee-resources`)}>
                    <Button
                      variant="ghost"
                      className={navLinkClass(
                        isActive("/employee-resources"),
                      )}
                      style={navLinkStyle(isActive("/employee-resources"))}
                    >
                      Employee Resources
                    </Button>
                  </Link>
                )}

                {enableNavigation ? (
                  <Link href={withPortalQuery(`${baseUrl}/my-benefits-team`)}>
                    <Button
                      variant="ghost"
                      className={navLinkClass(isActive("/my-benefits-team"))}
                      style={navLinkStyle(isActive("/my-benefits-team"))}
                    >
                      My Benefits Team
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    className={cn(
                      navLinkClass(isActive("/my-benefits-team")),
                      "cursor-default",
                    )}
                    style={navLinkStyle(isActive("/my-benefits-team"))}
                    onClick={(e) => e.preventDefault()}
                  >
                    My Benefits Team
                  </Button>
                )}
              </nav>

              {/* "Ask a question" is no longer a header button — it is the portal's
                  floating chatbot action in the bottom-right corner (see
                  portal-chatbot.tsx), so it is reachable on every page size. */}

              {/* The header CTA, chosen in Section 1 of the editing panel.
                  `login` keeps the original rule — Benefit Hub pages only, scrolling
                  to that hub's "How Can We Help You Today?" section, which holds the
                  Account Access card (plan / group ID, administering provider and the
                  Register or Login Here button). `schedule` follows the same page rule.
                  Ordered before the mobile hamburger so the two sit
                  [CTA][☰] on a phone and [nav][CTA] from `md:` up. */}
              {showHeaderCta &&
                (headerCtaAsLink ? (
                  // `asChild` keeps the markup valid (an anchor, not a button inside
                  // a link) while inheriting the Button's styling.
                  <Button asChild className={headerCtaClass} style={headerCtaStyle}>
                    <a
                      href={headerCtaHref.href}
                      {...(headerCtaHref.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {headerCtaText}
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleHeaderCtaClick}
                    className={headerCtaClass}
                    style={headerCtaStyle}
                  >
                    {headerCtaSetting.mode === "login" ? (
                      <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    {headerCtaText}
                  </Button>
                ))}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile side nav drawer with animation. Drawn through `drawerHost`, so
          its high z-index is not confined by the header's `fixed z-50` wrapper
          — see the note on `drawerHost` above. */}
      <AnimatePresence>
        {mobileMenuOpen && drawerHost ? (
          <PortalInto host={drawerHost}>
            {/* The drawer is portalled out of the header, so it carries the
                theme's variables of its own to keep the same corners. */}
            <div
              data-testid="portal-mobile-drawer"
              className="fixed inset-0 z-[200] md:hidden"
              style={themeStyle}
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Drawer — full-bleed on phones: the menu is the whole screen
                  there, so it slides in as a page rather than a side sheet. */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl"
              >
                {/* Drawer header — the plan's logo on the left, the close
                    control on the right. Taller than the old strip so the logo
                    reads as branding instead of a clipped thumbnail. The logo
                    is not a link here: Home is the first row below, and two
                    ways home in a 280px-wide menu is one too many. */}
                <div className="flex min-h-[4rem] items-center justify-between gap-3 border-b px-4 py-3">
                  {companyData?.companyLogo ? (
                    <BrandingImage
                      src={companyData.companyLogo}
                      alt="Company Logo"
                      className={`object-contain ${HEADER_LOGO_BAND_CLASS}`}
                      style={HEADER_LOGO_BAND_STYLE}
                    />
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                    aria-label="Close menu"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Drawer navigation links — tighter spacing */}
                <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
                  {/* Home */}
                  {enableNavigation ? (
                    <Link
                      href={withPortalQuery(baseUrl)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={drawerLinkClass(isHomeActive)}
                      style={navLinkStyle(isHomeActive)}
                      aria-current={isHomeActive ? "page" : undefined}
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      Home
                    </Link>
                  ) : (
                    <span className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600">
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      Home
                    </span>
                  )}

                  {/* Your Benefits sub-links */}
                  {benefitsNavItems.length > 0 && (
                    <div className="space-y-0.5">
                      {/* The group row marks itself while one of its hubs is
                          open — the mobile counterpart of the desktop trigger. */}
                      <div
                        className={drawerLinkClass(isBenefitsActive)}
                        style={navLinkStyle(isBenefitsActive)}
                      >
                        <svg
                          className="mr-3 h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Your Benefits
                      </div>
                      <div className="ml-4 space-y-0.5 border-l border-gray-200 pl-3">
                        {benefitsNavItems.map((item) =>
                          enableNavigation ? (
                            <Link
                              key={item.path}
                              href={withPortalQuery(`${baseUrl}${item.path}`)}
                              onClick={() => setMobileMenuOpen(false)}
                              className={drawerLinkClass(
                                isActive(item.path),
                                true,
                              )}
                              style={navLinkStyle(isActive(item.path))}
                              aria-current={
                                isActive(item.path) ? "page" : undefined
                              }
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <span
                              key={item.path}
                              className="flex items-center rounded-lg px-3 py-2 text-sm text-gray-500"
                            >
                              {item.label}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* News & Events */}
                  {enableNavigation ? (
                    <Link
                      href={withPortalQuery(`${baseUrl}/news-events`)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={drawerLinkClass(isActive("/news-events"))}
                      style={navLinkStyle(isActive("/news-events"))}
                      aria-current={
                        isActive("/news-events") ? "page" : undefined
                      }
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      News & Events
                    </Link>
                  ) : (
                    <span className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600">
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      News & Events
                    </span>
                  )}

                  {/* Employee Resources (TF-6) */}
                  {employeeResourcesEnabled &&
                    (enableNavigation ? (
                      <Link
                        href={withPortalQuery(`${baseUrl}/employee-resources`)}
                        onClick={() => setMobileMenuOpen(false)}
                        className={drawerLinkClass(
                          isActive("/employee-resources"),
                        )}
                        style={navLinkStyle(isActive("/employee-resources"))}
                        aria-current={
                          isActive("/employee-resources") ? "page" : undefined
                        }
                      >
                        Employee Resources
                      </Link>
                    ) : (
                      <span className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600">
                        Employee Resources
                      </span>
                    ))}

                  {/* My Benefits Team */}
                  {enableNavigation ? (
                    <Link
                      href={withPortalQuery(`${baseUrl}/my-benefits-team`)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={drawerLinkClass(isActive("/my-benefits-team"))}
                      style={navLinkStyle(isActive("/my-benefits-team"))}
                      aria-current={
                        isActive("/my-benefits-team") ? "page" : undefined
                      }
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      My Benefits Team
                    </Link>
                  ) : (
                    <span className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600">
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      My Benefits Team
                    </span>
                  )}
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
          </PortalInto>
        ) : null}
      </AnimatePresence>
    </>
  );
}
