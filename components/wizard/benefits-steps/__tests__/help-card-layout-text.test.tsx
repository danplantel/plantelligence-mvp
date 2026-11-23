import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpCardLayoutEditor } from "../help-card-layout-editor";
import {
  saveTopicText,
  useTopicBoard,
  type BoardPayload,
} from "../quick-answers-builder";
import { overridesFromTextValues } from "@/lib/topics/text-overrides";
import type { HelpCardContent, HelpCardLayoutEntry } from "@/types/benefit";
import type { TopicBodyBlock } from "@/types/topic";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

function featuredTopic(
  topicId: string,
  slug: string,
  title: string,
  bodyBlocks: TopicBodyBlock[] = [],
) {
  return {
    topicId,
    placementId: `p-${topicId}`,
    slug,
    location: "retirement" as const,
    displayMode: "featured" as const,
    title,
    bodyBlocks,
    tags: [] as string[],
    isActionHub: false,
    groupId: null as string | null,
    sortOrder: 0,
  };
}

function baseBoard(): BoardPayload {
  return {
    location: "retirement",
    featured: [
      featuredTopic("t-2", "sys.financial-planning", "Financial Planning", [
        { type: "quick_answer", text: "Plan your savings." },
        { type: "steps", steps: ["Set a goal", "Open an account"] },
      ]),
    ],
    groups: [],
    hidden: [],
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
  const patch = (entry: BoardPayload["featured"][number]) => {
    if (entry.topicId !== topicId) return entry;
    const next = { ...entry };
    if (typeof overrides.title === "string") next.title = overrides.title;
    if (typeof overrides.summary === "string") next.summary = overrides.summary;
    if (Array.isArray(overrides.bodyBlocks)) next.bodyBlocks = overrides.bodyBlocks;
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
        // A realistic round trip: the dialog must wait for this before it closes,
        // or reopening finds the cache still holding the old copy.
        await new Promise((resolve) => setTimeout(resolve, 300));
        return jsonResponse({ success: true, board: serverBoard, library: [] });
      }
      return jsonResponse({ board: serverBoard, library: [] });
    }),
  );
}

const catalog: HelpCardContent[] = [
  { id: "account-access", title: "Account Access", paragraphs: [], cta: "" },
  { id: "financial-planning", title: "Financial Planning", paragraphs: [], cta: "" },
];

const layout: HelpCardLayoutEntry[] = [
  { id: "account-access", primary: true },
  { id: "financial-planning" },
];

/** Mirrors the Employee Resources / Benefits panel wiring for the Card Layout. */
function Host() {
  const { data } = useTopicBoard("plan-layout-1", "retirement");
  const topics = data?.board?.featured;
  return (
    <HelpCardLayoutEditor
      value={layout}
      onChange={() => {}}
      catalog={catalog}
      showEnabledToggle={false}
      allowReorder={false}
      topics={topics}
      onSaveText={(topic, values) => {
        const overrides = overridesFromTextValues(topic, values);
        if (Object.keys(overrides).length === 0) return;
        return saveTopicText({
          planId: "plan-layout-1",
          location: "retirement",
          topicId: topic.topicId,
          overrides,
        });
      }}
    />
  );
}

function editButton() {
  const rowEl = document.querySelector<HTMLElement>(
    '[data-help-layout-card="financial-planning"]',
  );
  if (!rowEl) throw new Error("No financial-planning row");
  return within(rowEl).getByRole("button", { name: "Edit Topic" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Card Layout text editor — save then reopen", () => {
  it("reflects a saved step when the dialog is reopened", async () => {
    installServer();
    render(<Host />);

    await waitFor(() => expect(editButton()).toBeInTheDocument());
    fireEvent.click(editButton());

    const step1 = (await screen.findByLabelText("Step 1")) as HTMLInputElement;
    expect(step1.value).toBe("Set a goal");
    fireEvent.change(step1, { target: { value: "Set a SMART goal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByLabelText("Step 1")).not.toBeInTheDocument(),
    );

    // Reopen AT ONCE: the dialog should only close once the save has settled.
    fireEvent.click(editButton());
    const reopened = (await screen.findByLabelText("Step 1")) as HTMLInputElement;
    expect(reopened.value).toBe("Set a SMART goal");
  });
});
