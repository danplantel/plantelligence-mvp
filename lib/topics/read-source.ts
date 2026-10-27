/**
 * Which source does a plan's participant page read?
 *
 * The topic framework is additive: `Benefit.helpCards` and `Benefit.faqs` still hold
 * every live plan's content. Until a plan has been seeded (or backfilled) and compared
 * against what it renders today, it must keep reading those JSON columns — a pilot hub
 * going blank is not an acceptable failure mode for a refactor.
 *
 * Two environment switches decide it, and the allowlist wins:
 *
 *   TOPIC_FRAMEWORK_PLANS=planA,planB   — these plans read placements, nobody else does
 *   TOPIC_FRAMEWORK_ENABLED=1           — any plan WITH placements reads them
 *
 * An allowlist is EXCLUSIVE on purpose: while it is set, a plan that is not on it keeps
 * reading legacy JSON even if it has placements. That makes a staged rollout legible —
 * "the list is the rollout" — instead of silently expanding as plans get seeded.
 *
 * Server-only: it reads `process.env`. The participant pages get the answer from the
 * API rather than calling this in a browser bundle.
 */

export type TopicReadSource = "placements" | "legacy";

export const TOPIC_FRAMEWORK_PLANS_ENV = "TOPIC_FRAMEWORK_PLANS";
export const TOPIC_FRAMEWORK_ENABLED_ENV = "TOPIC_FRAMEWORK_ENABLED";

/** `" a, b ,,c "` → `["a","b","c"]`. */
export function parsePlanAllowlist(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isEnabledFlag(value: string | null | undefined): boolean {
  const flag = (value || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}

export interface TopicReadSourceInput {
  clientId?: string | null;
  /** True when the plan has at least one placement row. */
  hasPlacements: boolean;
  /** `TOPIC_FRAMEWORK_PLANS`, injected so this stays pure. */
  plans?: string | null;
  /** `TOPIC_FRAMEWORK_ENABLED`, injected so this stays pure. */
  enabled?: string | null;
}

/**
 * Decide the read path for one plan.
 *
 * A plan with no placements always reads legacy — rendering an empty placements list
 * would hide a hub that is live today.
 */
export function resolveTopicReadSource({
  clientId,
  hasPlacements,
  plans,
  enabled,
}: TopicReadSourceInput): TopicReadSource {
  const id = (clientId || "").trim();
  if (!id || !hasPlacements) return "legacy";

  const allowlist = parsePlanAllowlist(plans);
  if (allowlist.length > 0) {
    return allowlist.includes(id) ? "placements" : "legacy";
  }

  return isEnabledFlag(enabled) ? "placements" : "legacy";
}

/** The server-side convenience wrapper: reads the two env vars at call time. */
export function topicReadSourceForPlan(
  clientId: string | null | undefined,
  hasPlacements: boolean,
): TopicReadSource {
  return resolveTopicReadSource({
    clientId,
    hasPlacements,
    plans: process.env[TOPIC_FRAMEWORK_PLANS_ENV],
    enabled: process.env[TOPIC_FRAMEWORK_ENABLED_ENV],
  });
}
