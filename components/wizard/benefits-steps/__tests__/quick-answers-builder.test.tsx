import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAnswersBuilder, reorderFeaturedCards } from "../quick-answers-builder";
import type { BoardPayload } from "../quick-answers-builder";

const TITLES: Record<string, string> = {
  "t-1": "Contribution limits",
  "t-2": "Catch-up contributions",
  "t-9": "Social Security",
  "f-1": "Featured One",
  "f-2": "Featured Two",
  "f-3": "Featured Three",
  "f-4": "Featured Four",
  "f-5": "Featured Five",
  "f-6": "Featured Six",
  "f-7": "Featured Seven",
  "f-8": "Featured Eight",
  "f-9": "Featured Nine",
};

interface PendingPut {
  body: {
    location: string;
    groups: { id?: string; name: string; sortOrder: number }[];
    placements: {
      topicId: string;
      displayMode: "featured" | "quick_answers" | "hidden";
      groupId?: string | null;
      sortOrder: number;
    }[];
  };
  respond: (board: BoardPayload) => void;
}

/** The board the server would return after applying one PUT body. */
function boardFromBody(body: PendingPut["body"]): BoardPayload {
  const groups = body.groups
    .filter((group) => group.id)
    .map((group) => ({
      id: group.id as string,
      name: group.name,
      sortOrder: group.sortOrder,
      topics: [] as BoardPayload["hidden"],
    }));

  const topicOf = (placement: PendingPut["body"]["placements"][number]) => ({
    topicId: placement.topicId,
    placementId: `p-${placement.topicId}`,
    slug: `sys.${placement.topicId}`,
    location: "retirement" as const,
    displayMode: placement.displayMode,
    title: TITLES[placement.topicId] ?? placement.topicId,
    bodyBlocks: [],
    tags: [],
    isActionHub: false,
    groupId: placement.groupId ?? null,
    sortOrder: placement.sortOrder,
  });

  const featured: BoardPayload["featured"] = [];
  const hidden: BoardPayload["hidden"] = [];

  for (const placement of body.placements) {
    const topic = topicOf(placement);
    if (placement.displayMode === "featured") featured.push(topic);
    else if (placement.displayMode === "hidden") hidden.push(topic);
    else {
      const group = groups.find((entry) => entry.id === placement.groupId);
      if (group) group.topics.push(topic);
      else if (placement.groupId) hidden.push(topic);
      else {
        // A Quick Answer in no group is served under the board's virtual group.
        let ungrouped = groups.find((entry) => entry.id === "__ungrouped__");
        if (!ungrouped) {
          ungrouped = {
            id: "__ungrouped__",
            name: "Questions",
            sortOrder: 0,
            topics: [],
          };
          groups.push(ungrouped);
        }
        ungrouped.topics.push(topic);
      }
    }
  }

  return { location: "retirement", featured, groups, hidden, featuredCap: 12 };
}

function hiddenTopic(topicId: string, sortOrder: number) {
  return {
    topicId,
    placementId: `p-${topicId}`,
    slug: `sys.${topicId}`,
    location: "retirement" as const,
    displayMode: "hidden" as const,
    title: TITLES[topicId],
    bodyBlocks: [],
    tags: [],
    isActionHub: false,
    groupId: null,
    sortOrder,
  };
}

function featuredTopic(topicId: string, sortOrder: number) {
  return { ...hiddenTopic(topicId, sortOrder), displayMode: "featured" as const };
}

const INITIAL_BOARD: BoardPayload = {
  location: "retirement",
  featured: [],
  groups: [
    { id: "g-1", name: "Saving & Contributions", sortOrder: 0, topics: [] },
  ],
  hidden: [hiddenTopic("t-1", 0), hiddenTopic("t-2", 1)],
  featuredCap: 12,
};

function boardWithFeatured(count: number): BoardPayload {
  return {
    location: "retirement",
    featured: Array.from({ length: count }, (_, index) =>
      featuredTopic(`f-${index + 1}`, index),
    ),
    groups: [
      { id: "g-1", name: "Saving & Contributions", sortOrder: 0, topics: [] },
    ],
    hidden: [hiddenTopic("t-9", 0)],
    featuredCap: 12,
  };
}

