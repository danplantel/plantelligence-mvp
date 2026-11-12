import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAnswersBuilder } from "../quick-answers-builder";
import type { BoardPayload } from "../quick-answers-builder";

const TITLES: Record<string, string> = {
  "t-1": "Contribution limits",
  "t-2": "Catch-up contributions",
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
      (group ? group.topics : hidden).push(topic);
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

const INITIAL_BOARD: BoardPayload = {
  location: "retirement",
  featured: [],
  groups: [
    { id: "g-1", name: "Saving & Contributions", sortOrder: 0, topics: [] },
  ],
  hidden: [hiddenTopic("t-1", 0), hiddenTopic("t-2", 1)],
  featuredCap: 12,
};

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

let pending: PendingPut[] = [];

function installFetch() {
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== "PUT") {
        return jsonResponse({ board: INITIAL_BOARD, library: [] });
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
