"use client";

import type { FAQContact } from "@/components/faq-section";
import { BenefitContactCard } from "@/components/pages/client-portal/sections/benefit-contact-card";
import { useOptionalClientPortal } from "@/contexts/client-portal-context";
import { normalizeContactCategory } from "@/lib/benefit-contacts";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import { HAVE_QUESTIONS_SECTION_ID } from "@/lib/portal-section-anchors";
import {
  supportCardColumnClass,
  supportCardSize,
  supportContactShowsCta,
} from "@/lib/support-card-layout";

/** The stored label for the plan-sponsor card ("Custom" is the wizard's name for it). */
const PLAN_SPONSOR_CATEGORY = normalizeContactCategory(
  "Company / Plan Sponsor",
);

interface HaveQuestionsProps {
  brandColor?: string;
  secondaryColor?: string;
  contacts?: FAQContact[];
  /** Where "Schedule Appt." books. Defaults to the plan's appointment link. */
  appointmentLink?: string;
  /** Company shown on each card when the contact carries none. */
  companyName?: string;
  /** The plan's logo — shown on the Company / Plan Sponsor card. */
  companyLogo?: string;
  /**
   * The plan's contacts, used to work out WHICH of the cards below is this
   * benefit's key contact. Falls back to the portal context's `keyContacts`.
   */
  keyContacts?: unknown;
  /**
   * Benefit category used to pick that key contact — the same resolver the
   * welcome banner and the journey section use, so the label can never point at
   * a different person than the rest of the page features. Without a category
   * there is no "key contact for this benefit" to label.
   */
  category?: string;
}

/**
 * "Have Questions?" — the support contacts closing every Benefit Hub.
 *
 * Renders the SAME card as My Benefits Team (`BenefitContactCard`, category
 * placement) rather than a hub-specific design, so the info (photo, name, role,
 * designations, email, phone) and the affordances (a primary CTA, clickable
 * `mailto:`/`tel:` rows, the company logo) can never drift between the two pages.
 *
 * The CTA is whatever the advisor configured on the contact (`enableContactButton`
 * + `contactButtonType`), passed straight through. It is NOT derived from the
 * fields the person happens to have: a contact the advisor never gave a button
 * renders no button, exactly as on My Benefits Team and in the plan's Key
 * Contacts.
 */
