"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PiggyBank, Shield, Heart, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import {
  Benefit,
  KeyContact,
  BenefitsCategory,
} from "@/types/new-client-wizard";
import { getBenefitCompleteness } from "@/lib/benefit-completeness";
import { IncompleteBenefitDialog } from "./incomplete-benefit-dialog";
import {
  getCategoryPortalVisibility,
  isCategoryVisibleInPortal,
  syncBenefitsWithCategoryVisibility,
} from "@/lib/portal-category-visibility";
import { mergeUserBenefitWithHubDefaults } from "@/lib/hub-benefit-defaults";
import { getCategoryDefaultInnerImageUrl } from "@/lib/portal-category-hero-background";
import { BrandingImage } from "@/components/ui/branding-image";

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
  baselineBackgroundColor,
  completenessClientData,
}: PortalBenefitsProps) {
  const router = useRouter();
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

  // Determine visible benefits based on isEnabled and portal visibility
  // Incomplete benefits are shown as placeholder cards rather than being hidden
  const displayBenefits = (syncedBenefits as Benefit[])
    .filter((benefit) => {
      // 0. Portal visibility: hide if category is hidden
      const category = (benefit.category || benefit.title || "") as string;
      if (!isCategoryVisibleInPortal(category, categoryPortalVisibility))
        return false;

      // 1. Check if manually disabled (slider OFF in Step 5)
      if (benefit.isEnabled === false) return false;

      return true;
    })
    .map((benefit) => ({
      ...benefit,
      partnerLogo: getPartnerLogo(benefit, benefit.partnerLogo || ""),
    }));

  const handleBenefitClick = (e: React.MouseEvent, benefit: any) => {
    // If we're on a view page (hasClientId), check for completeness
    if (hasClientId) {
      const category = (benefit.category ||
        benefit.title ||
        "") as BenefitsCategory;
      const completeness = getBenefitCompleteness(
        category,
        completenessInput,
      );

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

  // Dynamic grid configuration
  const getGridClasses = (count: number) => {
    const base =
      "grid gap-4 sm:gap-5 auto-rows-fr w-full mx-auto justify-items-center";
    switch (count) {
      case 1:
        return `${base} grid-cols-1 max-w-[350px]`;
      case 2:
        return `${base} grid-cols-1 sm:grid-cols-2 max-w-[760px]`;
      case 3:
        return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-[1100px]`;
      default:
        return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-[1400px]`;
    }
  };

  // When all categories are hidden (portal visibility), do not render the benefits section
  if (displayBenefits.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-8 sm:py-10 lg:py-12 box-border flex flex-col items-center justify-center">
      <div className="text-center mb-8 sm:mb-12 lg:mb-16 px-4">
        <h2 className="text-2xl sm:text-4xl lg:text-[48px] font-dm-serif mb-4 sm:mb-6"
          style={{ color: brandColor }}
        >
          Your Benefits at a Glance
        </h2>
        <p className="text-sm sm:text-base font-red-hat text-[#6B6B6B] max-w-3xl mx-auto px-4 leading-relaxed">
          Explore your comprehensive benefits package designed to support your
          financial security and well-being.
        </p>
      </div>

      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className={getGridClasses(displayBenefits.length)}>
          {displayBenefits.map((benefit, index) => {
            const category = (benefit.category ||
              benefit.title ||
              "") as BenefitsCategory;
            const completeness = hasClientId
              ? getBenefitCompleteness(category, completenessInput)
              : { isComplete: true, missingInfo: [] };

            // The top image of each Benefit Card is the Benefit Hub's Inner
            // Header Image — the same image shown in the right column of that
            // hub's welcome banner: custom per-category image first, then the
            // per-category default placeholder image, then the legacy card image.
            const cardImage =
              benefit.innerHeaderImage ||
              getCategoryDefaultInnerImageUrl(category) ||
              benefit.image ||
              "";

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
                className="w-full h-full flex justify-center"
              >
                {!completeness.isComplete ? (
                  /* ── Placeholder Card for Incomplete Benefits ── */
                  <Card
                    className={`text-center w-full max-w-full sm:max-w-[303px] h-full rounded-xl border border-dashed border-gray-300 bg-gray-50/80 overflow-hidden flex flex-col transition-all duration-300 ease-in-out relative group ${
                      hasClientId ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg" : ""
                    }`}
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

                    {/* Placeholder Content */}
                    <div className="flex-1 pb-4 sm:pb-5 flex flex-col justify-center bg-gray-50/80 px-3 sm:px-4">
                      <h3
                        className="text-xl sm:text-2xl font-dm-serif text-center mb-2 sm:mb-3"
                        style={{ color: brandColor }}
                      >
                        {benefit.title}
                      </h3>
                      <p className="text-gray-400 text-sm sm:text-base font-red-hat text-center leading-relaxed">
                        This benefit is not yet set up.
                      </p>
                    </div>
                  </Card>
                ) : (
                  /* ── Live Benefit Card ── */
                  <div
                    className={`text-center w-full max-w-full sm:max-w-[303px] h-full rounded-xl ring-1 ring-[#E5E7EB] shadow-sm bg-white overflow-hidden flex flex-col transition-all duration-300 ease-in-out relative group ${
                      onEdit ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg" : "hover:-translate-y-2 hover:shadow-lg"
                    }`}
                    onClick={(e) => {
                      if (onEdit) {
                        onEdit(benefit.id);
                      }
                    }}
                  >
                    {/* Image Section - Top (Benefit Hub Inner Header Image) */}
                    <img
                      src={cardImage}
                      alt={benefit.title}
                      className="w-full h-[180px] sm:h-[200px] shrink-0 object-cover block rounded-t-xl relative bottom-4"
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

                        {/* Description */}
                        <p className="text-gray-600 text-sm sm:text-base font-red-hat leading-relaxed mb-3 sm:mb-4 whitespace-pre-line">
                          {benefit.description || (benefit as any).shortDescription}
                        </p>
                      </div>

                      <div className="flex min-h-[130px] px-4 sm:px-5 flex-col items-center justify-between">
                        {/* Partner logo */}
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
                          {benefit.partnerLogo && (
                            <div
                              className={`relative ${
                                onEdit
                                  ? "group-hover:ring-2 group-hover:ring-blue-500/50 rounded p-1 transition-all"
                                  : ""
                              }`}
                            >
                              <BrandingImage
                                src={benefit.partnerLogo}
                                alt={benefit.title}
                                className="opacity-90 w-auto h-auto max-w-[140px] sm:max-w-[160px]"
                              />
                            </div>
                          )}
                        </div>

                        {/* Button */}
                        {hasClientId ? (
                          <Link
                            href={`${basePath}${benefit.href}`}
                            className="block w-full rounded-md py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:opacity-90 hover:scale-105"
                            style={{ background: secondaryColor }}
                            onClick={(e) => handleBenefitClick(e, benefit)}
                          >
                            {benefit.buttonText}
                          </Link>
                        ) : (
                          <div
                            className="block w-full rounded-md py-2.5 sm:py-3 text-center text-xs sm:text-sm font-semibold tracking-wide text-white transition-all duration-300 cursor-default"
                            style={{ background: secondaryColor }}
                          >
                            {benefit.buttonText}
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
