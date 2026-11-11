import { toExternalUrl } from "@/lib/url-utils";

/**
 * Split plain copy into text and link segments.
 *
 * Topic copy is authored as prose, so a website is written the way a person
 * writes it — "You can see your personal estimate at ssa.gov/myaccount." — and a
 * document link has to be typed. The answer panel used to print that as text; the
 * reader had to copy it into the address bar. This finds the addresses and hands
 * back the pieces, so the renderer can wrap each one in an anchor.
 *
 * What counts as a link:
 *  - an email address (`mailto:`);
 *  - a full URL (`https://…`, `http://…`, `www.…`);
 *  - a bare host with an optional path (`ssa.gov/myaccount`, `irs.gov`), which is
 *    how advisors type it. `toExternalUrl` adds `https://` — the same rule the
 *    plan's login and booking links already use, so a bare host can never resolve
 *    as a path on the portal.
 *
 * Sentence punctuation (`ssa.gov/myaccount.`) is not part of the address. A
 * `{{token}}` is never matched: it has no dot and the patterns exclude braces.
 */
export type TextLinkSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const LINK_PATTERN =
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:https?:\/\/|www\.)[^\s<>"'{}]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'{}]*)?/gi;

/** Closing punctuation that belongs to the sentence, not the address. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}"']+$/;

function hrefFor(value: string): string {
  return value.includes("@") && !/^[a-z]+:\/\//i.test(value)
    ? `mailto:${value}`
    : toExternalUrl(value);
}

export function splitTextLinks(text: string): TextLinkSegment[] {
  if (!text) return [];

  const segments: TextLinkSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const raw = match[0];
    const value = raw.replace(TRAILING_PUNCTUATION, "");
    if (!value) continue;

    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, start) });
    }
    segments.push({ type: "link", value, href: hrefFor(value) });
    cursor = start + value.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments;
}

/** True when the copy holds nothing to link — lets a caller skip the wrapper. */
export function textHasNoLinks(text: string): boolean {
  return !splitTextLinks(text).some((segment) => segment.type === "link");
}
