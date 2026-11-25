"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  PlayCircle,
  User,
  X,
} from "lucide-react";
import { readableColor, transparentize } from "polished";
import { HOW_CAN_WE_HELP_SECTION_ID } from "@/lib/portal-section-anchors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOptionalClientPortal } from "@/contexts/client-portal-context";
import { formatPhoneWithExtension } from "@/lib/phone-utils";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import { portalRadiusValue } from "@/lib/typography-themes";
import {
  ACCOUNT_ACCESS_CARD_ID,
  accountAccessActionsFor,
  fillHelpCardTokens,
  getHelpCardContent,
  helpCardCatalogFor,
} from "@/lib/help-card-defaults";
import {
  HELP_CARD_ROW_SIZE,
  clampHelpCards,
  helpCardMaxSpan,
  helpCardRowSizes,
  helpCardRowSpans,
  normalizeHelpCardColumns,
  resolveHelpCardRows,
  type HelpCardColumns,
} from "@/lib/help-card-layout";
import { participantCopy } from "@/lib/participant-copy";
import {
  HAVE_QUESTIONS_SECTION_ID,
  QUICK_ANSWERS_SECTION_ID,
  scrollToPortalSection,
} from "@/lib/portal-section-anchors";
import type { ProviderContact } from "@/types/benefit";
import type { HelpCardLayoutEntry, HelpCardResolved } from "@/types/benefit";
import type {
  ActionHubRow,
  EffectiveTopic,
  PlanMediaDocument,
  PlanMediaMaps,
  PlanMediaVideo,
  TopicDocumentLink,
} from "@/types/topic";
import { ActionHubPanel } from "./action-hub-panel";
import { topicQuickAnswer } from "@/lib/topics/effective-topic";
import {
  topicDocumentIdsOf,
  topicDocumentsOf,
  topicVideoIdsOf,
} from "@/lib/topics/text-overrides";
import {
  buildTopicUrl,
  readHashTopicSlug,
  readOptionParam,
  topicMatchesHash,
} from "@/lib/topics/deep-link";
import {
  CONTRIBUTION_LIMITS_YEAR,
  ELECTIVE_DEFERRAL_LIMIT,
} from "@/lib/plan-contribution-limits";
import { toExternalUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";

// Kept as the section's public surface: the previews import the id from here.
export { ACCOUNT_ACCESS_CARD_ID };
// Legacy name for the card copy type (the copy itself is static now).
export type { HelpCardData } from "@/types/benefit";

/**
 * "How Can We Help You Today?" — a topic grid with an expand-in-place detail panel.
 *
 * Layout contract (see `lib/help-card-layout.ts`):
 *  - The section fills the viewport (`min-h-screen`), so it owns a whole screen
 *    between the welcome banner and the video section.
 *  - The grid is 3 columns wide by default, or 4 when the plan's Card Layout
 *    chose "4 per row" (`helpCardColumns`). ONE card is primary and takes the
 *    widest slot in its row (2 columns); every other card spans 1. With 4 across
 *    NOTHING runs wider than 2 of the 4 columns, the primary included, so a lone
 *    card in a short row keeps half that row empty.
 *  - Row 1 belongs to the primary: `2/3 + 1/3`. Every later row holds three `1/3`
 *    cards, and a short last row widens to reach the right edge — with the 7-card
 *    set that reads `2/3 + 1/3`, then `3 × 1/3`, then `2/3 + 1/3`. The primary
 *    sits at the left or right edge of row 1 only.
 *  - Opening a card renders its detail panel directly BENEATH the row it belongs to,
 *    so the rest of the grid moves down instead of the page jumping to a modal.
 *    NOTHING is open on first paint: the grid is a set of collapsed choices until
 *    the reader taps one (or follows a `#topic` deep link).
 *  - The whole tile is clickable, so a tap anywhere on the card opens it.
 *
 * The COPY is static: `lib/help-card-defaults.ts` owns it by card id, and a benefit
 * stores only its layout (`HelpCardLayoutEntry[]` — order + which card is primary).
 *
 * The Account Access card is a special tile, not a topic: it mirrors the Insurance
 * Benefits Access & Materials hero — plan / group ID, the provider administering the
 * benefit, what the participant can do there, and a "Register or Log In →" button
 * that opens the plan's login URL in a new tab. It never opens a detail panel.
 * It can be the primary card (the default) or a standard 1/3 tile.
 *
 * `[Benefit Category]` is a merge token in the catalog copy, resolved from the
 * `category` prop each hub passes ("Retirement", "Group Health", …) — so the wide
 * card reads "Retirement Account Access". `[Company Name]` / `[Advisor Name]`
 * follow the same convention used across the portal's default copy.
 */

interface HowCanWeHelpSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  /**
   * The hub's benefit category — "Retirement", "Group Health", "Group Life", or the
   * advisor's custom hub name. Fills the `[Benefit Category]` token in the copy.
   */
  category?: string;
  /**
   * Destination for the Account Access card's "Register or Log In" button.
   * Defaults to the plan's `employeePortalPreview.insuranceLoginUrl` when the section
   * is rendered inside the portal; callers outside that provider (the wizard preview)
   * pass it explicitly.
   */
  accountAccessHref?: string;
  /**
   * The plan / group ID line, already formatted with `formatPlanGroupIdLabel`
   * (e.g. "PLAN / GROUP ID: 1234-5678"). Hub pages pass their category's
   * `Benefit.insurancePlanId`; when omitted the section falls back to the legacy
   * plan-level `employeePortalPreview.insurancePlanId`, which the hero also reads.
   */
  planIdLabel?: string;
  /**
   * The provider / recordkeeper administering this benefit. Hub pages pass their
   * category's `Benefit.providerContact`, exactly as they do to the hero; the portal
   * context's plan-level copy is the fallback.
   */
  provider?: ProviderContact | null;
  /**
   * The saved card layout (order + primary). Omitted/empty falls back to the
   * catalog's natural order with Account Access primary on the left.
   */
  cards?: HelpCardLayoutEntry[] | null;
  /**
   * How many cards share a row: 3 (the classic grid, the default) or 4. The
   * Card Layout control in the editing panel writes it. Either grid shows at
   * most eight cards; with 4 across, no card is wider than two of the four
   * columns (a lone card in a short row keeps half the row empty).
   */
  helpCardColumns?: number | null;
  /**
   * The plan's FEATURED placements, already resolved (`GET .../benefits/[category]`
   * returns them as `topics.featured`). When present they drive the grid; when the
   * plan is not on the topic framework this stays null and `cards` is used instead.
   *
   * Account Access is still not a topic in this build (that is TF-9), so the card is
   * synthesised from the catalog and pinned first as the 2-wide primary.
   */
  topics?: EffectiveTopic[] | null;
  /**
   * The plan's attachable documents and videos, keyed by id. A topic's stored media
   * ids are resolved through this so the card's panel can open them.
   */
  media?: PlanMediaMaps | null;
  /**
   * Action Hub rows per topic slug (`topics.actionHubPanels`, TF-5). A card whose slug
   * has rows offers the participant a choice of benefits instead of a single CTA.
   */
  actionHubPanels?: Record<string, ActionHubRow[]> | null;
  /** Click handler for editing a specific card. Receives the card's ID. */
  onCardEdit?: (cardId: string) => void;
}

/**
 * The "PLAN / GROUP ID: 1234-5678" line the Access & Materials hero and the Account
 * Access card both print, built from the value the advisor typed in the benefit
 * editor (`Benefit.insurancePlanId`, or the legacy plan-level
 * `employeePortalPreview.insurancePlanId`).
 *
 * Returns "" for an unset value and for the "[Not Set]" placeholder, so callers can
 * simply hide the line. Exported because the hub pages feed the same string to the
 * hero below, and the two must never disagree about the plan's ID.
 */
export function formatPlanGroupIdLabel(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw || raw.includes("[Not Set]")) return "";
  return `PLAN / GROUP ID: ${raw}`;
}

/**
 * Cards that share one line of the phone grid.
 *
 * ONE: a phone shows a single full-width column of tiles, so every card owns its
 * line and the open panel sits directly beneath the card that opened it. (The
 * desktop grid still packs 3 or 4 to a row — see `DESKTOP_SPAN_CLASS`.)
 */
const MOBILE_ROW_CAPACITY = 1;

