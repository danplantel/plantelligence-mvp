/**
 * "Topic of Interest" configuration for the PlanTelligence-branded `/contact`
 * form.
 *
 * Each benefits category ships with a small set of *suggested* topics. An
 * advisor/admin can activate/deactivate suggestions, add custom topics, delete
 * topics, and reorder them. Only the active topics are shown to the participant
 * on the `/contact` page.
 *
 * The configuration is stored per contact (see `KeyContact.contactFormTopics`)
 * and is carried to the public `/contact` page as a compact, ordered list of
 * labels — the public page has no session, so the URL is the transport.
 */

/** A single selectable topic on the participant-facing contact form. */
export interface ContactFormTopic {
  /** Stable identifier (used for React keys / drag handles). */
  id: string;
  /** Participant-facing label. */
  label: string;
  /** When false the topic is hidden from participants (kept for later reuse). */
  enabled: boolean;
}

/** Benefits categories that own a topic list. */
export type ContactTopicCategory =
  | "Retirement"
  | "Group Health"
  | "Group Life"
  | "Other Benefits"
  | "Company / Plan Sponsor";

/** Label that always opens a free-text "tell us more" box for participants. */
export const OTHER_TOPIC_LABEL = "Other";

/**
 * Placeholder topic for the plan's *custom* benefit.
 *
 * That benefit is the benefits wizard's "Custom" category, stored on the plan as a
 * `Benefit` row with category "Company / Plan Sponsor" and whatever title the
 * advisor gave it. The stored topic label stays this text — so the list is
 * readable everywhere and a plan without a custom benefit still reads correctly —
 * and `resolveContactTopicLabel` swaps in the benefit's real title wherever a
 * person actually reads it (the participant form, the builder, the CTA link).
 */
export const CUSTOM_BENEFIT_TOPIC_LABEL = "Custom Benefits";

/**
 * Maps the many category names used across older contact records onto the four
 * topic keys. Portal/preview code historically stored the *display* category
 * ("Health Insurance", "Life Insurance", "Other"), so without this the topic
 * suggestions would silently come back empty for those contacts.
 */
const CONTACT_TOPIC_CATEGORY_ALIASES: Record<string, ContactTopicCategory> = {
  retirement: "Retirement",
  "group health": "Group Health",
  "health insurance": "Group Health",
  medical: "Group Health",
  "group life": "Group Life",
  "life insurance": "Group Life",
  "other benefits": "Other Benefits",
  other: "Other Benefits",
  // Legacy contacts stored the custom-benefit category as "Custom"; they keep the
  // free-form list rather than inheriting the plan-sponsor one.
  custom: "Other Benefits",
  "company / plan sponsor": "Company / Plan Sponsor",
  "company/plan sponsor": "Company / Plan Sponsor",
  "plan sponsor": "Company / Plan Sponsor",
};

/**
 * Resolve any category label to a topic category key, or `null` when the
 * category has no topic list (e.g. Company / Plan Sponsor, External HR).
 */
export function normalizeContactTopicCategory(
  value?: string | null,
): ContactTopicCategory | null {
  const key = (value || "").trim().toLowerCase();
  if (!key) return null;
  return CONTACT_TOPIC_CATEGORY_ALIASES[key] ?? null;
}

/**
 * Suggested defaults per benefits category. These are *suggestions* — the
 * advisor decides which ones stay active. Loans and hardship withdrawals are
 * intentionally excluded from the Retirement list.
 */
export const DEFAULT_CONTACT_FORM_TOPICS: Record<
  ContactTopicCategory,
  string[]
