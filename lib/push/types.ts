/**
 * Push types shared by the BROWSER helpers and the SERVER sender.
 *
 * Deliberately free of DOM and Prisma imports. `lib/pwa/push.ts` (client bundle) and
 * `lib/push/push.server.ts` (Node runtime) both import from here, and a runtime import in either
 * direction would drag the wrong world across the boundary — a server module reaching into the
 * client bundle breaks the build, and a client module reaching into Prisma leaks credentials-shaped
 * code into the browser. Types and tiny guards only.
 */

/**
 * Which product surface the reader opted in from.
 *
 * This is AUDIENCE metadata, not a channel. Both surfaces share one origin and one service worker, so
 * a browser holds exactly one subscription no matter which surface it opted in from — see
 * `plans/web-push-notifications.md`.
 */
export type PushSurface = "portal" | "dashboard";

/** The values accepted by the subscribe endpoint. */
export const PUSH_SURFACES: readonly PushSurface[] = ["portal", "dashboard"];

export function isPushSurface(value: unknown): value is PushSurface {
  return value === "portal" || value === "dashboard";
}

/**
 * The unit a reader can switch off independently.
 *
 * Coarser than a notification `type` on purpose: the header bell distinguishes four kinds of comment
 * event (`comment_thread_created`, `comment_reply`, `comment_mention`, `comment_task_assigned`), but
 * nobody wants four separate switches in Settings for what they think of as "comments". The mapping
 * lives in `pushCategoryForType` so the two views can never drift apart.
 */
export type PushCategory = "direct_message" | "comment" | "task";

export const PUSH_CATEGORIES: readonly PushCategory[] = [
  "direct_message",
  "comment",
  "task",
];

export function isPushCategory(value: unknown): value is PushCategory {
  return (
    value === "direct_message" || value === "comment" || value === "task"
  );
}

/** Stored opt-outs. A missing key means ENABLED — that is what every pre-existing row means. */
export type PushPreferences = Partial<Record<PushCategory, boolean>>;

/**
 * Map a persisted notification `type` to the switch that governs it.
 *
 * Returns null for a type no switch covers, and null is treated as "send": a preference must never
 * silence a notification we never offered a control for.
 */
export function pushCategoryForType(
  type: string | null | undefined,
): PushCategory | null {
  if (!type) return null;
  if (type === "direct_message") return "direct_message";
  if (type === "comment_task_assigned") return "task";
  if (type.startsWith("comment_")) return "comment";
  return null;
}

/** False only when the reader explicitly turned this category off. */
export function isCategoryEnabled(
  preferences: PushPreferences | null | undefined,
  category: PushCategory | null,
): boolean {
  // An unmapped type has no control, so it cannot have been switched off.
  if (!category) return true;
  if (!preferences) return true;
  return preferences[category] !== false;
}

/**
 * What the service worker receives.
 *
 * `url` is a same-origin path; the worker refuses anything else, because a notification tap is a
 * navigation the reader never typed.
 */
export interface PushPayload {
  title: string;
  body?: string | null;
  /** Same-origin path to open on tap. */
  url?: string | null;
  /** Collapse key: a newer notification with the same tag REPLACES the older one. */
  tag?: string | null;
  /** Tray-level collapse topic, so a burst does not stack. */
  topic?: string | null;
  /** Per-plan icon override. */
  icon?: string | null;
  /** The notification `type`, echoed back for debugging. */
  type?: string | null;
  /** The notification row id, echoed back for debugging. */
  id?: string | null;
}
