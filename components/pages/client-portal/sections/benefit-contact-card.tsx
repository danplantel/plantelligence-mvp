"use client";

import { PrimaryContactCard } from "@/components/pages/my-benefits-team/primary-contact-card";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import {
  getContactCategories,
  isNonHubContactCategory,
} from "@/lib/portal-category-visibility";
import { canonicalContactCategory } from "@/lib/benefit-contacts";
import type { SupportCardSize } from "@/lib/support-card-layout";

/**
 * Where the card is being rendered. The client wants the same contact to appear
 * in two places with (for now) a very similar design:
 *
 * - `team`     — the My Benefits Team page
 * - `category` — the benefit category's own page (Retirement, Group Health, …)
 *
 * The distinction is deliberately a prop rather than a second component, so both
 * placements stay visually in lockstep when the design is reviewed later.
 */
export type ContactPlacement = "team" | "category";

export interface BenefitContactCardProps {
  /** A `KeyContact` (or the equivalent serialized portal contact). */
  contact: Record<string, any>;
  brandColor: string;
  secondaryColor: string;
  /** Primary CTA background; defaults to `secondaryColor` (the card's design). */
  ctaColor?: string;
  appointmentLink?: string;
  companyName?: string;
  /** Animation stagger index (My Benefits Team layouts use it). */
  index?: number;
  disableAnimation?: boolean;
  baselineBackgroundColor?: string;
  /** Renders the large `PrimaryContactCard` instead of the compact card. */
  asPrimary?: boolean;
  /** Defaults to `team`. `category` renders the compact card variant. */
  placement?: ContactPlacement;
  /** Explicit compact override; wins over the placement default. */
  compact?: boolean;
  /** Stretch every card in the row to the tallest — see `SmallVerticalCard`. */
  equalHeight?: boolean;
  /**
   * Element tier for the compact card — the benefit hub sizes its support
   * cards from how many of them share the row (see `lib/support-card-layout`).
   * Omitted elsewhere, where `compact` picks the tier.
   */
  size?: SupportCardSize;
  /**
   * Phone-sized card design, set only by the mobile layouts (My Benefits Team and
   * the Step 3 / Contacts mobile preview): `wide` for a full-width card, `compact`
   * for one that shares a row in the 2-column grid. Ignored by the large
   * `PrimaryContactCard`, which only renders on desktop.
   */
  mobileVariant?: "wide" | "compact";
  /**
   * The advisor's own name for the plan's Custom benefit (see
   * `customBenefitTitleFromHubs`). A contact that covers "Other Benefits" serves
   * that benefit, so the pill wears its real name; with no custom benefit the pill
   * is dropped rather than reading "Other Benefits".
   */
  customBenefitName?: string | null;
  /**
   * Every benefit label the PLAN has (its hub rows). A contact who covers all of
   * them — the advisor's own row usually does — wears one "All Benefits" pill
   * instead of one pill per benefit.
   */
  planBenefitLabels?: string[];
}

/**
 * The benefit categories a contact serves, as card labels — e.g. ["Retirement"] or
 * ["Retirement", "Group Health", "Group Life"].
 *
 * `getContactCategories` is the same resolver the portal's visibility filter and the
 * benefit hubs use, so it already folds the stored spellings onto the canonical hub
 * names ("Health Insurance" → "Group Health"); `canonicalContactCategory` then turns the
 * visibility key "Other" back into the contact-facing "Other Benefits". Empty for a
 * contact with no category (e.g. a plan-wide / External HR row), which is what makes the
 * tag optional.
 *
 * Contact ROLES are dropped rather than labelled: "Company / Plan Sponsor",
 * "Recordkeeper / Vendor" and "External HR / Administrator" say what the person IS,
 * not which benefit they cover, and the card already shows the plan's company name
 * and logo. A pill reading "Company / Plan Sponsor" looked like one more benefit.
 * `isNonHubContactCategory` is the same predicate the portal's visibility rules use
 * to recognise those rows.
 *
 * "Other Benefits" is the generic label for the plan's Custom benefit, so it is
 * replaced by the advisor's own name for that benefit — and dropped when the plan
 * has no custom benefit, where "Other Benefits" paired with the pills of the real
 * hubs read as though it were one of them.
 */
