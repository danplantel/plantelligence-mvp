"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PiggyBank, Shield, Heart, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { readableColor } from "polished";

import {
  Benefit,
  KeyContact,
  BenefitsCategory,
} from "@/types/new-client-wizard";
import { getBenefitCompleteness } from "@/lib/benefit-completeness";
import { wantsCommentsRail } from "@/lib/comments/portal-surface";
import { getDefaultLandingCardBody } from "@/lib/landing-card-defaults";
import { PORTAL_SECTION_IDS } from "@/lib/portal-editor-sections";
import { PortalSectionEditButton } from "@/components/portal-editing/portal-section-edit-button";
import { IncompleteBenefitDialog } from "./incomplete-benefit-dialog";
import {
  benefitCategoryToVisibilityKey,
  getCategoryPortalVisibility,
  isCategoryVisibleInPortal,
  syncBenefitsWithCategoryVisibility,
} from "@/lib/portal-category-visibility";
import { mergeUserBenefitWithHubDefaults } from "@/lib/hub-benefit-defaults";
import { getCategoryDefaultInnerImageUrl } from "@/lib/portal-category-hero-background";
import { supportCardColumnClass } from "@/lib/support-card-layout";
import { portalRadiusValue } from "@/lib/typography-themes";

interface PortalBenefitsProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  keyContacts?: KeyContact[];
  benefits?: Benefit[];
  onEdit?: (benefitId: string) => void;
  documents?: any[];
  employeePortalPreview?: any;
  categoryPortalVisibility?: Record<string, boolean> | null;
  /**
   * The plan's Benefit rows — each hub's own publish switch.
   *
   * This is the AUTHORITY for "is this benefit published?". The legacy
   * `employeePortalPreview` mirror can lag a soft-disable, and Portal Visibility is a
   * separate control, so neither can answer it alone.
   */
  benefitHubs?:
    | { category?: string; title?: string | null; isEnabled?: boolean }[]
    | null;
  baselineBackgroundColor?: string;
  /** Merged plan fields + keyContacts + documents + ep — matches benefits wizard’s merged plan for getBenefitCompleteness. */
  completenessClientData?: any;
}

