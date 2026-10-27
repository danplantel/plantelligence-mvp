import { describe, expect, it } from "vitest";

import {
  LIFE_EVENT_HUB_PATH,
  lifeEventDeadlineText,
  resolveLifeEvent,
  resolveLifeEventSteps,
} from "@/lib/life-events/resolve";
import {
  LIFE_EVENT_TEMPLATES,
  lifeEventTemplate,
} from "@/lib/life-events/templates";
import type {
  TopicLocation,
  TopicPlacementRecord,
  TopicRecord,
} from "@/types/topic";

/**
 * TF-8 · Life Events.
 *
 * A checklist is a view over placements, so these tests are about what DROPS. The
 * acceptance case is the first two: "Having a baby" ships seven steps, and switching
 * Group Life off removes the life-insurance step, leaving six.
 */

let counter = 0;

function topic(slug: string, overrides: Partial<TopicRecord> = {}): TopicRecord {
  counter += 1;
  return {
    id: `topic-${counter}`,
    scope: "system",
    slug: `sys.${slug}`,
    title: slug.replace(/-/g, " "),
    isActionHub: false,
    status: "active",
    ...overrides,
  };
}

function placement(
  topicRecord: TopicRecord,
  location: TopicLocation,
  overrides: Partial<TopicPlacementRecord> = {},
): TopicPlacementRecord {
  counter += 1;
  return {
    id: `placement-${counter}`,
    clientId: "plan-1",
    topicId: topicRecord.id,
    location,
    displayMode: "quick_answers",
    groupId: null,
    sortOrder: 0,
    overrides: null,
    actionHubLink: null,
    ...overrides,
  };
}

/** A plan that has every topic the "Having a baby" template names. */
function babyPlan(locationOf: (slug: string) => TopicLocation) {
  const template = lifeEventTemplate("having_a_baby")!;
  const topics: TopicRecord[] = [];
  const placements: TopicPlacementRecord[] = [];

  for (const step of template.steps) {
    const record = topic(step.topicSlug, {
      title: step.label,
      isActionHub: step.topicSlug === "add-remove-dependent",
    });
    topics.push(record);
    placements.push(placement(record, locationOf(step.topicSlug)));
  }

  return { template, topics, placements };
}

/** The location each "Having a baby" topic belongs to, per the template itself. */
function declaredLocation(slug: string): TopicLocation {
  const template = lifeEventTemplate("having_a_baby")!;
  return template.steps.find((step) => step.topicSlug === slug)!.location;
}

function allVisible() {
  return () => true;
}

