import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAnswersSection } from "../quick-answers-section";
import { QUICK_ANSWERS_SECTION_ID } from "@/lib/portal-section-anchors";
import type {
  ActionHubRow,
  EffectiveTopic,
  TopicGroup,
} from "@/types/topic";

/**
 * "Get Quick Answers" (TF-2).
 *
 * Two contracts matter here and nothing else does:
 *
 *  - the questions are GROUPED, and search narrows the groups without ever emptying
 *    the section into a header with nothing under it;
 *  - ONE answer is open at a time, because the handoff's trade-off is explicit: a
 *    participant reads one answer and acts.
 */

function topic(overrides: Partial<EffectiveTopic> = {}): EffectiveTopic {
  return {
    topicId: "topic-1",
    placementId: "placement-1",
    slug: "sys.401k-loans",
    location: "retirement",
    displayMode: "quick_answers",
    title: "401(k) loans",
    summary: "Borrow from your own balance.",
    bodyBlocks: [{ type: "quick_answer", text: "You borrow and repay by payroll." }],
    tags: ["loan"],
    isActionHub: false,
    groupId: "group-1",
    sortOrder: 0,
    ...overrides,
  };
}

function group(overrides: Partial<TopicGroup> = {}): TopicGroup {
  return {
    id: "group-1",
    name: "Taking Money Out",
    sortOrder: 0,
    topics: [topic()],
    ...overrides,
  };
}

afterEach(() => {
  // The section reads the hash on mount, so each test starts from a clean URL.
  window.history.replaceState(null, "", "/acme/retirement");
  // `matchMedia` is stubbed per test to choose the phone layout.
  vi.unstubAllGlobals();
});

/**
 * Pretend the viewport is a phone. The section reads `matchMedia` to decide
 * between the in-place accordion (`md`+) and the full-screen answer sheet.
 */
