import { describe, expect, it } from "vitest";

import {
  CONTRIBUTION_LIMITS_YEAR,
  ELECTIVE_DEFERRAL_LIMIT,
} from "@/lib/plan-contribution-limits";
import {
  assistantStarterQuestions,
  buildAssistantCorpus,
  buildAssistantHubs,
  respondToHub,
  respondToQuestion,
  respondToTopic,
  searchAssistantTopics,
  type AssistantIndex,
  type AssistantPlacement,
  type AssistantPlan,
  type AssistantReply,
} from "@/lib/topics/assistant";

/**
 * The portal assistant's deterministic brain.
 *
 * These tests exercise the real shipped library — no fixtures for the corpus — so a
 * content pass that removes a slug shows up here. The synthetic placements below
 * only prove the overlay rules (copy, hiding, org topics).
 */

const PLAN: AssistantPlan = {
  clientId: "acme",
  advisorName: "Jordan Lee",
  loginUrl: "https://recordkeeper.example/sign-in",
  appointmentUrl: "https://cal.example/jordan",
  contactEmail: "jordan@example.com",
  hubs: [
    { location: "retirement", label: "Retirement", href: "/acme/retirement" },
    {
      location: "group_health",
      label: "Group Health",
      href: "/acme/health-insurance",
    },
    {
      location: "employee_resources",
      label: "Employee Resources",
      href: "/acme/employee-resources",
    },
  ],
};

const libraryIndex = () => buildAssistantCorpus();

function findTopic(
  index: AssistantIndex,
  location: AssistantPlacement["location"],
  slug: string,
) {
  return index.topics.find(
    (topic) => topic.location === location && topic.slug === slug,
  );
}

function answerOf(reply: AssistantReply) {
  if (reply.kind !== "answer") {
    throw new Error(`Expected an answer reply, received ${reply.kind}`);
  }
  return reply;
}

const placedLoan: AssistantPlacement = {
  slug: "sys.401k-loans",
  location: "retirement",
  title: "Can I take a loan?",
  bodyBlocks: [
    {
      type: "quick_answer",
      text: "You can borrow up to 50% of your vested balance, up to $50,000.",
    },
    {
      type: "steps",
      steps: [
        "Log in to your recordkeeper account.",
        "Review your available loan amount.",
        "Select a loan type.",
        "Submit your request.",
      ],
    },
  ],
  tags: ["loan", "borrow"],
  group: "Loans & Withdrawals",
  displayMode: "quick_answers",
  cta: { label: "Request a Loan", actionType: "external_url" },
};

describe("assistant corpus", () => {
  it("indexes the shipped library in every location", () => {
    const index = libraryIndex();

    expect(findTopic(index, "retirement", "401k-loans")).toBeTruthy();
    expect(findTopic(index, "group_health", "cobra")).toBeTruthy();
    expect(findTopic(index, "group_life", "disability-benefits")).toBeTruthy();
    expect(findTopic(index, "custom", "paying-down-debt")).toBeTruthy();
    expect(
      findTopic(index, "employee_resources", "pay-stubs-direct-deposit"),
    ).toBeTruthy();
    expect(index.topics.length).toBeGreaterThan(100);
  });

  it("drops a topic the advisor hid", () => {
    const index = buildAssistantCorpus({
      hiddenSlugs: ["sys.401k-loans", "cobra"],
    });

    expect(findTopic(index, "retirement", "401k-loans")).toBeUndefined();
    expect(findTopic(index, "group_health", "cobra")).toBeUndefined();
  });

  it("keeps a gated topic out until the plan places it", () => {
    expect(
      findTopic(libraryIndex(), "retirement", "employer-match-vesting"),
    ).toBeUndefined();

    const index = buildAssistantCorpus({
      placed: [
        {
          slug: "sys.employer-match-vesting",
          location: "retirement",
          title: "Employer Match & Vesting",
          bodyBlocks: [
            {
              type: "quick_answer",
              text: "Your employer matches a formula set by your plan.",
            },
          ],
          displayMode: "featured",
        },
      ],
    });

    const placed = findTopic(index, "retirement", "employer-match-vesting");
    expect(placed?.isPlaced).toBe(true);
  });

  it("takes the plan's placement copy and marks the topic placed", () => {
    const index = buildAssistantCorpus({
      placed: [
        {
          slug: "sys.beneficiaries",
          location: "retirement",
          title: "Name My Beneficiary",
          bodyBlocks: [
            {
              type: "quick_answer",
              text: "Your beneficiary designation decides who receives the account.",
            },
          ],
          tags: ["beneficiary"],
          displayMode: "featured",
        },
      ],
    });

    const topic = findTopic(index, "retirement", "beneficiaries");
    expect(topic?.title).toBe("Name My Beneficiary");
    expect(topic?.quickAnswer).toContain("beneficiary designation");
    expect(topic?.isPlaced).toBe(true);
  });

  it("adds an org topic the library does not carry", () => {
    const index = buildAssistantCorpus({
      placed: [
        {
          slug: "sys.acme-parking",
          location: "custom",
          title: "Parking & Commuter Benefits",
          bodyBlocks: [
            {
              type: "quick_answer",
              text: "Parking is payroll-deducted and managed by the facilities team.",
            },
          ],
          tags: ["parking", "commuter"],
          displayMode: "quick_answers",
        },
      ],
    });

    const topic = findTopic(index, "custom", "acme-parking");
    expect(topic?.title).toBe("Parking & Commuter Benefits");
    expect(topic?.isPlaced).toBe(true);
  });

  it("keeps a shared topic on each location it serves", () => {
    const index = libraryIndex();

    expect(findTopic(index, "retirement", "beneficiaries")).toBeTruthy();
    expect(findTopic(index, "group_life", "beneficiaries")).toBeTruthy();
  });
});

