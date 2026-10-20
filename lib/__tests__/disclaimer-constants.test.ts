import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISCLOSURES_TEXT,
  ensurePlanTelligenceTrademark,
  getFlyerCategoryDisclaimer,
  resolveDefaultDisclosuresText,
  resolveDisclaimerText,
  resolveOrgOnlyDisclaimerText,
} from "../disclaimer-constants";

/**
 * The portal footer's text pipeline.
 *
 * The landing page uses the **organization-only** variant (no company name),
 * while the benefit hubs include the plan's company name. Both share the same
 * template, and both must never leave a `[Company Name]` / `[Organization Name]`
 * placeholder visible to a participant — that is the failure mode these tests
 * exist for.
 *
 * `resolveDisclaimerText` is the other half: `Client.disclaimers` may be plain
 * text, an array of rows, a JSON envelope, or a JSON *string* of either, and
 * coercing it with `String()` used to render "[object Object]" in the footer.
 */

const ORG = "Acme Advisory";
const COMPANY = "Northwind";

const ENTITIES = "are separate and unaffiliated entities.";

describe("resolveDefaultDisclosuresText", () => {
  it("names only the organization on the landing page", () => {
    const text = resolveDefaultDisclosuresText(ORG);

    expect(text).toContain(`PlanTelligence® and ${ORG} ${ENTITIES}`);
    expect(text).not.toContain("[Organization Name]");
    expect(text).not.toContain("and [Company Name]");
  });

  it("includes the company name on a hub page", () => {
    const text = resolveDefaultDisclosuresText(ORG, COMPANY, true);

    expect(text).toContain(
      `PlanTelligence®, ${ORG}, and ${COMPANY} ${ENTITIES}`,
    );
  });

  it("drops back to organization-only when the company name is blank", () => {
    const text = resolveDefaultDisclosuresText(ORG, "   ", true);

    expect(text).toContain(`PlanTelligence® and ${ORG} ${ENTITIES}`);
  });

  it("keeps a visible placeholder when no organization is known", () => {
    const text = resolveDefaultDisclosuresText("");

    expect(text).toContain("[Organization Name]");
  });
});

describe("resolveOrgOnlyDisclaimerText", () => {
  it("rewrites the template's three-entity line into an org-only one", () => {
    const resolved = resolveOrgOnlyDisclaimerText(
      DEFAULT_DISCLOSURES_TEXT,
      ORG,
    );

    expect(resolved).toContain(`PlanTelligence® and ${ORG} ${ENTITIES}`);
    expect(resolved).not.toContain("[Company Name]");
  });

  it("rewrites an already-substituted organization name", () => {
    const stored = DEFAULT_DISCLOSURES_TEXT.replace(
      /\[Organization Name\]/g,
      "Old Org",
    );

    const resolved = resolveOrgOnlyDisclaimerText(stored, ORG);

    expect(resolved).toContain(`PlanTelligence® and ${ORG} ${ENTITIES}`);
    expect(resolved).not.toContain("Old Org");
  });

  it("replaces the organization placeholder in arbitrary advisor text", () => {
    const resolved = resolveOrgOnlyDisclaimerText(
      "Prepared by [Organization Name] for plan participants.",
      ORG,
    );

    expect(resolved).toBe(`Prepared by ${ORG} for plan participants.`);
  });

  it("removes a trailing company-name clause without leaving a dangling comma", () => {
    const resolved = resolveOrgOnlyDisclaimerText(
      "Prepared by [Organization Name], and [Company Name].",
      ORG,
    );

    expect(resolved).toBe(`Prepared by ${ORG}.`);
  });

  it("leaves plain text without placeholders untouched", () => {
    const text = "This is for educational purposes only.";

    expect(resolveOrgOnlyDisclaimerText(text, ORG)).toBe(text);
  });
});

describe("ensurePlanTelligenceTrademark", () => {
  it("adds the mark to an unmarked mention", () => {
    expect(ensurePlanTelligenceTrademark("PlanTelligence is a platform")).toBe(
      "PlanTelligence® is a platform",
    );
  });

  it("does not double-mark text that already carries it", () => {
    expect(
      ensurePlanTelligenceTrademark("PlanTelligence® is a platform"),
    ).toBe("PlanTelligence® is a platform");
  });

  it("marks every occurrence", () => {
    expect(
      ensurePlanTelligenceTrademark("PlanTelligence and PlanTelligence again"),
    ).toBe("PlanTelligence® and PlanTelligence® again");
  });

  it("returns an empty string for empty input", () => {
    expect(ensurePlanTelligenceTrademark("")).toBe("");
  });
});

describe("resolveDisclaimerText", () => {
  it("returns plain text unchanged", () => {
    expect(resolveDisclaimerText("A plain disclaimer")).toBe(
      "A plain disclaimer",
    );
  });

  it("joins an array of rows with a blank line", () => {
    expect(
      resolveDisclaimerText([{ text: "First" }, { text: "Second" }, "Third"]),
    ).toBe("First\n\nSecond\n\nThird");
  });

  it("reads the envelope's row list first", () => {
    expect(
      resolveDisclaimerText({
        disclaimers: [{ text: "Rows win" }],
        disclosuresText: "Saved text",
      }),
    ).toBe("Rows win");
  });

  it("falls back to the envelope's disclosuresText", () => {
    expect(
      resolveDisclaimerText({ disclaimers: [], disclosuresText: "Saved text" }),
    ).toBe("Saved text");
  });

  it("falls back to a legacy text field", () => {
    expect(resolveDisclaimerText({ text: "Legacy" })).toBe("Legacy");
  });

  it("parses a JSON-stringified envelope", () => {
    expect(
      resolveDisclaimerText(
        JSON.stringify({ disclaimers: [{ text: "From JSON" }] }),
      ),
    ).toBe("From JSON");
  });

  it("keeps a broken JSON string as-is", () => {
    expect(resolveDisclaimerText("{not json")).toBe("{not json");
  });

  it("returns an empty string for unusable input", () => {
    expect(resolveDisclaimerText(null)).toBe("");
    expect(resolveDisclaimerText(undefined)).toBe("");
    expect(resolveDisclaimerText({})).toBe("");
    expect(resolveDisclaimerText("   ")).toBe("");
  });
});

describe("getFlyerCategoryDisclaimer", () => {
  it("returns the mapped text for each hub", () => {
    for (const category of [
      "Retirement",
      "Group Health",
      "Group Life",
      "Other",
    ]) {
      expect(getFlyerCategoryDisclaimer(category)).toMatch(
        /educational and informational purposes only/i,
      );
    }
  });

  it("returns null for an unmapped category", () => {
    expect(getFlyerCategoryDisclaimer("Pet Insurance")).toBeNull();
  });
});
