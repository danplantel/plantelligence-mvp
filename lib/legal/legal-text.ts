import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  PLATFORM_LEGAL_ENTITY,
  PLATFORM_SUPPORT_EMAIL,
  type LegalPlaceholderContext,
} from "@/lib/legal/legal-config";

/**
 * Editorial notes in the source Markdown are bracketed instructions to the
 * drafting team ("[CONFIRM: …]", "[INSERT …]", "[DESCRIBE …]"). They must never
 * reach a participant, so they are removed before the document is rendered.
 */
const EDITORIAL_NOTE_SOURCE =
  "\\[(?:CONFIRM|INSERT|IDENTIFY|GOVERNING|ANY ADDITIONAL)[^\\]]*?\\]";

/**
 * Remove drafting notes from the policy text.
 *
 * A note in the middle of a sentence leaves the sentence intact; a line whose
 * only content was a label plus a note (for example the "Sale or sharing…"
 * heading) is dropped entirely so no heading renders without a body.
 */
export function stripEditorialNotes(markdown: string): string {
  const testPattern = new RegExp(EDITORIAL_NOTE_SOURCE, "i");
  const replacePattern = new RegExp(EDITORIAL_NOTE_SOURCE, "gi");

  const kept: string[] = [];
  for (const line of markdown.split("\n")) {
    const hadNote = testPattern.test(line);
    if (!hadNote) {
      kept.push(line);
      continue;
    }

    let next = line
      .replace(replacePattern, "")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/,\s*\./g, ".")
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+$/, "");

    const trimmed = next.trim();
    // Ignore emphasis markers when deciding whether the line was only a label.
    const skeleton = trimmed.replace(/^[*_`>\s-]+|[*_`\s-]+$/g, "");
    if (!trimmed || skeleton.endsWith(":")) continue;

    kept.push(next);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Substitute the `[PLACEHOLDER]` fields that remain after the editorial notes
 * have been removed. Dynamic values (the Publishing Organization) come from the
 * caller; product-wide values come from `legal-config`.
 */
export function resolveLegalPlaceholders(
  markdown: string,
  context: LegalPlaceholderContext = {},
): string {
  const organizationName = context.organizationName?.trim() || "your employer";
  const organizationContact =
    context.organizationContact?.trim() ||
    "Contact your employer's benefits administrator.";
  const effectiveDate = context.effectiveDate || LEGAL_EFFECTIVE_DATE;
  const lastUpdated = context.lastUpdated || LEGAL_LAST_UPDATED;

  // The documents use `[DATE]` twice, in order: effective date, then last
  // updated. A callback keeps that order without positional assumptions about
  // the surrounding text.
  let dateIndex = 0;
  let text = markdown.replace(/\[DATE\]/g, () =>
    dateIndex++ === 0 ? effectiveDate : lastUpdated,
  );

  const replacements: Array<[from: string, to: string]> = [
    [
      '[PERIOD OR CRITERIA, or "not stored after your session"]',
      "Not stored after your session.",
    ],
    [
      "[PERIOD OR CRITERIA]",
      "Retained only as long as necessary for the purpose described in this Policy or as required by applicable law.",
    ],
    // The Platform drafts use the shorthand form, without spaces.
    [
      "[PERIOD/CRITERIA]",
      "Retained only as long as necessary for the purpose described in this Policy or as required by applicable law.",
    ],
    [
      "[LINK TO STATE PRIVACY ADDENDUM]",
      "the applicable state privacy disclosures",
    ],
    [
      "[STATE PRIVACY ADDENDUM OR RIGHTS LINK]",
      "the applicable state privacy disclosures",
    ],
    [
      "[DESCRIBE VERIFIED ADMINISTRATIVE, TECHNICAL, AND ORGANIZATIONAL SECURITY PRACTICES]",
      "administrative, technical, and organizational security practices",
    ],
    [
      "[DESCRIBE VERIFIED SECURITY MEASURES]",
      "administrative, technical, and organizational security measures",
    ],
    ["[PLANtelligence LEGAL ENTITY]", PLATFORM_LEGAL_ENTITY],
    ["[LEGAL ENTITY NAME]", PLATFORM_LEGAL_ENTITY],
    ["[SUPPORT EMAIL]", PLATFORM_SUPPORT_EMAIL],
    ["[SECURITY/PRIVACY CONTACT]", PLATFORM_SUPPORT_EMAIL],
    ["[PRIVACY CONTACT]", PLATFORM_SUPPORT_EMAIL],
    ["[PRIVACY EMAIL OR REQUEST LINK]", PLATFORM_SUPPORT_EMAIL],
    ["[PRIVACY EMAIL]", PLATFORM_SUPPORT_EMAIL],
    ["[LEGAL CONTACT EMAIL]", PLATFORM_SUPPORT_EMAIL],
    ["[EMAIL]", PLATFORM_SUPPORT_EMAIL],
    ["[COOKIE NOTICE OR SETTINGS LINK]", "the Cookie Notice available through the Platform"],
    ["[PAYMENT PROCESSOR]", "a third-party payment processor"],
    ["[IMAGE LICENSE TERMS]", "the applicable image license terms"],
    ["[PUBLISHING ORGANIZATION NAME]", organizationName],
    ["[ORGANIZATION NAME]", organizationName],
    ["[CONTACT INFORMATION]", organizationContact],
  ];

  // The operator's postal address is not configured per deployment yet. Drop the
  // whole placeholder line rather than leave an empty line inside the contact
  // block (the surrounding lines carry hard breaks).
  text = text.replace(/^\[BUSINESS ADDRESS\][ \t]*\n?/gm, "");

  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }

  return text.replace(/\n{3,}/g, "\n\n");
}

/** Strip drafting notes, then resolve every participant-facing placeholder. */
export function prepareLegalMarkdown(
  markdown: string,
  context: LegalPlaceholderContext = {},
): string {
  return resolveLegalPlaceholders(stripEditorialNotes(markdown), context);
}
