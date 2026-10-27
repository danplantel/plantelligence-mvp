/**
 * Where a topic's CTA points.
 *
 * A destination typed by an advisor can be a portal path, an absolute URL, a bare
 * hostname, a hash, or a `mailto:` / `tel:` link. The portal must decide three things
 * for each: whether it stays inside the portal, whether it opens in a new tab, and
 * what href to render. Same rules as the help-card links, kept as one function so a
 * topic CTA and a legacy card CTA can never disagree.
 */

export interface ResolvedTopicHref {
  href: string;
  /** True when the link must open in a new tab. */
  external: boolean;
}

/** `"/retirement"` + `"/acme"` → `"/acme/retirement"`. */
export function resolveTopicHref(
  destination: string | null | undefined,
  basePath = "",
): ResolvedTopicHref {
  const trimmed = (destination || "").trim();
  if (!trimmed) return { href: "", external: false };

  // Internal portal path.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return { href: `${basePath}${trimmed}`, external: false };
  }

  // Absolute URL, protocol-relative URL, hash, mailto:, tel:.
  if (
    trimmed.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return { href: trimmed, external: trimmed.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) };
  }

  // A bare hostname the advisor typed ("voya.com/login").
  return { href: `https://${trimmed}`, external: true };
}