/** Eight Featured cards: the page's nine tiles (Account Access + eight). */
const FULL_BOARD = boardWithFeatured(8);

/** One short of the limit, so a promotion still fits. */
const SEVEN_BOARD = boardWithFeatured(7);

/** A plan that somehow already carries one card too many. */
const OVERFULL_BOARD = boardWithFeatured(9);

/** One card that remembers the section it was promoted out of. */
const REMEMBERED_GROUP_BOARD: BoardPayload = {
  location: "retirement",
  featured: [{ ...featuredTopic("f-1", 0), groupId: "g-1" }],
  groups: [
    { id: "g-1", name: "Saving & Contributions", sortOrder: 0, topics: [] },
  ],
  hidden: [hiddenTopic("t-1", 0)],
  featuredCap: 12,
};

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

let pending: PendingPut[] = [];

function installFetch(board: BoardPayload = INITIAL_BOARD) {
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== "PUT") {
        return jsonResponse({ board, library: [] });
      }
      const body = JSON.parse(String(init.body)) as PendingPut["body"];
      return new Promise<Response>((resolve) => {
        pending.push({
          body,
          respond: (board) => resolve(jsonResponse({ board, library: [] })),
        });
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Assigning a hidden topic to a section must stick.
 *
 * Each save sends the WHOLE board, so two quick moves used to race: whichever
 * response landed last won, and the older board put the first topic back into
 * "Hidden from participants". Saves are now serialized and the newest snapshot
 * is the only one applied.
 */
describe("QuickAnswersBuilder — hidden topics", () => {
  it("keeps a restored topic in its section when two moves happen quickly", async () => {
    installFetch();
    const onBoardChange = vi.fn();

    render(
      <QuickAnswersBuilder
        planId="plan-1"
        location="retirement"
        onBoardChange={onBoardChange}
      />,
    );

    const firstSelect = await screen.findByLabelText("Restore Contribution limits");
    fireEvent.change(firstSelect, { target: { value: "g-1" } });

    // The portal page renders the questions from the BENEFIT payload, so the
    // builder hands it the new board before the request settles.
    expect(onBoardChange).toHaveBeenCalled();
    const firstBoard = onBoardChange.mock.calls.at(-1)?.[0] as BoardPayload;
    expect(firstBoard.hidden.map((topic) => topic.topicId)).toEqual(["t-2"]);
    expect(firstBoard.groups[0].topics.map((topic) => topic.topicId)).toEqual([
      "t-1",
    ]);

    // OPTIMISTIC: the row is in its section before the request even settles.
    const optimisticGroup = await screen.findByTestId("quick-answers-group");
    await waitFor(() =>
      expect(
        within(optimisticGroup).getByText("Contribution limits"),
      ).toBeInTheDocument(),
    );

    await waitFor(() => expect(pending).toHaveLength(1));

    // A second move while the first save is still in flight. It must NOT reach
    // the server yet: the saves are queued in the order the advisor made them.
    fireEvent.change(screen.getByLabelText("Restore Catch-up contributions"), {
      target: { value: "g-1" },
    });
    expect(pending).toHaveLength(1);

    // The first response is now stale (a newer board supersedes it) and is
    // ignored; the queued save goes out with both topics in the group.
    pending[0].respond(boardFromBody(pending[0].body));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(
      pending[1].body.placements.filter(
        (placement) => placement.displayMode === "quick_answers",
      ),
    ).toHaveLength(2);

    pending[1].respond(boardFromBody(pending[1].body));

    // Both topics end up in the section, and nothing is left hidden.
    const group = await screen.findByTestId("quick-answers-group");
    await waitFor(() =>
      expect(within(group).getAllByRole("combobox")).toHaveLength(2),
    );
    expect(within(group).getByText("Contribution limits")).toBeInTheDocument();
    expect(
      within(group).getByText("Catch-up contributions"),
    ).toBeInTheDocument();
    // The hidden list is empty in the draft. (Its last row may still be on screen
    // for the length of its exit animation, which is the animation we want.)
    expect(screen.getByText(/Nothing is hidden/i)).toBeInTheDocument();
  });
});

/**
 * The page holds NINE cards: the Account Access card's primary row, then two rows
 * of four — so eight Featured questions fill it. Promoting a question into a full
 * grid is a trade-off, so the builder stops and asks which card gives way, and
 * writes nothing until the advisor answers.
 */
describe("QuickAnswersBuilder — Featured is full", () => {
  it("asks which card to demote instead of promoting a ninth", async () => {
    installFetch(FULL_BOARD);
    const onBoardChange = vi.fn();

    // A distinct plan id gives this case its own SWR key: the builder reads one
    // board key per plan, and the earlier suite already populated `plan-1`'s.
    render(
      <QuickAnswersBuilder
        planId="plan-ninth"
        location="retirement"
        onBoardChange={onBoardChange}
      />,
    );

    fireEvent.change(await screen.findByLabelText("Restore Social Security"), {
      target: { value: "featured" },
    });

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Featured is full");
    // The portal's Editing Panel is `fixed z-[51]`, above the app's dialog tier,
    // so the dialog AND its scrim have to be raised past it (and past the chat
    // pill at z-[60] / the published pop-up at z-[100]) or it opens underneath.
    expect(dialog.className).toContain("z-[110]");
    expect(document.querySelectorAll('[class*="z-[110]"]')).toHaveLength(2);
    // It names the card waiting to come in, and every card that could give way.
    expect(dialog).toHaveTextContent("Social Security");
    expect(
      within(dialog).getByRole("button", {
        name: "Move Featured One to Quick Answers",
      }),
    ).toBeInTheDocument();
    // Nothing was saved and the page beside the panel is untouched.
    expect(pending).toHaveLength(0);
    expect(onBoardChange).not.toHaveBeenCalled();

    // Cancel closes it and leaves the question where it was.
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pending).toHaveLength(0);
    expect(screen.getByLabelText("Restore Social Security")).toHaveValue(
      "hidden",
    );
  });

  it("sends one board write when a featured card gives way", async () => {
    installFetch(FULL_BOARD);

    render(<QuickAnswersBuilder planId="plan-swap" location="retirement" />);

    fireEvent.change(await screen.findByLabelText("Restore Social Security"), {
      target: { value: "featured" },
    });

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Move Featured One to Quick Answers",
      }),
    );

    // ONE write, and the grid still holds exactly eight Featured cards.
    await waitFor(() => expect(pending).toHaveLength(1));
    const { placements } = pending[0].body;
    const featuredIds = placements
      .filter((placement) => placement.displayMode === "featured")
      .map((placement) => placement.topicId);
    expect(featuredIds).toHaveLength(8);
    expect(featuredIds).toContain("t-9");
    expect(featuredIds).not.toContain("f-1");

    // The card that gave way becomes a Quick Answer in a real section — never
    // "Questions (ungrouped)", which reads as a stray group on the page.
    const demoted = placements.find((placement) => placement.topicId === "f-1");
    expect(demoted?.displayMode).toBe("quick_answers");
    expect(demoted?.groupId).toBe("g-1");

    pending[0].respond(boardFromBody(pending[0].body));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The grid swapped: the promoted card is Featured, the one that gave way is a
    // Quick Answer (its row now carries the group select, not a demote button).
    expect(await screen.findByText("Social Security")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Move Featured One"),
    ).toBeInTheDocument();
  });

  it("promotes straight away while a card still fits", async () => {
    installFetch(SEVEN_BOARD);

    render(<QuickAnswersBuilder planId="plan-eighth" location="retirement" />);

    fireEvent.change(await screen.findByLabelText("Restore Social Security"), {
      target: { value: "featured" },
    });

    // Seven featured + this one is the eighth: no dialog, no trade-off.
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      pending[0].body.placements.filter(
        (placement) => placement.displayMode === "featured",
      ),
    ).toHaveLength(8);
  });

  it("brings a plan that is already over the limit back to eight", async () => {
    installFetch(OVERFULL_BOARD);

    render(<QuickAnswersBuilder planId="plan-overfull" location="retirement" />);

    fireEvent.change(await screen.findByLabelText("Restore Social Security"), {
      target: { value: "featured" },
    });

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Move Featured One to Quick Answers",
      }),
    );

    await waitFor(() => expect(pending).toHaveLength(1));
    const { placements } = pending[0].body;
    expect(
      placements.filter((placement) => placement.displayMode === "featured"),
    ).toHaveLength(8);
    // The extra card is a Quick Answer, not dropped from the plan.
    expect(
      placements.filter((placement) => placement.displayMode === "quick_answers")
        .length,
    ).toBe(2);
  });
});

