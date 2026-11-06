import { describe, expect, it } from "vitest";

import {
  findLandingDisclosure,
  landingDisclosureSeed,
  parseDisclaimersEnvelope,
  readLandingDisclosureText,
  withFooterBackground,
  withLandingDisclosureText,
} from "@/lib/portal-disclosures";

/**
 * The footer disclosure of the four NON-hub portal pages (Landing, My Benefits
 * Team, News & Events, Employee Resources) is one stored row. These tests pin the
 * rule the portal layout uses to pick it, and the two writes the Edit Panel makes,
 * because a mismatch either edits an invisible row or rewrites a benefit's own
 * disclosure.
 */

const landingRow = {
  id: "home-1",
  text: "Landing footer disclosure.",
  locations: ["Home Page"],
  customLocation: "",
  scope: "plan",
  apply_all_benefits_categories: false,
};

const retirementRow = {
  id: "ret-1",
  text: "Retirement only.",
  locations: ["Retirement"],
  apply_all_benefits_categories: false,
};

const envelope = {
  disclaimers: [landingRow, retirementRow],
  byCategory: { Retirement: { text: "Retirement per-benefit" } },
  disclosuresText: "legacy combined text",
  footerBackground: { mode: "secondary", customColor: "" },
};

describe("parseDisclaimersEnvelope", () => {
  it("accepts the stored object as-is", () => {
    expect(parseDisclaimersEnvelope(envelope)).toBe(envelope);
  });

  it("parses the JSON string some rows still hold", () => {
    expect(parseDisclaimersEnvelope(JSON.stringify(envelope))).toEqual(envelope);
  });

  it("returns null for legacy plain text, arrays and broken JSON", () => {
    expect(parseDisclaimersEnvelope("For educational purposes only.")).toBeNull();
    expect(parseDisclaimersEnvelope([landingRow])).toBeNull();
    expect(parseDisclaimersEnvelope("{not json")).toBeNull();
    expect(parseDisclaimersEnvelope(null)).toBeNull();
  });
});

describe("findLandingDisclosure", () => {
  it("finds the Home Page row and its position", () => {
    const found = findLandingDisclosure(envelope);
    expect(found?.row.id).toBe("home-1");
    expect(found?.index).toBe(0);
  });

  it("accepts a Global row and an apply-all row, as the layout does", () => {
    expect(
      findLandingDisclosure({ disclaimers: [{ text: "G", locations: ["Global"] }] })
        ?.row.text,
    ).toBe("G");
    expect(
      findLandingDisclosure({
        disclaimers: [{ text: "A", apply_all_benefits_categories: true }],
      })?.row.text,
    ).toBe("A");
  });

  it("prefers a row that actually has text", () => {
    const found = findLandingDisclosure({
      disclaimers: [
        { id: "empty", text: "", locations: ["Home Page"] },
        { id: "filled", text: "Shown", locations: ["Home Page"] },
      ],
    });
    expect(found?.row.id).toBe("filled");
  });

  it("ignores rows aimed only at a benefit category", () => {
    expect(
      findLandingDisclosure({ disclaimers: [retirementRow] }),
    ).toBeNull();
  });
});

describe("readLandingDisclosureText", () => {
  it("returns the row's text", () => {
    expect(readLandingDisclosureText(envelope)).toBe("Landing footer disclosure.");
  });

  it("returns null when only a benefit row exists", () => {
    expect(readLandingDisclosureText({ disclaimers: [retirementRow] })).toBeNull();
  });
});

describe("withLandingDisclosureText", () => {
  it("updates the row the layout reads and keeps everything else", () => {
    const next = withLandingDisclosureText(envelope, "New footer text.");

    const rows = next.disclaimers as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "home-1",
      text: "New footer text.",
      locations: ["Home Page"],
      scope: "plan",
    });
    // The benefit's own row is untouched…
    expect(rows[1]).toEqual(retirementRow);
    // …and so is every other key of the envelope.
    expect(next.byCategory).toEqual(envelope.byCategory);
    expect(next.disclosuresText).toBe("legacy combined text");
    expect(next.footerBackground).toEqual({ mode: "secondary", customColor: "" });
  });

  it("appends a Home Page row when the plan has no disclosure", () => {
    const next = withLandingDisclosureText(
      { disclaimers: [retirementRow] },
      "First footer text.",
    );
    const rows = next.disclaimers as any[];
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      text: "First footer text.",
      locations: ["Home Page"],
      scope: "plan",
      apply_all_benefits_categories: false,
    });
    expect(rows[0]).toEqual(retirementRow);
  });

  it("starts an envelope from nothing", () => {
    const next = withLandingDisclosureText("legacy plain text", "Written.");
    expect((next.disclaimers as any[])[0].text).toBe("Written.");
  });

  it("gives an apply-all row an explicit Home Page location once it is edited here", () => {
    const next = withLandingDisclosureText(
      {
        disclaimers: [
          {
            id: "a",
            text: "All",
            locations: [],
            apply_all_benefits_categories: true,
          },
        ],
      },
      "All benefits",
    );
    expect((next.disclaimers as any[])[0].locations).toEqual(["Home Page"]);
    // The flag that made it apply everywhere is kept — only the location is added.
    expect((next.disclaimers as any[])[0].apply_all_benefits_categories).toBe(
      true,
    );
  });
});

describe("withFooterBackground", () => {
  it("writes the preference and leaves the disclosures alone", () => {
    const next = withFooterBackground(envelope, {
      mode: "custom",
      customColor: "#123456",
    });
    expect(next.footerBackground).toEqual({
      mode: "custom",
      customColor: "#123456",
    });
    expect(next.disclaimers).toEqual(envelope.disclaimers);
    expect(next.byCategory).toEqual(envelope.byCategory);
  });
});

describe("landingDisclosureSeed", () => {
  it("prefers the stored row", () => {
    expect(landingDisclosureSeed(envelope, "advisor text")).toBe(
      "Landing footer disclosure.",
    );
  });

  it("falls back to the advisor's disclaimer", () => {
    expect(landingDisclosureSeed({}, "advisor text")).toBe("advisor text");
  });

  it("falls back to a legacy plain-text value", () => {
    expect(landingDisclosureSeed("old plain footer")).toBe("old plain footer");
  });

  it("returns an empty string when there is nothing to show", () => {
    expect(landingDisclosureSeed(undefined)).toBe("");
  });
});