> = {
  Retirement: [
    "How to enroll in the retirement plan",
    "Consolidate / roll over a previous employer retirement plan",
    "Review my investment elections",
    "Personalized financial planning",
    "Review or update my beneficiary",
    OTHER_TOPIC_LABEL,
  ],
  "Group Health": [
    "Understanding my medical benefits",
    "Finding an in-network doctor or provider",
    "Questions about deductibles, copays, or coinsurance",
    "Prescription coverage",
    "Adding or removing a dependent",
    "HSA / FSA questions",
    "Dental or vision benefits",
    "Life event / qualifying event questions",
    "Help with a claim or billing issue",
    OTHER_TOPIC_LABEL,
  ],
  "Group Life": [
    "Understanding my life insurance coverage",
    "Review or update my beneficiary",
    "Voluntary life insurance options",
    "Spouse or dependent coverage",
    "AD&D coverage",
    "Disability benefits",
    "Portability or conversion options",
    "Evidence of insurability",
    "Filing a claim",
    OTHER_TOPIC_LABEL,
  ],
  // Custom / "Other Benefits" categories start empty apart from "Other" — the
  // advisor builds the list for whatever the custom benefit is.
  "Other Benefits": [OTHER_TOPIC_LABEL],
  // Company / Plan Sponsor. This contact speaks for the whole plan rather than
  // for one benefit, so its topics are the plan's benefits by name — including
  // the plan's *custom* benefit, which shows its own title (see
  // `CUSTOM_BENEFIT_TOPIC_LABEL`) — followed by the plan-wide requests.
  "Company / Plan Sponsor": [
    "Retirement Plan",
    "Group Health",
    "Group Life",
    CUSTOM_BENEFIT_TOPIC_LABEL,
    "Open Enrollment",
    "Employee Communications / Education",
    "Plan Documents / Resources",
    "Meetings / Events",
    "Plan Changes / Updates",
    "General Benefits Support",
    OTHER_TOPIC_LABEL,
  ],
};

/** Max number of topics allowed per contact (guards the URL payload size). */
export const MAX_CONTACT_FORM_TOPICS = 40;
/** Max label length. */
export const MAX_CONTACT_TOPIC_LABEL_LENGTH = 120;
/** Delimiter used when the topic list is carried in the /contact query string. */
const TOPICS_DELIMITER = "|";

/** Build a stable-ish id from a label (falls back to a random suffix). */
function topicIdFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `topic-${slug || Math.random().toString(36).slice(2, 8)}`;
}

/** Create a new (active) topic from a label. */
export function createContactFormTopic(label: string): ContactFormTopic {
  const clean = label.trim().slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
  return { id: topicIdFromLabel(clean), label: clean, enabled: true };
}

/**
 * Coerce a persisted value (possibly missing/legacy/corrupt) into a clean topic
 * list. Accepts an array of `{ id?, label, enabled? }` objects or plain strings.
 */
export function normalizeContactFormTopics(value: unknown): ContactFormTopic[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ContactFormTopic[] = [];
  for (const raw of value) {
    const label = (
      typeof raw === "string"
        ? raw
        : ((raw as ContactFormTopic)?.label ?? "")
    )
      .toString()
      .trim()
      .slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const explicitId =
      typeof raw === "object" && raw !== null
        ? ((raw as ContactFormTopic).id || "").toString().trim()
        : "";
    const enabled =
      typeof raw === "object" && raw !== null
        ? (raw as ContactFormTopic).enabled !== false
        : true;
    out.push({
      id: explicitId || topicIdFromLabel(label),
      label,
      enabled,
    });
    if (out.length >= MAX_CONTACT_FORM_TOPICS) break;
  }
  return out;
}

/** The suggested topic list for a benefits category (all active). */
export function getDefaultContactFormTopics(
  category?: string | null,
): ContactFormTopic[] {
  const key = normalizeContactTopicCategory(category);
  if (!key) return [];
  const labels = DEFAULT_CONTACT_FORM_TOPICS[key];
  if (!labels) return [];
  return labels.map((label) => ({ ...createContactFormTopic(label), enabled: true }));
}

/**
 * Resolve the effective topic list for a contact: a saved configuration always
 * wins (an explicitly empty array means "no topics"), otherwise the category's
 * suggested defaults are used.
 */
export function resolveContactFormTopics(
  category: string | null | undefined,
  saved?: unknown,
): ContactFormTopic[] {
  if (Array.isArray(saved)) {
    const list = normalizeContactFormTopics(saved);
    // For a Company / Plan Sponsor contact an empty list means "never
    // configured", not "no topics": this category had no suggestions until now, so
    // every such contact carries the empty array the builder seeded by default.
    // Seeding the new defaults is what makes them appear on contacts that already
    // exist; a list the advisor actually built is returned untouched.
    if (
      list.length === 0 &&
      normalizeContactTopicCategory(category) === "Company / Plan Sponsor"
    ) {
      return getDefaultContactFormTopics(category);
    }
    return list;
  }
  return getDefaultContactFormTopics(category);
}

/** True when the contact's topic list should render on the participant form. */
export function hasContactFormTopics(topics: ContactFormTopic[]): boolean {
  return topics.some((t) => t.enabled && !!t.label.trim());
}

