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
  customBenefitTitleFromHubs,
  isCustomHubCategory,
} from "@/lib/benefit-custom-name";
import { canonicalContactCategory } from "@/lib/benefit-contacts";
import {
  isContactVisibleInPortal,
  getCategoryPortalVisibility,
  getContactCategories as getContactCategoriesFromLib,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import { portalRadiusValue } from "@/lib/typography-themes";
import {
  supportCardColumnClass,
  supportCardSize,
  supportContactShowsCta,
} from "@/lib/support-card-layout";

/** True if contact should be hidden by Category Display (Show/Hide). Use: fetch → filter by !isHidden → render. */
function isContactHiddenByCategory(
  contact: Record<string, unknown>,
  visibility: CategoryPortalVisibility,
): boolean {
  return !isContactVisibleInPortal(
    getContactCategoriesFromLib(contact),
    visibility,
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
// The one card shared with the benefit category pages (Retirement, Group Health,
// …). `placement="team"` is this page; the category pages pass "category" and get
// the compact variant. Routing both surfaces through it is what keeps them in
// lockstep for the upcoming card design review.
import { BenefitContactCard } from "@/components/pages/client-portal/sections/benefit-contact-card";

interface Contact {
  id?: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  /** Free-text designations, each rendered directly under the job title. */
  designations?: string[];
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
  const {
    clientData,
    profile: advisorProfile,
    loading,
    refetch,
  } = useClientPortal();

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

  // The plan's ADVISOR profile, resolved server-side by the portal provider
  // (`/api/profile?forPortal=1&clientSlug=…`). Unlike the session JWT it is read on
  // every portal load, so it reflects a rename in Settings → Branding, and it is
  // returned to anonymous viewers too — which is what the advisor's own contact card
  // actually needs. It identifies the advisor's card by their real email rather than
  // by whoever happens to be signed in.
  const advisorOrgName = (advisorProfile?.organizationName || "").trim();
  const advisorEmail = (advisorProfile?.email || "").trim();

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
  /** The viewer's CURRENT designations from /api/profile — applied to their own card
   *  below for the same reason as the logo: the stored contact row is a copy, and it
   *  was seeded without the designations, so the owner's own card showed none. */
  const [currentUserDesignations, setCurrentUserDesignations] = useState<
    string[]
  >([]);
  /** CURRENT Organization Name from /api/profile — see the comment in the effect below. */
  const [currentUserOrgNameLive, setCurrentUserOrgNameLive] = useState<
    string | null
  >(null);
  /** The login + organization email from /api/profile, used to match the advisor's
   *  own contact row even when the stored copy still holds a previous address. */
  const [profileEmails, setProfileEmails] = useState<string[]>([]);
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

      // Same source, same reason: the current Organization Name for the user's own
      // contact card, rather than the stale value baked into the session JWT.
      const orgName =
        profile.organizationName ||
        profile.wizardSessions?.[0]?.branding?.organizationName ||
        profile.organizationType ||
        null;
      setCurrentUserOrgNameLive(orgName ? String(orgName).trim() : null);

      setProfileEmails(
        [profile.email, profile.organizationEmail]
          .filter((value: unknown) => typeof value === "string" && value.trim())
          .map((value: string) => value.trim()),
      );

      // Their designations, so their own card shows the credentials Settings →
      // Profile holds even when the stored contact row predates them.
      setCurrentUserDesignations(
        Array.isArray(profile.designations)
          ? profile.designations.filter(
              (value: unknown): value is string =>
                typeof value === "string" && value.trim().length > 0,
            )
          : [],
      );
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
    } else if (
      typeof keyContactsData === "object" &&
      keyContactsData !== null
    ) {
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

  /** Every email we can resolve for the plan's advisor, de-duplicated. Identifies which
   *  contact row is theirs: the portal-resolved advisor profile (works for anonymous
   *  viewers), the session, and the full profile. */
  const matchEmails = Array.from(
    new Set(
      [advisorEmail, currentUserEmail, currentUserOrgEmail, ...profileEmails]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  // 2) Only contacts that are NOT hidden by category — fetch → check isHidden → then we only render these
  const visibleContacts: Contact[] = useMemo(() => {
    const filtered = contacts.filter(
      (c: any) => !isContactHiddenByCategory(c, visibility),
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
        normalized.name = `${normalized.firstName || ""} ${
          normalized.lastName || ""
        }`.trim();
      }

      const categories = getContactCategoriesFromLib(contact);
      const isPlanSponsor =
        categories.includes("Company / Plan Sponsor") ||
        contact.benefitsCategory === "Company / Plan Sponsor";
      // Whether this row is the ADVISOR's own contact. Matching uses every email we can
      // resolve for them (portal advisor profile + session + full profile) because the
      // seeded row stores whichever address the user had at seed time — often the
      // organization email, and possibly one that has since been changed.
      const isOwnContact = isLoggedInUserContact(contact, matchEmails);
      // The advisor's CURRENT Organization Name, preferring the portal-resolved advisor
      // profile (read on every request) over the session JWT snapshot.
      const ownOrgName = (
        advisorOrgName ||
        currentUserOrgNameLive ||
        currentUserOrgName ||
        ""
      ).trim();

      if (isPlanSponsor) {
        // Every Company / Plan Sponsor card keeps the PLAN's company name and logo,
        // matching the Main Contact card — even when the row happens to belong to the
        // advisor. A Company / Plan Sponsor card represents the plan sponsor, so it
        // must never be relabelled with the advisor's organization.
        normalized.companyName =
          planCompanyName || normalized.companyName || "";
        normalized.companyLogo =
          contact.companyLogo || planCompanyLogo || undefined;
        normalized.logo = normalized.companyLogo;
      } else {
        if (normalized.companyLogo && !normalized.logo) {
          normalized.logo = normalized.companyLogo;
        }
        // The advisor's own card shows their Organization Name; every other contact
        // keeps their own company name (resolveContactCompanyName falls back to the
        // contact's stored value).
        normalized.companyName = resolveContactCompanyName(
          contact,
          matchEmails,
          ownOrgName || null,
        );
        // The advisor's own card shows their CURRENT Organization Logo: its logo was
        // pre-populated from that same value at seed time, so a later change in
        // Settings must win over the stored copy.
        //
        // Scoped to this branch on purpose — a Company / Plan Sponsor contact goes
        // through the branch above and represents the plan's company, so it must keep
        // THAT company's logo even when the card belongs to the logged-in user.
        if (currentUserLogo && isOwnContact) {
          normalized.companyLogo = currentUserLogo;
          normalized.logo = currentUserLogo;
        }
      }

      // The viewer's own card falls back to their CURRENT designations (see above)
      // only when the stored row carries none — it was seeded from the profile
      // before designations were copied onto it. A row that already has them keeps
      // them, so clearing the pills in the wizard's Edit Panel is not silently
      // undone here.
      const storedDesignations = Array.isArray(normalized.designations)
        ? normalized.designations.filter(
            (value: unknown): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
        : [];
      if (
        isOwnContact &&
        currentUserDesignations.length > 0 &&
        storedDesignations.length === 0
      ) {
        normalized.designations = currentUserDesignations;
      }

      // A card with no logo of its own borrows one — but the RIGHT one. A person
      // who works for the ADVISOR'S OWN ORGANIZATION (the firm that provides the
      // benefit) gets the organization's branding logo, never the plan sponsor's;
      // every other card falls back to the plan's mark, as the hub does.
      if (!normalized.companyLogo && !normalized.logo) {
        const isOrgCompany =
          !!ownOrgName &&
          (normalized.companyName || "").trim().toLowerCase() ===
            ownOrgName.toLowerCase();
        const fallbackLogo = isOrgCompany
          ? currentUserLogo || ""
          : planCompanyLogo;
        if (fallbackLogo) {
          normalized.companyLogo = fallbackLogo;
          normalized.logo = fallbackLogo;
        }
      }

      normalized.cardBackgroundColor = contact.cardBackgroundColor;
      normalized.logoScale = contact.logoScale ?? globalLogoScale ?? 1;
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
    currentUserOrgNameLive,
    currentUserLogo,
    currentUserDesignations,
    advisorOrgName,
    advisorEmail,
    profileEmails,
    planCompanyName,
    planCompanyLogo,
  ]);

  // Every card's logo fallback now happens above, in the normalisation map, so the
  // headline card and the support cards cannot disagree about it.
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

  /**
   * The advisor's own name for the plan's Custom benefit.
   *
   * A contact tagged "Other Benefits" covers that benefit, so the card names it
   * instead of printing the generic label — and prints nothing while the plan has
   * no custom benefit at all. Read from the portal's hub rows (`Benefit.title`),
   * the same source the header's Custom hub link uses.
   */
  const customBenefitName = customBenefitTitleFromHubs(
    (clientData as any)?.benefitHubs,
  );

  /**
   * Every benefit the plan offers, in the same labels the card pills use.
   *
   * A contact who covers all of them — the advisor's own row normally carries
   * every category — is shown as one "All Benefits" pill instead of a row that
   * repeats the plan's benefit list. The Custom hub is named with the advisor's
   * own name for it, and an unnamed Custom benefit drops out (nothing to cover).
   */
  const planBenefitLabels = useMemo(() => {
    const hubs = (clientData as any)?.benefitHubs;
    if (!Array.isArray(hubs)) return [] as string[];
    const labels = hubs.map((hub: any) => {
      const category = String(hub?.category || "").trim();
      if (isCustomHubCategory(category)) return customBenefitName || "";
      return canonicalContactCategory(category);
    });
    return Array.from(new Set(labels.filter(Boolean))) as string[];
  }, [clientData, customBenefitName]);

  // Show skeleton while loading, null when no data after loading
  if (!clientData) {
    if (loading) return <MyBenefitsTeamSkeleton />;
    return null;
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Same width as the benefit hubs' "Have Questions?" band, so the two
          contact surfaces read at the same scale. */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8">
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
              customBenefitName={customBenefitName}
              planBenefitLabels={planBenefitLabels}
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
              customBenefitName={customBenefitName}
              planBenefitLabels={planBenefitLabels}
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
              customBenefitName={customBenefitName}
              planBenefitLabels={planBenefitLabels}
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
              customBenefitName={customBenefitName}
              planBenefitLabels={planBenefitLabels}
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
              customBenefitName={customBenefitName}
              planBenefitLabels={planBenefitLabels}
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
            customBenefitName={customBenefitName}
            planBenefitLabels={planBenefitLabels}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------
   LAYOUT COMPONENTS
--------------------------------------------------- */

/**
 * One row of SUPPORT cards, rendered the way the benefit hub's "Have Questions?"
 * band renders them:
 *
 *  - the row fills its parent, its column count coming from how many cards it
 *    holds — a plan with two contacts gets two halves, not two quarters and a
 *    pair of empty columns;
 *  - each card takes the element tier that matches that width, so a 2-up card is
 *    a genuinely larger card rather than a quarter card with slack in it;
 *  - the row levels to its tallest card as soon as one card draws a CTA;
 *  - the CTA wears the plan's PRIMARY colour, exactly as it does on the hub.
 *
 * The PRIMARY card is deliberately not part of this row — it keeps its own
 * headline layout.
 */
function SupportCardsRow({
  contacts,
  visibility,
  brandColor,
  secondaryColor,
  appointmentLink,
  companyName,
  baselineBackgroundColor,
  customBenefitName,
  planBenefitLabels,
  startIndex = 1,
}: {
  contacts: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
  customBenefitName?: string | null;
  planBenefitLabels?: string[];
  startIndex?: number;
}) {
  const visible = contacts.filter(
    (contact) => !isContactHiddenByCategory(contact as any, visibility),
  );
  if (visible.length === 0) return null;

  const columnClass = supportCardColumnClass(visible.length);
  const cardSize = supportCardSize(visible.length);
  const anyCta = visible.some((contact) =>
    supportContactShowsCta(contact as any, appointmentLink),
  );

  return (
    <div className="flex w-full flex-wrap justify-center gap-4 sm:gap-6">
      {visible.map((contact, index) => (
        <div
          key={contact.id || index}
          data-testid="contact-column"
          // The wrapper carries the column width (`min-w-0` keeps a long name
          // from widening it off-centre).
          className={columnClass}
        >
          <BenefitContactCard
            contact={{ ...contact, isPrimary: false }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            ctaColor={brandColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={index + startIndex}
            baselineBackgroundColor={baselineBackgroundColor}
            customBenefitName={customBenefitName}
            planBenefitLabels={planBenefitLabels}
            placement="team"
            size={cardSize}
            equalHeight={anyCta}
          />
        </div>
      ))}
    </div>
  );
}

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
  customBenefitName,
  planBenefitLabels,
}: {
  primaryContact?: Contact;
  rest: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
  customBenefitName?: string | null;
  planBenefitLabels?: string[];
}) {
  const restVisible = rest.filter(
    (c) => !isContactHiddenByCategory(c as any, visibility),
  );
  const [first, ...smallCards] = restVisible;
  const showPrimary =
    primaryContact &&
    !isContactHiddenByCategory(primaryContact as any, visibility);

  // Each of the two rows levels on its own, and every CTA wears the plan's
  // primary colour — the same button treatment the hub uses.
  const showsCta = (contact?: Contact) =>
    contact ? supportContactShowsCta(contact as any, appointmentLink) : false;
  const topRowHasCta = showsCta(primaryContact) || showsCta(first);
  const bottomRowHasCta = smallCards.some((contact) => showsCta(contact));

  return (
    <div className="space-y-4">
      {/* TOP ROW — 2 vertical cards */}
      <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
        {showPrimary && primaryContact && (
          <BenefitContactCard
            contact={{
              ...primaryContact,
              isPrimary: true,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            ctaColor={brandColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={0}
            baselineBackgroundColor={baselineBackgroundColor}
            customBenefitName={customBenefitName}
            planBenefitLabels={planBenefitLabels}
            placement="team"
            size={supportCardSize(2)}
            equalHeight={topRowHasCta}
          />
        )}
        {first && (
          <BenefitContactCard
            contact={{
              ...first,
              isPrimary: false,
            }}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            ctaColor={brandColor}
            appointmentLink={appointmentLink}
            companyName={companyName}
            index={1}
            baselineBackgroundColor={baselineBackgroundColor}
            customBenefitName={customBenefitName}
            planBenefitLabels={planBenefitLabels}
            placement="team"
            size={supportCardSize(2)}
            equalHeight={topRowHasCta}
          />
        )}
      </div>

      {/* BOTTOM ROW — remaining vertical cards */}
      {smallCards.length > 0 && (
        <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 gap-4 [&>*]:min-w-0">
          {smallCards.map((contact, index) => (
            <BenefitContactCard
              key={contact.id || index}
              contact={{
                ...contact,
                isPrimary: false,
              }}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              ctaColor={brandColor}
              appointmentLink={appointmentLink}
              companyName={companyName}
              index={index + 2}
              baselineBackgroundColor={baselineBackgroundColor}
              customBenefitName={customBenefitName}
              planBenefitLabels={planBenefitLabels}
              placement="team"
              size={supportCardSize(smallCards.length)}
              equalHeight={bottomRowHasCta}
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
  customBenefitName,
  planBenefitLabels,
}: {
  contacts: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
  customBenefitName?: string | null;
  planBenefitLabels?: string[];
}) {
  const toRender = contacts.filter(
    (c) => !isContactHiddenByCategory(c as any, visibility),
  );
  const contactsWithPrimary = toRender.map((contact, index) => ({
    ...contact,
    isPrimary: index === 0,
  }));

  // This layout deliberately wraps two-up, so its cards keep the 2-up tier — but
  // they level to each other as soon as one of them shows a CTA, and the CTA wears
  // the plan's primary colour like the hub's.
  const anyCta = contactsWithPrimary.some((contact) =>
    supportContactShowsCta(contact as any, appointmentLink),
  );

  return (
    <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
      {contactsWithPrimary.map((contact, index) => (
        <BenefitContactCard
          key={contact.id || index}
          contact={contact}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          ctaColor={brandColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          index={index}
          baselineBackgroundColor={baselineBackgroundColor}
          customBenefitName={customBenefitName}
          planBenefitLabels={planBenefitLabels}
          placement="team"
          size={supportCardSize(2)}
          equalHeight={anyCta}
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
  customBenefitName,
  planBenefitLabels,
}: {
  contacts: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
  customBenefitName?: string | null;
  planBenefitLabels?: string[];
}) {
  const toRender = contacts.filter(
    (c) => !isContactHiddenByCategory(c as any, visibility),
  );
  const contactsWithPrimary = toRender.map((contact, index) => ({
    ...contact,
    isPrimary: index === 0,
  }));

  // Same count-driven row as the hub: this layout is one row of support cards.
  return (
    <SupportCardsRow
      contacts={contactsWithPrimary}
      visibility={visibility}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      appointmentLink={appointmentLink}
      companyName={companyName}
      baselineBackgroundColor={baselineBackgroundColor}
      customBenefitName={customBenefitName}
      planBenefitLabels={planBenefitLabels}
      startIndex={0}
    />
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
  customBenefitName,
  planBenefitLabels,
}: {
  primaryContact?: Contact;
  rest: Contact[];
  visibility: CategoryPortalVisibility;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
  customBenefitName?: string | null;
  planBenefitLabels?: string[];
}) {
  const showPrimary =
    primaryContact &&
    !isContactHiddenByCategory(primaryContact as any, visibility);
  const restVisible = rest.filter(
    (c) => !isContactHiddenByCategory(c as any, visibility),
  );

  return (
    <div className="space-y-4">
      {/* ---------- PRIMARY CONTACT BLOCK ---------- */}
      {showPrimary && primaryContact && (
        <BenefitContactCard
          asPrimary
          contact={{ ...primaryContact, cardBackgroundColor: "#ffffffea" }}
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          appointmentLink={appointmentLink}
          companyName={companyName}
          baselineBackgroundColor={baselineBackgroundColor}
          customBenefitName={customBenefitName}
          planBenefitLabels={planBenefitLabels}
          placement="team"
        />
      )}

      {/* ---------- SUPPORT CARDS ---------- */}
      {/* One count-driven row, exactly like the hub's "Have Questions?" band. */}
      <SupportCardsRow
        contacts={restVisible}
        visibility={visibility}
        brandColor={brandColor}
        secondaryColor={secondaryColor}
        appointmentLink={appointmentLink}
        companyName={companyName}
        baselineBackgroundColor={baselineBackgroundColor}
        customBenefitName={customBenefitName}
        planBenefitLabels={planBenefitLabels}
        startIndex={1}
      />
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
  customBenefitName,
  planBenefitLabels,
}: {
  contacts: Contact[];
  mobileDisplayStyle: number;
  brandColor: string;
  secondaryColor: string;
  appointmentLink: string;
  companyName: string;
  baselineBackgroundColor?: string;
  customBenefitName?: string | null;
  planBenefitLabels?: string[];
}) {
  const toRender = contacts.map((contact, index) => ({
    ...contact,
    isPrimary: index === 0,
  }));

  /**
   * One mobile card. `variant` picks the phone design inside the shared card:
   * `wide` for a card that owns the full width of the screen, `compact` for the
   * cards that share a row in the 2-column grid.
   */
  const renderCard = (
    contact: Contact,
    index: number,
    variant: "wide" | "compact",
  ) => (
    <BenefitContactCard
      key={contact.id || index}
      contact={contact}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      // Same CTA colour the hub's support cards use.
      ctaColor={brandColor}
      appointmentLink={appointmentLink}
      companyName={companyName}
      index={index}
      compact={true}
      mobileVariant={variant}
      baselineBackgroundColor={baselineBackgroundColor}
      customBenefitName={customBenefitName}
      planBenefitLabels={planBenefitLabels}
      placement="team"
    />
  );

  if (mobileDisplayStyle === 1) {
    // 2-Column Grid — every card shares a row, so all use the narrow variant.
    return (
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
        {toRender.map((contact, index) =>
          renderCard(contact, index, "compact"),
        )}
      </div>
    );
  }

  if (mobileDisplayStyle === 2) {
    // Hero + Grid: first card full-width, remaining in 2-column grid
    const [hero, ...gridContacts] = toRender;
    return (
      <div className="w-full min-w-0 max-w-none space-y-2">
        {hero && (
          <div className="w-full min-w-0">{renderCard(hero, 0, "wide")}</div>
        )}
        {gridContacts.length > 0 && (
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
            {gridContacts.map((contact, index) =>
              renderCard(contact, index + 1, "compact"),
            )}
          </div>
        )}
      </div>
    );
  }

  // 0 (default): Stacked — each card owns the full width, so all use the wide variant.
  return (
    <div className="w-full min-w-0 max-w-none space-y-2">
      {toRender.map((contact, index) => renderCard(contact, index, "wide"))}
    </div>
  );
}

/* ---------- Skeleton shown while clientData is loading ---------- */
function MyBenefitsTeamSkeleton() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center mb-11">
          <Skeleton className="h-10 w-64 mx-auto" />
        </div>

        {/* Default layout skeleton: 1 primary + 4 small. It mirrors the loaded
            cards, so it carries the same typography-theme corners. */}
        <Skeleton
          className="h-52 w-full rounded-xl"
          style={{ borderRadius: portalRadiusValue(1.5) }}
        />
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
