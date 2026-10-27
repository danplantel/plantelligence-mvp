import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { QuickAnswersSection } from "../quick-answers-section";
import type { EffectiveTopic, TopicGroup } from "@/types/topic";

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
});

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
});
