"use client";

import { useMemo, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  resolveContactCompanyName,
  isLoggedInUserContact,
} from "@/lib/resolve-contact-company-name";
import { fetchProfileOnce } from "@/lib/fetch-profile";
import {
  isContactVisibleInPortal,
  getCategoryPortalVisibility,
  getContactCategories as getContactCategoriesFromLib,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";

/** True if contact should be hidden by Category Display (Show/Hide). Use: fetch → filter by !isHidden → render. */
function isContactHiddenByCategory(
  contact: Record<string, unknown>,
  visibility: CategoryPortalVisibility
): boolean {
  return !isContactVisibleInPortal(
    getContactCategoriesFromLib(contact),
    visibility
  );
}

/**
 * Portal desktop layouts are stored as 0 (default) / 2 / 3 / 4. Coerce anything
 * else (legacy 1-based values, numeric strings, null, garbage) so a stray value
 * can never leave the desktop area empty.
 */
function normalizeDisplayStyle(value: unknown): 0 | 2 | 3 | 4 | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n === 2 || n === 3 || n === 4) return n;
  // 0, 1 and anything unexpected fall back to the default layout.
  return 0;
}

/** Mobile layouts are 0 (stacked) / 1 (2-col) / 2 (hero + grid). */
function normalizeMobileDisplayStyle(value: unknown): 0 | 1 | 2 {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === 1 || n === 2) return n;
  return 0;
}
import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { LargeHorizontalCard } from "@/components/pages/my-benefits-team/large-horizontal-card";

interface Contact {
  id?: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  customRole?: string;
  email?: string;
  phone?: string;
  phoneExtension?: string;
  headshot?: string;
  logo?: string;
  showOnPortal?: boolean;
  benefitsCategory?:
  | "Retirement"
  | "Health Insurance"
  | "Life Insurance"
  | "Company / Plan Sponsor"
  | "Other";
  benefitsCategoryOther?: string;
  companyName?: string;
  companyLogo?: string;
  isPrimary?: boolean;
  cardBackgroundColor?: string;
  logoScale?: number;
}

/**
 * Flow: 1) Fetch client (API with forPortal=1 already filters contacts by category).
 *       2) Compute visibility and filter to only non-hidden contacts (isContactHiddenByCategory).
 *       3) Render only those contacts; layouts also filter again before render (defensive).
 */
