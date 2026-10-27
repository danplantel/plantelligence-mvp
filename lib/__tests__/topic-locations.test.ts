import { describe, expect, it } from "vitest";
import {
  TOPIC_LOCATION_ORDER,
  benefitCategoryForLocation,
  isBenefitCategoryLocation,
  isTopicLocation,
  topicLocationForCategory,
  topicLocationLabel,
} from "@/lib/topic-locations";

describe("topicLocationForCategory", () => {
  it("maps the three canonical categories", () => {
    expect(topicLocationForCategory("Retirement")).toBe("retirement");
    expect(topicLocationForCategory("Group Health")).toBe("group_health");
    expect(topicLocationForCategory("Group Life")).toBe("group_life");
  });

  it("maps every spelling of the Custom hub to custom", () => {
    for (const spelling of [
      "Company / Plan Sponsor",
      "company/plan sponsor",
      "Custom",
      "Other",
      "Other / Custom",
      "Wellness Programs",
    ]) {
      expect(topicLocationForCategory(spelling)).toBe("custom");
    }
  });

  it("accepts the legacy titles the wizard writes", () => {
    expect(topicLocationForCategory("Health Insurance")).toBe("group_health");
    expect(topicLocationForCategory("Life Insurance")).toBe("group_life");
    expect(topicLocationForCategory("Retirement Plan Benefits")).toBe(
      "retirement",
    );
  });

  it("is case and punctuation insensitive", () => {
    expect(topicLocationForCategory("  GROUP HEALTH  ")).toBe("group_health");
    expect(topicLocationForCategory("group_health")).toBe("group_health");
    expect(topicLocationForCategory("GroupLife")).toBe("group_life");
  });

  it("never maps Employee Resources to a benefit location", () => {
    // It is a hub, but not a benefit category: TF-6 adds it, and it must not be
    // inferred from a name that happens to look like one.
    expect(topicLocationForCategory("Employee Resources")).toBeNull();
    expect(topicLocationForCategory("employee_resources")).toBeNull();
  });

  it("returns null for an empty category", () => {
    expect(topicLocationForCategory("")).toBeNull();
    expect(topicLocationForCategory("   ")).toBeNull();
    expect(topicLocationForCategory(null)).toBeNull();
    expect(topicLocationForCategory(undefined)).toBeNull();
  });

  it("treats an unrecognised benefit category as the Custom hub", () => {
    // A Benefit row is always one of the four hubs, and Custom is the only slot whose
    // stored spelling has changed over the app's life.
    expect(topicLocationForCategory("Acme Perks")).toBe("custom");
  });
});

describe("benefitCategoryForLocation", () => {
  it("round-trips every benefit location back to its stored category", () => {
    for (const location of TOPIC_LOCATION_ORDER) {
      const category = benefitCategoryForLocation(location);
      expect(category).toBeTruthy();
      expect(topicLocationForCategory(category)).toBe(location);
    }
  });

  it("keeps the Custom hub's existing storage key", () => {
    expect(benefitCategoryForLocation("custom")).toBe(
      "Company / Plan Sponsor",
    );
  });

  it("has no category for Employee Resources", () => {
    expect(benefitCategoryForLocation("employee_resources")).toBeNull();
  });
});

describe("canonical order", () => {
  it("is Retirement, Group Health, Group Life, Custom", () => {
    expect(TOPIC_LOCATION_ORDER).toEqual([
      "retirement",
      "group_health",
      "group_life",
      "custom",
    ]);
  });

  it("excludes Employee Resources from the benefit locations", () => {
    expect(isBenefitCategoryLocation("employee_resources")).toBe(false);
    expect(isBenefitCategoryLocation("custom")).toBe(true);
  });
});

describe("isTopicLocation", () => {
  it("accepts the five enum values only", () => {
    expect(isTopicLocation("retirement")).toBe(true);
    expect(isTopicLocation("employee_resources")).toBe(true);
    expect(isTopicLocation("Retirement")).toBe(false);
    expect(isTopicLocation("group-health")).toBe(false);
    expect(isTopicLocation(null)).toBe(false);
    expect(isTopicLocation(7)).toBe(false);
  });
});

describe("topicLocationLabel", () => {
  it("names the Custom hub after the advisor's benefit", () => {
    expect(topicLocationLabel("custom", "Acme Perks")).toBe("Acme Perks");
  });

  it("falls back to Other / Custom when the hub has no name yet", () => {
    expect(topicLocationLabel("custom", "  ")).toBe("Other / Custom");
  });

  it("uses the canonical label for the other hubs", () => {
    expect(topicLocationLabel("group_health")).toBe("Group Health");
  });
});
