import { libraryTopicBySlug } from "@/lib/topics/library";
import type {
  ActionHubLink,
  EffectiveTopic,
  TopicBodyBlock,
  TopicCta,
  TopicCtaActionType,
  TopicPlacementOverrides,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

/**
 * Effective topic = Topic merged with its placement's overrides.
 *
 * This is the ONLY place a topic record and a placement record are combined, so the
 * portal, the admin builder and any future surface always agree about what a topic
 * says. Two rules matter:
 *
 *  1. Overrides live on the PLACEMENT. A plan's edit is therefore never written to
 *     the shared Topic, which is what makes "editing plan A cannot change plan B"
 *     true by construction rather than by remembering to filter.
 *  2. Anything arriving from `Json` columns is untrusted. Prisma returns `unknown`
 *     for `bodyBlocks` / `defaultCta` / `overrides`, so each is validated on read and
 *     an unreadable value degrades to "no blocks" instead of throwing at render time.
 */

const CTA_ACTION_TYPES: readonly TopicCtaActionType[] = [
  "external_url",
  "topic_modal",
  "document",
  "contact",
  "action_hub_panel",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Coerce one stored CTA into a `TopicCta`, or `undefined` when it is unusable.
 *
 * A CTA with no label is dropped: a button that cannot say what it does must not
 * render, and an unknown `actionType` would produce a dead control.
 */
export function readTopicCta(value: unknown): TopicCta | undefined {
  if (!isRecord(value)) return undefined;
  const label = asTrimmedString(value.label);
  const actionType = asTrimmedString(value.actionType) as TopicCtaActionType;
  if (!label || !CTA_ACTION_TYPES.includes(actionType)) return undefined;
  const destination = asTrimmedString(value.destination);
  return destination ? { label, actionType, destination } : { label, actionType };
}

/**
 * Coerce stored body blocks into the block list the answer panel renders.
 *
 * Unknown block types and blocks with no content are dropped rather than rendered as
 * empty rows — the handoff's rule is that a block with no data simply does not appear.
 */
export function readTopicBodyBlocks(value: unknown): TopicBodyBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: TopicBodyBlock[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) continue;
    switch (raw.type) {
      case "quick_answer": {
        const text = asTrimmedString(raw.text);
        if (text) blocks.push({ type: "quick_answer", text });
        break;
      }
      case "steps": {
        const steps = Array.isArray(raw.steps)
          ? raw.steps.map(asTrimmedString).filter(Boolean)
          : [];
        if (steps.length > 0) blocks.push({ type: "steps", steps });
        break;
      }
      case "documents": {
        const documentIds = Array.isArray(raw.documentIds)
          ? raw.documentIds.map(asTrimmedString).filter(Boolean)
          : [];
        // An empty `documentIds` means "every document for this plan + category",
        // which is a valid block on its own.
        blocks.push(
          documentIds.length > 0
            ? { type: "documents", documentIds }
            : { type: "documents" },
        );
        break;
      }
      case "video": {
        const videoId = asTrimmedString(raw.videoId);
        if (videoId) blocks.push({ type: "video", videoId });
        break;
      }
      case "contact": {
        const contactId = asTrimmedString(raw.contactId);
        if (contactId) blocks.push({ type: "contact", contactId });
        break;
      }
      case "cta": {
        const cta = readTopicCta(raw.cta);
        if (cta) blocks.push({ type: "cta", cta });
        break;
      }
      default:
        // Unknown block type: ignore it. A newer writer must not break an older reader.
        break;
    }
  }

  return blocks;
}

/**
 * Coerce a placement's stored overrides. An absent or unreadable value is simply "no
 * overrides", never an error.
 *
 * `cta` is the one field where "absent" and "null" differ: absent inherits the topic's
 * default CTA, `null` explicitly removes it for this placement.
 */
