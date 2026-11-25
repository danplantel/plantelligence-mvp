import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAnswersBuilder } from "../quick-answers-builder";
import type { BoardPayload } from "../quick-answers-builder";
import type { PlanMediaLibrary, TopicBodyBlock } from "@/types/topic";
import {
  MAX_TOPIC_ANSWER_LENGTH,
  MAX_TOPIC_STEP_LENGTH,
  MAX_TOPIC_SUMMARY_LENGTH,
  MAX_TOPIC_TITLE_LENGTH,
} from "@/lib/topics/text-overrides";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// The upload itself is a separate pipeline (presign → R2 → document row); this
// suite is about what the dialog does with the result.
const mocks = vi.hoisted(() => ({
  uploadTopicDocument: vi.fn(async () => ({
    title: "Loan request form",
    url: "/api/documents/doc-9/view",
  })),
}));

vi.mock("@/lib/topics/upload-topic-document", () => ({
  uploadTopicDocument: mocks.uploadTopicDocument,
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

function installServer(
  media?: PlanMediaLibrary,
  initialBoard?: BoardPayload,
) {
  let serverBoard = initialBoard ?? baseBoard();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as {
          topicId: string;
          overrides: Overrides;
        };
        serverBoard = applyOverrides(serverBoard, body.topicId, body.overrides);
        return jsonResponse({
          success: true,
          board: serverBoard,
          library: [],
          media,
        });
      }
      return jsonResponse({ board: serverBoard, library: [], media });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Each copy field caps at a length the CARD can actually show, and says so
 * (`n/max`) while the advisor types — a limit they only discover by having text
 * clipped by the layout is not a limit, it is a trap.
 */
describe("TopicTextEditDialog — character limits", () => {
  it("shows a counter for every copy field and caps what can be typed", async () => {
    installServer();
    render(<QuickAnswersBuilder planId="plan-limits-1" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Topic for Financial Planning",
      }),
    );

    const dialog = within(await screen.findByRole("dialog"));
    const title = dialog.getByLabelText("Title") as HTMLInputElement;
    const cardLine = dialog.getByLabelText("Card line") as HTMLInputElement;
    const answer = dialog.getByLabelText("Answer") as HTMLTextAreaElement;
    const step1 = dialog.getByLabelText("Step 1") as HTMLInputElement;

    expect(title).toHaveAttribute("maxLength", String(MAX_TOPIC_TITLE_LENGTH));
    expect(cardLine).toHaveAttribute(
      "maxLength",
      String(MAX_TOPIC_SUMMARY_LENGTH),
    );
    expect(answer).toHaveAttribute(
      "maxLength",
      String(MAX_TOPIC_ANSWER_LENGTH),
    );
    expect(step1).toHaveAttribute("maxLength", String(MAX_TOPIC_STEP_LENGTH));

    // Every counter reports the field's current copy, not a placeholder.
    expect(
      dialog.getByText(`18/${MAX_TOPIC_TITLE_LENGTH}`),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(`0/${MAX_TOPIC_SUMMARY_LENGTH}`),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(`18/${MAX_TOPIC_ANSWER_LENGTH}`),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(`10/${MAX_TOPIC_STEP_LENGTH}`),
    ).toBeInTheDocument();

    // The counter follows the text as it changes.
    const longer = "Financial planning, simply";
    fireEvent.change(title, { target: { value: longer } });
    expect(
      dialog.getByText(`${longer.length}/${MAX_TOPIC_TITLE_LENGTH}`),
    ).toBeInTheDocument();
  });
});

describe("TopicTextEditDialog — save then reopen", () => {
  it("reflects a saved title when the dialog is reopened", async () => {
    installServer();
    render(<QuickAnswersBuilder planId="plan-text-1" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Topic for Contribution limits",
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
          name: "Edit Topic for New contribution limits",
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit Topic for New contribution limits",
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
        name: "Edit Topic for Financial Planning",
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
      screen.getByRole("button", { name: "Edit Topic for Financial Planning" }),
    );
    const reopened = (await screen.findByLabelText("Step 1")) as HTMLInputElement;
    expect(reopened.value).toBe("Set a SMART goal");
  });
});

/**
 * Two kinds of document, told apart in the dialog:
 *
 *  - the benefit's own documents (chosen from the plan's library, and ALSO listed
 *    under Documents & Forms), and
 *  - documents that belong to this card only (a title + link typed here).
 */
describe("TopicTextEditDialog — documents", () => {
  it("splits Documents from Videos, and the benefit's documents from the card's own", async () => {
    installServer();
    render(<QuickAnswersBuilder planId="plan-docs-1" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Topic for Contribution limits",
      }),
    );

    const dialog = within(await screen.findByRole("dialog"));
    // Two sections now, not one "Documents & videos" box.
    expect(dialog.getByText("Documents")).toBeInTheDocument();
    expect(dialog.getByText("Videos")).toBeInTheDocument();
    expect(dialog.queryByText("Documents & videos")).not.toBeInTheDocument();

    // …and inside Documents, the two groups are named.
    expect(dialog.getByText("Benefit documents")).toBeInTheDocument();
    expect(dialog.getByText("Shared")).toBeInTheDocument();
    expect(dialog.getByText("Topic documents")).toBeInTheDocument();
    expect(dialog.getByText("Only on this card")).toBeInTheDocument();
    // The grouping is spacing, not a second surface or colour.
    expect(
      screen.queryByText("From your computer — the name is filled in for you."),
    ).not.toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: /Upload a document/ }),
    ).toBeEnabled();
  });

  it("uploads a document from the computer onto this card alone", async () => {
    installServer();
    mocks.uploadTopicDocument.mockClear();
    render(<QuickAnswersBuilder planId="plan-docs-3" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Topic for Contribution limits",
      }),
    );

    const dialog = within(await screen.findByRole("dialog"));
    const file = new File(["%PDF-1.4"], "plan-loan-form.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(dialog.getByLabelText("Upload a topic-only document"), {
      target: { files: [file] },
    });

    // The helper names the file and stores it against the plan.
    expect(
      await dialog.findByText("Loan request form"),
    ).toBeInTheDocument();
    expect(mocks.uploadTopicDocument).toHaveBeenCalledWith({
      file,
      planId: "plan-docs-3",
    });

    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument(),
    );

    // Reopening reads it back from the board, so the card kept the document.
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit Topic for Contribution limits",
      }),
    );
    const reopened = within(await screen.findByRole("dialog"));
    expect(await reopened.findByText("Loan request form")).toHaveAttribute(
      "title",
      "/api/documents/doc-9/view",
    );
  });

  it("lets the advisor rename an uploaded document", async () => {
    installServer();
    mocks.uploadTopicDocument.mockClear();
    render(<QuickAnswersBuilder planId="plan-docs-4" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Topic for Contribution limits",
      }),
    );

    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Upload a topic-only document"), {
      target: {
        files: [new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" })],
      },
    });
    expect(await dialog.findByText("Loan request form")).toBeInTheDocument();

    // The model's name is a starting point, not the final word.
    fireEvent.click(
      dialog.getByRole("button", { name: "Rename Loan request form" }),
    );
    const field = dialog.getByLabelText("Document name");
    fireEvent.change(field, { target: { value: "2026 Loan Form" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(await dialog.findByText("2026 Loan Form")).toBeInTheDocument();
    expect(dialog.queryByText("Loan request form")).not.toBeInTheDocument();

    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument(),
    );

    // The new name is what the card saved, and what it reads back.
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit Topic for Contribution limits",
      }),
    );
    const reopened = within(await screen.findByRole("dialog"));
    expect(await reopened.findByText("2026 Loan Form")).toHaveAttribute(
      "title",
      "/api/documents/doc-9/view",
    );
  });

  it("drops a benefit document the library no longer holds, and says so first", async () => {
    const board = baseBoard();
    board.hidden = [
      topic("t-1", "Contribution limits", 0),
      topic("t-2", "Financial Planning", 1, [
        { type: "quick_answer", text: "Plan your savings." },
        { type: "documents", documentIds: ["doc-gone", "doc-live"] },
      ]),
    ];
    installServer(
      {
        documents: [
          {
            id: "doc-live",
            title: "Enrollment guide",
            url: "/api/documents/doc-live/view",
          },
        ],
        videos: [],
      },
      board,
    );
    render(<QuickAnswersBuilder planId="plan-docs-5" location="retirement" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Topic for Financial Planning",
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));

    // The live document keeps its title; the deleted one is named for what it
    // is, never as a generic "unavailable" chip.
    expect(dialog.getByText("Enrollment guide")).toBeInTheDocument();
    expect(dialog.getByText("No longer in the library")).toBeInTheDocument();
    expect(
      dialog.getByText(/One attached document is no longer in this benefit's library/),
    ).toBeInTheDocument();

    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument(),
    );

    // Saving detaches the dead id, so it never comes back.
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Topic for Financial Planning" }),
    );
    const reopened = within(await screen.findByRole("dialog"));
    expect(reopened.getByText("Enrollment guide")).toBeInTheDocument();
    expect(
      reopened.queryByText("No longer in the library"),
    ).not.toBeInTheDocument();
  });
});
