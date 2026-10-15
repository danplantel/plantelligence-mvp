/**
 * Validates if a string is a valid domain or website URL (accepts various formats)
 * Accepts: example.com, www.example.com, https://example.com, https://www.example.com,
 *          example.com/path, https://example.com/path?query=1#hash, example.com:8080
 */
export function isValidDomain(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const trimmedUrl = url.trim();

  // Reject strings containing whitespace
  if (/\s/.test(trimmedUrl)) {
    return false;
  }

  // Prepends a protocol when missing so `new URL` can parse bare domains too
  try {
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    const parsed = new URL(candidate);

    // Hostname must contain a dot and have a valid domain suffix
    const hostname = parsed.hostname;
    return hostname.includes('.') && hostname.length > 1;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a clean domain name without www. or https://
 * Accepts domains and subdomains with optional paths, e.g.:
 * example.com, subdomain.example.com, example.com/path
 */
export function isValidCleanDomain(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const trimmedUrl = url.trim();

  // Must not start with www. or https:// or http://
  if (trimmedUrl.startsWith('www.') ||
      trimmedUrl.startsWith('https://') ||
      trimmedUrl.startsWith('http://')) {
    return false;
  }

  if (/\s/.test(trimmedUrl)) {
    return false;
  }

  try {
    const parsed = new URL(`https://${trimmedUrl}`);
    const hostname = parsed.hostname;
    return hostname.includes('.') && hostname.length > 1;
  } catch {
    return false;
  }
}

/**
 * Normalizes a stored domain by removing the PROTOCOL, and only the protocol.
 *
 * ## Why `www.` is kept
 *
 * It used to be stripped too, as housekeeping — and that was wrong twice over.
 *
 *  - **It is not noise.** `www.example.com` is the address the advisor types and the address their
 *    visitors recognise. The consumers that need a scheme already prepend one themselves
 *    (`https://${website}` in typography-section.tsx), and a hostname is exactly what they want to
 *    be handed — `https://www.example.com` builds a perfectly good link from it.
 *  - **This runs on every KEYSTROKE.** `saveStepData` normalizes as the wizard stores each change
 *    and the input is seeded back from the store, so the strip did not tidy a finished value: it
 *    deleted each character the moment it was typed. "www." could not be entered at all.
 *
 * If a caller ever needs the bare registrable domain (for a certificate, a favicon lookup or a
 * comparison), that is a different question and deserves its own function — not a rewrite of what
 * the advisor typed.
 */
export function normalizeCleanDomain(url: string): string {
  if (!url || url.trim() === '') {
    return '';
  }

  let normalizedUrl = url.trim();

  // The protocol goes because every link builder in the app adds it back itself. Anything else in
  // the string is the advisor's, and stays as they wrote it.
  if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
  }

  return normalizedUrl;
}

/**
 * Ensures a stored /contact CTA link carries the contact's CURRENT headshot.
 * Old saved links (created before avatar support) have no `avatar` param, so
 * inject it at click time from the live contact data. The headshot must be a
 * short R2 key or http(s) URL — base64 data URLs are never put in query params.
 * Non-/contact URLs (schedule/call/email) are returned unchanged.
 */
export function withContactFormAvatar(
  url: string,
  headshot?: string | null,
): string {
  if (!url || !headshot) return url;
  if (headshot.startsWith("data:")) return url;
  try {
    const u = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "https://plantel.pro",
    );
    if (u.pathname !== "/contact") return url;
    if (u.searchParams.has("avatar")) return url;
    u.searchParams.set("avatar", headshot);
    return u.toString();
  } catch {
    return url;
  }
}
