import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAnswersBuilder } from "../quick-answers-builder";
import type { BoardPayload } from "../quick-answers-builder";
import type { TopicBodyBlock } from "@/types/topic";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

function topic(
  topicId: string,
  title: string,
  sortOrder: number,
  bodyBlocks: TopicBodyBlock[] = [],
) {
  return {
    topicId,
    placementId: `p-${topicId}`,
    slug: `sys.${topicId}`,
    location: "retirement" as const,
    displayMode: "hidden" as const,
    title,
    bodyBlocks,
    tags: [] as string[],
    isActionHub: false,
    groupId: null as string | null,
    sortOrder,
  };
}

function baseBoard(): BoardPayload {
  return {
    location: "retirement",
    featured: [],
    groups: [],
    hidden: [
      topic("t-1", "Contribution limits", 0),
      topic("t-2", "Financial Planning", 1, [
        { type: "quick_answer", text: "Plan your savings." },
        { type: "steps", steps: ["Set a goal", "Open an account", "Automate it"] },
      ]),
    ],
    featuredCap: 12,
  };
}

interface Overrides {
  title?: string | null;
  summary?: string | null;
  bodyBlocks?: TopicBodyBlock[] | null;
}

function applyOverrides(
  board: BoardPayload,
  topicId: string,
  overrides: Overrides,
): BoardPayload {
  const patch = (entry: BoardPayload["hidden"][number]) => {
    if (entry.topicId !== topicId) return entry;
    const next = { ...entry };
    if (typeof overrides.title === "string") next.title = overrides.title;
    if (typeof overrides.summary === "string") next.summary = overrides.summary;
    if (Array.isArray(overrides.bodyBlocks)) {
      next.bodyBlocks = overrides.bodyBlocks;
    }
    return next;
  };
  return {
    ...board,
    featured: board.featured.map(patch),
    hidden: board.hidden.map(patch),
    groups: board.groups.map((group) => ({
      ...group,
      topics: group.topics.map(patch),
    })),
  };
}

function installServer() {
  let serverBoard = baseBoard();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as {
          topicId: string;
          overrides: Overrides;
        };
        serverBoard = applyOverrides(serverBoard, body.topicId, body.overrides);
        return jsonResponse({ success: true, board: serverBoard, library: [] });
      }
      return jsonResponse({ board: serverBoard, library: [] });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TopicTextEditDialog — save then reopen", () => {
  it("reflects a saved title when the dialog is reopened", async () => {
    installServer();
    render(<QuickAnswersBuilder planId="plan-text-1" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit text for Contribution limits",
      }),
    );

    const titleInput = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(titleInput.value).toBe("Contribution limits");
    fireEvent.change(titleInput, { target: { value: "New contribution limits" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Edit text for New contribution limits",
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit text for New contribution limits",
      }),
    );
    const reopened = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(reopened.value).toBe("New contribution limits");
  });

  it("reflects a saved step when the dialog is reopened", async () => {
    installServer();
    render(<QuickAnswersBuilder planId="plan-text-2" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit text for Financial Planning",
      }),
    );

    const step1 = (await screen.findByLabelText("Step 1")) as HTMLInputElement;
    expect(step1.value).toBe("Set a goal");
    fireEvent.change(step1, { target: { value: "Set a SMART goal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByLabelText("Step 1")).not.toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit text for Financial Planning" }),
    );
    const reopened = (await screen.findByLabelText("Step 1")) as HTMLInputElement;
    expect(reopened.value).toBe("Set a SMART goal");
  });
});