/**
 * A card that was promoted OUT of a section still belongs to it. Demoting it has to
 * return it there — the alternative is an "ungrouped" question that the drawer then
 * offers again under "Add from the library".
 */
describe("QuickAnswersBuilder — demoting a card", () => {
  it("asks for a section and puts the card in the one chosen", async () => {
    installFetch(REMEMBERED_GROUP_BOARD);

    render(<QuickAnswersBuilder planId="plan-remember" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Move to Quick Answers" }),
    );

    // A question belongs to a section, so nothing is written until one is named.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Choose a section");
    expect(pending).toHaveLength(0);

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Saving & Contributions/ }),
    );

    await waitFor(() => expect(pending).toHaveLength(1));
    const demoted = pending[0].body.placements.find(
      (placement) => placement.topicId === "f-1",
    );
    expect(demoted?.displayMode).toBe("quick_answers");
    expect(demoted?.groupId).toBe("g-1");
    // It is in the group, so nothing is left floating in "Questions".
    expect(
      pending[0].body.placements.filter(
        (placement) =>
          placement.displayMode === "quick_answers" && !placement.groupId,
      ),
    ).toHaveLength(0);

    pending[0].respond(boardFromBody(pending[0].body));
    // The row lands inside the group card, not in a separate ungrouped list.
    const group = await screen.findByTestId("quick-answers-group");
    expect(within(group).getByText("Featured One")).toBeInTheDocument();
  });

  it("leaves the card Featured when the section is not chosen", async () => {
    installFetch(REMEMBERED_GROUP_BOARD);

    render(<QuickAnswersBuilder planId="plan-cancel-demote" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Move to Quick Answers" }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pending).toHaveLength(0);
    // The card is still on the grid, still offering the demote action.
    expect(
      screen.getByRole("button", { name: "Move to Quick Answers" }),
    ).toBeInTheDocument();
  });
});

