"use client";

import type { FAQContact } from "@/components/faq-section";
import { BenefitContactCard } from "@/components/pages/client-portal/sections/benefit-contact-card";
import { useOptionalClientPortal } from "@/contexts/client-portal-context";
import { normalizeContactCategory } from "@/lib/benefit-contacts";
import { HAVE_QUESTIONS_SECTION_ID } from "@/lib/portal-section-anchors";

/** The stored label for the plan-sponsor card ("Custom" is the wizard's name for it). */
const PLAN_SPONSOR_CATEGORY = normalizeContactCategory("Company / Plan Sponsor");

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
}: HaveQuestionsProps) {
  // The hub pages render this inside the portal provider; the wizard preview and
  // tests do not, hence the optional read.
  const { clientData } = useOptionalClientPortal();
  const resolvedAppointmentLink =
    appointmentLink || String((clientData as any)?.appointmentLink || "");
  const resolvedCompanyName = companyName || clientData?.companyName || "";
  const resolvedCompanyLogo =
    companyLogo || String((clientData as any)?.companyLogo || "");

  if (!contacts || contacts.length === 0) return null;

  return (
    // The same light grey band as the FAQ section above it: it separates this block
    // from the white sections around it, and the white cards sit against it.
    // `id` + scroll margin: the journey section's "Schedule with …" buttons scroll
    // here, and the margin keeps the heading clear of the fixed portal header.
    <section
      id={HAVE_QUESTIONS_SECTION_ID}
      className="w-full scroll-mt-24 border-y border-black/5 bg-gray-100 px-4 py-20 sm:scroll-mt-28 sm:px-6 lg:scroll-mt-32 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2
            className="mb-2 font-dm-serif text-3xl leading-tight sm:text-4xl lg:text-[40px]"
            style={{ color: brandColor }}
          >
            Have Questions?
          </h2>
          <p className="mx-auto max-w-[505px] font-red-hat text-[16px]">
            Our team is here to help you navigate your benefits and answer any
            questions you may have.
          </p>
        </div>

        {/* One row of four from `lg`; two across on tablets, stacked on phones.
            A flex row rather than a grid so a partial row is CENTRED: with one,
            two or three support contacts the cards sit in the middle of the band
            instead of hugging the left edge. The widths are the same fourths (and
            halves) a grid would give them, so a full row is unchanged.

            Each card is wrapped in a sizing div — the card itself is `w-full`, and
            the wrapper is what carries the column width. */}
        <div className="flex w-full flex-wrap justify-center gap-4 sm:gap-6">
          {contacts.map((contact, index) => {
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
                (category) =>
                  normalizeContactCategory(category) === PLAN_SPONSOR_CATEGORY,
              );

            return (
              // Half the row on tablets (one 1.5rem gap), a quarter from `lg`
              // (three 1.5rem gaps). `min-w-0` keeps a long name from widening
              // its column and pushing the row off-centre.
              <div
                key={contact.id}
                className="w-full min-w-0 sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)]"
              >
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
                    companyLogo: isPlanCompanyCard
                      ? contact.companyLogo || resolvedCompanyLogo
                      : contact.companyLogo,
                    websiteUrl: contact.websiteUrl,
                    // The advisor's choice, untouched — no inferred CTA.
                    enableContactButton: contact.enableContactButton,
                    contactButtonType: contact.contactButtonType,
                    isPrimary: false,
                  }}
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                  appointmentLink={resolvedAppointmentLink}
                  companyName={resolvedCompanyName}
                  index={index}
                  // The category placement renders the compact card: no benefit
                  // tag (the whole page is one benefit) and a denser layout.
                  placement="category"
                  compact
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
