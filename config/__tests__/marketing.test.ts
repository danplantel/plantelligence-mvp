import { describe, expect, it } from "vitest";

import {
  MARKETING_DEEP_DIVES,
  MARKETING_FAQS,
  MARKETING_FEATURES,
  MARKETING_NAV_LINKS,
  MARKETING_STEPS,
} from "@/config/marketing";

describe("marketing content", () => {
  it("uses anchors that exist on the page", () => {
    const sectionIds = new Set([
      "features",
      "faq",
      ...MARKETING_DEEP_DIVES.map((section) => section.id),
    ]);

    for (const link of MARKETING_NAV_LINKS) {
      expect(link.href.startsWith("#")).toBe(true);
      expect(sectionIds.has(link.href.slice(1))).toBe(true);
    }
  });

  it("keeps deep-dive ids unique and fully populated", () => {
    const ids = new Set<string>();

    for (const section of MARKETING_DEEP_DIVES) {
      expect(ids.has(section.id)).toBe(false);
      ids.add(section.id);
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.description.length).toBeGreaterThan(0);
      expect(section.bullets.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("publishes a complete feature inventory", () => {
    expect(MARKETING_FEATURES.length).toBeGreaterThanOrEqual(20);

    for (const feature of MARKETING_FEATURES) {
      expect(feature.title.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    }
  });

  it("has a three-step story and a useful FAQ", () => {
    expect(MARKETING_STEPS).toHaveLength(3);
    expect(MARKETING_FAQS.length).toBeGreaterThanOrEqual(8);
    expect(MARKETING_FAQS.every((item) => item.answer.length > 0)).toBe(true);
  });

  it("does not claim video generation with Synthesia or HeyGen", () => {
    const videoFaq = MARKETING_FAQS.find((item) =>
      item.question.toLowerCase().includes("generate videos"),
    );

    expect(videoFaq).toBeDefined();
    expect(videoFaq?.answer).toMatch(/does not currently generate/i);
    expect(videoFaq?.answer).toMatch(/Synthesia or HeyGen/);

    const claims = JSON.stringify({
      features: MARKETING_FEATURES,
      dives: MARKETING_DEEP_DIVES,
      steps: MARKETING_STEPS,
    });
    expect(claims).not.toMatch(/Synthesia|HeyGen/i);
  });

  it("does not promise an answering chatbot or compliance certifications", () => {
    const copy = JSON.stringify({
      features: MARKETING_FEATURES,
      dives: MARKETING_DEEP_DIVES,
      faqs: MARKETING_FAQS,
    });

    expect(copy).toMatch(/Automated answer generation is not part of the current release/i);
    expect(copy).not.toMatch(/SOC 2|SOC2|HIPAA certified|GDPR certified/i);
  });

  it("contains no fabricated customer quotes or metrics", () => {
    const copy = JSON.stringify({
      features: MARKETING_FEATURES,
      dives: MARKETING_DEEP_DIVES,
      faqs: MARKETING_FAQS,
    });

    expect(copy).not.toMatch(/testimonial/i);
    expect(copy).not.toMatch(/\d+% of (advisors|plans|participants)/i);
  });
});