function setPhoneViewport(phone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: phone && /max-width:\s*767px/.test(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

describe("QuickAnswersSection", () => {
  it("renders the section heading, its groups and their questions", () => {
    render(<QuickAnswersSection groups={[group()]} />);

    expect(
      screen.getByRole("heading", {
        name: "Get Quick Answers to Common Benefits Questions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Taking Money Out")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /401\(k\) loans/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing at all when the location has no questions", () => {
    const { container } = render(<QuickAnswersSection groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("claims its frame while the hub is still loading its placements", () => {
    const { container } = render(<QuickAnswersSection groups={[]} loading />);

    const skeleton = screen.getByTestId("quick-answers-skeleton");
    expect(skeleton).toBeInTheDocument();
    // The anchor that links ("Related Quick Answers", the chatbot, the header) target
    // must exist on the first paint, not seconds later.
    expect(skeleton).toHaveAttribute("id", QUICK_ANSWERS_SECTION_ID);
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    // The two-column rhythm is drawn as bars, and announced ONCE as a status.
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    // Nothing to answer yet: no search field and no question bars.
    expect(screen.queryByTestId("quick-answers-search")).toBeNull();
    expect(screen.queryAllByTestId("quick-answer-question")).toHaveLength(0);
  });

  it("keeps the real heading in the skeleton so the answers cannot shift the page", () => {
    render(<QuickAnswersSection groups={[]} loading />);

    expect(
      screen.getByRole("heading", {
        name: "Get Quick Answers to Common Benefits Questions",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/grouped and searchable/i),
    ).toBeInTheDocument();
  });

  it("never flashes the skeleton over answers already on screen", () => {
    render(<QuickAnswersSection groups={[group()]} loading />);

    expect(screen.queryByTestId("quick-answers-skeleton")).toBeNull();
    expect(screen.getByText("Taking Money Out")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /401\(k\) loans/i }),
    ).toBeInTheDocument();
  });

  it("opens one answer at a time and closes it on a second press", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic(),
              topic({
                topicId: "topic-2",
                placementId: "placement-2",
                slug: "sys.hardship-withdrawals",
                title: "Hardship withdrawals",
                bodyBlocks: [
                  { type: "quick_answer", text: "For an immediate heavy need." },
                ],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /401\(k\) loans/i }));
    expect(
      screen.getByText("You borrow and repay by payroll."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /hardship withdrawals/i }),
    );
    expect(
      screen.getByText("For an immediate heavy need."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("You borrow and repay by payroll."),
    ).not.toBeInTheDocument();

    // Pressing the open question again collapses it.
    await user.click(
      screen.getByRole("button", { name: /hardship withdrawals/i }),
    );
    expect(
      screen.queryByText("For an immediate heavy need."),
    ).not.toBeInTheDocument();
  });

  it("renders steps as an ordered list", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "Before you roll over",
                bodyBlocks: [
                  { type: "quick_answer", text: "Ask for a direct rollover." },
                  { type: "steps", steps: ["Call the recordkeeper", "Open the IRA"] },
                ],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /before you roll over/i }),
    );

    const steps = screen.getAllByRole("listitem");
    expect(steps.map((item) => item.textContent)).toEqual([
      "Call the recordkeeper",
      "Open the IRA",
    ]);
  });

  it("makes a website named in the answer clickable", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "Social Security",
                bodyBlocks: [
                  {
                    type: "quick_answer",
                    text: "You can see your personal estimate at ssa.gov/myaccount.",
                  },
                ],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /social security/i }));

    const link = screen.getByRole("link", { name: "ssa.gov/myaccount" });
    expect(link).toHaveAttribute("href", "https://ssa.gov/myaccount");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("makes the recordkeeper address in a step clickable", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "Enroll",
                bodyBlocks: [
                  { type: "steps", steps: ["Log in at {{recordkeeper_url}}.", "Save"] },
                ],
              }),
            ],
          }),
        ]}
        recordkeeperUrl="portal.example.com"
      />,
    );

    await user.click(screen.getByRole("button", { name: /enroll/i }));

    const link = screen.getByRole("link", {
      name: "https://portal.example.com",
    });
    expect(link).toHaveAttribute("href", "https://portal.example.com");
  });

  it("draws the placement CTA as a link to its destination", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                cta: {
                  label: "Talk through my options",
                  actionType: "external_url",
                  destination: "https://example.com/schedule",
                },
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /401\(k\) loans/i }));

    const cta = screen.getByRole("link", { name: /talk through my options/i });
    expect(cta).toHaveAttribute("href", "https://example.com/schedule");
    expect(cta).toHaveAttribute("target", "_blank");
  });

  it("filters by question text and hides groups that lose every question", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group(),
          group({
            id: "group-2",
            name: "Investing",
            sortOrder: 1,
            topics: [
              topic({
                topicId: "topic-3",
                placementId: "placement-3",
                slug: "sys.target-date-funds",
                title: "Target date funds",
                bodyBlocks: [{ type: "quick_answer", text: "They rebalance for you." }],
                groupId: "group-2",
                // No tag overlap with the "loan" search, or this assertion would be
                // testing the tag match instead of the title filter.
                tags: [],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.type(screen.getByTestId("quick-answers-search"), "loan");

    expect(
      screen.getByRole("button", { name: /401\(k\) loans/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /target date funds/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Investing")).not.toBeInTheDocument();
    expect(screen.getByText("1 answer")).toBeInTheDocument();
  });

  it("keeps a whole group when the search matches its name", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({ title: "Alpha", bodyBlocks: [{ type: "quick_answer", text: "A." }] }),
              topic({
                topicId: "topic-2",
                placementId: "placement-2",
                slug: "sys.beta",
                title: "Beta",
                bodyBlocks: [{ type: "quick_answer", text: "B." }],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.type(screen.getByTestId("quick-answers-search"), "taking money");

    expect(screen.getByRole("button", { name: /alpha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beta/i })).toBeInTheDocument();
  });

  it("says so when nothing matches, without dropping the search box", async () => {
    const user = userEvent.setup();
    render(<QuickAnswersSection groups={[group()]} />);

    await user.type(
      screen.getByTestId("quick-answers-search"),
      "zzzz-not-a-topic",
    );

    expect(screen.getByText("No answers match that search.")).toBeInTheDocument();
    expect(screen.getByTestId("quick-answers-search")).toBeInTheDocument();
  });

  it("opens the answer named in the URL hash", async () => {
    window.history.replaceState(
      null,
      "",
      "/acme/retirement#401k-loans",
    );

    render(<QuickAnswersSection groups={[group()]} />);

    expect(
      await screen.findByText("You borrow and repay by payroll."),
    ).toBeInTheDocument();
  });

  it("writes the open answer back to the URL, and clears it on close", async () => {
    const user = userEvent.setup();
    render(<QuickAnswersSection groups={[group()]} />);

    const question = screen.getByRole("button", { name: /401\(k\) loans/i });
    await user.click(question);
    expect(window.location.hash).toBe("#401k-loans");

    await user.click(question);
    expect(window.location.hash).toBe("");
  });

  it("marks an Action Hub question so the reader knows it spans benefits", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "Update my beneficiaries",
                isActionHub: true,
                bodyBlocks: [{ type: "quick_answer", text: "Update each plan." }],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /update my beneficiaries/i }),
    );

    const card = screen.getByRole("button", {
      name: /update my beneficiaries/i,
    }).parentElement as HTMLElement;
    expect(
      within(card).getByText("Applies to more than one benefit"),
    ).toBeInTheDocument();
  });

  it("sends a destination-less CTA to the advisor's booking link", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "How much should I be saving?",
                cta: { label: "Book a Meeting", actionType: "external_url" },
                bodyBlocks: [
                  {
                    type: "quick_answer",
                    text: "Aim for 10% to 15% of pay.",
                  },
                ],
              }),
            ],
          }),
        ]}
        advisorBookingUrl="https://book.test/jane"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /how much should i be saving/i }),
    );

    const cta = screen.getByRole("link", { name: "Book a Meeting" });
    expect(cta).toHaveAttribute("href", "https://book.test/jane");
    expect(cta).toHaveAttribute("target", "_blank");
  });

  it("fills the recordkeeper token and sends a recordkeeper CTA to the login URL", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "How do I change my contribution rate?",
                bodyBlocks: [
                  {
                    type: "quick_answer",
                    text: "Log in and enter a new percentage.",
                  },
                  {
                    type: "steps",
                    steps: [
                      "Log in at {{recordkeeper_url}}.",
                      "Select Contributions or Deferral Rate.",
                      "Enter your new percentage and save.",
                    ],
                  },
                ],
                cta: {
                  label: "Change My Contribution",
                  actionType: "external_url",
                  target: "recordkeeper",
                },
              }),
            ],
          }),
        ]}
        recordkeeperUrl="google.com"
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /how do i change my contribution rate/i,
      }),
    );

    // A bare host is normalised, not treated as a plan-relative path — and the
    // address in the step is now an anchor, so the sentence is text + link + ".".
    expect(
      screen.getByRole("link", { name: "https://google.com" }),
    ).toHaveAttribute("href", "https://google.com");
    expect(
      screen.getByRole("link", { name: "Change My Contribution" }),
    ).toHaveAttribute("href", "https://google.com");
  });

  it("fills the annual contribution-limit figures", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "Contribution limits",
                bodyBlocks: [
                  {
                    type: "quick_answer",
                    text: "For {{plan_year}}, you can contribute up to {{deferral_limit}} from your paycheck.",
                  },
                ],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Contribution limits" }),
    );

    expect(
      screen.getByText(
        "For 2026, you can contribute up to $24,500 from your paycheck.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the answer's video block and hands the advisor CTA to the booking link", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "Roth vs. Pre-Tax",
                bodyBlocks: [
                  {
                    type: "quick_answer",
                    text: "Pre-tax lowers your taxable income now.",
                  },
                  { type: "video", videoId: "Roth vs. Pre-Tax" },
                ],
                cta: {
                  label: "Talk to an Advisor",
                  actionType: "external_url",
                  target: "advisor",
                },
              }),
            ],
          }),
        ]}
        advisorBookingUrl="https://book.test/jane"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Roth vs. Pre-Tax" }));

    expect(
      within(screen.getByTestId("quick-answer-resources")).getByText(
        "Roth vs. Pre-Tax",
        { selector: "span" },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Talk to an Advisor" }),
    ).toHaveAttribute("href", "https://book.test/jane");
  });

  it("falls back to the contact band when no booking link exists", async () => {
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                title: "How much should I be saving?",
                cta: { label: "Book a Meeting", actionType: "external_url" },
                bodyBlocks: [
                  {
                    type: "quick_answer",
                    text: "Aim for 10% to 15% of pay.",
                  },
                ],
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /how much should i be saving/i }),
    );

    expect(
      screen.getByRole("link", { name: "Book a Meeting" }),
    ).toHaveAttribute("href", "#have-questions");
  });
});