/**
 * The Featured list is a read-out: which cards are Featured and in what order is
 * arranged in Section 6's Card Layout, so the only action left on a row is sending
 * it back down.
 */
describe("QuickAnswersBuilder — Featured cards list", () => {
  it("labels the list and leaves only the demote action", async () => {
    installFetch(FULL_BOARD);

    render(<QuickAnswersBuilder planId="plan-featured" location="retirement" />);

    await screen.findByText("Featured Cards");
    // No reordering here any more.
    expect(
      screen.queryByRole("button", { name: "Move Featured One up" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Move Featured One down" }),
    ).toBeNull();
    // The one action that stays.
    expect(
      screen.getAllByRole("button", { name: "Move to Quick Answers" }),
    ).toHaveLength(8);
  });

  it("writes a new Featured order to the board", async () => {
    installFetch(FULL_BOARD);

    const orderedTopicIds = [
      "f-3",
      "f-1",
      "f-2",
      "f-4",
      "f-5",
      "f-6",
      "f-7",
      "f-8",
    ];
    const done = reorderFeaturedCards({
      planId: "plan-order",
      location: "retirement",
      board: FULL_BOARD,
      orderedTopicIds,
    });

    await waitFor(() => expect(pending).toHaveLength(1));
    const featuredIds = pending[0].body.placements
      .filter((placement) => placement.displayMode === "featured")
      .map((placement) => placement.topicId);
    expect(featuredIds.slice(0, 3)).toEqual(["f-3", "f-1", "f-2"]);
    // Every featured card is still there — a reorder never drops one.
    expect(featuredIds).toHaveLength(8);

    pending[0].respond({ ...FULL_BOARD, featured: [] });
    await done;
  });
});