describe("assistant retrieval", () => {
  it("finds the 401(k) loan topic", () => {
    const result = searchAssistantTopics(
      libraryIndex(),
      "How do I take a loan from my 401k?",
    );

    expect(result.confident).toBe(true);
    expect(result.matches[0].topic.slug).toBe("401k-loans");
  });

  it("separates the loan repayment answer from the loan request", () => {
    const result = searchAssistantTopics(
      libraryIndex(),
      "How is my 401k loan repaid?",
    );

    expect(result.confident).toBe(true);
    expect(result.matches[0].topic.slug).toBe("loan-repayment");
  });

  it("finds COBRA from the acronym, even with filler words", () => {
    const result = searchAssistantTopics(
      libraryIndex(),
      "What does COBRA stand for?",
    );

    expect(result.confident).toBe(true);
    expect(result.matches[0].topic.slug).toBe("cobra");
  });

  it("finds the pay stub answer through its tag phrase", () => {
    const result = searchAssistantTopics(
      libraryIndex(),
      "Where do I see my pay stub?",
    );

    expect(result.confident).toBe(true);
    expect(result.matches[0].topic.slug).toBe("pay-stubs-direct-deposit");
  });

  it("expands PTO to the time-off answer", () => {
    const balances = searchAssistantTopics(
      libraryIndex(),
      "How much PTO do I have?",
    );
    expect(balances.confident).toBe(true);
    expect(balances.matches[0].topic.slug).toBe("time-off-leave");

    const policy = searchAssistantTopics(
      libraryIndex(),
      "What is the PTO policy?",
    );
    expect(policy.confident).toBe(true);
    expect(policy.matches[0].topic.slug).toBe("pto-policy");
  });

  it("returns nothing confident for gibberish", () => {
    const result = searchAssistantTopics(libraryIndex(), "zzzxcvbnm");

    expect(result.confident).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("does not answer a question the plan does not cover", () => {
    const result = searchAssistantTopics(
      libraryIndex(),
      "How do I file for unemployment?",
    );

    expect(result.confident).toBe(false);
  });
});

describe("assistant replies", () => {
  it("greets without searching", () => {
    const reply = respondToQuestion({
      question: "Hello!",
      index: libraryIndex(),
      plan: PLAN,
    });

    expect(reply.kind).toBe("smalltalk");
    expect(reply.links.map((link) => link.href)).toContain("/acme/retirement");
  });

  it("answers with the topic's copy, steps, CTA and deep link", () => {
    const index = buildAssistantCorpus({ placed: [placedLoan] });
    const reply = answerOf(
      respondToQuestion({
        question: "How do I take a loan?",
        index,
        plan: PLAN,
      }),
    );

    expect(reply.text).toContain("50%");
    expect(reply.steps).toHaveLength(3);
    expect(reply.links.map((link) => link.href)).toContain(
      "/acme/retirement#401k-loans",
    );
    expect(
      reply.links.find((link) => link.label === "Request a Loan")?.href,
    ).toBe(PLAN.loginUrl);
    expect(reply.note).toBeUndefined();
  });

  it("links the hub instead of a dead anchor when the plan never placed the topic", () => {
    const reply = answerOf(
      respondToQuestion({
        question: "How do I take a loan?",
        index: libraryIndex(),
        plan: PLAN,
      }),
    );

    expect(reply.links.map((link) => link.href)).toContain("/acme/retirement");
    expect(reply.links.some((link) => link.href.includes("#"))).toBe(false);
    expect(reply.note).toContain("not on your plan's page yet");
  });

  it("routes the login question to the plan's sign-in link", () => {
    const reply = respondToQuestion({
      question: "Where do I log in?",
      index: libraryIndex(),
      plan: PLAN,
    });

    expect(reply.kind).toBe("navigate");
    expect(reply.links[0].href).toBe(PLAN.loginUrl);
  });

  it("hands a request for a person to the advisor", () => {
    const reply = respondToQuestion({
      question: "I want to talk to someone",
      index: libraryIndex(),
      plan: PLAN,
    });

    expect(reply.kind).toBe("handoff");
    expect(reply.links.map((link) => link.href)).toContain(PLAN.appointmentUrl);
  });

  it("offers suggestions rather than inventing an answer", () => {
    const reply = respondToQuestion({
      question: "How do I file for unemployment?",
      index: libraryIndex(),
      plan: PLAN,
    });

    expect(reply.kind).toBe("suggest");
    if (reply.kind !== "suggest") throw new Error("unreachable");
    expect(reply.options.length).toBeGreaterThan(0);
  });

  it("sends a conversation CTA to the advisor, not the recordkeeper", () => {
    const reply = answerOf(
      respondToQuestion({
        question: "What does COBRA stand for?",
        index: libraryIndex(),
        plan: PLAN,
      }),
    );

    expect(
      reply.links.find((link) => link.label === "Talk Through My Options")?.href,
    ).toBe(PLAN.appointmentUrl);
    expect(reply.links.map((link) => link.href)).toContain(
      "/acme/health-insurance",
    );
  });
});

describe("assistant hubs", () => {
  it("lists only the hubs the plan publishes", () => {
    const hubs = buildAssistantHubs({
      clientId: "acme",
      benefitHubs: [
        { category: "Retirement", isEnabled: true },
        { category: "Group Health", isEnabled: false },
        { category: "Group Life", isEnabled: true },
        {
          category: "Company / Plan Sponsor",
          isEnabled: true,
          title: "Mindfulness & Me",
        },
      ],
      categoryPortalVisibility: {
        Retirement: true,
        "Group Health": true,
        "Group Life": false,
        Other: true,
      },
      employeeResourcesEnabled: true,
    });

    expect(hubs.map((hub) => hub.href)).toEqual([
      "/acme/retirement",
      "/acme/mindfulness-me",
      "/acme/employee-resources",
    ]);
  });

  it("keeps Employee Resources out unless the plan switched it on", () => {
    const hubs = buildAssistantHubs({
      clientId: "acme",
      benefitHubs: [{ category: "Retirement", isEnabled: true }],
      employeeResourcesEnabled: false,
    });

    expect(hubs.map((hub) => hub.location)).toEqual(["retirement"]);
  });

  it("falls back to every canonical hub in preview, with the legacy Custom segment", () => {
    const hubs = buildAssistantHubs({ clientId: "acme", benefitHubs: null });

    expect(hubs.map((hub) => hub.href)).toEqual([
      "/acme/retirement",
      "/acme/health-insurance",
      "/acme/life-insurance",
      "/acme/wellness-programs",
    ]);
  });

  it("returns nothing without a client id", () => {
    expect(buildAssistantHubs({ clientId: "" })).toEqual([]);
  });
});

describe("assistant starter questions", () => {
  it("uses the library's openers on a plan that places nothing", () => {
    const starters = assistantStarterQuestions(libraryIndex());

    expect(starters.map((starter) => starter.query)).toEqual([
      "Can I take a loan?",
      "COBRA",
      "Update My Beneficiary",
    ]);
  });

  it("leads with the plan's own placed topics", () => {
    const index = buildAssistantCorpus({ placed: [placedLoan] });
    const starters = assistantStarterQuestions(index);

    expect(starters[0]).toMatchObject({
      label: "Can I take a loan?",
      query: "Can I take a loan?",
      topicSlug: "401k-loans",
      location: "retirement",
    });
  });

  it("caps the list and never repeats a title", () => {
    const index = buildAssistantCorpus({
      placed: [
        placedLoan,
        { ...placedLoan, location: "retirement" },
      ],
    });

    expect(assistantStarterQuestions(index, 1)).toHaveLength(1);
    expect(assistantStarterQuestions(index, 3).length).toBeLessThanOrEqual(3);
  });
});

describe("assistant hub turns", () => {
  it("offers that hub's topics without a navigation link", () => {
    const reply = respondToHub({
      location: "retirement",
      index: libraryIndex(),
      plan: PLAN,
    });

    if (reply.kind !== "suggest") throw new Error("expected a suggestion reply");
    expect(reply.text).toContain("Retirement");
    expect(reply.options.length).toBeGreaterThan(0);
    expect(reply.links).toEqual([]);
  });

  it("leads with the plan's placed Featured topics", () => {
    const index = buildAssistantCorpus({
      placed: [{ ...placedLoan, displayMode: "featured" }],
    });
    const reply = respondToHub({ location: "retirement", index, plan: PLAN });

    if (reply.kind !== "suggest") throw new Error("expected a suggestion reply");
    expect(reply.options[0].label).toBe("Can I take a loan?");
    // The chip names its topic, so pressing it cannot drift to a same-title one.
    expect(reply.options[0]).toMatchObject({
      topicSlug: "401k-loans",
      location: "retirement",
    });
  });

  it("answers the exact topic a chip stands for", () => {
    const reply = respondToTopic({
      slug: "beneficiaries",
      location: "retirement",
      index: libraryIndex(),
      plan: PLAN,
    });

    if (reply.kind !== "answer") throw new Error("expected an answer reply");
    expect(reply.location).toBe("retirement");
    expect(reply.text).toContain("beneficiary designation");
  });

  it("offers Employee Resources topics from the library", () => {
    const reply = respondToHub({
      location: "employee_resources",
      index: buildAssistantCorpus({}),
      plan: PLAN,
    });

    if (reply.kind !== "suggest") throw new Error("expected a suggestion reply");
    expect(reply.text).toContain("Employee Resources");
    expect(reply.options.length).toBeGreaterThan(0);
  });
});

/**
 * The topic copy is written with `{{token}}` placeholders for per-plan values.
 * The hubs fill them; the assistant used to return the raw text, so asking
 * "what are the contribution limits?" printed `{{plan_year}}` and
 * `{{deferral_limit}}` in the chat. These tests pin the same substitution — in
 * the answer AND its steps.
 */
describe("assistant plan tokens", () => {
  const RETIREMENT_PLAN: AssistantPlan = {
    ...PLAN,
    companyName: "Acme Corp",
    advisorFirm: "Acme Advisors",
    recordkeeperName: "Empower Retirement",
  };

  it("fills the annual contribution figures instead of printing the tokens", () => {
    const reply = answerOf(
      respondToTopic({
        slug: "contribution-limits",
        location: "retirement",
        index: libraryIndex(),
        plan: RETIREMENT_PLAN,
      }),
    );

    expect(reply.text).not.toContain("{{");
    expect(reply.text).toContain(String(CONTRIBUTION_LIMITS_YEAR));
    expect(reply.text).toContain(ELECTIVE_DEFERRAL_LIMIT);
  });

  it("fills the recordkeeper URL inside the answer's steps", () => {
    const reply = answerOf(
      respondToTopic({
        slug: "change-contribution-rate",
        location: "retirement",
        index: libraryIndex(),
        plan: RETIREMENT_PLAN,
      }),
    );

    expect(reply.steps.length).toBeGreaterThan(0);
    expect(reply.steps.join(" ")).toContain(PLAN.loginUrl as string);
    expect(reply.steps.join(" ")).not.toContain("{{");
  });

  it("names the plan sponsor and provider the way the page does", () => {
    const reply = answerOf(
      respondToTopic({
        slug: "review-my-coverage",
        location: "group_life",
        index: libraryIndex(),
        plan: RETIREMENT_PLAN,
      }),
    );

    expect(reply.text).toContain("Acme Corp");
    expect(reply.text).not.toContain("{{");
    expect(reply.steps.join(" ")).toContain(PLAN.loginUrl as string);
  });

  it("uses the same plain-language fallbacks as the hub when values are missing", () => {
    const barePlan: AssistantPlan = {
      ...PLAN,
      loginUrl: null,
      advisorName: null,
      advisorFirm: null,
      companyName: null,
      recordkeeperName: null,
    };
    const reply = answerOf(
      respondToTopic({
        slug: "change-contribution-rate",
        location: "retirement",
        index: libraryIndex(),
        plan: barePlan,
      }),
    );

    expect(reply.steps[0]).toContain("your recordkeeper's website");
    expect(reply.steps.join(" ")).not.toContain("{{");
    expect(reply.text).not.toContain("{{");
  });
});
