"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import { readableColor } from "polished";
import { HOW_CAN_WE_HELP_SECTION_ID } from "@/lib/portal-section-anchors";
import { Button } from "@/components/ui/button";
import { useOptionalClientPortal } from "@/contexts/client-portal-context";
import { formatPhoneWithExtension } from "@/lib/phone-utils";
import { resolvePortalPrimaryContact } from "@/lib/portal-primary-contact";
import type { ProviderContact } from "@/types/benefit";
import { cn } from "@/lib/utils";

/**
 * "How Can We Help You Today?" — a topic grid with an expand-in-place detail panel.
 *
 * Layout contract:
 *  - The section fills the viewport (`min-h-screen`), so it owns a whole screen
 *    between the welcome banner and the video section.
 *  - Row 1 is `2/4 + 1/4 + 1/4`: the first card (Account Access) takes the wide slot
 *    and the next two sit beside it.
 *  - Every row after that is `4 × 1/4`.
 *  - Opening a card renders its detail panel directly BENEATH the row it belongs to,
 *    so the rest of the grid moves down instead of the page jumping to a modal.
 *    Rollovers & Distributions is open on first paint.
 *  - Every tile ends in a "Learn more" Button in the plan's SECONDARY colour; the
 *    whole tile is also clickable, so a tap anywhere on the card opens it.
 *
 * `cards` comes from the Benefit row (`helpCards`). A plan that has not configured
 * any yet still gets the full set below, because the section is a fixed part of every
 * hub page.
 *
 * The WIDE tile is the account-access card, not a topic: it mirrors the Insurance
 * Benefits Access & Materials hero — plan / group ID, the provider administering the
 * benefit, what the participant can do there, and a "Register or Login Here →" button
 * that opens the plan's login URL in a new tab. It never opens a detail panel; the
 * topics below it do.
 *
 * `[Benefit Category]` is a merge token in the default copy, resolved from the
 * `category` prop each hub passes ("Retirement", "Group Health", …) — so the wide
 * card reads "Retirement Account Access". It is resolved in ANY card, configured by
 * the advisor or not; when no category is known the token is dropped rather than
 * shown to a participant. `[Company Name]` / `[Advisor Name]` follow the same
 * convention used across the portal's default copy.
 */

export interface HelpCardData {
  id: string;
  title: string;
  /**
   * The tile's supporting line — the one or two sentences shown under the title on
   * the CARD itself. Optional: a tile without it is just the title and its button.
   * (The expanded panel reads `paragraphs`.)
   */
  body?: string;
  introBold?: string;
  paragraphs: string[];
  cta: string;
  href?: string;
}

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
   * Destination for the Account Access card's "Register or Login Here" button.
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
  /** Custom cards from the wizard. Falls back to the set below when omitted. */
  cards?: HelpCardData[];
  /** Click handler for editing a specific card. Receives the card's ID. */
  onCardEdit?: (cardId: string) => void;
}

/** Merge token in the default copy, replaced by `category`. */
const BENEFIT_CATEGORY_TOKEN = "[Benefit Category]";

/**
 * `data-help-card` id of the wide Account Access card.
 *
 * The card is not a topic tile — it carries no panel — but it IS the marker the
 * editor's Plan / Group ID, login URL and Provider inputs scroll the preview to,
 * so the id lives here (next to the card that renders it) and is imported by both
 * preview scroll bridges instead of being repeated as a string literal.
 */
export const ACCOUNT_ACCESS_CARD_ID = "account-access";

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
 * Replace the `[Benefit Category]` token. With no category known the token is
 * removed (and the leftover spacing tidied) so a participant never sees a
 * placeholder on a live page.
 */
