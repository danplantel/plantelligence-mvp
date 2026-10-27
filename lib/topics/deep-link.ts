/**
 * Topic deep links (TF-2, handoff rule: "One URL per answer").
 *
 * A topic's stored slug is namespaced (`sys.rollovers-distributions`) so one unique
 * constraint can cover system and org topics. That namespace must never reach the
 * address bar: the published URL is `.../retirement#rollovers-distributions`, and a
 * plan's own topics read the same way.
 *
 * The option param is only meaningful for an Options-Compare topic
 * (`#rollovers-distributions&option=ira`, written as `?option=ira` in the query).
 */

/** The hash form of a topic slug: the storage namespace removed. */
export function topicHashSlug(slug: string): string {
  return (slug || "").trim().replace(/^sys\./, "");
}

/** `#sys.rollovers-distributions` → `rollovers-distributions`. */
export function readHashTopicSlug(hash: string | null | undefined): string {
  const raw = (hash || "").trim().replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Does this topic answer the hash?
 *
 * Both spellings are accepted so a link written before the namespace was introduced
 * keeps working, and the comparison is case-insensitive because a hand-typed or
 * hand-edited URL should not silently miss.
 */
export function topicMatchesHash(
  topic: { slug: string },
  hash: string | null | undefined,
): boolean {
  const wanted = readHashTopicSlug(hash).toLowerCase();
  if (!wanted) return false;
  return [topic.slug, topicHashSlug(topic.slug)].some(
    (candidate) => candidate.toLowerCase() === wanted,
  );
}

/** `?option=ira` → `ira`. Accepts the raw query, with or without the `?`. */
export function readOptionParam(search: string | null | undefined): string {
  const raw = (search || "").trim();
  if (!raw) return "";
  const query = raw.startsWith("?") ? raw.slice(1) : raw;
  try {
    return (new URLSearchParams(query).get("option") || "").trim();
  } catch {
    return "";
  }
}

/**
 * The URL to put in the address bar for an open answer.
 *
 * Returns a PATH (not an absolute URL) so it can be handed straight to
 * `history.replaceState`. Passing no slug clears both the hash and the option, so
 * collapsing an answer leaves a clean URL behind.
 */
export function buildTopicUrl(
  currentHref: string,
  slug?: string | null,
  optionId?: string | null,
): string {
  const base =
    typeof window !== "undefined" && window.location
      ? window.location.origin
      : "http://localhost";
  const url = new URL(currentHref, base);

  url.hash = slug ? `#${encodeURIComponent(topicHashSlug(slug))}` : "";

  if (optionId) {
    url.searchParams.set("option", optionId);
  } else {
    url.searchParams.delete("option");
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