/** The DESKTOP half of a card's span, per grid width. */
const DESKTOP_SPAN_CLASS: Record<HelpCardColumns, Record<number, string>> = {
  3: { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3" },
  4: {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
  },
};

/**
 * Column span → grid classes, for the TWO grids the card lives in.
 *
 * The phone grid is ONE column and the desktop grid is `columns` wide, so a span
 * only means something at `lg` — the phone half is a plain `col-span-1` and the
 * desktop half is the `lg:` override. Written out as static strings because
 * Tailwind cannot see a computed `col-span-${n}`.
 *
 * On a phone there is ONE grid for the whole section (the desktop row wrappers
 * are `display: contents` at that width) and every card fills it, edge to edge:
 * a plan's tiles are its primary reading surface, and a half-width tile squeezed
 * a title, a line of copy and a CTA into ~160px. `col-span-1` is kept explicit
 * (rather than omitted) so no card can inherit a wider desktop span at that width.
 */
function spanClass(span: number, columns: HelpCardColumns = 3): string {
  const clamped = Math.min(Math.max(span, 1), columns);
  return cn("col-span-1", DESKTOP_SPAN_CLASS[columns][clamped]);
}

/** The desktop column count, written out because Tailwind cannot see `${n}`. */
const GRID_CLASS: Record<HelpCardColumns, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** The open panel spans the whole row — the only column on a phone, the full row on desktop. */
const PANEL_SPAN_CLASS: Record<HelpCardColumns, string> = {
  3: "col-span-1 lg:col-span-3 lg:order-last",
  4: "col-span-1 lg:col-span-4 lg:order-last",
};

/**
 * The ONE-card exception: a lone card is centred and THREE COLUMNS WIDE on the
 * four-column measure — three quarters of the section — in EITHER setting. It
 * never runs the whole row (the 3-across grid included), and every other row
 * obeys the two-column cap.
 */
const LONE_CARD_WIDTH: Record<HelpCardColumns, string> = {
  3: "lg:w-3/4",
  4: "lg:w-3/4",
};

/**
 * The measured, centred content column every WIDE card uses — the Account Access
 * card and a full-row topic tile alike.
 *
 * Sharing one constant is the point: the CTA sits inside this column at full
 * width, so the button is the same size whichever card happens to be the primary
 * one filling the row. A per-card value would make the button resize just because
 * the advisor promoted a different card.
 */
const WIDE_CARD_CONTENT = "w-full max-w-[44rem] text-center mx-auto";

/**
 * The reflow animation used when the advisor reorders the cards in the Editing
 * Panel (Section 4).
 *
 * Framer's `layout` animates a card from its previous box to its new one, so the
 * preview glides into the new order instead of jumping. It is deliberately short
 * and gentle — this runs inside the scaled preview while the advisor drags, so it
 * must read as a hint, not a performance. `initial={false}` keeps the first portal
 * paint static: a participant must never see the section assemble itself.
 */
const HELPCARD_LAYOUT_TRANSITION = {
  layout: {
    duration: 0.32,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
};

/** One card of a row, with the columns it takes and its index in that row. */
interface RowEntry {
  card: HelpCardResolved;
  index: number;
  span: number;
}

/**
 * Group a row into the lines a PHONE shows, so the open card's panel can be
 * inserted directly under the line it belongs to.
 *
 * The width itself is CSS: every desktop row wrapper is `display: contents` on a
 * phone, so all the cards flow into the section's single ONE-column grid. With
 * that capacity every card is its own line; this grouping still decides WHERE the
 * panel goes — after the card that opened it.
 */
function chunkRowForPhone(row: HelpCardResolved[], spans: number[]): RowEntry[][] {
  const lines: RowEntry[][] = [];
  let current: RowEntry[] = [];
  let used = 0;

  row.forEach((card, index) => {
    const span = spans[index] ?? 1;
    const phoneWidth = Math.min(span, MOBILE_ROW_CAPACITY);
    if (used + phoneWidth > MOBILE_ROW_CAPACITY && current.length > 0) {
      lines.push(current);
      current = [];
      used = 0;
    }
    current.push({ card, index, span });
    used += phoneWidth;
  });

  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Pin the PRIMARY to its chosen edge of row 1.
 *
 * On a placement-driven page the board owns which cards exist and the order they
 * appear in, so the saved layout cannot re-order them. The one thing it still owns
 * is the primary's edge — the Left/Right control in Card Layout — and row 1 holds
 * the primary plus one card, so the primary belongs in the first slot (left) or
 * the second (right). Everything else keeps the board's order.
 */
function pinPrimaryToEdge(
  cards: HelpCardResolved[],
  primaryId: string,
  layoutIdOf: (id: string) => string,
  onRight: boolean,
  columns: HelpCardColumns = 3,
): HelpCardResolved[] {
  const index = cards.findIndex((card) => layoutIdOf(card.id) === primaryId);
  if (index < 0) return cards;
  const primary = cards[index];
  const rest = cards.filter((_card, cardIndex) => cardIndex !== index);
  // The right edge is the last slot of row 1, whose size the packing rule
  // decides (a full 4-across page puts just two cards there).
  const row1Slots = helpCardRowSizes(cards.length, columns)[0] ?? 1;
  const rightAt = Math.min(Math.max(row1Slots - 1, 1), rest.length);
  const at = onRight ? rightAt : 0;
  return [...rest.slice(0, at), primary, ...rest.slice(at)];
}

/**
 * Rows for a placement-driven grid. The split is the same rule the legacy path
 * uses (`helpCardFirstRowSize`), so the renderer cannot tell the two sources
 * apart and neither can leave a row short of the right edge.
 */
function chunkIntoRows(
  cards: HelpCardResolved[],
  columns: HelpCardColumns = 3,
): HelpCardResolved[][] {
  if (cards.length === 0) return [];
  const rows: HelpCardResolved[][] = [];
  let start = 0;
  for (const size of helpCardRowSizes(cards.length, columns)) {
    rows.push(cards.slice(start, start + size));
    start += size;
  }
  return rows;
}

/** Resolve a card link. Internal paths stay in the portal; everything else is external. */
function resolveCardHref(
  href: string,
  basePath: string,
): { href: string; external: boolean } {
  const trimmed = href.trim();
  if (!trimmed) return { href: "", external: false };
  if (trimmed.startsWith("/")) {
    return { href: `${basePath}${trimmed}`, external: false };
  }
  if (
    trimmed.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
  ) {
    return { href: trimmed, external: true };
  }
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return { href: trimmed, external: false };
  }
  return { href: `https://${trimmed}`, external: true };
}

/**
 * Where the caret sits, as PERCENTAGES of the grid container.
 *
 * Percentages are the only measurement that survives the editor preview, which
 * renders this section inside a `transform: scale(<1>)` wrapper. Pixel offsets
 * from `getBoundingClientRect()` are screen pixels, and the scale is applied by an
 * ancestor AFTER mount, so it cannot be read reliably. A ratio of two rect
 * measurements cancels any uniform scale (and any browser zoom), so the caret
 * lands on the card in the live portal, the wizard preview and the scaled Edit
 * Benefit preview alike.
 */
export function computeCaretPosition(input: {
  containerRect: { left: number; top: number; width: number; height: number };
  tileRect: { left: number; width: number };
  panelRect: { top: number };
}): { xPercent: number; yPercent: number } {
  const { containerRect, tileRect, panelRect } = input;
  const tileCentre = tileRect.left + tileRect.width / 2;
  return {
    xPercent:
      containerRect.width > 0
        ? ((tileCentre - containerRect.left) / containerRect.width) * 100
        : 50,
    yPercent:
      containerRect.height > 0
        ? ((panelRect.top - containerRect.top) / containerRect.height) * 100
        : 0,
  };
}

/** Matches the Rollovers topic so its panel can render its own body. */
const ROLLOVER_CARD_PATTERN = /rollover/i;

interface RolloverOption {
  id: string;
  title: string;
  pros: string;
  cons: string;
}

/**
 * The four things a participant can do with an old employer plan, in the order the
 * Rollovers panel numbers them.
 */
const ROLLOVER_OPTIONS: RolloverOption[] = [
  {
    id: "new-employer-plan",
    title: "New Employer Plan",
    pros: "One account to manage, and your new plan may offer a loan.",
    cons: "You are limited to that plan's investment menu and fees.",
  },
  {
    id: "ira",
    title: "Roll Into an IRA",
    pros: "The widest choice of investments, and it stays with you when you change jobs.",
    cons: "You manage it yourself and cover the account fees.",
  },
  {
    id: "leave-in-plan",
    title: "Leave It in the Old Plan",
    pros: "Keeps your current investments and any institutional pricing.",
    cons: "A limited investment menu, and the account is easy to lose track of.",
  },
  {
    id: "cash",
    title: "Cash Out",
    pros: "Immediate access to the money.",
    cons: "Ordinary income tax, plus a 10% penalty before age 59½ in most cases.",
  },
];

/**
 * The Rollovers & Distributions body: the four options, the pros/cons of whichever
 * one is selected, and the "talk it through" CTA.
 */
function RolloversDetail({
  brandColor,
  contactName,
  onTalkThrough,
  initialOptionId,
  onOptionChange,
}: {
  brandColor: string;
  contactName?: string;
  onTalkThrough?: () => void;
  /** `&option=` from the URL, so a shared link can open one option directly. */
  initialOptionId?: string | null;
  /** Mirrors the selection into the URL; `null` clears the option. */
  onOptionChange?: (optionId: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    // Only honour an id this topic actually has — a stale link opens nothing.
    initialOptionId &&
      ROLLOVER_OPTIONS.some((option) => option.id === initialOptionId)
      ? initialOptionId
      : null,
  );
  const selected =
    ROLLOVER_OPTIONS.find((option) => option.id === selectedId) ?? null;

  return (
    <div className="mt-1">
      <h4
        className="font-dm-serif text-2xl leading-tight sm:text-3xl"
        style={{ color: brandColor }}
      >
        Changing jobs? You have 4 options
      </h4>

      {/* The four options. Each carries its text top-left and its number bottom-right. */}
      <div
        data-testid="rollover-options"
        className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
      >
        {ROLLOVER_OPTIONS.map((option, index) => {
          const isSelected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                const next = selectedId === option.id ? null : option.id;
                setSelectedId(next);
                onOptionChange?.(next);
              }}
              className={cn(
                "flex min-h-[92px] flex-col justify-between gap-3 rounded-xl border bg-white p-3 text-left transition-all duration-200 hover:shadow-sm",
                isSelected
                  ? "border-transparent"
                  : "border-neutral-200 hover:border-neutral-300",
              )}
              style={
                isSelected
                  ? { boxShadow: `0 0 0 2px ${brandColor}` }
                  : undefined
              }
            >
              <span
                className="font-red-hat text-[13px] font-semibold leading-snug"
                style={{ color: brandColor }}
              >
                {option.title}
              </span>
              <span
                // 50% larger than the option copy, per the design.
                className="self-end font-dm-serif text-[27px] font-semibold leading-none tabular-nums"
                style={{ color: isSelected ? brandColor : "#D4D4D4" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pros and cons — only while an option is selected. */}
      {selected && (
        <div
          data-testid="rollover-detail"
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          {[
            {
              label: "Pros",
              body: selected.pros,
              emoji: "👍",
              tone: "text-emerald-600",
            },
            {
              label: "Cons",
              body: selected.cons,
              emoji: "👎",
              tone: "text-red-600",
            },
          ].map(({ label, body, emoji, tone }) => (
            <div
              key={label}
              className="rounded-xl border border-neutral-200 bg-white p-4"
            >
              {/* Green for pros, red for cons, each with its thumb. */}
              <p
                className={cn(
                  "flex items-center gap-1.5 font-red-hat text-[10px] font-semibold uppercase tracking-[0.14em]",
                  tone,
                )}
              >
                <span aria-hidden className="text-[13px] leading-none">
                  {emoji}
                </span>
                {label}
              </p>
              <p className="mt-1 font-red-hat text-[14px] leading-relaxed text-neutral-700">
                {body}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-testid="rollover-talk-cta"
          onClick={onTalkThrough}
          className="gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] shadow-sm hover:opacity-90"
          // The CTA wears the theme's corner treatment, like the card around it.
          style={{
            backgroundColor: brandColor,
            color: readableColor(brandColor),
            borderRadius: portalRadiusValue(),
          }}
        >
          Talk through my options
        </Button>
        <span className="font-red-hat text-[13px] text-neutral-600">
          Free call with {contactName || "your specialist"}
        </span>
      </div>
    </div>
  );
}

/**
 * The Account Access card.
 *
 * This is the Insurance Benefits Access & Materials hero, condensed into a tile:
 * the heading, the plan / group ID, who administers the benefit, what the participant
 * can do once they are in, and the Register / Login CTA. The destination and the
 * provider come from the same sources the hero uses, so the two can never point at
 * different places.
 *
 * When it is the PRIMARY card it is painted with the plan's primary colour and every
 * element switches to the readable colour for that fill — including the CTA, which
 * becomes an inverse button. The secondary colour is deliberately not used: on some
 * plans it does not contrast with the primary at all.
 */
function AccountAccessCard({
  title,
  description,
  brandColor,
  secondaryColor,
  primary = false,
  span = 2,
  columns = 3,
  lone = false,
  planIdLabel,
  providerName,
  providerDetailLine,
  loginUrl,
  actions,
}: {
  title: string;
  description?: string;
  brandColor: string;
  secondaryColor: string;
  primary?: boolean;
  /** Columns this card takes in its row — see `helpCardRowSpans`. */
  span?: number;
  /** The grid's column count, so "owns the whole row" is measured correctly. */
  columns?: HelpCardColumns;
  /** The only card in the section: centred on desktop, two columns wide. */
  lone?: boolean;
  planIdLabel?: string;
  providerName?: string;
  providerDetailLine?: string;
  loginUrl?: string;
  /**
   * What the participant can do once signed in. The category decides this — a
   * recordkeeper login lists balances and contributions, a carrier login lists
   * coverage and ID cards — so the tile never promises actions the destination
   * does not offer.
   */
  actions?: string[];
}) {
  const bullets =
    actions && actions.length > 0
      ? actions
      : ["See coverage", "Get ID cards", "Make changes", "Update dependents"];
  const ctaColor = brandColor || secondaryColor;
  // Colours used when the tile itself is filled with the plan's primary.
  const onPrimary = readableColor(brandColor);
  const onPrimaryMuted = transparentize(0.2, onPrimary);
  const onPrimaryFaint = transparentize(0.35, onPrimary);
  /**
   * A card that owns its whole row (all 3 columns) lays out as one banner: the
   * details in a measured, centred column with the CTA keeping its natural width
   * beneath them. Stacked at that width every line runs the full page and the
   * tile reads as three disconnected islands.
   */
  // A lone card is centred like a full-row card, in either grid — `lone` is what
  // makes the 4-across case (3 of 4 columns) read the same as the 3-across one.
  const isWide = span >= columns || lone;
  /**
   * The card has a row to itself. Its four feature bullets then sit as one centred
   * group instead of being pushed to the edges of a full-width card — at 3/3 the
   * spaced-out version reads as stray text rather than a list.
   */
  const isFullRow = isWide;

  return (
    <motion.div
      data-help-card={ACCOUNT_ACCESS_CARD_ID}
      // Reflow with the other cards when the layout changes, and keep the hover
      // lift on framer (an inline layout transform would override the CSS one).
      layout
      // Same identity rule as the topic cards: this one changes rows whenever the
      // Primary moves to the other edge.
      layoutId={`help-card-${ACCOUNT_ACCESS_CARD_ID}`}
      initial={false}
      transition={HELPCARD_LAYOUT_TRANSITION}
      whileHover={{ y: -2 }}
      // The height floor is what makes every row in the grid the same height: the
      // topic tiles below use the identical `min-h`, so row 2 matches row 1 even
      // though its cards carry far less content. A full-width card has its row to
      // itself, so it uses the compact floor instead of a tall, empty band.
      className={cn(
        "group flex h-full flex-col rounded-2xl border p-4 text-left shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5",
        isWide
          ? "min-h-[132px] items-center justify-center"
          : "min-h-[180px] lg:min-h-[210px]",
        // The wide card is wide because its ROW says so, not because it is the
        // Access card: in the classic seven it takes two columns, and in a
        // two-card row it shares with its neighbour. On a phone a two-column card
        // takes the whole line, and a one-column card pairs with its neighbour.
        spanClass(span, columns),
        // The ONE-card section: three columns wide and centred (the row is a
        // flex line then), whatever the cards-per-row setting.
        lone && LONE_CARD_WIDTH[columns],
        primary
          ? "border-transparent"
          : "border-neutral-200 bg-white hover:border-neutral-300",
      )}
      style={primary ? { backgroundColor: brandColor } : undefined}
    >
      {/* A wide card does not stretch its contents across the whole row: the
          details AND the button share one measured column, centred in the card, so
          the button is exactly as wide as the text above it. */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          // A wide card centres its measured column; every narrower card fills
          // its tile, so the CTA below spans the card instead of shrinking to
          // the widest line of copy in it.
          isWide ? WIDE_CARD_CONTENT : "w-full",
        )}
      >
        <div className={cn("min-w-0", isWide && "text-center")}>
          <h3
            // Matches the topic titles, so every card in the grid reads at one size.
            className="font-dm-serif text-lg font-semibold leading-snug sm:text-xl"
            style={{ color: primary ? onPrimary : brandColor }}
          >
            {title}
          </h3>

          {description && (
            <p
              // The theme's BODY font (`--font-body` via `font-red-hat`), like the
              // rest of the portal's copy. Without it this line inherited Manrope
              // from `html` and ignored the plan's typography theme.
              className={cn(
                "mt-0.5 font-red-hat text-[15px] leading-snug",
                isWide ? "line-clamp-2" : "line-clamp-1",
                !primary && "text-neutral-600",
              )}
              style={primary ? { color: onPrimaryMuted } : undefined}
            >
              {description}
            </p>
          )}

          {/* Plan ID and administrator share one wrapped line — two short facts,
              not two stacked blocks that push the CTA to the far bottom of a wide
              card. A PRIMARY tile anchors them to the same left edge as its title
              and copy, so the chip does not float in the middle of a left-aligned
              card; a non-primary tile keeps its centred band. */}
          {(planIdLabel || providerName) && (
            <div
              className={cn(
                "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5",
                // A LONE card is centred (its title and CTA are too), so its plan
                // ID / recordkeeper line centres with them even though it is the
                // primary. A primary sharing its row keeps its left edge.
                primary && !lone
                  ? "justify-start text-left"
                  : "justify-center text-center",
              )}
            >
              {planIdLabel && (
                <span
                  className="inline-block rounded-md px-2 py-1 font-red-hat text-[13px] font-semibold leading-tight"
                  style={
                    primary
                      ? { backgroundColor: onPrimaryFaint, color: onPrimary }
                      : { backgroundColor: `${brandColor}14`, color: brandColor }
                  }
                >
                  {planIdLabel}
                </span>
              )}
              {providerName && (
                <p
                  className={cn(
                    "font-red-hat text-[13px] leading-tight",
                    !primary && "text-neutral-500",
                  )}
                  style={primary ? { color: onPrimaryMuted } : undefined}
                >
                  Administered by{" "}
                  <span
                    className="font-semibold"
                    style={{ color: primary ? onPrimary : brandColor }}
                  >
                    {providerName}
                  </span>
                  {providerDetailLine ? ` · ${providerDetailLine}` : ""}
                </p>
              )}
            </div>
          )}

          <div
            data-testid="account-access-actions"
            className={cn(
              "mt-2 gap-x-4 gap-y-0.5",
              isFullRow
                ? // A full-width card centres its four features as one group.
                  "flex flex-wrap items-center justify-center gap-x-6"
                : // Otherwise they pair up on a phone and run four-up when wide.
                  cn("grid grid-cols-2", isWide && "sm:grid-cols-4 sm:justify-items-center"),
            )}
          >
            {bullets.map((item) => (
              <div key={item} className="flex items-center">
                <span
                  className="mr-1.5 h-1 w-1 flex-shrink-0 rounded-full"
                  style={{ background: primary ? onPrimary : brandColor }}
                />
                <span
                  className={cn(
                    "font-red-hat text-[13px] leading-tight",
                    !primary && "text-neutral-700",
                  )}
                  style={primary ? { color: onPrimary } : undefined}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-3">
          <Button
            type="button"
            data-testid="account-access-cta"
            // Same destination and same new-tab behaviour as the hero's CTA; with no
            // URL configured the button is drawn but inert, exactly like the hero.
            onClick={() => {
              if (!loginUrl) return;
              window.open(loginUrl, "_blank", "noopener,noreferrer");
            }}
            // Full width of the card's content column — on a wide card that column
            // is the measured block above it, not the whole row. One line always:
            // the label is short enough to fit a phone tile with the tighter
            // padding/tracking below, and `whitespace-nowrap` makes that explicit.
            //
            // No hover SCALE here either: the shared variant's `hover:scale-105`
            // pushed this `w-full` button past the card's content column, so it
            // looked like it stretched to the card's edge.
            className="h-auto w-full gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] shadow-sm hover:scale-100 hover:!scale-100 hover:opacity-90 active:scale-100 sm:px-4 sm:text-xs sm:tracking-[0.08em]"
            style={
              primary
                ? // Inverse button: the readable colour as the fill, the primary as
                  // the label. Never the secondary colour.
                  {
                    backgroundColor: onPrimary,
                    color: brandColor,
                    borderRadius: portalRadiusValue(),
                  }
                : {
                    backgroundColor: ctaColor,
                    color: readableColor(ctaColor),
                    borderRadius: portalRadiusValue(),
                  }
            }
          >
            Register or Log In
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function HelpCardPanel({
  card,
  brandColor,
  basePath,
  onClose,
  contactName,
  onTalkThrough,
  initialOptionId,
  onOptionChange,
  actionHubRows,
  loginUrl,
  advisorBookingUrl,
  recordkeeperName,
  advisorFirm,
  planSponsorName,
  upcomingMeetings,
  resolvedMedia,
}: {
  card: HelpCardResolved;
  brandColor: string;
  basePath: string;
  onClose: () => void;
  /** Full name of the plan's primary key contact, for the Rollovers "free call" line. */
  contactName?: string;
  /** Scrolls to the "Have Questions?" band, where the contact's card lives. */
  onTalkThrough?: () => void;
  /** `&option=` deep link, forwarded to the Options Compare body. */
  initialOptionId?: string | null;
  onOptionChange?: (optionId: string | null) => void;
  /**
   * TF-5: the other benefits this action applies to. When present the panel replaces
   * the single CTA — the choice IS the call to action.
   */
  actionHubRows?: ActionHubRow[];
  /**
   * The plan's login URL. It fills `{{recordkeeper_url}}` in a topic's steps and is
   * the destination of a CTA that does not carry its own href — the recordkeeper is
   * where "Enroll or Change My Contribution" has to go.
   */
  loginUrl?: string;
  /**
   * The key contact's scheduling link, for a CTA that hands off to the advisor
   * ("Get Investment Help"). Empty means the button points at the Have Questions
   * band, where that contact's card (and booking control) lives.
   */
  advisorBookingUrl?: string;
  /** The provider administering this benefit, for `{{recordkeeper_name}}`. */
  recordkeeperName?: string;
  /** The advisor's firm, for `{{advisor_firm}}`. */
  advisorFirm?: string;
  /** The plan sponsor, for `{{plan_sponsor_name}}`. */
  planSponsorName?: string;
  /** This category's scheduled sessions, for `{{upcoming_retirement_meetings}}`. */
  upcomingMeetings?: string;
  /** Documents and videos attached to this topic, resolved from the plan library. */
  resolvedMedia?: {
    documents: PlanMediaDocument[];
    videos: PlanMediaVideo[];
    /**
     * Documents that belong to this card ALONE (a title + link stored on the
     * placement). They are not in the plan's library, so they never appear on the
     * benefit's Documents & Forms list.
     */
    topicDocuments?: TopicDocumentLink[];
  };
}) {
  // The video a resolved media chip is currently playing, if any.
  const [activeVideo, setActiveVideo] = useState<PlanMediaVideo | null>(null);
  // The Rollovers topic has its own body (options, pros/cons, CTA) instead of the
  // paragraph copy every other topic uses.
  const isRollovers = ROLLOVER_CARD_PATTERN.test(`${card.id} ${card.title}`);
  /** Per-plan values a topic's copy may name. */
  const fillPlanTokens = (text: string) =>
    participantCopy(
      text
      .replace(
        /\{\{recordkeeper_url\}\}/g,
        (loginUrl || "").trim() || "your recordkeeper's website",
      )
      // The key contact is the participant's SPECIALIST; the token keeps its name
      // so every stored topic that already uses it keeps resolving.
      .replace(/\{\{advisor_name\}\}/g, contactName || "your specialist")
      .replace(
        /\{\{advisor_firm\}\}/g,
        (advisorFirm || "").trim() || "your specialist's firm",
      )
      .replace(
        /\{\{plan_sponsor_name\}\}/g,
        (planSponsorName || "").trim() || "your employer",
      )
      .replace(/\{\{upcoming_retirement_meetings\}\}/g, upcomingMeetings || "")
      // Annual IRS figures — global values, updated each January.
      .replace(/\{\{plan_year\}\}/g, String(CONTRIBUTION_LIMITS_YEAR))
      .replace(/\{\{deferral_limit\}\}/g, ELECTIVE_DEFERRAL_LIMIT)
        .replace(
          /\{\{recordkeeper_name\}\}/g,
          (recordkeeperName || "").trim() || "your recordkeeper",
        ),
    );
  const steps = (card.steps ?? []).map(fillPlanTokens);
  const docs = card.docs ?? [];
  const video = fillPlanTokens((card.video || "").trim());
  const contact = fillPlanTokens((card.contact || "").trim());
  const related = card.related ?? [];
  const meetingsLine = fillPlanTokens((card.meetings || "").trim()).trim();
  /** Docs, the video and the contact this topic hands off to, in one list. */
  const resources: { kind: "doc" | "video" | "contact"; label: string }[] = [
    ...docs.map((label) => ({ kind: "doc" as const, label })),
    ...(video ? [{ kind: "video" as const, label: video }] : []),
    ...(contact ? [{ kind: "contact" as const, label: contact }] : []),
  ];
  // The CTA destination follows the card's own `ctaDestination`: the recordkeeper
  // login by default, the advisor's scheduling link (or the Have Questions band)
  // for an advisor handoff, and that same band for "contact" CTAs.
  const fallbackCtaHref = !card.cta
    ? ""
    : card.ctaDestination === "advisor"
      ? advisorBookingUrl || `#${HAVE_QUESTIONS_SECTION_ID}`
      : card.ctaDestination === "contact"
        ? `#${HAVE_QUESTIONS_SECTION_ID}`
        : loginUrl || "";
  const ctaHref = (card.href || fallbackCtaHref || "").trim();
  const resolved = ctaHref ? resolveCardHref(ctaHref, basePath) : null;
  // Stored labels ("Talk to an Advisor") read as "Specialist" on the portal.
  const ctaLabel = card.cta?.trim() ? participantCopy(card.cta) : "";
  // Rollovers already closes with its own CTA — the same "Talk through my options"
  // button, plus the "Free call with …" line. The topic also carries that label as
  // its `cta` (the library seeds it), so printing the generic button too would put
  // two identical buttons in one panel. The topic's own footer wins.
  const showGenericCta = !isRollovers && Boolean(ctaLabel);
  const ctaStyle = {
    backgroundColor: brandColor,
    borderColor: brandColor,
    color: readableColor(brandColor),
  } as React.CSSProperties;
  const ctaClass =
    "inline-flex min-h-11 items-center justify-center rounded-md border px-6 text-sm font-red-hat uppercase tracking-[0.15em] transition-all duration-300 hover:opacity-90";

  return (
    <div
      // Opaque (not /70) so the caret's fill matches it exactly. The border takes the
      // plan's brand colour, matching the ring on the card that opened it.
      className="animate-in fade-in-0 slide-in-from-top-1 rounded-2xl border bg-neutral-50 p-5 shadow-sm duration-200 sm:p-7"
      style={{ borderColor: brandColor }}
      // The panel belongs to the tile that opened it.
      role="region"
      aria-label={participantCopy(card.title)}
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          // Rollovers keeps a small title: its own larger header sits underneath.
          className={cn(
            "font-dm-serif leading-snug",
            isRollovers ? "text-base sm:text-lg" : "text-xl sm:text-2xl",
          )}
          style={{ color: brandColor }}
        >
          {participantCopy(card.title)}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${participantCopy(card.title)}`}
          className="shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isRollovers ? (
        <RolloversDetail
          brandColor={brandColor}
          contactName={contactName}
          onTalkThrough={onTalkThrough}
          initialOptionId={initialOptionId}
          onOptionChange={onOptionChange}
        />
      ) : (
        <>
          {card.introBold && (
            <p className="mt-3 font-red-hat text-[15px] font-semibold text-neutral-900">
              {card.introBold}
            </p>
          )}

          {/* The theme's body font for the expanded answer, the same face the card
              lines use — the detail panel is still the plan's copy. */}
          <div className="mt-2 space-y-2 font-red-hat text-[15px] leading-relaxed text-neutral-700">
            {(card.paragraphs ?? [])
              .map(fillPlanTokens)
              .filter((paragraph) => paragraph && paragraph.trim())
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>

          {/* Steps — the handoff's numbered how-to, built from the same tile the
              old Rollovers card used: the instruction top-left, its two-digit
              number bottom-right. */}
          {steps.length > 0 && (
            <ol
              data-testid="help-card-steps"
              className="mt-4 grid gap-2 sm:grid-cols-2"
            >
              {/* Steps animate INWARD when they are created (and back out when a
                  step is removed) — this is what the advisor sees live while adding
                  steps in the editor. `initial={false}` keeps the first participant
                  paint static: existing steps do not assemble themselves on load. */}
              {/* `mode="popLayout"` pops a removed step out of the grid flow the
                  instant it leaves, so the remaining tiles close up immediately
                  (without it, the exit held its slot and the delete looked late). */}
              <AnimatePresence initial={false} mode="popLayout">
                {steps.map((step, index) => (
                  <motion.li
                    key={index}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{
                      duration: 0.2,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    // The same hover the old Rollovers option tiles carried — a
                    // small lift, a darker border and a soft shadow.
                    className="flex min-h-[84px] flex-col justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm"
                  >
                    <span className="font-red-hat text-[13px] leading-snug text-neutral-700">
                      {step}
                    </span>
                    <span
                      className="self-end font-dm-serif text-[24px] font-semibold leading-none tabular-nums"
                      style={{ color: brandColor }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}

          {/* Upcoming meetings — hidden entirely when the plan has none (the
              token resolves empty). */}
          {meetingsLine && (
            <p
              data-testid="help-card-meetings"
              className="mt-3 font-red-hat text-[13px] leading-relaxed text-neutral-600"
            >
              <span className="font-semibold text-neutral-700">
                Upcoming meetings:
              </span>{" "}
              {meetingsLine}
            </p>
          )}

          {/* Docs / Video / Contact — the resources this topic points at. The
              category's Documents & Forms section and Video Library are where
              they are opened from. */}
          {resources.length > 0 && (
            <div
              data-testid="help-card-resources"
              className="mt-4 rounded-xl border border-neutral-200 bg-white/60 p-3"
            >
              <p className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Docs, video & contacts
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {resources.map((resource) => (
                  <li
                    key={`${resource.kind}-${resource.label}`}
                    data-resource-kind={resource.kind}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-red-hat text-[12px] text-neutral-700"
                  >
                    {resource.kind === "doc" ? (
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : resource.kind === "video" ? (
                      <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {resource.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Documents & videos attached to this topic: the plan's library (opens
              in a new tab) and the documents that belong to this card alone. A
              video plays in a lightbox. */}
          {resolvedMedia &&
            (resolvedMedia.documents.length > 0 ||
              resolvedMedia.videos.length > 0 ||
              (resolvedMedia.topicDocuments ?? []).length > 0) && (
              <div
                data-testid="help-card-media"
                className="mt-4 rounded-xl border border-neutral-200 bg-white/60 p-3"
              >
                <p className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Documents & Videos
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {resolvedMedia.documents.map((document) => (
                    <li key={`doc-${document.id}`}>
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-resource-kind="plan-document"
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-red-hat text-[12px] text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="max-w-[16rem] truncate">
                          {document.title}
                        </span>
                      </a>
                    </li>
                  ))}
                  {/* This card's OWN documents: same chip, but they exist only
                      here — the benefit's Documents & Forms list does not carry them. */}
                  {(resolvedMedia.topicDocuments ?? []).map((document) => (
                    <li key={`topic-doc-${document.url}`}>
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-resource-kind="topic-document"
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-red-hat text-[12px] text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="max-w-[16rem] truncate">
                          {document.title}
                        </span>
                      </a>
                    </li>
                  ))}
                  {resolvedMedia.videos.map((video) => (
                    <li key={`video-${video.id}`}>
                      <button
                        type="button"
                        onClick={() => setActiveVideo(video)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 font-red-hat text-[12px] text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                      >
                        <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="max-w-[16rem] truncate">{video.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Related Quick Answers — the questions that continue this topic. Each
              is a link into the Quick Answers band below. */}
          {related.length > 0 && (
            <div data-testid="help-card-related" className="mt-4">
              <p className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Related Quick Answers
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-red-hat text-[13px] text-neutral-700">
                {related.map((title, index) => (
                  <span key={title} className="inline-flex items-center gap-2">
                    {index > 0 && (
                      <span aria-hidden className="text-neutral-400">
                        ·
                      </span>
                    )}
                    <a
                      href={`#${QUICK_ANSWERS_SECTION_ID}`}
                      className="font-medium underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-900"
                      style={{ color: brandColor }}
                    >
                      {title}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          )}

          {/* Tags are deliberately NOT drawn: they are the search and chatbot
              vocabulary (`lib/topics/search.ts`, the Navigator's Ask box), not
              participant-facing copy. The data still rides on the card. */}
        </>
      )}

      {actionHubRows && actionHubRows.length > 0 ? (
        <ActionHubPanel
          rows={actionHubRows}
          brandColor={brandColor}
          basePath={basePath}
          ctaLabel={ctaLabel}
        />
      ) : (
        showGenericCta && (
          <div className="mt-5">
            {resolved && resolved.external ? (
              <a
                href={resolved.href}
                target="_blank"
                rel="noopener noreferrer"
                className={ctaClass}
                style={ctaStyle}
              >
                {ctaLabel}
              </a>
            ) : resolved ? (
              <Link href={resolved.href} className={ctaClass} style={ctaStyle}>
                {ctaLabel}
              </Link>
            ) : (
              <button type="button" className={ctaClass} style={ctaStyle}>
                {ctaLabel}
              </button>
            )}
          </div>
        )
      )}

      {/* Lightbox for an attached video. The chip opens it here rather than
          navigating away from the topic the participant is reading. */}
      <Dialog
        open={activeVideo !== null}
        onOpenChange={(next) => {
          if (!next) setActiveVideo(null);
        }}
      >
        <DialogContent overlayClassName="z-[120]" className="z-[120] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeVideo?.title ?? "Video"}</DialogTitle>
          </DialogHeader>
          {activeVideo && (
            <div className="space-y-2">
              <video
                src={activeVideo.videoUrl}
                controls
                autoPlay
                className="w-full rounded-lg bg-black"
              />
              <a
                href={activeVideo.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-red-hat text-[12px] text-neutral-600 underline"
              >
                Open in a new tab
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HowCanWeHelpSection({
  brandColor = "#002B5B",
  secondaryColor = "#E6C47A",
  clientId,
  category,
  accountAccessHref,
  planIdLabel,
  provider,
  cards,
  helpCardColumns,
  topics,
  media,
  actionHubPanels,
  onCardEdit,
}: HowCanWeHelpSectionProps) {
  const basePath = clientId ? `/${clientId}` : "";
  /** 3 or 4 cards per row — anything else in storage falls back to 3. */
  const columns = normalizeHelpCardColumns(helpCardColumns);

  // ── Account Access: the same inputs the Insurance Benefits Access & Materials
  // hero reads ──
  // The section is also rendered inside the portal, so the plan-level values come
  // from the portal context (the hero's own source). Callers outside that provider
  // pass the values explicitly.
  const portal = useOptionalClientPortal();
  const epp = (portal.clientData as any)?.employeePortalPreview as
    | Record<string, any>
    | undefined;

  const loginUrlFromContext = String(epp?.insuranceLoginUrl || "").trim();
  // Normalised: a bare host ("google.com") must leave the site, not become a
  // relative /{plan}/google.com path.
  const resolvedLoginUrl = toExternalUrl(
    accountAccessHref || loginUrlFromContext,
  );

  // The benefit's own value (passed by the hub) wins; the legacy plan-level copy is
  // the fallback for any caller that has not been wired yet.
  const resolvedPlanIdLabel =
    (planIdLabel || "").trim() ||
    formatPlanGroupIdLabel(epp?.insurancePlanId as string | undefined);

  const providerContact = provider ?? (epp?.providerContact as ProviderContact | undefined) ?? null;
  const legacyRecordkeeper = String(
    (portal.clientData as any)?.recordkeeper || "",
  ).trim();
  // Same rule as the hero: the category's own provider first, and the legacy
  // plan-level recordkeeper only ever described retirement services.
  const resolvedProviderName =
    (providerContact?.companyName || "").trim() ||
    (category === "Retirement" ? legacyRecordkeeper : "");
  const resolvedProviderDetail = [
    providerContact?.contactName,
    providerContact?.phone
      ? formatPhoneWithExtension(providerContact.phone)
      : "",
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .join(" · ");

  // The person the Rollovers panel offers a free call with. Resolved with the SAME
  // helper the welcome banner uses (`resolvePortalPrimaryContact`) and the same
  // category, so the two always name the same person for this benefit.
  const bannerPrimaryContact = resolvePortalPrimaryContact(
    (portal.clientData as any)?.keyContacts,
    category,
  );
  const benefitContactName = String(
    bannerPrimaryContact?.fullName || bannerPrimaryContact?.name || "",
  ).trim();
  // That same contact's booking link, for a topic CTA that hands off to the
  // advisor ("Get Investment Help").
  const advisorBookingUrl = toExternalUrl(
    String(bannerPrimaryContact?.schedulingUrl || ""),
  );
  // The advisor's firm and the plan sponsor, for the Financial Planning copy.
  const advisorFirm = String(
    bannerPrimaryContact?.companyName || bannerPrimaryContact?.company || "",
  ).trim();
  const planSponsorName = String(
    (portal.clientData as any)?.companyName || "",
  ).trim();

  /**
   * Two sources for the grid, and what each one owns:
   *
   *  - MEMBERSHIP **and ORDER** come from the FEATURED placements (`topics`)
   *    whenever the plan has any. That list is what the Editing Panel's Quick Access
   *    dropdown edits, and its order is written by Section 6's Card Layout — so a
   *    question promoted back to Featured arrives LAST, exactly where the board put
   *    it, instead of reappearing in the slot it held before it was demoted.
   *  - The PRIMARY comes from the SAVED card layout (`cards`): the advisor's
   *    arrangement still decides which card is wide. The layout's ORDER is not read
   *    here — the placements own it, so the two can never disagree. A layout id that
   *    is not featured any more simply finds no card to mark.
   *
   * Without placements (a plan that has not been switched to the topic framework)
   * the saved layout — or the catalog's natural order — lays the grid out exactly
   * as it always has. Account Access is not a topic in this build (that is TF-9),
   * so the card is synthesised from the catalog and pinned first.
   *
   * `[Benefit Category]` is resolved once per card.
   */
  const rows = useMemo(() => {
    const catalog = helpCardCatalogFor(category);

    if (topics && topics.length > 0) {
      const access = getHelpCardContent(ACCOUNT_ACCESS_CARD_ID, catalog);

      // A layout stores catalog ids (`understand-coverage`); a placement's card
      // carries the published slug (`sys.understand-coverage`), so the two are
      // compared without the system prefix.
      const layoutIdOf = (id: string) => id.replace(/^sys\./, "");
      const stored = (Array.isArray(cards) ? cards : []).filter(
        (entry): entry is HelpCardLayoutEntry =>
          !!entry && typeof entry.id === "string",
      );
      const disabled = new Set(
        stored
          .filter((entry) => entry.enabled === false)
          .map((entry) => entry.id),
      );
      const storedPrimaryId = stored.find((entry) => entry.primary)?.id ?? "";

      const placementCards: HelpCardResolved[] = (topics ?? [])
        .map((topic) => {
          const quickAnswer = topicQuickAnswer(topic);
          // The shipped catalog entry carries the blocks the topic row may not:
          // steps, docs, tags and the default CTA come from one place, so a
          // placement-driven grid reads exactly like a saved-layout one.
          const shipped = getHelpCardContent(
            topic.slug.replace(/^sys\./, ""),
            catalog,
          );
          const stepsBlock = topic.bodyBlocks.find(
            (block) => block.type === "steps",
          );
          /**
           * What the open panel prints.
           *
           * The topic's own quick answer first, then the shipped card's
           * paragraphs (a legacy topic predates this library's body), and finally
           * the card line — an accordion that opens onto nothing helps nobody.
           */
          const shippedParagraphs = (shipped?.paragraphs ?? []).map((paragraph) =>
            fillHelpCardTokens(paragraph, category),
          );
          const paragraphs = quickAnswer
            ? [fillHelpCardTokens(quickAnswer, category)]
            : shippedParagraphs.length > 0
              ? shippedParagraphs
              : (topic.summary || "").trim()
                ? [fillHelpCardTokens(topic.summary as string, category)]
                : [];
          const card: HelpCardResolved = {
            id: topic.slug,
            title: fillHelpCardTokens(topic.title, category),
            paragraphs,
            cta: topic.cta?.label ?? shipped?.cta ?? "",
            steps:
              stepsBlock && stepsBlock.type === "steps"
                ? stepsBlock.steps
                : shipped?.steps,
            docs: shipped?.docs,
            video: shipped?.video,
            contact: shipped?.contact,
            meetings: shipped?.meetings,
            related: shipped?.related,
            ctaDestination: shipped?.ctaDestination,
            tags: topic.tags.length > 0 ? topic.tags : shipped?.tags,
            primary: false,
          };
          /**
           * The tile's own line of copy.
           *
           * A Featured topic ships a `summary` written for the card. A question
           * PROMOTED from Quick Answers has none — its copy is the answer — so the
           * first answer doubles as the card line. Without this the tile arrives
           * with a title and nothing else.
           */
          const cardLine = (topic.summary || "").trim() || quickAnswer;
          if (cardLine) {
            card.body = participantCopy(
              fillHelpCardTokens(cardLine, category),
            );
          }
          if (topic.cta?.destination) {
            card.href = topic.cta.destination;
          }
          return card;
        })
        // A card Section 6 unticked stays off the hub even while it is featured.
        .filter((card) => !disabled.has(layoutIdOf(card.id)));

      // Account Access always rides along unless Section 6 turned it off; it is
      // not a placement, so it is added here rather than coming from the board.
      const withAccess: HelpCardResolved[] = disabled.has(ACCOUNT_ACCESS_CARD_ID)
        ? placementCards
        : [
            {
              id: ACCOUNT_ACCESS_CARD_ID,
              title: fillHelpCardTokens(
                access?.title ?? "[Benefit Category] Account Access",
                category,
              ),
              paragraphs: (access?.paragraphs ?? []).map((paragraph) =>
                fillHelpCardTokens(paragraph, category),
              ),
              cta: "",
              primary: false,
            },
            ...placementCards,
          ];

      // The ORDER is the board's: Account Access first, then the Featured cards in
      // placement order — which is what Card Layout writes. A promoted card is
      // appended there, so it lands last rather than back in its old slot.

      // The layout's primary, else Account Access — exactly the default the grid
      // had before the advisor arranged anything.
      const primaryId = withAccess.some(
        (card) => layoutIdOf(card.id) === storedPrimaryId,
      )
        ? storedPrimaryId
        : ACCOUNT_ACCESS_CARD_ID;

      // ...and the layout's EDGE is the one part of the order it still owns, so
      // Left/Right in Card Layout moves the primary on a placement-driven page too.
      const row1Slots = helpCardRowSizes(withAccess.length, columns)[0] ?? 1;
      const primaryOnRight =
        stored.findIndex((entry) => entry.primary === true) >=
        Math.max(row1Slots - 1, 1);
      const ordered = pinPrimaryToEdge(
        withAccess,
        primaryId,
        layoutIdOf,
        primaryOnRight,
        columns,
      );

      // The grid shows eight cards at most, so the board's order is trimmed to
      // its first eight once the primary has been marked.
      return chunkIntoRows(
        clampHelpCards(ordered).map((card) => ({
          ...card,
          primary: layoutIdOf(card.id) === primaryId,
        })),
        columns,
      );
    }

    // The saved layout (or, with neither, the catalog's natural order).
    if (catalog.length === 0) return [];
    return resolveHelpCardRows(cards, category, columns).map((row) =>
      row.map((card) => ({
        ...card,
        title: participantCopy(fillHelpCardTokens(card.title, category)),
        body: card.body
          ? participantCopy(fillHelpCardTokens(card.body, category))
          : undefined,
        introBold: card.introBold
          ? fillHelpCardTokens(card.introBold, category)
          : undefined,
        paragraphs: (card.paragraphs ?? []).map((paragraph) =>
          fillHelpCardTokens(paragraph, category),
        ),
      })),
    );
  }, [cards, category, topics, columns]);

  /** Every resolved card, in visual order. */
  const resolvedCards = useMemo(() => rows.flat(), [rows]);

  /**
   * Each topic's attached media, resolved through the plan's library. Keyed by the
   * card id (`topic.slug`), so the open panel can look up what to draw.
   */
  const mediaByCardId = useMemo(() => {
    const map = new Map<
      string,
      {
        documents: PlanMediaDocument[];
        videos: PlanMediaVideo[];
        topicDocuments: TopicDocumentLink[];
      }
    >();
    for (const topic of topics ?? []) {
      const documents = topicDocumentIdsOf(topic)
        .map((id) => media?.documents[id])
        .filter((document): document is PlanMediaDocument => Boolean(document));
      const videos = topicVideoIdsOf(topic)
        .map((id) => media?.videos[id])
        .filter((video): video is PlanMediaVideo => Boolean(video));
      // This card's own documents ride the topic, not the plan's library.
      const topicDocuments = topicDocumentsOf(topic);
      if (
        documents.length > 0 ||
        videos.length > 0 ||
        topicDocuments.length > 0
      ) {
        map.set(topic.slug, { documents, videos, topicDocuments });
      }
    }
    return map;
  }, [topics, media]);

  // Nothing starts open: the grid is collapsed choices until the reader picks
  // one. `null` is the closed state; the first tap (or a `#topic` deep link)
  // opens a panel, and tapping that card again closes it.
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const activeCardId = openCardId;

  // ── Deep links (TF-2) ──
  // `#<topic-slug>` opens the matching panel and `&option=` opens one Rollovers
  // option. Both write back with `replaceState`, so opening a card never piles up
  // history entries the reader has to click back through.
  const [rolloversOption, setRolloversOption] = useState<string | null>(null);

  const syncUrl = (slug: string | null, optionId: string | null) => {
    try {
      window.history.replaceState(
        window.history.state,
        "",
        buildTopicUrl(window.location.href, slug, optionId),
      );
    } catch {
      // History can be unavailable (sandboxed frames); the panel still works.
    }
  };

  const toggleCard = (cardId: string) => {
    const next = activeCardId === cardId ? null : cardId;
    setOpenCardId(next);
    // Only real topics go in the hash — the Account Access card is not one.
    syncUrl(next && next !== ACCOUNT_ACCESS_CARD_ID ? next : null, null);
    setRolloversOption(null);
    onCardEdit?.(cardId);
  };

  // ── The caret that points from the panel back to the card that opened it ──
  // It lives ONCE at the section level (not inside the panel) so selecting another
  // card moves the same node — a CSS transition slides it across the grid instead
  // of a new caret appearing in a new place.
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());
  const [caretPosition, setCaretPosition] = useState<{
    xPercent: number;
    yPercent: number;
  } | null>(null);

  /** Card ids in order — a stable dependency for the measuring effect. */
  const cardOrderKey = resolvedCards.map((card) => card.id).join("|");

  // Open whatever the URL named, once the grid is known. Placed after
  // `cardOrderKey` because that key is what tells us the topic set changed.
  //
  // The `hashchange` listener is what makes an IN-PAGE deep link work. The chatbot
  // lives in the portal layout, so following "Open on your plan page" while already
  // on that hub changes only the hash: this section never remounts, and without the
  // listener the answer the visitor just asked for would not open. A panel opens on
  // the next commit, so the scroll waits a frame.
  useEffect(() => {
    if (!topics || topics.length === 0) return;

    const openFromHash = () => {
      const fromHash = readHashTopicSlug(window.location.hash);
      if (!fromHash) return;

      const match = resolvedCards.find((card) =>
        topicMatchesHash({ slug: card.id }, fromHash),
      );
      if (!match) return;

      setOpenCardId(match.id);
      window.requestAnimationFrame?.(() => {
        document
          .getElementById(`help-card-${match.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    };

    openFromHash();

    const option = readOptionParam(window.location.search);
    if (option) setRolloversOption(option);

    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [cardOrderKey, topics]);

  useEffect(() => {
    const measure = () => {
      const container = rowsContainerRef.current;
      const tile = activeCardId
        ? tileRefs.current.get(activeCardId)
        : undefined;
      const panel = panelRef.current;
      if (!container || !tile || !panel) {
        setCaretPosition((prev) => (prev === null ? prev : null));
        return;
      }

      // Aim at the tile's centre and the panel's actual top border — the panel can
      // sit between two phone lines or under the whole row on desktop, so its
      // bounding box is the only reliable reference. Expressed as percentages, so
      // a scaled preview (the editor canvas) needs no correction.
      const next = computeCaretPosition({
        containerRect: container.getBoundingClientRect(),
        tileRect: tile.getBoundingClientRect(),
        panelRect: panel.getBoundingClientRect(),
      });
      setCaretPosition((prev) =>
        prev &&
        prev.xPercent === next.xPercent &&
        prev.yPercent === next.yPercent
          ? prev
          : next,
      );
    };

    measure();
    window.addEventListener("resize", measure);

    // Re-measure while a card is open. The editor preview scales this section with
    // a CSS transform applied AFTER mount (the scale is computed in an effect), and
    // a transform changes neither the layout box nor fires `resize` — so without
    // this the caret keeps the position it measured at scale 1 and sits off the
    // card. The state setter ignores identical values, so a settled caret costs no
    // re-renders.
    let frame = 0;
    const tick = () => {
      measure();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [activeCardId, cardOrderKey]);

  return (
    // `id` + scroll margin: the header's Login button scrolls here, and the margin
    // keeps the heading clear of the fixed portal header.
    <section
      id={HOW_CAN_WE_HELP_SECTION_ID}
      className="flex min-h-screen w-full scroll-mt-24 flex-col justify-center bg-white py-16 sm:scroll-mt-28 lg:py-20 lg:scroll-mt-32"
    >
      <h2 className="mb-14 text-center text-2xl font-dm-serif text-gray-900 sm:text-2xl lg:text-5xl">
        How Can We Help You Today?
      </h2>

      <div
        ref={rowsContainerRef}
        // ONE grid for the whole section. On a phone that is a SINGLE column
        // (the row wrappers are `display: contents` there), so every card fills
        // the viewport's width. On desktop it is a stack of rows — each row spans
        // the whole line and runs its own grid — and the gaps do the spacing that
        // `space-y-4` used to.
        className={cn(
          "relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8",
          GRID_CLASS[columns],
        )}
      >
        {/* ONE layout group for the whole grid.
            A row is keyed by its INDEX, so a card that changes rows is unmounted
            from one wrapper and mounted in another — framer can only animate
            across that boundary when the cards share a `layoutId`, which is what
            the group makes possible. Without it the TWO-COLUMN cards (the ones
            that trade places with a narrower card in the next row) snapped into
            their new slot while the rest glided. */}
        <LayoutGroup>
        {/* Caret — a rotated square straddling the open panel's top border, aimed at
            the card that opened it. It is ONE element for the whole section, so
            changing cards slides it across the grid instead of popping up a new one.
            Hidden from assistive tech: the panel is labelled by its own heading.

            Positioned with PERCENTAGES and a CSS transition rather than animated
            pixels: percentages are layout units, so the editor preview's
            `transform: scale(<1>)` (and browser zoom) cannot displace it, and the
            preview's `.force-visible` rule, which forces `transform: none` on
            framer-animated nodes, no longer applies. */}
        <span
          aria-hidden
          data-testid="help-card-caret"
          data-help-caret
          className="pointer-events-none absolute z-10 h-3.5 w-3.5 rounded-[2px] border-l border-t bg-neutral-50"
          style={{
            left: `${caretPosition?.xPercent ?? 0}%`,
            top: `${caretPosition?.yPercent ?? 0}%`,
            transform: "translate(-50%, -50%) rotate(45deg)",
            opacity: caretPosition ? 1 : 0,
            transition:
              "left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease",
            borderColor: brandColor,
          }}
        />

        {rows.map((row, rowIndex) => {
          const openCard =
            row.find((card) => card.id === activeCardId) ?? null;
          // The row's columns, divided between its cards. The extra column of a
          // short row follows the PRIMARY, so a primary at the right edge of row 1
          // stays the wide card there. Every card is capped at two columns — except
          // a section holding ONE card, which is three columns wide and centred.
          const primaryIndexInRow = row.findIndex((card) => card.primary);
          const spans = helpCardRowSpans(
            row.length,
            columns,
            primaryIndexInRow >= 0 ? primaryIndexInRow : 0,
            row.length === 1 ? 3 : helpCardMaxSpan(columns),
          );
          const phoneLines = chunkRowForPhone(row, spans);

          const renderCard = (
            card: HelpCardResolved,
            cardIndex: number,
            span: number,
            lone = false,
          ): React.ReactNode => {
            const isAccountAccess = card.id === ACCOUNT_ACCESS_CARD_ID;
            const isPrimary = card.primary;
            const description = (card.paragraphs ?? [])
              .find((paragraph) => paragraph && paragraph.trim())
              // The Account Access card line names the provider.
              ?.replace(
                /\{\{recordkeeper_name\}\}/g,
                resolvedProviderName || "your recordkeeper",
              );

            // Colour pair for a primary tile: the plan's primary colour as the fill
            // and the readable colour for everything drawn on top of it.
            const onPrimary = readableColor(brandColor);
            const onPrimaryMuted = transparentize(0.2, onPrimary);

            // The Account Access card mirrors the materials hero and never opens a
            // detail panel. It renders as the 2-wide primary or as a 1-wide tile.
            if (isAccountAccess) {
              return (
                <AccountAccessCard
                  key={card.id}
                  title={participantCopy(card.title)}
                  description={description}
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                  primary={isPrimary}
                  span={span}
                  columns={columns}
                  lone={lone}
                  planIdLabel={resolvedPlanIdLabel || undefined}
                  providerName={resolvedProviderName || undefined}
                  providerDetailLine={resolvedProviderDetail || undefined}
                  loginUrl={resolvedLoginUrl}
                  actions={accountAccessActionsFor(category)}
                />
              );
            }

            const isOpen = card.id === activeCardId;
            /**
             * Same treatment as the Account Access card when a topic owns its
             * whole row: the content and its button share one measured, centred
             * column instead of each line running the full width of the grid.
             */
            const isWide = span >= columns || lone;

            return (
              <motion.div
                key={card.id}
                data-help-card={card.id}
                // A reorder in the Editing Panel animates the card into its new
                // slot; a participant's first paint stays static (`initial={false}`).
                layout
                // The card's identity across ROWS: a two-column card moving to a
                // narrower slot lives under a different row wrapper afterwards, and
                // the shared id is what lets framer carry it there.
                layoutId={`help-card-${card.id}`}
                initial={false}
                transition={HELPCARD_LAYOUT_TRANSITION}
                whileHover={{ y: -2 }}
                // Measured by the section-level caret, so it can animate to whichever
                // card is open.
                ref={(element) => {
                  if (element) tileRefs.current.set(card.id, element);
                  else tileRefs.current.delete(card.id);
                }}
                onClick={() => toggleCard(card.id)}
                className={cn(
                  // Same height floor as the Account Access card, so row 2 is
                  // exactly as tall as row 1. The hover lift is framer's
                  // `whileHover` (an inline layout transform would override CSS).
                  // `relative` hosts the open ring, which is a child rather than this
                  // node's own `boxShadow` — see the comment on that span.
                  "group relative flex h-full w-full cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left shadow-sm transition-shadow duration-200 hover:shadow-md",
                  // A wide tile centres its measured block; a narrow one stacks from
                  // the top-left, with the CTA pushed to the bottom edge.
                  isWide
                    ? "min-h-[132px] items-center justify-center"
                    : "min-h-[180px] items-start lg:min-h-[210px]",
                  // Width comes from the row's span plan, so every row reaches the
                  // right edge however many cards the plan shows.
                  spanClass(span, columns),
                  // The only card in the section: three columns, centred.
                  lone && LONE_CARD_WIDTH[columns],
                  isPrimary ? "border-transparent" : "bg-white",
                  !isPrimary &&
                    (isOpen
                      ? "border-transparent"
                      : "border-neutral-200 hover:border-neutral-300"),
                )}
                // Only the STATIC fill lives here. `boxShadow` used to be passed on
                // this node too, toggling with `isOpen` — but framer-motion owns a
                // motion element's `style` and does not reliably CLEAR a key that
                // drops out of it. A card that had been open therefore kept its ring
                // after another card was opened (and picked it up a commit late).
                style={isPrimary ? { backgroundColor: brandColor } : undefined}
              >
                {/* The open ring. A plain span, so React mounts and unmounts it
                    outright and no stale inline shadow can survive the switch. The
                    brand ring would vanish on a brand fill, so an open primary tile
                    rings in its own readable colour instead. */}
                {isOpen && (
                  <span
                    aria-hidden
                    data-help-card-ring
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      boxShadow: `0 0 0 2px ${isPrimary ? onPrimary : brandColor}`,
                    }}
                  />
                )}
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-2",
                    // The same measured column the Account Access card uses, so
                    // the button below is the same width on either card type.
                    // A card that does not own most of its row (a 2/4 primary,
                    // say) fills the tile instead; the tile aligns children to
                    // the start, so without this the CTA would only be as wide
                    // as its longest line.
                    isWide ? WIDE_CARD_CONTENT : "w-full",
                  )}
                >
                <h3
                  // A step down from the Account Access heading: on a phone these
                  // tiles are half-width, so an 18px serif title crowded the copy
                  // and the CTA under it. Desktop still gets the larger step.
                  className="font-dm-serif text-base font-semibold leading-snug sm:text-lg"
                  style={{ color: isPrimary ? onPrimary : brandColor }}
                >
                  {participantCopy(card.title)}
                </h3>

                {/* Body text — the short supporting line on the card itself.
                    `font-red-hat` is the theme's body role (`--font-body`), so the
                    card copy follows the plan's Typography Theme. */}
                {card.body && (
                  <p
                    className={cn(
                      "font-red-hat text-[15px] leading-snug",
                      !isPrimary && "text-neutral-600",
                    )}
                    style={isPrimary ? { color: onPrimaryMuted } : undefined}
                  >
                    {card.body}
                  </p>
                )}

                {/* `w-full`: the tile is a flex column with `items-start`, so without
                    it this wrapper shrinks to the button's content and the CTA only
                    spans half the card. */}
                <div className="mt-auto w-full pt-2">
                  <Button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`help-card-${card.id}`}
                    // The whole tile is clickable, so stop this click from bubbling
                    // back up and toggling the panel twice.
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleCard(card.id);
                    }}
                    // Full width of the card's CONTENT column — the same rule the
                    // Account Access card follows. On a wide tile that column is the
                    // measured 44rem block above it, so the button matches the text
                    // rather than spanning the whole row. The phone size is tuned so
                    // "Showing Below" stays on ONE line inside a half-width tile;
                    // `whitespace-nowrap` is the guarantee, not a hope.
                    //
                    // `hover:!scale-100` cancels the shared button variant's
                    // `hover:scale-105`: on a `w-full` CTA that scaling grew the
                    // button past its card's content column — it looked like it was
                    // stretching to the card's edge on hover. The lift on the tile
                    // (framer) and the opacity change below are the feedback instead.
                    className="w-full justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.04em] shadow-sm hover:scale-100 hover:!scale-100 hover:opacity-90 active:scale-100 sm:px-4 sm:text-xs sm:tracking-[0.12em]"
                    style={
                      isPrimary
                        ? // Inverse button on a filled card — never the secondary
                          // colour, which may not contrast with the primary.
                          {
                            backgroundColor: onPrimary,
                            color: brandColor,
                            borderRadius: portalRadiusValue(),
                          }
                        : {
                            backgroundColor: brandColor,
                            color: readableColor(brandColor),
                            borderRadius: portalRadiusValue(),
                          }
                    }
                  >
                    {/* The open card tells the reader where its content went. */}
                    {isOpen ? "Showing Below" : "Learn more"}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200 sm:h-3.5 sm:w-3.5",
                        isOpen && "rotate-180",
                      )}
                    />
                  </Button>
                </div>
                </div>
              </motion.div>
            );
          };

          /**
           * The open card's panel.
           *
           * `inGrid` places it INSIDE the row grid, spanning both phone columns, so on
           * a phone it lands directly under the cards it belongs to instead of after
           * the whole row. `lg:order-last` moves it back below all three cards on
           * desktop, where the row is a single line.
           */
          const panelNode = (inGrid: boolean) =>
            openCard ? (
              <div
                key={`panel-${openCard.id}`}
                id={`help-card-${openCard.id}`}
                ref={panelRef}
                className={inGrid ? PANEL_SPAN_CLASS[columns] : undefined}
              >
                <HelpCardPanel
                  card={openCard}
                  brandColor={brandColor}
                  basePath={basePath}
                  contactName={benefitContactName}
                  actionHubRows={actionHubPanels?.[openCard.id]}
                  resolvedMedia={mediaByCardId.get(openCard.id)}
                  loginUrl={resolvedLoginUrl}
                  advisorBookingUrl={advisorBookingUrl}
                  recordkeeperName={resolvedProviderName}
                  advisorFirm={advisorFirm}
                  planSponsorName={planSponsorName}
                  // Sends the reader to the contact's card in "Have Questions?"
                  // rather than opening the scheduling URL in another tab — the
                  // person (and their email / phone) is right there.
                  onTalkThrough={() =>
                    scrollToPortalSection(HAVE_QUESTIONS_SECTION_ID)
                  }
                  initialOptionId={rolloversOption}
                  onOptionChange={(optionId) => {
                    setRolloversOption(optionId);
                    syncUrl(activeCardId, optionId);
                  }}
                  onClose={() => {
                    setOpenCardId(null);
                    setRolloversOption(null);
                    syncUrl(null, null);
                  }}
                />
              </div>
            ) : null;

          return (
            <motion.div
              key={rowIndex}
              // On a PHONE this wrapper leaves the layout entirely (`display:
              // contents`), so its cards become items of the section's single
              // two-column grid and pair up with the cards of the rows above and
              // below. That is the fix for the hole a row of three singles used
              // to leave: its third card now pairs with the next row's first.
              // On DESKTOP the wrapper is the row's own grid, filling one line of
              // the outer grid, which is what keeps three columns per row.
              className={cn(
                "contents",
                row.length === 1
                  ? // A lone card is CENTRED: a flex line, rather than a grid row
                    // it cannot fill.
                    "lg:col-span-full lg:flex lg:justify-center"
                  : cn("lg:col-span-full lg:grid lg:gap-4", GRID_CLASS[columns]),
              )}
            >
              {/* EVERY row renders through its PHONE lines — row 1 included.
                  The line plan decides where the open card's panel goes: after
                  the last card of the line it belongs to. On desktop the panel's
                  `lg:order-last` puts it below the whole row instead. */}
              {phoneLines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {line.map((entry) =>
                    renderCard(
                      entry.card,
                      entry.index,
                      entry.span,
                      row.length === 1,
                    ),
                  )}
                  {line.some((entry) => entry.card.id === activeCardId)
                    ? panelNode(true)
                    : null}
                </Fragment>
              ))}
            </motion.div>
          );
        })}
        </LayoutGroup>
      </div>
    </section>
  );
}