export function HaveQuestions({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  contacts,
  appointmentLink,
  companyName,
  companyLogo,
  keyContacts,
  category,
}: HaveQuestionsProps) {
  // The hub pages render this inside the portal provider; the wizard preview and
  // tests do not, hence the optional read.
  const { clientData } = useOptionalClientPortal();
  const resolvedAppointmentLink =
    appointmentLink || String((clientData as any)?.appointmentLink || "");
  const resolvedCompanyName = companyName || clientData?.companyName || "";
  const resolvedCompanyLogo =
    companyLogo || String((clientData as any)?.companyLogo || "");
  // The benefit's key contact, resolved exactly as the banner and the journey
  // section resolve it. No category means no key contact to point at: the
  // resolver would otherwise fall back to the plan's primary contact, labelling
  // someone the page never featured.
  const keyContactId = category
    ? String(
        resolvePortalPrimaryContact(
          keyContacts ?? (clientData as any)?.keyContacts,
          category,
        )?.id ?? "",
      )
    : "";

  if (!contacts || contacts.length === 0) return null;

  // The key contact leads the row. It is the person the page features — the one
  // the banner signs and the journey section schedules with — so it belongs first
  // from the left rather than wherever the benefit's selection happens to put it.
  // Every other card keeps its order behind it.
  const orderedContacts = keyContactId
    ? [
        ...contacts.filter((contact) => String(contact.id) === keyContactId),
        ...contacts.filter((contact) => String(contact.id) !== keyContactId),
      ]
    : contacts;

  // The row fills its parent whatever the count: four contacts share it as
  // quarters, three as thirds, two as halves, and a LONE card keeps a half
  // rather than stretching across the band. Fewer cards also means a bigger
  // element tier, so a 2-up card is a genuinely larger card — not a quarter
  // card with empty space around it (see `lib/support-card-layout`).
  const contactCount = orderedContacts.length;
  const columnClass = supportCardColumnClass(contactCount);
  const cardSize = supportCardSize(contactCount);

  // If even one card draws a button, every card in the row stretches to that
  // height — otherwise the row reads ragged, with the button-less cards ending a
  // CTA's height short (see `lib/support-card-layout`).
  const anyContactShowsCta = orderedContacts.some((contact) =>
    supportContactShowsCta(contact, resolvedAppointmentLink),
  );

  return (
    // The same light grey band as the FAQ section above it: it separates this block
    // from the white sections around it, and the white cards sit against it.
    // `id` + scroll margin: the journey section's "Schedule with …" buttons scroll
    // here, and the margin keeps the heading clear of the fixed portal header.
    //
    // From `lg` the band is at least one viewport tall and centres its content, so
    // the closing section fills the screen instead of leaving the next page (or the
    // footer) peeking in under a short row of cards. Phones keep the natural
    // height — a 100vh band there would only push the cards apart.
    <section
      id={HAVE_QUESTIONS_SECTION_ID}
      className="flex w-full scroll-mt-24 flex-col justify-center border-y border-black/5 bg-gray-100 px-4 py-20 sm:scroll-mt-28 sm:px-6 lg:min-h-screen lg:scroll-mt-32 lg:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-2 font-dm-serif text-3xl leading-tight text-gray-900 sm:text-4xl lg:text-[40px]">
            Have Questions?
          </h2>
          <p className="mx-auto max-w-[505px] font-red-hat text-[16px]">
            Our team is here to help you navigate your benefits and answer any
            questions you may have.
          </p>
        </div>

        {/* The row's column count comes from the number of support contacts
            (`supportCardColumnClass`): full width on phones, halves on tablets,
            then quarters / thirds / halves / a single half from `lg`. A flex row
            rather than a grid so a partial row is CENTRED — a lone card, or the
            third card of a 3-up row on a tablet, sits in the middle of the band
            instead of hugging the left edge.

            Each card is wrapped in a sizing div — the card itself is `w-full`, and
            the wrapper is what carries the column width. */}
        <div className="flex w-full flex-wrap justify-center gap-4 sm:gap-6">
          {orderedContacts.map((contact, index) => {
            const categories = (contact.benefitsCategories || []).filter(
              Boolean,
            );
            // Two kinds of card represent the PLAN rather than the person's own
            // employer, exactly as on My Benefits Team:
            //
            //  - one tagged "Company / Plan Sponsor" (or "Custom", its wizard name);
            //  - one tagged with NO category — a plan-level contact (the plan
            //    sponsor's own people, the client's main contact). Those rows
            //    carry no company of their own, so without this they render a
            //    logo-less card even though the plan has one.
            //
            // Both take the plan's company name and logo, and the plan's logo is
            // the fallback rather than the only source: a card with its own
            // company logo keeps it.
            const isPlanCompanyCard =
              categories.length === 0 ||
              categories.some(
                (contactCategory) =>
                  normalizeContactCategory(contactCategory) ===
                  PLAN_SPONSOR_CATEGORY,
              );

            // The one card this benefit points at. The label sits in a strip that
            // every card reserves, so a labelled card never shifts its row.
            const isKeyContact =
              Boolean(keyContactId) && String(contact.id) === keyContactId;

            return (
              // The wrapper carries the column width for this row's count (and
              // `min-w-0` keeps a long name from widening it off-centre).
              <div
                key={contact.id}
                data-testid="contact-column"
                className={columnClass}
              >
                <div className="mb-2 flex h-6 items-center justify-center">
                  {isKeyContact ? (
                    <span
                      data-testid="key-contact-label"
                      className="inline-flex items-center rounded-full border bg-white px-3 py-1 font-red-hat text-[11px] font-semibold uppercase tracking-[0.1em] shadow-sm"
                      style={{ borderColor: brandColor, color: brandColor }}
                    >
                      Key Contact
                    </span>
                  ) : null}
                </div>
                <BenefitContactCard
                  contact={{
                    id: contact.id,
                    // The FAQ contact stores the name in `title`; the shared card
                    // reads `name` and shows the role underneath.
                    name: contact.name || contact.title,
                    title: contact.description || undefined,
                    email: contact.email,
                    phone: contact.phone,
                    phoneExtension: contact.phoneExtension,
                    headshot: contact.headshot,
                    designations: contact.designations,
                    schedulingUrl: contact.schedulingUrl,
                    companyName: isPlanCompanyCard
                      ? resolvedCompanyName || contact.companyName
                      : contact.companyName,
                    // A card with no logo of its own borrows the plan's, exactly as
                    // the wizard's own contact preview does (`planLogoUrl` fallback).
                    // A contact whose employer has never had a logo uploaded — or
                    // who carries no company at all — otherwise rendered a
                    // logo-less card beside cards that do have one.
                    companyLogo: contact.companyLogo || resolvedCompanyLogo,
                    websiteUrl: contact.websiteUrl,
                    // The advisor's choice, untouched — no inferred CTA.
                    enableContactButton: contact.enableContactButton,
                    contactButtonType: contact.contactButtonType,
                    isPrimary: false,
                  }}
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                  // The support CTA wears the plan's PRIMARY colour, matching the
                  // other buttons on the hub (the card's default is secondary).
                  ctaColor={brandColor}
                  appointmentLink={resolvedAppointmentLink}
                  companyName={resolvedCompanyName}
                  index={index}
                  // The category placement renders the compact card: no benefit
                  // tag (the whole page is one benefit) and a denser layout. The
                  // `size` tier then scales that card to the width of its column.
                  placement="category"
                  compact
                  size={cardSize}
                  // Level heights whenever any card shows a CTA.
                  equalHeight={anyContactShowsCta}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