describe("resolveLifeEventSteps", () => {
  it("lists every step the plan's placements support (\"Having a baby\": 7)", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: allVisible(),
    });

    expect(steps).toHaveLength(7);
    expect(steps.map((step) => step.label)).toEqual([
      "Add your child to your health plan",
      "Update your beneficiaries",
      "Review your life insurance coverage",
      "Learn about parental leave",
      "Update your tax withholding",
      "Adjust your FSA or HSA",
      "Start saving for education",
    ]);
  });

  it("drops the life-insurance step when Group Life is switched off (7 → 6)", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: (location) => location !== "group_life",
    });

    expect(steps).toHaveLength(6);
    expect(steps.some((step) => step.label.includes("life insurance"))).toBe(false);
  });

  it("drops every step of a switched-off location", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    // Employee Resources is opt-in: with it off, its two steps go.
    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: (location) => location !== "employee_resources",
    });

    expect(steps).toHaveLength(5);
    expect(
      steps.some((step) => step.location === "employee_resources"),
    ).toBe(false);
  });

  it("never resurrects a placement the advisor hid", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);
    const lifeIndex = placements.findIndex(
      (row) => row.location === "group_life",
    );
    placements[lifeIndex] = { ...placements[lifeIndex], displayMode: "hidden" };

    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: allVisible(),
    });

    expect(steps).toHaveLength(6);
  });

  it("skips a topic this plan simply does not have", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);
    const withoutCollege = placements.filter(
      (row) => row.location !== "retirement" || row.topicId !== topics.at(-1)!.id,
    );

    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements: withoutCollege,
      isLocationVisible: allVisible(),
    });

    expect(steps).toHaveLength(6);
    expect(steps.some((step) => step.topicSlug === "college-savings")).toBe(false);
  });

  it("links each step into its hub with the topic hash", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: allVisible(),
      planSlug: "air-fayre",
    });

    expect(steps[0].href).toBe(
      `/air-fayre/${LIFE_EVENT_HUB_PATH.group_health}#add-remove-dependent`,
    );
    // Beneficiaries is a RETIREMENT step in this template; its hub is /retirement.
    expect(steps[1].href).toBe(
      `/air-fayre/${LIFE_EVENT_HUB_PATH.retirement}#beneficiaries`,
    );
  });

  it("omits the href when no plan slug is known", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const [first] = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: allVisible(),
    });

    expect(first.href).toBeNull();
  });

  it("marks Action Hub steps, so the checklist can open a panel", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const steps = resolveLifeEventSteps({
      template,
      topics,
      placements,
      isLocationVisible: allVisible(),
    });

    expect(steps[0].isActionHub).toBe(true);
    expect(steps[2].isActionHub).toBe(false);
  });

  it("keeps one id per position, even when a topic appears twice", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);
    const grief = lifeEventTemplate("losing_a_loved_one")!;

    const steps = resolveLifeEventSteps({
      template: grief,
      topics,
      placements,
      isLocationVisible: allVisible(),
    });

    // Only the steps this fixture has placements for survive; ids must still be unique.
    const ids = steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveLifeEvent", () => {
  it("reports how many template steps were dropped", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const event = resolveLifeEvent({
      template,
      topics,
      placements,
      isLocationVisible: (location) => location !== "group_life",
    });

    expect(event.steps).toHaveLength(6);
    expect(event.droppedCount).toBe(1);
    expect(event.title).toBe("Having a baby");
    expect(event.deadlineDays).toBe(30);
  });

  it("carries the deadline and the footer CTA from the template", () => {
    const { template, topics, placements } = babyPlan(declaredLocation);

    const event = resolveLifeEvent({
      template,
      topics,
      placements,
      isLocationVisible: allVisible(),
    });

    expect(event.deadlineLabel).toContain("add your child");
    expect(event.ctaLabel).toBe("Talk to my benefits team");
  });
});

describe("lifeEventDeadlineText", () => {
  it("formats the window with the template's wording", () => {
    expect(
      lifeEventDeadlineText({
        deadlineDays: 30,
        deadlineLabel: "days to add your child to your health plan",
      }),
    ).toBe("30 days to add your child to your health plan");
  });

  it("honours a plan-level override", () => {
    expect(lifeEventDeadlineText({ deadlineDays: 30 }, 14)).toBe("14 days left");
  });

  it("is silent when there is no window", () => {
    expect(lifeEventDeadlineText({ deadlineDays: null })).toBeNull();
    expect(lifeEventDeadlineText({ deadlineDays: 30 }, 0)).toBeNull();
  });
});

describe("LIFE_EVENT_TEMPLATES", () => {
  it("ships the eight defaults from §16.5", () => {
    expect(LIFE_EVENT_TEMPLATES.map((template) => template.title)).toEqual([
      "Having a baby",
      "Getting married",
      "Moving",
      "Leaving the company",
      "Approaching Retirement",
      "Losing a Loved One",
      "Divorce",
      "Going on Leave",
    ]);
  });

  it("naming every step by location + topic, never by copy", () => {
    for (const template of LIFE_EVENT_TEMPLATES) {
      expect(template.steps.length).toBeGreaterThan(0);
      for (const step of template.steps) {
        expect(step.location).toBeTruthy();
        expect(step.topicSlug).toBeTruthy();
        expect(step.label).toBeTruthy();
      }
    }
  });
});