export function PortalBenefits({
  brandColor = "#0D315F",
  secondaryColor = "#C89B5B",
  clientId,
  keyContacts = [],
  benefits: dynamicBenefits,
  onEdit,
  documents = [],
  employeePortalPreview,
  categoryPortalVisibility,
  benefitHubs,
  baselineBackgroundColor,
  completenessClientData,
}: PortalBenefitsProps) {
  const router = useRouter();
  /**
   * Whether the INCOMPLETE placeholder cards may render.
   *
   * They are an ADVISOR affordance, not participant content: an unfinished
   * benefit should not be advertised to employees on the landing page. They
   * appear only in the editing view, which is the portal opened with
   * `?edit=true` (the same flag the Comments rail and the Editing launcher key
   * off). Read from the URL on mount, exactly like the rail does.
   */
  const [showIncompleteCards, setShowIncompleteCards] = useState(false);
  useEffect(() => {
    setShowIncompleteCards(wantsCommentsRail(window.location.search));
  }, []);

  const [incompleteDialog, setIncompleteDialog] = useState<{
    isOpen: boolean;
    category: BenefitsCategory | null;
    missingInfo: string[];
  }>({
    isOpen: false,
    category: null,
    missingInfo: [],
  });

  const hasClientId = !!clientId;
  const basePath = clientId ? `/${clientId}` : "#";

  const completenessInput = completenessClientData ?? {
    keyContacts,
    documents,
    employeePortalPreview,
  };

  // ... existing getPartnerLogo ...
  const getPartnerLogo = (benefit: Benefit, defaultLogo: string): string => {
    // 1. If benefit has a specific contact assigned, use that contact's logo
    if (benefit.contactId) {
      const assignedContact = keyContacts.find(
        (c) => c.id === benefit.contactId,
      );
      if (assignedContact?.companyLogo) {
        return assignedContact.companyLogo;
      }
    }

    // 2. Map benefit card categories to KeyContact benefitsCategories
    const categoryMap: Record<string, string> = {
      "Retirement Plan Benefits": "Retirement",
      "Health Insurance": "Group Health",
      "Life Insurance": "Group Life",
      "Wellness Programs": "Company / Plan Sponsor",
    };

    const targetCategory =
      (benefit.category as string) || categoryMap[benefit.title];
    if (!targetCategory) return defaultLogo;

    // 3. Find a contact that has this category and a companyLogo (prioritize primary)
    const contactWithLogo =
      keyContacts.find(
        (contact) =>
          contact.benefitsCategories?.includes(targetCategory as any) &&
          (contact.isPrimary || contact.isPrimaryOverall) &&
          contact.companyLogo,
      ) ||
      keyContacts.find(
        (contact) =>
          contact.benefitsCategories?.includes(targetCategory as any) &&
          contact.companyLogo,
      );

    return contactWithLogo?.companyLogo || defaultLogo;
  };

  /**
   * The partner company's NAME, resolved from the same contact that supplies
   * the partner logo. The portal card shows this name where the logo used to
   * be, so the contact lookup mirrors `getPartnerLogo` exactly.
   */
  const getPartnerName = (benefit: Benefit): string => {
    const categoryMap: Record<string, string> = {
      "Retirement Plan Benefits": "Retirement",
      "Health Insurance": "Group Health",
      "Life Insurance": "Group Life",
      "Wellness Programs": "Company / Plan Sponsor",
    };

    // 1. The explicitly assigned contact wins.
    if (benefit.contactId) {
      const assignedContact = keyContacts.find(
        (c) => c.id === benefit.contactId,
      );
      if (assignedContact?.companyName) return assignedContact.companyName;
    }

    // 2. Otherwise the primary contact for the benefit's category.
    const targetCategory =
      (benefit.category as string) || categoryMap[benefit.title];
    if (!targetCategory) return "";

    const contactWithName =
      keyContacts.find(
        (contact) =>
          contact.benefitsCategories?.includes(targetCategory as any) &&
          (contact.isPrimary || contact.isPrimaryOverall) &&
          contact.companyName,
      ) ||
      keyContacts.find(
        (contact) =>
          contact.benefitsCategories?.includes(targetCategory as any) &&
          contact.companyName,
      );

    return contactWithName?.companyName || "";
  };

  const defaultBenefits = [
    {
      id: "retirement",
      icon: PiggyBank,
      title: "Retirement Plan Benefits",
      description:
        "Enrollment guidance, investment options, and retirement resources to help you build a more secure financial future.",
      partnerLogo: "/benefits-logo/Waypoint-WEB.webp",
      image:
        "/benefits-logo/Beach-Summer-Couple-on-Island-Vacation-Holiday-1536x960.webp",
      buttonText: "RETIREMENT BENEFITS>",
      href: "/retirement",
      category: "Retirement" as BenefitsCategory,
      isEnabled: true,
    },
    {
      id: "health",
      icon: Shield,
      title: "Health Insurance",
      description:
        "Comprehensive health, dental, and vision benefits to help you and your family stay healthy and protected.",
      partnerLogo: "/benefits-logo/Integrity_H_CMYK.jpeg",
      image: "/benefits-logo/Integrity.jpg",
      buttonText: "HEALTH BENEFITS>",
      href: "/health-insurance",
      category: "Group Health" as BenefitsCategory,
      isEnabled: true,
    },
    {
      id: "life",
      icon: Heart,
      title: "Life Insurance",
      description:
        "Life and disability insurance designed to help protect your income and ensure peace of mind for your family.",
      partnerLogo: "/benefits-logo/Sun-Life-Financial.jpg",
      image:
        "/benefits-logo/Hiking-Couple-Looking-Enjoying-Sunset-View-on-Hike.webp",
      buttonText: "LIFE INSURANCE BENEFITS>",
      href: "/life-insurance",
      category: "Group Life" as BenefitsCategory,
      isEnabled: true,
    },
    {
      id: "wellness",
      icon: Heart,
      title: "Wellness Programs",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      partnerLogo: "/benefits-logo/wellhub.png",
      image: "/benefits-logo/doing-yoga-1536x960.webp",
      buttonText: "WELLNESS BENEFITS>",
      href: "/wellness-programs",
      category: "Company / Plan Sponsor" as BenefitsCategory,
      isEnabled: true,
    },
  ];

  // Normalize category for matching (e.g. "Group Health" vs "group health")
  const normCat = (c: string | null | undefined) =>
    (c || "").toLowerCase().trim().replace(/\s+/g, " ");

  /**
   * Is this card's benefit UNPUBLISHED?
   *
   * The Benefit row's own `isEnabled` is the authority — the same predicate the
   * portal header (hub links) and the assistant use to decide a benefit exists.
   * The legacy mirror cannot answer it: `syncBenefitsWithCategoryVisibility` below
   * deliberately re-enables a stale `isEnabled: false` when the CATEGORY is visible,
   * which is exactly why an unpublished benefit kept its landing card.
   *
   * No row, or several rows sharing this visibility key (Custom's "Other" bucket),
   * cannot speak unambiguously, so the caller's existing rules still apply.
   */
  const isBenefitUnpublished = (category: string) => {
    if (!Array.isArray(benefitHubs)) return false;
    const exact = benefitHubs.filter(
      (row) =>
        normCat(row.category) === normCat(category) ||
        normCat(row.title) === normCat(category),
    );
    const matches =
      exact.length > 0
        ? exact
        : benefitHubs.filter(
            (row) =>
              benefitCategoryToVisibilityKey(row.category || "") ===
              benefitCategoryToVisibilityKey(category),
          );
    if (matches.length !== 1) return false;
    return matches[0].isEnabled === false;
  };

  // Always show exactly 4 cards (Retirement, Health, Life, Wellness) mapped to default categories
  const benefitsFromApi = Array.isArray(dynamicBenefits) ? dynamicBenefits : [];
  const rawMerged: Benefit[] = defaultBenefits.map((d) => {
    const fromApi = (benefitsFromApi as any[]).find(
      (b: any) => normCat(b.category) === normCat(d.category),
    );
    return (fromApi ?? d) as Benefit;
  });
  // Fill empty card image / copy / CTA from hub defaults (retirement was saving partial rows).
  const mergedBenefits = rawMerged.map((b) => {
    const filled = mergeUserBenefitWithHubDefaults(
      b as unknown as Record<string, unknown>,
      (b.category || b.title) as string,
    ) as unknown as Benefit;
    return { ...b, ...filled };
  });

  // Sync isEnabled with category visibility so a Visible category's benefit card
  // isn't hidden by a stale isEnabled:false in employeePortalPreview.benefits
  // (same root cause as the PortalHeader nav links). Publishing a category via
  // Portal Visibility updates categoryPortalVisibility, but the benefits array can
  // still carry the previous isEnabled:false until a benefit write re-syncs it.
  const visibility = getCategoryPortalVisibility(categoryPortalVisibility);
  const syncedBenefits = syncBenefitsWithCategoryVisibility(
    mergedBenefits as {
      category?: string;
      title?: string;
      isEnabled?: boolean;
    }[],
    visibility,
  );

  // Determine visible benefits based on isEnabled and portal visibility.
  //
  // An incomplete benefit is a placeholder card rather than a hidden one — but
  // ONLY in the editing view (`?edit=true`), where the advisor needs to see
  // what still has to be finished. A participant's landing page omits the card
  // entirely, so "INCOMPLETE" is never shown to employees.
  const displayBenefits = (syncedBenefits as Benefit[])
    .filter((benefit) => {
      const category = (benefit.category || benefit.title || "") as string;

      // 0. The Benefit row's own publish switch wins. An unpublished benefit has
      //    no hub link and no assistant entry, so it must not leave a card behind
      //    on the landing page either.
      if (isBenefitUnpublished(category)) return false;

      // 1. Portal visibility: hide if category is hidden
      if (!isCategoryVisibleInPortal(category, categoryPortalVisibility))
        return false;

      // 1. Check if manually disabled (slider OFF in Step 5)
      if (benefit.isEnabled === false) return false;

      // 2. Participant view: drop the unfinished categories instead of drawing
      //    their placeholders. Without a clientId this is a preview, where the
      //    completeness gate is deliberately bypassed.
      if (hasClientId && !showIncompleteCards) {
        const completeness = getBenefitCompleteness(
          category as BenefitsCategory,
          completenessInput,
        );
        if (!completeness.isComplete) return false;
      }

      return true;
    })
    .map((benefit) => ({
      ...benefit,
      partnerLogo: getPartnerLogo(benefit, benefit.partnerLogo || ""),
      partnerName: getPartnerName(benefit),
    }));

  const handleBenefitClick = (e: React.MouseEvent, benefit: any) => {
    // If we're on a view page (hasClientId), check for completeness
    if (hasClientId) {
      const category = (benefit.category ||
        benefit.title ||
        "") as BenefitsCategory;
      const completeness = getBenefitCompleteness(category, completenessInput);

      if (!completeness.isComplete) {
        e.preventDefault();
        e.stopPropagation();
        setIncompleteDialog({
          isOpen: true,
          category: category,
          missingInfo: completeness.missingInfo,
        });
        return false;
      }
    }
    return true;
  };

  /**
   * Width of one card, from how many share the row — the same count-driven rule
   * the "Have Questions?" support cards use (`supportCardColumnClass`):
   *
   *   1 card  → half the row (two of four slots), centred
   *   2 cards → halves
   *   3 cards → thirds from `lg`
   *   4 cards → quarters from `lg`
   *
   * Phones keep one card per line and tablets pair up. The wrapper carries the
   * width, so the card's image and copy scale with it.
   */
  const columnClass = supportCardColumnClass(displayBenefits.length);

  // When all categories are hidden (portal visibility), do not render the benefits section
  if (displayBenefits.length === 0) {
    return null;
  }

  return (
    <section className="relative bg-white py-8 sm:py-10 lg:py-12 box-border flex flex-col items-center justify-center">
      {/* The advisor's way into Section 5 of the Landing panel, which edits these
          four cards. Renders nothing without an editing provider, so a participant
          never sees it. */}
      <PortalSectionEditButton
        sectionId={PORTAL_SECTION_IDS.benefitsGlance}
        label="Edit benefits at a glance"
        className="right-4 top-4"
      />
      <div className="text-center mb-8 sm:mb-12 lg:mb-16 px-4">
        <h2
          // `text-gray-900`, matching "How Can We Help You Today?" — one colour for
          // every section heading on the landing page.
          className="text-2xl sm:text-4xl lg:text-[48px] font-dm-serif text-gray-900 mb-4 sm:mb-6"
        >
          Your Benefits at a Glance
        </h2>
        <p className="text-sm sm:text-base font-red-hat text-[#6B6B6B] max-w-3xl mx-auto px-4 leading-relaxed">
          Explore your comprehensive benefits package designed to support your
          financial security and well-being.
        </p>
      </div>

      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* A flex row rather than a grid, so a partial row is CENTRED — a lone
            card, or the third of a 3-up row on a tablet, sits in the middle
            instead of hugging the left edge. Same layout as the support cards. */}
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap justify-center gap-4 sm:gap-6">
          {displayBenefits.map((benefit, index) => {
            const category = (benefit.category ||
              benefit.title ||
              "") as BenefitsCategory;
            const completeness = hasClientId
              ? getBenefitCompleteness(category, completenessInput)
              : { isComplete: true, missingInfo: [] };

            // The top image of each Benefit Card: the dedicated landing-card
            // image first, then the category's stock card image, then the
            // legacy card image. (The banner's Inner Header Image is now the
            // key contact's headshot, so it is not part of this chain.)
            const cardImage =
              benefit.landingCardImage ||
              getCategoryDefaultInnerImageUrl(category) ||
              benefit.image ||
              "";

            // Button copy is stored as e.g. "RETIREMENT BENEFITS>". Split the
            // trailing chevron out so it can carry a deliberate gap from the label.
            const buttonText = benefit.buttonText || "";
            const hasButtonArrow = buttonText.trimEnd().endsWith(">");
            const buttonLabel = hasButtonArrow
              ? buttonText.trimEnd().slice(0, -1).trimEnd()
              : buttonText;

            // Card body copy is capped at 75 characters including spaces (the
            // ellipsis counts toward the cap) so a long description cannot push
            // the partner name and CTA out of line.
            const descriptionText =
              // Dedicated card copy first, then the category's landing-card
              // default, then the hub's intro message.
              benefit.landingCardBody ||
              getDefaultLandingCardBody(category) ||
              benefit.description ||
              (benefit as any).shortDescription ||
              "";
            const bodyText =
              descriptionText.length > 75
                ? `${descriptionText.slice(0, 74).trimEnd()}…`
                : descriptionText;

            const fadeUp = {
              hidden: { opacity: 0, y: 200 },
              visible: { opacity: 1, y: 0 },
            };

            return (
              <motion.div
                key={benefit.id || index}
                variants={fadeUp}
                initial="visible"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{
                  opacity: { duration: 0.2, delay: index * 0.1 },
                  y: { duration: 0.6, delay: index * 0.1, ease: "easeOut" },
                }}
                data-testid="benefit-column"
                // The wrapper carries the row's column width for this card count.
                className={`${columnClass} flex h-full justify-center`}
              >
                {!completeness.isComplete ? (
                  /* ── Placeholder Card for Incomplete Benefits ── */
                  <Card
                    className={`text-center w-full h-full rounded-xl border border-dashed border-gray-300 bg-gray-50/80 overflow-hidden flex flex-col transition-all duration-300 ease-in-out relative group ${
                      hasClientId
                        ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg"
                        : ""
                    }`}
                    // Benefit cards wear the typography theme's corners.
                    style={{ borderRadius: portalRadiusValue(1.5) }}
                    onClick={(e) => {
                      if (hasClientId) {
                        handleBenefitClick(e, benefit);
                      }
                    }}
                  >
                    {/* Placeholder Image Area */}
                    <div className="w-full h-[180px] sm:h-[200px] bg-gray-100 flex items-center justify-center relative">
                      <div className="text-center">
                        <Shield className="w-12 h-12 mx-auto text-gray-300" />
                        <p className="text-xs text-gray-400 font-red-hat mt-2 font-medium">
                          Benefit Incomplete
                        </p>
                      </div>
                      <div className="absolute top-3 right-3 bg-amber-500 text-white px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md z-10 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        INCOMPLETE
                      </div>
                    </div>

                    {/* Placeholder content — deliberately the SAME skeleton as the
                        live card (a title block above a `min-h-[130px]` footer), so
                        an incomplete card is exactly as tall as its published
                        neighbours however that row is sized. */}
                    <div className="flex-1 pb-4 sm:pb-5 flex flex-col justify-between bg-gray-50/80">
                      <div className="px-3 sm:px-4 mt-3 sm:mt-4">
                        <h3
                          className="text-xl sm:text-2xl font-dm-serif mb-2 sm:mb-3"
                          style={{ color: brandColor }}
                        >
                          {benefit.title}
                        </h3>
                        <p className="text-gray-400 text-sm sm:text-base font-red-hat leading-relaxed mb-3 sm:mb-4">
                          This benefit is not yet set up.
                        </p>
                      </div>

                      <div
                        data-testid="incomplete-card-footer"
                        className="flex min-h-[130px] px-4 sm:px-5 flex-col items-center justify-between"
                      >
                        <div className="flex justify-center mb-3 sm:mb-4">
                          <p className="text-center text-sm sm:text-base font-red-hat font-semibold text-gray-400">
                            Not published yet
                          </p>
                        </div>
                        <div
                          className="block w-full py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold tracking-wide bg-gray-200 text-gray-500 cursor-default"
                          style={{ borderRadius: portalRadiusValue() }}
                        >
                          Finish setup to publish
                        </div>
                      </div>
                    </div>

                  </Card>
                ) : (
                  /* ── Live Benefit Card ── */
                  <div
                    className={`text-center w-full h-full rounded-xl ring-1 ring-[#E5E7EB] shadow-sm bg-white overflow-hidden flex flex-col transition-all duration-300 ease-in-out relative group ${
                      onEdit
                        ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg"
                        : "hover:-translate-y-2 hover:shadow-lg"
                    }`}
                    style={{ borderRadius: portalRadiusValue(1.5) }}
                    onClick={(e) => {
                      if (onEdit) {
                        onEdit(benefit.id);
                      }
                    }}
                  >
                    {/* Image Section - Top (Benefits at a Glance card image) */}
                    {/* The card clips this image, so its top corners come from
                        the card's themed radius rather than a fixed utility. */}
                    <img
                      src={cardImage}
                      alt={benefit.title}
                      className="w-full h-[180px] sm:h-[200px] shrink-0 object-cover block relative bottom-4"
                    />

                    {/* Content Section - Bottom (White Background) */}
                    <div className="flex-1 pb-4 sm:pb-5 flex flex-col justify-between bg-white">
                      <div className="px-3 sm:px-4 mt-3 sm:mt-4">
                        {/* Title */}
                        <h3
                          className="text-xl sm:text-2xl font-dm-serif mb-2 sm:mb-3"
                          style={{ color: brandColor }}
                        >
                          {benefit.title}
                        </h3>

                        {/* Description (max 75 characters, spaces included) */}
                        <p className="text-gray-600 text-sm sm:text-base font-red-hat leading-relaxed mb-3 sm:mb-4 whitespace-pre-line">
                          {bodyText}
                        </p>
                      </div>

                      <div className="flex min-h-[130px] px-4 sm:px-5 flex-col items-center justify-between">
                        {/* Partner company name (replaces the partner logo) */}
                        <div className="flex justify-center mb-3 sm:mb-4">
                          {onEdit && (
                            <div className="absolute top-2 left-2 z-20 bg-blue-500 rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </div>
                          )}
                          {(benefit as any).partnerName && (
                            <p className="text-center text-sm sm:text-base font-red-hat font-semibold text-gray-700">
                              {(benefit as any).partnerName}
                            </p>
                          )}
                        </div>

                        {/* Button */}
                        {hasClientId ? (
                          <Link
                            href={`${basePath}${benefit.href}`}
                            className="block w-full rounded-md py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold tracking-wide transition-all duration-300 hover:opacity-90 hover:scale-105"
                            // Primary brand colour, with the readable colour for the
                            // label — never the secondary, which may not contrast.
                            style={{
                              backgroundColor: brandColor,
                              color: readableColor(brandColor),
                              borderRadius: portalRadiusValue(),
                            }}
                            onClick={(e) => handleBenefitClick(e, benefit)}
                          >
                            {buttonLabel}
                            {hasButtonArrow && (
                              <span className="ml-1.5">{">"}</span>
                            )}
                          </Link>
                        ) : (
                          <div
                            className="block w-full rounded-md py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold tracking-wide transition-all duration-300 cursor-default"
                            style={{
                              backgroundColor: brandColor,
                              color: readableColor(brandColor),
                              borderRadius: portalRadiusValue(),
                            }}
                          >
                            {buttonLabel}
                            {hasButtonArrow && (
                              <span className="ml-1.5">{">"}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {clientId && (
        <IncompleteBenefitDialog
          isOpen={incompleteDialog.isOpen}
          onOpenChange={(open: boolean) =>
            setIncompleteDialog({ ...incompleteDialog, isOpen: open })
          }
          category={incompleteDialog.category as BenefitsCategory}
          missingInfo={incompleteDialog.missingInfo}
          clientId={clientId}
        />
      )}
    </section>
  );
}
