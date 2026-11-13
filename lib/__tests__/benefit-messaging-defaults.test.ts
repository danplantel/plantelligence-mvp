import { describe, expect, it } from "vitest";

import {
  INTRO_MESSAGE_MAX_LENGTH,
  buildIntroHeadline,
  buildIntroMessage,
} from "../benefit-messaging-defaults";

/**
 * Step 1 → Branding → Messaging seeds.
 *
 * Two rules are pinned here, because both were wrong before:
 *
 *  - the headline names the PLAN SPONSOR (the participant's employer), never the
 *    advisor's own firm — and it takes no category at all, so no admin preference can
 *    change whose name a participant is greeted with;
 *  - the message is written for the benefit being edited, so a Group Health or Group
 *    Life hub no longer opens with a paragraph about "your retirement plan".
 */

describe("buildIntroHeadline", () => {
  it("greets the participant with the plan sponsor's name", () => {
    expect(buildIntroHeadline("Acme Corp")).toBe("Welcome to Acme Corp!");
  });

  it("trims and collapses whitespace", () => {
    expect(buildIntroHeadline("  Acme   Corp  ")).toBe("Welcome to Acme Corp!");
  });

  it("fits the 35-character Intro Headline field, trailing '!' included", () => {
    const headline = buildIntroHeadline(
      "A Really Long Plan Sponsor Company Name Incorporated",
    );

    expect(headline.length).toBe(35);
    expect(headline.startsWith("Welcome to ")).toBe(true);
    expect(headline.endsWith("!")).toBe(true);
  });

  it("falls back to the benefits hub when the plan is not known yet", () => {
    expect(buildIntroHeadline("")).toBe("Welcome to Your Benefits Hub!");
    expect(buildIntroHeadline(null)).toBe("Welcome to Your Benefits Hub!");
    expect(buildIntroHeadline(undefined)).toBe("Welcome to Your Benefits Hub!");
  });
});

describe("buildIntroMessage", () => {
  const message = (category: string, orgName = "Acme Advisory") =>
    buildIntroMessage({ category, companyName: "Acme Corp", orgName });

  it("names the plan sponsor and the advisor's firm", () => {
    expect(message("Retirement")).toContain("Acme Corp");
    expect(message("Retirement")).toContain("Acme Advisory");
  });

  it("talks about the retirement plan on the retirement hub", () => {
    expect(message("Retirement")).toMatch(/retirement plan/);
  });

  it("never mentions retirement on any other hub", () => {
    for (const category of [
      "Group Health",
      "Group Life",
      "Company / Plan Sponsor",
      "Custom",
      "Other Benefits",
      "Wellness Programs",
      "Acme Financial Wellness",
    ]) {
      expect(message(category)).not.toMatch(/retirement/i);
    }
  });

  it("writes health copy for the health hub and life copy for the life hub", () => {
    expect(message("Group Health")).toMatch(/medical, dental and vision/);
    expect(message("Group Life")).toMatch(/life and disability/);
  });

  it("accepts the legacy spellings of each category", () => {
    expect(message("Health")).toMatch(/medical, dental and vision/);
    expect(message("Health Insurance")).toMatch(/medical, dental and vision/);
    expect(message("Life Insurance")).toMatch(/life and disability/);
    expect(message("Disability")).toMatch(/life and disability/);
    expect(message("Retirement Plan")).toMatch(/retirement plan/);
  });

  it("falls back to plain-language names when the plan or the advisor is unknown", () => {
    const text = buildIntroMessage({ category: "Group Health" });

    expect(text).toContain("your company");
    expect(text).toContain("your advisor");
  });

  it("always fits the 450-character Intro Message field", () => {
    const text = buildIntroMessage({
      category: "Retirement",
      companyName: "A Very Long Plan Sponsor Company Name That Keeps Going",
      orgName: "An Equally Long Advisory Firm Name That Also Keeps Going",
    });

    expect(text.length).toBeLessThanOrEqual(INTRO_MESSAGE_MAX_LENGTH);
  });
});
