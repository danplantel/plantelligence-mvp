import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUICK_ANSWER_GROUPS,
  libraryTopicBySlug,
  libraryTopicsForLocation,
} from "@/lib/topics/library";
import type { LibraryTopicSeed } from "@/lib/topics/library";

const lifeSeeds = libraryTopicsForLocation("group_life");

/**
 * Group Health's shipped content, from the handoff's Group Health page: five
 * Featured topics and 41 Quick Answers in seven groups, with the account
 * acronyms spelled out wherever the answer introduces them.
 */
const seeds = libraryTopicsForLocation("group_health");

function textOf(seed: LibraryTopicSeed | undefined): string {
  return (seed?.bodyBlocks ?? [])
    .map((block) => ("text" in block ? block.text : ""))
    .join(" ");
}

/**
 * A question promoted to a Featured card borrows its `summary` as the card line.
 * When an answer has one, it must TEASE the answer rather than print it.
 */
describe("Retirement card lines", () => {
  it("teases the savings-rate answer instead of printing it", () => {
    const seed = libraryTopicBySlug("how-much-should-i-save");

    expect(seed?.summary?.trim()).toBeTruthy();
    expect(seed?.summary).not.toContain("10%");
    expect(textOf(seed)).toContain("10% to 15%");
  });

  it("gives the two legacy leaving questions a body", () => {
    // Older plans were seeded with these slugs before the library carried their
    // copy — without this they open an EMPTY accordion.
    for (const slug of ["what-if-i-leave", "previous-employer-plans"]) {
      const seed = libraryTopicBySlug(slug);
      expect(seed, slug).toBeTruthy();
      expect(seed?.group, slug).toBe("Leaving / Retirement");
      expect(textOf(seed).length, slug).toBeGreaterThan(80);
      expect(seed?.summary?.trim(), slug).toBeTruthy();
    }
  });
});

describe("Group Health library", () => {
  it("ships five Featured topics, HSA / FSA among them", () => {
    expect(
      seeds
        .filter((seed) => seed.displayByDefault === "featured")
        .map((seed) => seed.slug),
    ).toEqual([
      "understand-coverage",
      "find-care-providers",
      "claims-bills-costs",
      "add-remove-dependent",
      "hsa-fsa-resources",
    ]);
  });

  it("ships 41 answers in the seven documented groups", () => {
    const answers = seeds.filter((seed) => seed.displayByDefault === "quick_answers");

    expect(answers).toHaveLength(41);
    expect(new Set(answers.map((seed) => seed.group))).toEqual(
      new Set(DEFAULT_QUICK_ANSWER_GROUPS.group_health),
    );
    expect(DEFAULT_QUICK_ANSWER_GROUPS.group_health).toEqual([
      "Understanding Coverage",
      "Getting Care",
      "Claims & Billing",
      "Prescriptions",
      "Changes to Coverage",
      "HSA / FSA",
      "Leaving / Aging",
    ]);
  });

  it("says what COBRA stands for before it explains it", () => {
    const cobra = libraryTopicBySlug("cobra");
    const divorce = libraryTopicBySlug("divorce-or-legal-separation");

    expect(textOf(cobra)).toContain(
      "COBRA (the Consolidated Omnibus Budget Reconciliation Act)",
    );
    expect(cobra?.summary?.trim()).toBeTruthy();
    // The other place the acronym appears spells it out too.
    expect(textOf(divorce)).toContain(
      "Consolidated Omnibus Budget Reconciliation Act",
    );
  });

  it("spells out the account names on the card and in the answers", () => {
    const card = libraryTopicBySlug("hsa-fsa-resources");
    const versus = libraryTopicBySlug("hsa-vs-fsa");
    const limits = libraryTopicBySlug("hsa-fsa-contribution-limits");

    expect(card?.summary).toContain("Health Savings Account (HSA)");
    expect(card?.summary).toContain("Flexible Spending Account (FSA)");
    expect(textOf(card)).toContain("HSA (Health Savings Account)");
    expect(textOf(card)).toContain("FSA (Flexible Spending Account)");
    expect(textOf(versus)).toContain("HSA (Health Savings Account)");
    expect(textOf(versus)).toContain("FSA (Flexible Spending Account)");
    expect(textOf(limits)).toContain("HSA (Health Savings Account)");
    expect(textOf(limits)).toContain("FSA (Flexible Spending Account)");
  });
});

/**
 * Group Life's shipped content, from the handoff's Group Life page: five Featured
 * topics (Disability Benefits among them) and 30 Quick Answers in six groups.
 */
describe("Group Life library", () => {
  it("ships five Featured topics, disability among them", () => {
    expect(
      lifeSeeds
        .filter((seed) => seed.displayByDefault === "featured")
        .map((seed) => seed.slug),
    ).toEqual([
      "review-my-coverage",
      "beneficiaries",
      "change-or-add-coverage",
      "file-a-claim",
      "disability-benefits",
    ]);
  });

  it("ships 30 answers in the six documented groups", () => {
    const answers = lifeSeeds.filter(
      (seed) => seed.displayByDefault === "quick_answers",
    );

    expect(answers).toHaveLength(30);
    expect(new Set(answers.map((seed) => seed.group))).toEqual(
      new Set(DEFAULT_QUICK_ANSWER_GROUPS.group_life),
    );
    expect(DEFAULT_QUICK_ANSWER_GROUPS.group_life).toEqual([
      "Coverage",
      "Beneficiaries",
      "Enrollment",
      "Claims",
      "Leaving the Company",
      "Disability",
    ]);
  });

  it("keeps the slugs the life-event checklists link to", () => {
    const slugs = new Set(lifeSeeds.map((seed) => seed.slug));

    for (const slug of [
      "review-my-coverage",
      "how-much-coverage",
      "portability",
      "conversion",
      "file-a-claim",
      "disability-benefits",
    ]) {
      expect(slugs.has(slug)).toBe(true);
    }
  });
});