const OTHER_BENEFITS_LABEL = "Other Benefits";
/** Replaces the whole list for a contact who covers the plan's every benefit. */
const ALL_BENEFITS_LABEL = "All Benefits";

function benefitCategoryList(
  contact: Record<string, any>,
  customBenefitName?: string | null,
  planBenefitLabels?: string[],
): string[] {
  const custom = (customBenefitName || "").trim();
  const labels = Array.from(
    new Set(
      getContactCategories(contact)
        .map((category) => canonicalContactCategory(String(category)))
        .filter(Boolean),
    ),
  )
    .filter((category) => !isNonHubContactCategory(category))
    .map((category) => (category === OTHER_BENEFITS_LABEL ? custom : category))
    .filter(Boolean);

  // A contact who serves every benefit the plan has (the advisor's own row
  // normally carries all of them) reads better as one pill than as a row that
  // repeats the plan's whole benefit list. Compared on the same labels the pills
  // use, so "Other Benefits" is matched by the plan's custom name. A single-
  // benefit plan keeps its name rather than claiming "all" of one thing.
  const plan = Array.from(
    new Set(
      (planBenefitLabels || [])
        .map((label) => String(label || "").trim())
        .filter(Boolean),
    ),
  );
  if (plan.length > 1 && plan.every((label) => labels.includes(label))) {
    return [ALL_BENEFITS_LABEL];
  }

  return labels;
}

/**
 * The one card used by both contact placements.
 *
 * It composes the existing My Benefits Team cards (rather than re-implementing
 * their styling) so the two surfaces cannot drift, and so the eventual design
 * review only has to change one entry point.
 */
export function BenefitContactCard({
  contact,
  brandColor,
  secondaryColor,
  ctaColor,
  appointmentLink = "",
  companyName = "",
  index,
  disableAnimation,
  baselineBackgroundColor,
  asPrimary = false,
  placement = "team",
  compact,
  equalHeight,
  size,
  mobileVariant,
  customBenefitName,
  planBenefitLabels,
}: BenefitContactCardProps) {
  // Category pages are content-dense, so their cards default to the compact
  // variant; the team page keeps whatever its layout asks for.
  const isCompact = compact ?? placement === "category";

  // My Benefits Team mixes contacts from every benefit on one page, so each card is
  // tagged with the benefit its contact speaks for. The category pages ARE one
  // benefit, so the tag would only repeat the page it sits on and is skipped there.
  // The list (not just the joined string) travels with the card so several categories
  // can collapse to "Multiple Categories" with the full list on hover.
  const categoryList =
    placement === "team"
      ? benefitCategoryList(contact, customBenefitName, planBenefitLabels)
      : [];
  const categoryLabel = categoryList.join(" · ");

  if (asPrimary) {
    return (
      <PrimaryContactCard
        contact={contact as any}
        brandColor={brandColor}
        secondaryColor={secondaryColor}
        appointmentLink={appointmentLink}
        companyName={companyName}
        baselineBackgroundColor={baselineBackgroundColor}
        compact={isCompact}
        categoryLabel={categoryLabel}
        categoryList={categoryList}
      />
    );
  }

  return (
    <SmallVerticalCard
      contact={contact as any}
      brandColor={brandColor}
      secondaryColor={secondaryColor}
      ctaColor={ctaColor}
      appointmentLink={appointmentLink}
      companyName={companyName}
      index={index}
      disableAnimation={disableAnimation}
      baselineBackgroundColor={baselineBackgroundColor}
      compact={isCompact}
      equalHeight={equalHeight}
      size={size}
      mobileVariant={mobileVariant}
      categoryLabel={categoryLabel}
      categoryList={categoryList}
    />
  );
}