export function readTopicOverrides(value: unknown): TopicPlacementOverrides {
  if (!isRecord(value)) return {};
  const overrides: TopicPlacementOverrides = {};

  const title = asTrimmedString(value.title);
  if (title) overrides.title = title;

  const summary = asTrimmedString(value.summary);
  if (summary) overrides.summary = summary;

  if (Array.isArray(value.bodyBlocks)) {
    overrides.bodyBlocks = readTopicBodyBlocks(value.bodyBlocks);
  }

  if (Object.prototype.hasOwnProperty.call(value, "cta")) {
    overrides.cta = value.cta === null ? null : readTopicCta(value.cta);
  }

  return overrides;
}

/** Coerce a placement's stored Action Hub sub-link (TF-5 reads it; nothing else yet). */
export function readActionHubLink(value: unknown): ActionHubLink | undefined {
  if (!isRecord(value)) return undefined;
  const label = asTrimmedString(value.label);
  const url = asTrimmedString(value.url);
  if (!label && !url) return undefined;
  return {
    ...(label ? { label } : {}),
    ...(url ? { url } : {}),
  };
}

/** Tags are a scalar list, so this only has to defend against a non-array. */
function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asTrimmedString).filter(Boolean);
}

/**
 * Merge one topic with one placement into the shape everything renders.
 *
 * The topic supplies the content; the placement supplies where it sits and what this
 * plan changed. `displayMode`, `location`, `groupId` and `sortOrder` always come from
 * the placement — a topic has no opinion about them.
 *
 * SYSTEM topics fall back to the shipped library entry (`lib/topics/library`) when
 * the stored row carries no body blocks. That is what lets a content pass reach a
 * plan seeded before it: seeding never overwrites a row, so a legacy Topic would
 * otherwise render its question with an empty accordion body. A row that DOES store
 * blocks keeps them, and a placement's overrides always win.
 */
export function resolveEffectiveTopic(
  topic: TopicRecord,
  placement: TopicPlacementRecord,
): EffectiveTopic {
  const overrides = readTopicOverrides(placement.overrides);

  const shipped = topic.scope === "system" ? libraryTopicBySlug(topic.slug) : undefined;
  const storedBlocks = readTopicBodyBlocks(topic.bodyBlocks);
  // A system row with no blocks predates the content pass — use the library copy.
  const isLegacyRow = storedBlocks.length === 0;

  const title =
    overrides.title || (isLegacyRow && shipped ? shipped.title : topic.title);
  const summary =
    overrides.summary ||
    asTrimmedString(
      isLegacyRow && shipped?.summary ? shipped.summary : topic.summary,
    );
  const bodyBlocks =
    overrides.bodyBlocks ??
    (isLegacyRow ? readTopicBodyBlocks(shipped?.bodyBlocks) : storedBlocks);

  // `undefined` → inherit the topic default; `null` → deliberately removed.
  const cta =
    overrides.cta === null
      ? undefined
      : overrides.cta ??
        readTopicCta(topic.defaultCta) ??
        readTopicCta(shipped?.cta);

  const iconKey = asTrimmedString(topic.iconKey);
  const imageKey = asTrimmedString(topic.imageKey);
  const actionHubLink = readActionHubLink(placement.actionHubLink);

  return {
    topicId: topic.id,
    placementId: placement.id,
    slug: topic.slug,
    location: placement.location,
    displayMode: placement.displayMode,
    title,
    ...(summary ? { summary } : {}),
    ...(iconKey ? { iconKey } : {}),
    ...(imageKey ? { imageKey } : {}),
    bodyBlocks,
    tags: readTags(topic.tags).length > 0
      ? readTags(topic.tags)
      : readTags(shipped?.tags),
    isActionHub: topic.isActionHub === true,
    ...(cta ? { cta } : {}),
    ...(actionHubLink ? { actionHubLink } : {}),
    groupId: placement.groupId ?? null,
    sortOrder: placement.sortOrder,
  };
}

/**
 * The first `quick_answer` block's text, which is what a card or a collapsed
 * question shows. Returns "" when the topic has no quick answer.
 */
export function topicQuickAnswer(topic: EffectiveTopic): string {
  const block = topic.bodyBlocks.find(
    (candidate): candidate is { type: "quick_answer"; text: string } =>
      candidate.type === "quick_answer",
  );
  return block?.text ?? "";
}
