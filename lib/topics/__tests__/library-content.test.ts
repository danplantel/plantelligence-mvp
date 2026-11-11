import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUICK_ANSWER_GROUPS,
  libraryTopicBySlug,
  libraryTopicsForLocation,
} from "@/lib/topics/library";
import type { LibraryTopicSeed } from "@/lib/topics/library";

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