export default function MyBenefitsTeamPage() {
  const { clientData, loading, refetch } = useClientPortal();

  // Currently logged-in user — used to show the user's Organization Name on
  // their own contact card instead of the plan/contact company name.
  const { data: session } = useSession();
  const currentUserEmail = session?.user?.email || null;
  const currentUserOrgName = session?.user?.organizationName || null;
  // Seeded advisor contacts store the *organization* email, not the login email,
  // so the org-name override must match on both.
  const currentUserOrgEmail = session?.user?.organizationEmail || null;
  const currentUserEmails = [currentUserEmail, currentUserOrgEmail].filter(
    Boolean,
  ) as string[];

  useEffect(() => {
    refetch();
  }, [refetch]);

  /**
   * The logged-in user's CURRENT Organization Logo.
   *
   * Contact cards are seeded with the advisor's Organization Logo
   * (`seed-onboarding-advisor-contacts` writes `companyLogo: profile.advisorLogo ||
   * profile.advisorLogoUrl`), so the stored copy goes stale as soon as Settings →
   * Branding changes it. `/api/profile` is the authoritative source — and it is
   * single-flight with a cache that `invalidateProfileCache()` clears on save, so this
   * resolves to the new logo on the next visit. Only fetched when the viewer is signed
   * in, and only applied to their own card below.
   */
  const [currentUserLogo, setCurrentUserLogo] = useState<string | null>(null);
  useEffect(() => {
    if (currentUserEmails.length === 0) return;

    let cancelled = false;
    (async () => {
      const profile: any = await fetchProfileOnce().catch(() => null);
      if (cancelled || !profile) return;

      const logo =
        profile.advisorLogoUrl ||
        profile.advisorLogo ||
        profile.wizardSessions?.[0]?.branding?.logo ||
        null;
      setCurrentUserLogo(logo ? String(logo) : null);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
    // Keyed on the joined emails: the array itself is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserEmails.join("|")]);

  const brandColor = clientData?.brandColor || "#0D315F";
  const secondaryColor = clientData?.secondaryColor || "#C89B5B";
  const appointmentLink =
    clientData?.appointmentLink ||
    "https://go.oncehub.com/WFAParticipantInquiry";

  // Normalize keyContacts to handle both old format (array) and new format (object with contacts and displayStyle)
  let contacts: Contact[] = [];
  let displayStyle: 0 | 2 | 3 | 4 | null = null;
  let mobileDisplayStyle: 0 | 1 | 2 = 0;
  let globalBackgroundColor: string | undefined = undefined;
  /** Wizard saves logoScale on keyContacts root (same as card colors), not per contact */
  let globalLogoScale: number | undefined = undefined;

  if (clientData?.keyContacts) {
    const keyContactsData = clientData.keyContacts as any;
    if (Array.isArray(keyContactsData)) {
      // Old format: just an array
      contacts = keyContactsData.filter(
        (c: Contact) => c.showOnPortal !== false,
      );
    } else if (typeof keyContactsData === "object" && keyContactsData !== null) {
      // New format: { contacts: [...], displayStyle: ..., mobileDisplayStyle: ... }
      // Accept both `contacts` and legacy `Contacts` keys.
      const contactsArray = Array.isArray(keyContactsData.contacts)
        ? keyContactsData.contacts
        : Array.isArray(keyContactsData.Contacts)
          ? keyContactsData.Contacts
          : [];
      contacts = contactsArray.filter((c: Contact) => c.showOnPortal !== false);
      displayStyle = normalizeDisplayStyle(keyContactsData.displayStyle);
      mobileDisplayStyle = normalizeMobileDisplayStyle(
        keyContactsData.mobileDisplayStyle,
      );
      globalBackgroundColor = keyContactsData.cardBackgroundColor;
      globalLogoScale =
        typeof keyContactsData.logoScale === "number"
          ? keyContactsData.logoScale
          : undefined;
    }
  }

  // 1) Visibility from server (Category Display Show/Hide)
  const visibility = useMemo(() => {
    const raw =
      (clientData as any)?.categoryPortalVisibility ??
      clientData?.categoryPortalVisibility ??
      (typeof (clientData as any)?.employeePortalPreview === "object"
        ? (clientData as any).employeePortalPreview?.categoryPortalVisibility
        : undefined);
    return getCategoryPortalVisibility(raw);
  }, [
    clientData?.categoryPortalVisibility,
    (clientData as any)?.employeePortalPreview?.categoryPortalVisibility,
  ]);

  // Plan-level company name/logo — used for every Company / Plan Sponsor card
  // (not just the Main Contact) so they all read the same and always show a logo.
  const planCompanyName = clientData?.companyName || "";
  const planCompanyLogo = (clientData as any)?.companyLogo || "";

  // 2) Only contacts that are NOT hidden by category — fetch → check isHidden → then we only render these
  const visibleContacts: Contact[] = useMemo(() => {
    const filtered = contacts.filter(
      (c: any) => !isContactHiddenByCategory(c, visibility)
    );
    return filtered.map((contact: any) => {
      const normalized: Contact = { ...contact };
      // Carry the plan id so the Contact Form CTA can resolve the plan's live
      // "Topic of Interest" configuration at click time (see
      // resolveContactFormUrl).
      if (clientData?.id) {
        (normalized as any).planId = clientData.id;
      }
      if (!normalized.name && (normalized.firstName || normalized.lastName)) {
        normalized.name = `${normalized.firstName || ""} ${normalized.lastName || ""}`.trim();
      }

      const categories = getContactCategoriesFromLib(contact);
      const isPlanSponsor =
        categories.includes("Company / Plan Sponsor") ||
        contact.benefitsCategory === "Company / Plan Sponsor";

      if (isPlanSponsor) {
        // Every Company / Plan Sponsor card shows the plan's company name and
        // logo, matching the Main Contact card.
        normalized.companyName = planCompanyName || normalized.companyName || "";
        normalized.companyLogo = contact.companyLogo || planCompanyLogo || undefined;
        normalized.logo = normalized.companyLogo;
      } else {
        if (normalized.companyLogo && !normalized.logo) {
          normalized.logo = normalized.companyLogo;
        }
        // If this contact is the logged-in user, show their Organization Name
        // as the company name on the card.
        normalized.companyName = resolveContactCompanyName(
          contact,
          currentUserEmails,
          currentUserOrgName,
        );
        // The logged-in user's own card shows their CURRENT Organization Logo: its
        // logo was pre-populated from that same value at seed time, so a later change
        // in Settings must win over the stored copy.
        //
        // Scoped to this branch on purpose — a Company / Plan Sponsor contact goes
        // through the branch above and represents the plan's company, so it must keep
        // THAT company's logo even when the card belongs to the logged-in user.
        if (currentUserLogo && isLoggedInUserContact(contact, currentUserEmails)) {
          normalized.companyLogo = currentUserLogo;
          normalized.logo = currentUserLogo;
        }
      }

      normalized.cardBackgroundColor = contact.cardBackgroundColor;
      normalized.logoScale =
        contact.logoScale ?? globalLogoScale ?? 1;
      return normalized;
    });
  }, [
    contacts,
    visibility,
    clientData?.id,
    globalLogoScale,
    currentUserEmail,
    currentUserOrgEmail,
    currentUserOrgName,
    currentUserLogo,
    planCompanyName,
    planCompanyLogo,
  ]);

  const primaryContact = visibleContacts[0];
  const rest = visibleContacts.slice(1);

  // Mark primary contact visually
  if (primaryContact) {
    (primaryContact as any).isPrimary = true;
  }
  // Ensure rest are not primary
  rest.forEach((c: any) => {
    c.isPrimary = false;
  });

  const companyName = clientData?.companyName || "";

  // Show skeleton while loading, null when no data after loading
  if (!clientData) {
    if (loading) return <MyBenefitsTeamSkeleton />;
    return null;
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* TITLE */}
        <div className="text-center">
          <h1
            className="text-4xl font-semibold mb-8"
            style={{
              fontFamily: "var(--font-headline)",
              color: brandColor,
            }}
          >
            My Benefits Team
          </h1>
        </div>

        {/* 3) Render only non-hidden contacts (visibility passed for defensive filter in layouts).
             Desktop layouts (md and up) mirror step-3d.tsx EXACTLY — grid columns, gaps,
             and card types must stay in sync. Mobile layouts render below md from
             mobileDisplayStyle (0 = Stacked, 1 = 2-Column, 2 = Hero + Grid). */}
        <div className="hidden md:block">
          {displayStyle === 0 && (
            <DefaultLayout
              primaryContact={primaryContact}
              rest={rest}
              visibility={visibility}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              baselineBackgroundColor={globalBackgroundColor}
            />
          )}
          {displayStyle === 2 && (
            <Layout2
              contacts={visibleContacts}
              visibility={visibility}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              baselineBackgroundColor={globalBackgroundColor}
            />
          )}
          {displayStyle === 3 && (
            <Layout3
              contacts={visibleContacts}
              visibility={visibility}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              baselineBackgroundColor={globalBackgroundColor}
            />
          )}
          {displayStyle === 4 && (
            <Layout4
              primaryContact={primaryContact}
              rest={rest}
              visibility={visibility}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              baselineBackgroundColor={globalBackgroundColor}
            />
          )}
          {displayStyle === null && (
            <DefaultLayout
              primaryContact={primaryContact}
              rest={rest}
              visibility={visibility}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              baselineBackgroundColor={globalBackgroundColor}
            />
          )}
        </div>

        {/* MOBILE LAYOUT (below md) — uses mobileDisplayStyle (mirrors step-3d mobile preview) */}
        <div className="md:hidden">
          <MobileLayout
            contacts={visibleContacts}
            mobileDisplayStyle={mobileDisplayStyle}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            baselineBackgroundColor={globalBackgroundColor}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------
   LAYOUT COMPONENTS
--------------------------------------------------- */

// Layout 4 (displayStyle 4): all compact vertical cards — 2 top row + 3 bottom row
// Mirrors step-3d.tsx displayStyle 4 EXACTLY — step-3d converts "large" slots
// to compact SmallVerticalCard on desktop, so every card renders vertically.
function Layout4({
  primaryContact,
  rest,
  visibility,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
}: {
  primaryContact?: Contact;
  rest: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
}) {
  const restVisible = rest.filter((c) => !isContactHiddenByCategory(c as any, visibility));
  const [first, ...smallCards] = restVisible;
  const showPrimary = primaryContact && !isContactHiddenByCategory(primaryContact as any, visibility);

  return (
    <div className="space-y-4">
      {/* TOP ROW — 2 vertical cards */}
      <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
        {showPrimary && primaryContact && (
          <SmallVerticalCard
            contact={{
              ...primaryContact,
              isPrimary: true,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={0}
            baselineBackgroundColor={baselineBackgroundColor}
          />
        )}
        {first && (
          <SmallVerticalCard
            contact={{
              ...first,
              isPrimary: false,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={1}
            baselineBackgroundColor={baselineBackgroundColor}
          />
        )}
      </div>

      {/* BOTTOM ROW — remaining vertical cards */}
      {smallCards.length > 0 && (
        <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 gap-4 [&>*]:min-w-0">
          {smallCards.map((contact, index) => (
            <SmallVerticalCard
              key={contact.id || index}
              contact={{
                ...contact,
                isPrimary: false,
              }}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              index={index + 2}
              baselineBackgroundColor={baselineBackgroundColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Layout 2 (displayStyle 2): compact vertical cards in a 2×2 grid
// Mirrors step-3d.tsx displayStyle 2 EXACTLY — step-3d converts "large"
// slots to compact SmallVerticalCard for Layout 2 on desktop.
function Layout2({
  contacts,
  visibility,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
}: {
  contacts: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
}) {
  const toRender = contacts.filter((c) => !isContactHiddenByCategory(c as any, visibility));
  const contactsWithPrimary = toRender.map((contact, index) => ({
    ...contact,
    isPrimary: index === 0,
  }));

  return (
    <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
      {contactsWithPrimary.map((contact, index) => (
        <SmallVerticalCard
          key={contact.id || index}
          contact={contact}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          index={index}
          baselineBackgroundColor={baselineBackgroundColor}
        />
      ))}
    </div>
  );
}

// Layout 3 (displayStyle 3): 8 small vertical (responsive grid)
// Mirrors step-3d.tsx displayStyle 3 EXACTLY.
function Layout3({
  contacts,
  visibility,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
}: {
  contacts: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
}) {
  const toRender = contacts.filter((c) => !isContactHiddenByCategory(c as any, visibility));
  const contactsWithPrimary = toRender.map((contact, index) => ({
    ...contact,
    isPrimary: index === 0,
  }));

  return (
    <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 [&>*]:min-w-0">
      {contactsWithPrimary.map((contact, index) => (
        <SmallVerticalCard
          key={contact.id || index}
          contact={contact}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          index={index}
          baselineBackgroundColor={baselineBackgroundColor}
        />
      ))}
    </div>
  );
}

// Default layout (displayStyle 0): 1 primary + 4 small vertical (responsive grid)
// Mirrors step-3d.tsx displayStyle 0 EXACTLY.
function DefaultLayout({
  primaryContact,
  rest,
  visibility,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
}: {
  primaryContact?: Contact;
  rest: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
}) {
  const showPrimary = primaryContact && !isContactHiddenByCategory(primaryContact as any, visibility);
  const restVisible = rest.filter((c) => !isContactHiddenByCategory(c as any, visibility));

  return (
    <div className="space-y-4">
      {/* ---------- PRIMARY CONTACT BLOCK ---------- */}
      {showPrimary && primaryContact && (
        <PrimaryContactCard
          contact={{ ...primaryContact, cardBackgroundColor: "#ffffffea" }}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          baselineBackgroundColor={baselineBackgroundColor}
        />
      )}

      {/* ---------- SECONDARY CONTACT CARDS ---------- */}
      {restVisible.length > 0 && (
        <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-4 gap-4 [&>*]:min-w-0">
          {restVisible.map((contact, index) => (
            <SmallVerticalCard
              key={contact.id || index}
              contact={{
                ...contact,
                isPrimary: false,
              }}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              index={index + 1}
              baselineBackgroundColor={baselineBackgroundColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Mobile layout (below md breakpoint) — mirrors step-3d.tsx mobile preview EXACTLY.
// mobileDisplayStyle: 0 = Stacked (single column), 1 = 2-Column Grid, 2 = Hero + Grid.
function MobileLayout({
  contacts,
  mobileDisplayStyle,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
}: {
  contacts: Contact[];
  mobileDisplayStyle: number;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
}) {
  const toRender = contacts.map((contact, index) => ({
    ...contact,
    isPrimary: index === 0,
  }));

  // All mobile cards render as compact vertical cards (matches step-3d mobile preview).
  const cards = toRender.map((contact, index) => (
    <SmallVerticalCard
      key={contact.id || index}
      contact={contact}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      appointmentLink={appointmentLink}
      companyName={companyName}
      index={index}
      compact={true}
      baselineBackgroundColor={baselineBackgroundColor}
    />
  ));

  if (mobileDisplayStyle === 1) {
    // 2-Column Grid
    return (
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
        {cards}
      </div>
    );
  }

  if (mobileDisplayStyle === 2) {
    // Hero + Grid: first card full-width, remaining in 2-column grid
    const hero = cards[0];
    const gridCards = cards.slice(1);
    return (
      <div className="w-full min-w-0 max-w-none space-y-2">
        {hero && <div className="w-full min-w-0">{hero}</div>}
        {gridCards.length > 0 && (
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
            {gridCards}
          </div>
        )}
      </div>
    );
  }

  // 0 (default): Stacked — all cards in a single column
  return (
    <div className="w-full min-w-0 max-w-none space-y-2">
      {cards}
    </div>
  );
}

/* ---------- Skeleton shown while clientData is loading ---------- */
function MyBenefitsTeamSkeleton() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center mb-11">
          <Skeleton className="h-10 w-64 mx-auto" />
        </div>

        {/* Default layout skeleton: 1 primary + 4 small */}
        <Skeleton className="h-52 w-full rounded-xl" />
        <div className="mt-3 w-full min-w-0">
          <div className="grid w-full min-w-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-1">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
