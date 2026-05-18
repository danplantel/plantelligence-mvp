"use client";

import { useMemo, useEffect } from "react";
import { useClientPortal } from "@/contexts/client-portal-context";
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
  const { clientData, refetch } = useClientPortal();

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (!clientData) return null;

  const brandColor = clientData.brandColor || "#0D315F";
  const secondaryColor = clientData.secondaryColor || "#C89B5B";
  const appointmentLink =
    clientData.appointmentLink ||
    "https://go.oncehub.com/WFAParticipantInquiry";

  // Normalize keyContacts to handle both old format (array) and new format (object with contacts and displayStyle)
  let contacts: Contact[] = [];
  let displayStyle: number | null = null;
  let globalBackgroundColor: string | undefined = undefined;
  /** Wizard saves logoScale on keyContacts root (same as card colors), not per contact */
  let globalLogoScale: number | undefined = undefined;

  if (clientData.keyContacts) {
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
      return normalized;
    });
  }, [contacts, visibility, globalLogoScale]);

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

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-10 pt-24">
        {/* TITLE */}
        <div className="text-center">
          <h1
            className="text-4xl font-semibold"
            style={{
              fontFamily: '"DM Serif Display", serif',
              color: brandColor,
            }}
          >
            My Benefits Team
          </h1>
        </div>

        {/* 3) Render only non-hidden contacts (visibility passed for defensive filter in layouts) */}
        {displayStyle === 0 && (
          <DefaultLayout
            primaryContact={primaryContact}
            rest={rest}
            visibility={visibility}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={clientData.companyName}
            baselineBackgroundColor={globalBackgroundColor}
          />
        )}
        {displayStyle === 1 && (
          <Layout1
            primaryContact={primaryContact}
            rest={rest}
            visibility={visibility}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={clientData.companyName}
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
            companyName={clientData.companyName}
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
            companyName={clientData.companyName}
            baselineBackgroundColor={globalBackgroundColor}
          />
        )}
        {displayStyle === 4 && (
          <Layout1
            primaryContact={primaryContact}
            rest={rest}
            visibility={visibility}
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            appointmentLink={appointmentLink}
            companyName={clientData.companyName}
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
            companyName={clientData.companyName}
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

// Layout 1: 1 large horizontal + 1 small vertical (top row) + 3 small vertical (bottom row)
function Layout1({
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
    <>
      {/* 2 LARGE HORIZONTAL CARDS */}
      <div className="mt-11 grid w-full min-w-0 gap-8 md:grid-cols-2">
        {showPrimary && primaryContact && (
          <div className="flex-shrink-0">
            <LargeHorizontalCard
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
          </div>
        )}
        {/* Small Vertical Card (Secondary) */}
        {first && (
          <LargeHorizontalCard
            contact={{
              ...first,
              isPrimary: false, // Second contact is not primary
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

      {/* SMALL VERTICAL CARDS - Show all remaining contacts */}
      {smallCards.length > 0 && (
        <div className="mt-3 w-full min-w-0">
          <div className="grid w-full min-w-0 grid-cols-3 gap-8">
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
        </div>
      )}
    </>
  );
}

// Layout 2: 4 large horizontal
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
    <div className="mt-10 grid w-full min-w-0 gap-8 md:grid-cols-2">
      {contactsWithPrimary.map((contact, index) => (
        <LargeHorizontalCard
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

// Layout 3: 8 small vertical
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
    <div className="mt-10 w-full min-w-0">
      <div className="grid w-full min-w-0 grid-cols-4 gap-8">
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
    </div>
  );
}

// Default layout (original layout)
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
    <>
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
        <div className="mt-3 w-full min-w-0">
          <div className="grid w-full min-w-0 grid-cols-4 gap-1">
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
        </div>
      )}
    </>
  );
}
