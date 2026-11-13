import { describe, expect, it } from "vitest";

import { benefitsHubPrivacyPolicy } from "@/lib/legal/content/privacy-policy";
import { benefitsHubTermsOfService } from "@/lib/legal/content/terms-of-service";
import {
  prepareLegalMarkdown,
  resolveLegalPlaceholders,
  stripEditorialNotes,
} from "@/lib/legal/legal-text";

describe("stripEditorialNotes", () => {
  it("removes an inline drafting note but keeps the sentence", () => {
    const result = stripEditorialNotes(
      "Reports may be shared, [CONFIRM: in aggregate form].",
    );

    expect(result).toBe("Reports may be shared.");
  });

  it("drops a heading that existed only to introduce an editorial note", () => {
    const result = stripEditorialNotes(
      "**Sale or sharing for targeted advertising:** [INSERT VERIFIED STATEMENT]",
    );

    expect(result).toBe("");
  });

  it("leaves participant-facing placeholders untouched", () => {
    const result = stripEditorialNotes(
      "Effective Date: [DATE]\nFor [ORGANIZATION NAME].",
    );

    expect(result).toContain("Effective Date: [DATE]");
    expect(result).toContain("[ORGANIZATION NAME]");
  });
});

describe("resolveLegalPlaceholders", () => {
  it("resolves both dates in order and the organization fields", () => {
    const result = resolveLegalPlaceholders(
      "Effective Date: [DATE]  \nLast Updated: [DATE]\n\n" +
        "Refer to [PLANtelligence LEGAL ENTITY] for [ORGANIZATION NAME]. " +
        "Privacy contact: [PRIVACY EMAIL OR REQUEST LINK].",
      {
        organizationName: "Acme Advisory",
        effectiveDate: "January 1, 2026",
        lastUpdated: "February 2, 2026",
      },
    );

    expect(result).toContain("Effective Date: January 1, 2026");
    expect(result).toContain("Last Updated: February 2, 2026");
    expect(result).toContain("Refer to PlanTelligence for Acme Advisory.");
    expect(result).toContain("support@plantelligence.ai");
  });

  it("drops the unconfigured business-address line", () => {
    const result = resolveLegalPlaceholders(
      "**Platform Operator**  \nPlanTelligence  \n[BUSINESS ADDRESS]  \nPrivacy Contact: support@plantelligence.ai",
    );

    expect(result).not.toContain("[BUSINESS ADDRESS]");
    expect(result).toContain("Privacy Contact: support@plantelligence.ai");
  });
});

describe("prepareLegalMarkdown", () => {
  it("strips drafting notes and resolves placeholders in one pass", () => {
    const result = prepareLegalMarkdown(
      "Effective Date: [DATE]\n\nSee [ORGANIZATION NAME]. [CONFIRM: counsel review]",
      { organizationName: "Northwind" },
    );

    expect(result).toContain("See Northwind.");
    expect(result).not.toMatch(/CONFIRM|\[DATE\]|\[ORGANIZATION NAME\]/);
  });
});

describe("the shipped Benefits Hub documents", () => {
  const documents = [
    ["Privacy Policy", benefitsHubPrivacyPolicy],
    ["Terms of Service", benefitsHubTermsOfService],
  ] as const;

  for (const [name, source] of documents) {
    it(`${name} exposes no drafting notes or unresolved placeholders`, () => {
      const result = prepareLegalMarkdown(source, {
        organizationName: "Northwind",
        organizationContact: "benefits@northwind.example",
      });

      expect(result).not.toMatch(
        /\[(CONFIRM|INSERT|DESCRIBE|ANY ADDITIONAL)/i,
      );
      // No bracket field survives — every one is either substituted or removed.
      expect(result.match(/\[[A-Z][^\]]*\]/g) ?? []).toEqual([]);
      expect(result).toContain("Effective Date: November 13, 2026");
      expect(result).toContain("Northwind");
    });
  }
});