/** Plan facts a topic label may depend on. */
export interface ContactTopicContext {
  /**
   * Title of the plan's custom benefit — the `Benefit` row with category
   * "Company / Plan Sponsor". Absent for a plan that has no custom benefit yet.
   */
  customBenefitTitle?: string | null;
}

/**
 * Replace the custom-benefit placeholder with that benefit's real title, so the
 * participant reads the plan's own wording ("Wellness Programs") instead of the
 * generic "Custom Benefits". Any other label passes through untouched.
 */
export function resolveContactTopicLabel(
  label: string,
  context?: ContactTopicContext,
): string {
  const title = (context?.customBenefitTitle || "").trim();
  if (!title) return label;
  if (label.trim().toLowerCase() !== CUSTOM_BENEFIT_TOPIC_LABEL.toLowerCase()) {
    return label;
  }
  return title;
}

/** `resolveContactTopicLabel` applied across a list of labels. */
export function resolveContactTopicLabels(
  labels: string[],
  context?: ContactTopicContext,
): string[] {
  return labels.map((label) => resolveContactTopicLabel(label, context));
}

/** Active (enabled) labels in the advisor-defined order. */
export function getActiveContactFormTopicLabels(
  topics: ContactFormTopic[],
  context?: ContactTopicContext,
): string[] {
  return topics
    .filter((t) => t.enabled && !!t.label.trim())
    .map((t) => resolveContactTopicLabel(t.label.trim(), context));
}

/** Serialize labels for the `/contact` query string. */
export function encodeContactFormTopics(labels: string[]): string {
  const clean: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const trimmed = (label || "").trim().slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
    if (clean.length >= MAX_CONTACT_FORM_TOPICS) break;
  }
  return clean.join(TOPICS_DELIMITER);
}

/**
 * Parse the `topics` query param into an ordered label list. Returns `null`
 * when the param is absent (so callers can distinguish "not configured" from
 * "configured with zero topics").
 */
export function decodeContactFormTopics(
  raw: string | null | undefined,
): string[] | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(TOPICS_DELIMITER)) {
    const label = part.trim().slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length >= MAX_CONTACT_FORM_TOPICS) break;
  }
  return labels;
}

/** Add a topic to a list (no-op when a case-insensitive duplicate exists). */
export function addContactFormTopic(
  topics: ContactFormTopic[],
  label: string,
): ContactFormTopic[] {
  const clean = label.trim().slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
  if (!clean) return topics;
  if (topics.some((t) => t.label.toLowerCase() === clean.toLowerCase())) {
    return topics;
  }
  if (topics.length >= MAX_CONTACT_FORM_TOPICS) return topics;
  return [...topics, createContactFormTopic(clean)];
}

/** Remove a topic by id. */
export function removeContactFormTopic(
  topics: ContactFormTopic[],
  id: string,
): ContactFormTopic[] {
  return topics.filter((t) => t.id !== id);
}

/** Toggle a topic's enabled flag by id. */
export function toggleContactFormTopic(
  topics: ContactFormTopic[],
  id: string,
  enabled?: boolean,
): ContactFormTopic[] {
  return topics.map((t) =>
    t.id === id ? { ...t, enabled: enabled ?? !t.enabled } : t,
  );
}

/** Move a topic from one index to another (drag / arrow reordering). */
export function reorderContactFormTopics(
  topics: ContactFormTopic[],
  fromIndex: number,
  toIndex: number,
): ContactFormTopic[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= topics.length ||
    toIndex >= topics.length
  ) {
    return topics;
  }
  const next = [...topics];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** Rename a topic's label (keeps its id so ordering/selection is preserved). */
export function renameContactFormTopic(
  topics: ContactFormTopic[],
  id: string,
  label: string,
): ContactFormTopic[] {
  const clean = label.slice(0, MAX_CONTACT_TOPIC_LABEL_LENGTH);
  return topics.map((t) => (t.id === id ? { ...t, label: clean } : t));
}

/**
 * The canonical topic set for a contact, preferring a saved configuration and
 * otherwise seeding the category defaults. Also guarantees "Other" is present
 * (last) unless the advisor explicitly removed it.
 */
export function ensureOtherTopic(topics: ContactFormTopic[]): ContactFormTopic[] {
  if (topics.some((t) => t.label.toLowerCase() === OTHER_TOPIC_LABEL.toLowerCase())) {
    return topics;
  }
  return [...topics, createContactFormTopic(OTHER_TOPIC_LABEL)];
}