function fillBenefitCategory(text: string, category?: string): string {
  if (!text || !text.includes(BENEFIT_CATEGORY_TOKEN)) return text;
  const label = (category || "").trim();
  if (label) return text.split(BENEFIT_CATEGORY_TOKEN).join(label);
  return text
    .split(BENEFIT_CATEGORY_TOKEN)
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The seven topics, in the order the grid lays them out:
 * row 1 — Account Access (wide), Rollovers & Distributions, Update My Beneficiaries;
 * row 2 — Financial Planning, When to Claim Social Security, Turning 65: Medicare,
 *         How Much Should I Save?
 */
export const HELP_TOPIC_CARDS: HelpCardData[] = [
  {
    id: "account-access",
    title: "[Benefit Category] Account Access",
    paragraphs: [
      "View your balances, plan documents, and investment details in one place.",
      "Take charge of your account and stay on top of your progress anytime.",
    ],
    cta: "",
  },
  {
    id: "rollovers-distributions",
    title: "Rollovers & Distributions",
    body: "Changing jobs? Compare your 4 options side by side.",
    introBold: "Transitioning to a new employer?",
    paragraphs: [
      "Understand your options for managing the savings you have already built. The decision you make now can have a lasting impact on your retirement lifestyle.",
    ],
    cta: "",
  },
  {
    id: "beneficiaries",
    title: "Update My Beneficiaries",
    body: "Update your 401(k) and life insurance beneficiaries in one place.",
    paragraphs: [
      "Keep your beneficiary designations current so your benefits go to the people you intend.",
    ],
    cta: "",
  },
  {
    id: "financial-planning",
    title: "Financial Planning",
    body: "Exclusive benefits for [Company Name] plan participants.",
    paragraphs: [
      "Exclusive benefits for [Company Name] plan participants.",
      "Elevate your financial journey with personalized planning through [Advisor Name], integrated with your benefits.",
    ],
    cta: "",
  },
  {
    id: "social-security",
    title: "When to Claim Social Security",
    body: "See how your claiming age changes your monthly benefit.",
    paragraphs: [
      "See how your claiming age changes your monthly benefit, and what to weigh before you file.",
    ],
    cta: "",
  },
  {
    id: "medicare",
    title: "Turning 65: Medicare",
    body: "How Medicare works with your employer coverage, and when to enroll.",
    paragraphs: [
      "Understand how Medicare works with your employer coverage and when to enroll so there are no gaps or penalties.",
    ],
    cta: "",
  },
  {
    id: "savings",
    title: "How Much Should I Save?",
    body: "See how your contribution rate shapes your retirement income.",
    paragraphs: [
      "Find out how your contribution rate today shapes your income in retirement — and how to close the gap.",
    ],
    cta: "",
  },
];

/** Row 1 holds the wide slot plus two cards; later rows fill four across. */
const FIRST_ROW_CARDS = 3;
const ROW_CAPACITY = 4;
/** Cards that share one line of the 2-column phone grid. */
const MOBILE_ROW_CAPACITY = 2;

/** Split a row into the groups of cards that share a line on a phone. */
function chunkCards(cards: HelpCardData[], size: number): HelpCardData[][] {
  const chunks: HelpCardData[][] = [];
  for (let index = 0; index < cards.length; index += size) {
    chunks.push(cards.slice(index, index + size));
  }
  return chunks;
}

/**
 * Split the cards into the layout's rows: `[wide, narrow, narrow]` first, then
 * chunks of four. A plan with fewer cards simply ends early instead of leaving
 * empty cells.
 */
function groupIntoRows(cards: HelpCardData[]): HelpCardData[][] {
  const rows: HelpCardData[][] = [];
  const first = cards.slice(0, FIRST_ROW_CARDS);
  if (first.length > 0) rows.push(first);
  const rest = cards.slice(FIRST_ROW_CARDS);
  for (let i = 0; i < rest.length; i += ROW_CAPACITY) {
    rows.push(rest.slice(i, i + ROW_CAPACITY));
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
  secondaryColor,
  contactName,
  onTalkThrough,
}: {
  brandColor: string;
  secondaryColor: string;
  contactName?: string;
  onTalkThrough?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
              onClick={() =>
                setSelectedId((prev) =>
                  prev === option.id ? null : option.id,
                )
              }
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
          style={{
            backgroundColor: secondaryColor,
            color: readableColor(secondaryColor),
          }}
        >
          Talk through my options
        </Button>
        <span className="font-red-hat text-[13px] text-neutral-600">
          Free call with {contactName || "your advisor"}
        </span>
      </div>
    </div>
  );
}

/**
 * The wide Account Access card.
 *
 * This is the Insurance Benefits Access & Materials hero, condensed into a tile:
 * the heading, the plan / group ID, who administers the benefit, what the participant
 * can do once they are in, and the Register / Login CTA. The destination and the
 * provider come from the same sources the hero uses, so the two can never point at
 * different places.
 */
function AccountAccessCard({
  title,
  description,
  brandColor,
  secondaryColor,
  planIdLabel,
  providerName,
  providerDetailLine,
  loginUrl,
}: {
  title: string;
  description?: string;
  brandColor: string;
  secondaryColor: string;
  planIdLabel?: string;
  providerName?: string;
  providerDetailLine?: string;
  loginUrl?: string;
}) {
  // The hero's own feature list — what the login gets the participant.
  const bullets = ["See coverage", "Get ID cards", "Make changes", "Update dependents"];
  const ctaColor = secondaryColor || brandColor;

  return (
    <div
      data-help-card={ACCOUNT_ACCESS_CARD_ID}
      // The height floor is what makes every row in the grid the same height: the
      // topic tiles below use the identical `min-h`, so row 2 matches row 1 even
      // though its cards carry far less content.
      className="group col-span-2 flex h-full min-h-[180px] flex-col rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md sm:p-5 lg:min-h-[210px]"
    >
      <h3
        // Matches the topic titles, so every card in the grid reads at one size.
        className="font-dm-serif text-lg font-semibold leading-snug sm:text-xl"
        style={{ color: brandColor }}
      >
        {title}
      </h3>

      {description && (
        <p className="mt-0.5 line-clamp-1 text-[15px] leading-snug text-neutral-600">
          {description}
        </p>
      )}

      {planIdLabel && (
        <div className="mt-2">
          <span
            className="inline-block rounded-md px-2 py-1 font-red-hat text-[13px] font-semibold leading-tight"
            style={{ backgroundColor: `${brandColor}14`, color: brandColor }}
          >
            {planIdLabel}
          </span>
        </div>
      )}

      {providerName && (
        <div className="mt-1.5">
          <p className="font-red-hat text-[13px] leading-tight text-neutral-500">
            Administered by{" "}
            <span className="font-semibold" style={{ color: brandColor }}>
              {providerName}
            </span>
            {providerDetailLine ? ` · ${providerDetailLine}` : ""}
          </p>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
        {bullets.map((item) => (
          <div key={item} className="flex items-center">
            <span
              className="mr-1.5 h-1 w-1 flex-shrink-0 rounded-full"
              style={{ background: brandColor }}
            />
            <span className="font-red-hat text-[13px] leading-tight text-neutral-700">
              {item}
            </span>
          </div>
        ))}
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
          className="h-auto w-full gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] shadow-sm hover:opacity-90"
          style={{
            backgroundColor: ctaColor,
            color: readableColor(ctaColor),
          }}
        >
          Register or Login Here
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function HelpCardPanel({
  card,
  brandColor,
  secondaryColor,
  basePath,
  onClose,
  contactName,
  onTalkThrough,
}: {
  card: HelpCardData;
  brandColor: string;
  secondaryColor: string;
  basePath: string;
  onClose: () => void;
  /** Full name of the plan's primary key contact, for the Rollovers "free call" line. */
  contactName?: string;
  /** Opens the plan's appointment link, when one is configured. */
  onTalkThrough?: () => void;
}) {
  // The Rollovers topic has its own body (options, pros/cons, CTA) instead of the
  // paragraph copy every other topic uses.
  const isRollovers = ROLLOVER_CARD_PATTERN.test(`${card.id} ${card.title}`);
  const resolved = card.href ? resolveCardHref(card.href, basePath) : null;
  const ctaLabel = card.cta?.trim() ? card.cta : "";
  const ctaStyle = {
    borderColor: secondaryColor,
    color: secondaryColor,
  } as React.CSSProperties;
  const ctaClass =
    "inline-flex min-h-11 items-center justify-center rounded-md border bg-white px-6 text-sm font-red-hat uppercase tracking-[0.15em] transition-all duration-300 hover:opacity-90";

  return (
    <div
      // Opaque (not /70) so the caret's fill matches it exactly. The border takes the
      // plan's brand colour, matching the ring on the card that opened it.
      className="animate-in fade-in-0 slide-in-from-top-1 rounded-2xl border bg-neutral-50 p-5 shadow-sm duration-200 sm:p-7"
      style={{ borderColor: brandColor }}
      // The panel belongs to the tile that opened it.
      role="region"
      aria-label={card.title}
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
          {card.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${card.title}`}
          className="shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isRollovers ? (
        <RolloversDetail
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contactName={contactName}
          onTalkThrough={onTalkThrough}
        />
      ) : (
        <>
          {card.introBold && (
            <p className="mt-3 text-[15px] font-semibold text-neutral-900">
              {card.introBold}
            </p>
          )}

          <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-neutral-700">
            {(card.paragraphs ?? [])
              .filter((paragraph) => paragraph && paragraph.trim())
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        </>
      )}

      {ctaLabel && (
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
      )}
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
  onCardEdit,
}: HowCanWeHelpSectionProps) {
  const basePath = clientId ? `/${clientId}` : "";

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
  const resolvedLoginUrl = (accountAccessHref || loginUrlFromContext).trim();

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

  // Where "Talk through my options" goes — the plan's own appointment link.
  const appointmentLink = String(
    (portal.clientData as any)?.appointmentLink || "",
  ).trim();

  // Resolve `[Benefit Category]` once per card set, so the default topics and any
  // advisor-configured card read the same way.
  const resolvedCards = useMemo(() => {
    const source = cards && cards.length > 0 ? cards : HELP_TOPIC_CARDS;
    return source.map((card) => ({
      ...card,
      title: fillBenefitCategory(card.title, category),
      body: card.body ? fillBenefitCategory(card.body, category) : undefined,
      introBold: card.introBold
        ? fillBenefitCategory(card.introBold, category)
        : undefined,
      paragraphs: (card.paragraphs ?? []).map((paragraph) =>
        fillBenefitCategory(paragraph, category),
      ),
    }));
  }, [cards, category]);

  // `undefined` = untouched, so the default open card is used; `null` = the reader
  // closed it and it must stay closed.
  const [openCardId, setOpenCardId] = useState<string | null | undefined>(
    undefined,
  );

  const defaultOpenCardId =
    resolvedCards.find((card) =>
      ROLLOVER_CARD_PATTERN.test(`${card.id} ${card.title}`),
    )?.id ?? null;
  const activeCardId = openCardId === undefined ? defaultOpenCardId : openCardId;

  const rows = groupIntoRows(resolvedCards);

  const toggleCard = (cardId: string) => {
    setOpenCardId(activeCardId === cardId ? null : cardId);
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
      <h2
        className="mb-14 text-center text-2xl font-dm-serif sm:text-2xl lg:text-5xl"
        style={{ color: brandColor }}
      >
        How Can We Help You Today?
      </h2>

      <div
        ref={rowsContainerRef}
        className="relative mx-auto w-full max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8"
      >
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
          const isFirstRow = rowIndex === 0;
          const openCard =
            row.find((card) => card.id === activeCardId) ?? null;

          const renderCard = (
            card: HelpCardData,
            cardIndex: number,
          ): React.ReactNode => {
            const isWide = isFirstRow && cardIndex === 0;
            const description = (card.paragraphs ?? []).find(
              (paragraph) => paragraph && paragraph.trim(),
            );

            // The wide card is the account-access card — it mirrors the materials
            // hero and never opens a detail panel.
            if (isWide) {
              return (
                <AccountAccessCard
                  key={card.id}
                  title={card.title}
                  description={description}
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                  planIdLabel={resolvedPlanIdLabel || undefined}
                  providerName={resolvedProviderName || undefined}
                  providerDetailLine={resolvedProviderDetail || undefined}
                  loginUrl={resolvedLoginUrl}
                />
              );
            }

            const isOpen = card.id === activeCardId;

            return (
              <div
                key={card.id}
                data-help-card={card.id}
                // Measured by the section-level caret, so it can animate to whichever
                // card is open.
                ref={(element) => {
                  if (element) tileRefs.current.set(card.id, element);
                  else tileRefs.current.delete(card.id);
                }}
                onClick={() => toggleCard(card.id)}
                className={cn(
                  // Same height floor as the Account Access card, so row 2 is
                  // exactly as tall as row 1.
                  "group flex h-full min-h-[180px] w-full cursor-pointer flex-col items-start gap-2 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:min-h-[210px]",
                  "col-span-1",
                  isOpen
                    ? "border-transparent"
                    : "border-neutral-200 hover:border-neutral-300",
                )}
                style={
                  isOpen
                    ? { boxShadow: `0 0 0 2px ${brandColor}` }
                    : undefined
                }
              >
                <h3
                  // Topic titles run a step larger than the Account Access card's,
                  // since those cards carry far less content.
                  className="font-dm-serif text-lg font-semibold leading-snug sm:text-xl"
                  style={{ color: brandColor }}
                >
                  {card.title}
                </h3>

                {/* Body text — the short supporting line on the card itself. */}
                {card.body && (
                  <p className="text-[15px] leading-snug text-neutral-600">
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
                    // Nearly the full card width, like the Account Access CTA.
                    className="w-full justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] shadow-sm hover:opacity-90"
                    style={{
                      backgroundColor: secondaryColor,
                      color: readableColor(secondaryColor),
                    }}
                  >
                    {/* The open card tells the reader where its content went. */}
                    {isOpen ? "Showing Below" : "Learn more"}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </Button>
                </div>
              </div>
            );
          };

          /**
           * The open card's panel.
           *
           * `inGrid` places it INSIDE the row grid, spanning both phone columns, so on
           * a phone it lands directly under the cards it belongs to instead of after
           * the whole row. `lg:order-last` moves it back below all four cards on
           * desktop, where the row is a single line.
           */
          const panelNode = (inGrid: boolean) =>
            openCard ? (
              <div
                key={`panel-${openCard.id}`}
                id={`help-card-${openCard.id}`}
                ref={panelRef}
                className={
                  inGrid ? "col-span-2 lg:col-span-4 lg:order-last" : undefined
                }
              >
                <HelpCardPanel
                  card={openCard}
                  brandColor={brandColor}
                  secondaryColor={secondaryColor}
                  basePath={basePath}
                  contactName={benefitContactName}
                  onTalkThrough={() => {
                    if (!appointmentLink) return;
                    window.open(
                      appointmentLink,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  onClose={() => setOpenCardId(null)}
                />
              </div>
            ) : null;

          return (
            <div key={rowIndex} className="space-y-4">
              {/* Row 1 is 2/4 + 1/4 + 1/4; every later row is 4 × 1/4. */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {isFirstRow
                  ? row.map(renderCard)
                  : chunkCards(row, MOBILE_ROW_CAPACITY).map(
                      (chunk, chunkIndex) => (
                        <Fragment key={chunkIndex}>
                          {chunk.map((card, index) =>
                            renderCard(card, chunkIndex * MOBILE_ROW_CAPACITY + index),
                          )}
                          {/* Below the phone line the open card sits on — and below
                              everything on desktop, via `lg:order-last`. */}
                          {chunk.some((card) => card.id === activeCardId)
                            ? panelNode(true)
                            : null}
                        </Fragment>
                      ),
                    )}
              </div>

              {/* Row 1 keeps its panel under the whole row. */}
              {isFirstRow ? panelNode(false) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
