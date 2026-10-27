/**
 * Benefits Topic Framework — shared types (TF-1).
 *
 * These are the shapes the library, the placement resolver and the portal all speak.
 * They mirror the Prisma models but are deliberately hand-written: the participant
 * components and the admin builder must not import generated Prisma types, so the
 * render layer keeps compiling if the storage layer changes.
 *
 * The three objects, exactly as the handoff describes them:
 *
 *   Topic          the content, written once and shared across plans
 *   TopicPlacement one topic on ONE plan in ONE location, with its display mode,
 *                  order and per-plan overrides
 *   AccordionGroup a named Quick Answers group for one plan + location
 *
 * `[Benefit Category]`, `[Company Name]` and `[Advisor Name]` stay merge tokens in
 * topic copy; they are filled at render time by the same helpers the help cards use
 * (see `lib/help-card-defaults.ts`).
 */

/** Who authored a topic: shipped by us (`system`) or by the advisor's org (`org`). */
export type TopicScope = "system" | "org";

export type TopicStatus = "active" | "archived";

/**
 * How a placement renders.
 *
 * `quick_answers` is the handoff's "accordion" mode — the topic is listed under
 * Quick Answers instead of rendering as a Featured card. `hidden` keeps the
 * placement (and its order) without showing it to participants.
 */
export type TopicDisplayMode = "featured" | "quick_answers" | "hidden";

/**
 * A hub a topic can render on.
 *
 * `employee_resources` is reserved for TF-6. Nothing seeds or renders it yet, but
 * reserving the value now means adding that hub needs no schema migration.
 */
export type TopicLocation =
  | "retirement"
  | "group_health"
  | "group_life"
  | "custom"
  | "employee_resources";

/** What a conversion CTA does when clicked (Section 11 of the handoff). */
export type TopicCtaActionType =
  | "external_url"
  | "topic_modal"
  | "document"
  | "contact"
  | "action_hub_panel";

export interface TopicCta {
  label: string;
  actionType: TopicCtaActionType;
  /** URL, document id, contact id — meaning depends on `actionType`. */
  destination?: string;
}

/**
 * One block in an answer panel (Section 5). `quick_answer` is the only required
 * block; a block with no data is simply absent, so nothing renders empty.
 */
export type TopicBodyBlock =
  | { type: "quick_answer"; text: string }
  | { type: "steps"; steps: string[] }
  | { type: "documents"; documentIds?: string[] }
  | { type: "video"; videoId?: string }
  | { type: "contact"; contactId?: string }
  | { type: "cta"; cta: TopicCta };

/**
 * A per-plan override of a topic's copy or CTA. Written to the PLACEMENT, never to
 * the Topic, which is what keeps one plan's edit from reaching another plan.
 */
export interface TopicPlacementOverrides {
  title?: string;
  summary?: string;
  bodyBlocks?: TopicBodyBlock[];
  /** `null` explicitly removes the CTA for this placement. */
  cta?: TopicCta | null;
}

/** This location's row inside a cross-category Action Hub panel (TF-5). */
export interface ActionHubLink {
  label?: string;
  url?: string;
}

/** Where a row's destination came from, in the handoff's priority order. */
export type ActionHubLinkSource = "placement" | "provider" | "contact";

/**
 * One actionable row in an Action Hub panel (TF-5, §6).
 *
 * The row is NOT a link into another page of this portal — it is a launcher. "Update
 * my beneficiaries" lists every benefit that holds beneficiaries (Retirement, Group
 * Life) and each row sends the participant to that provider's own beneficiary tools.
 * That is why the destination is resolved from the placement's sub-link first, then
 * from the category's provider, and only then from a contact.
 */
export interface ActionHubRow {
  location: TopicLocation;
  /** The hub this row belongs to: "Retirement", "Group Life", … */
  label: string;
  /** Ready to use: absolute URL, `mailto:`, `tel:`, or an in-portal path. */
  href: string;
  /** True when the link leaves the portal (open in a new tab). */
  external: boolean;
  source: ActionHubLinkSource;
}

/**
 * What an Action Hub renders.
 *
 * `direct` is the single-row shortcut: one qualifying row means there is nothing to
 * choose between, so the CTA links straight at it and no panel is drawn.
 */
export type ActionHubPanel =
  | { mode: "none" }
  | { mode: "direct"; row: ActionHubRow }
  | { mode: "panel"; rows: ActionHubRow[] };

/** A topic row as stored. `bodyBlocks`/`defaultCta` are JSON, so they are validated on read. */
export interface TopicRecord {
  id: string;
  scope: TopicScope;
  organizationId?: string | null;
  slug: string;
  title: string;
  summary?: string | null;
  iconKey?: string | null;
  imageKey?: string | null;
  bodyBlocks?: unknown;
  tags?: string[];
  defaultLocations?: TopicLocation[];
  isActionHub?: boolean;
  defaultCta?: unknown;
  status?: TopicStatus;
}

/** A placement row as stored. */
export interface TopicPlacementRecord {
  id: string;
  clientId: string;
  topicId: string;
  location: TopicLocation;
  displayMode: TopicDisplayMode;
  groupId?: string | null;
  sortOrder: number;
  overrides?: unknown;
  actionHubLink?: unknown;
}

export interface AccordionGroupRecord {
  id: string;
  clientId: string;
  location: TopicLocation;
  name: string;
  sortOrder: number;
}

/**
 * A topic after its placement has been merged in — the only shape the portal and
 * the admin builder should render from.
 */
export interface EffectiveTopic {
  topicId: string;
  placementId: string;
  slug: string;
  location: TopicLocation;
  displayMode: TopicDisplayMode;
  title: string;
  summary?: string;
  iconKey?: string;
  imageKey?: string;
  bodyBlocks: TopicBodyBlock[];
  tags: string[];
  isActionHub: boolean;
  cta?: TopicCta;
  /**
   * This location's Action Hub sub-link (TF-5), when the advisor set one. It is the
   * FIRST source in the row's priority order; provider and contact links are resolved
   * at read time because they live on the category, not the placement.
   */
  actionHubLink?: ActionHubLink;
  /** Set only for a `quick_answers` placement. */
  groupId?: string | null;
  sortOrder: number;
}

/** One named Quick Answers group, with its questions already ordered. */
export interface TopicGroup {
  id: string;
  name: string;
  sortOrder: number;
  topics: EffectiveTopic[];
}

/**
 * Everything one location resolves to.
 *
 * `featured` is in card order; `groups` are in group order with their questions in
 * placement order. A location with nothing visible resolves to two empty arrays —
 * the section then renders nothing at all rather than an empty header.
 */
export interface ResolvedLocationTopics {
  location: TopicLocation;
  featured: EffectiveTopic[];
  groups: TopicGroup[];
  /** Placements deliberately hidden — never rendered, but useful to the builder. */
  hiddenCount: number;
}

/**
 * The `topics` block `GET /api/clients/[id]/benefits/[category]` returns (TF-2), with
 * the Action Hub panels attached (TF-5).
 *
 * `source` is what a hub page checks before rendering placements: a plan that is
 * seeded but not rolled out still answers `legacy` and keeps today's page.
 * `actionHubPanels` is keyed by the topic's PUBLISHED slug, which is what a rendered
 * card carries — the ids never reach the address bar or the DOM.
 */
export interface TopicsPayload extends ResolvedLocationTopics {
  source: "placements" | "legacy";
  actionHubPanels: Record<string, ActionHubRow[]>;
}
