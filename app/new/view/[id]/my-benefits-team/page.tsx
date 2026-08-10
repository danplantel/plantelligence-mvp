"use client";

import { useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientPortal } from "@/contexts/client-portal-context";
import { resolveContactCompanyName } from "@/lib/resolve-contact-company-name";
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

  useEffect(() => {
    refetch();
  }, [refetch]);

  const brandColor = clientData?.brandColor || "#0D315F";
  const secondaryColor = clientData?.secondaryColor || "#C89B5B";
  const appointmentLink =
    clientData?.appointmentLink ||
    "https://go.oncehub.com/WFAParticipantInquiry";

  // Normalize keyContacts to handle both old format (array) and new format (object with contacts and displayStyle)
  let contacts: Contact[] = [];
  let displayStyle: number | null = null;
  let globalBackgroundColor: string | undefined = undefined;
  /** Wizard saves logoScale on keyContacts root (same as card colors), not per contact */
  let globalLogoScale: number | undefined = undefined;

  if (clientData?.keyContacts) {
    if (Array.isArray(clientData.keyContacts)) {
      // Old format: just an array
      contacts = clientData.keyContacts.filter(
        (c: Contact) => c.showOnPortal !== false,
      );
    } else if (
      typeof clientData.keyContacts === "object" &&
      clientData.keyContacts !== null
    ) {
      // New format: { contacts: [...], displayStyle: ... }
      const keyContactsData = clientData.keyContacts as any;
      const contactsArray = Array.isArray(keyContactsData.contacts)
        ? keyContactsData.contacts
        : [];
      contacts = contactsArray.filter((c: Contact) => c.showOnPortal !== false);
      displayStyle = keyContactsData.displayStyle ?? null;
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

  // 2) Only contacts that are NOT hidden by category — fetch → check isHidden → then we only render these
  const visibleContacts: Contact[] = useMemo(() => {
    const filtered = contacts.filter(
      (c: any) => !isContactHiddenByCategory(c, visibility)
    );
    return filtered.map((contact: any) => {
      const normalized: Contact = { ...contact };
      if (!normalized.name && (normalized.firstName || normalized.lastName)) {
        normalized.name = `${normalized.firstName || ""} ${normalized.lastName || ""}`.trim();
      }
      if (normalized.companyLogo && !normalized.logo) normalized.logo = normalized.companyLogo;
      normalized.cardBackgroundColor = contact.cardBackgroundColor;
      normalized.logoScale =
        contact.logoScale ?? globalLogoScale ?? 1;
      // If this contact is the logged-in user, show their Organization Name
      // as the company name on the card.
      normalized.companyName = resolveContactCompanyName(
        contact,
        currentUserEmail,
        currentUserOrgName,
      );
      return normalized;
    });
  }, [contacts, visibility, globalLogoScale, currentUserEmail, currentUserOrgName]);

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
              fontFamily: '"DM Serif Display", serif',
              color: brandColor,
            }}
          >
            My Benefits Team
          </h1>
        </div>

        {/* 3) Render only non-hidden contacts (visibility passed for defensive filter in layouts).
             Layouts mirror step-3d.tsx EXACTLY — grid columns, gaps, and card types must stay in sync. */}
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
          contact={primaryContact}
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