/**
 * The PHONE view. Below `md` the questions are not accordions: the caret is
 * hidden, tapping one slides a full-screen answer up, and the answer's CTA
 * joins a pinned Close bar at the bottom.
 */
describe("QuickAnswersSection phone answer sheet", () => {
  it("hides the accordion caret, because the phone opens a sheet instead", () => {
    setPhoneViewport(true);
    const { container } = render(<QuickAnswersSection groups={[group()]} />);

    const caret = container.querySelector(
      '[data-testid="quick-answer-question"] svg',
    );
    expect(caret?.getAttribute("class") ?? "").toContain("hidden");
    // It comes back where the answer really folds in place.
    expect(caret?.getAttribute("class") ?? "").toContain("md:block");
  });

  it("slides the answer up with a pinned Close and CTA bar", async () => {
    setPhoneViewport(true);
    const user = userEvent.setup();
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                cta: {
                  label: "Talk through my options",
                  actionType: "external_url",
                  destination: "https://example.com/schedule",
                },
              }),
            ],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /401\(k\) loans/i }));

    const sheet = screen.getByTestId("quick-answer-fullscreen");
    expect(sheet).toHaveAttribute("role", "dialog");
    expect(sheet.className).toContain("md:hidden");
    // The sheet arrives from the bottom edge (framer's `initial={{ y: "100%" }}`).
    expect(sheet.style.transform).toContain("translateY");

    const bar = screen.getByTestId("quick-answer-mobile-actions");
    const close = within(bar).getByRole("button", { name: "Close the answer" });
    const cta = within(bar).getByRole("link", {
      name: "Talk through my options",
    });
    expect(cta).toHaveAttribute("href", "https://example.com/schedule");
    expect(cta).toHaveAttribute("target", "_blank");

    // Both buttons are full-width single-line controls, and the bar sits 28px
    // above the viewport edge (16px higher than before) plus the safe area.
    expect(cta.className).toContain("whitespace-nowrap");
    expect(cta.className).toContain("w-full");
    expect(close.className).toContain("whitespace-nowrap");
    expect(close.className).toContain("w-full");
    expect(bar.className).toContain("1.75rem");

    // The bar is the CTA's only home in the sheet, so it is never duplicated.
    expect(
      screen.getAllByRole("link", { name: "Talk through my options" }),
    ).toHaveLength(1);

    await user.click(close);
    // The close slides back down (`exit={{ y: "100%" }}` inside
    // `AnimatePresence`) and then unmounts. The animation itself is jsdom-timed,
    // so only the end state is asserted.
    await waitFor(() =>
      expect(
        screen.queryByTestId("quick-answer-fullscreen"),
      ).not.toBeInTheDocument(),
    );
  });

  it("leaves an Action Hub's choice as the only call to action", async () => {
    setPhoneViewport(true);
    const user = userEvent.setup();
    const rows: ActionHubRow[] = [
      {
        location: "retirement",
        label: "Retirement plan",
        href: "https://example.com/retire",
        external: true,
        source: "placement",
      },
    ];
    render(
      <QuickAnswersSection
        groups={[
          group({
            topics: [
              topic({
                isActionHub: true,
                cta: {
                  label: "Update everything",
                  actionType: "external_url",
                },
              }),
            ],
          }),
        ]}
        actionHubPanels={{ "sys.401k-loans": rows }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /401\(k\) loans/i }));

    const bar = screen.getByTestId("quick-answer-mobile-actions");
    expect(
      within(bar).getByRole("button", { name: "Close the answer" }),
    ).toBeInTheDocument();
    // The hub's own panel is the choice; the generic CTA is not repeated here.
    expect(
      within(bar).queryByTestId("quick-answer-mobile-cta"),
    ).not.toBeInTheDocument();
  });
});
