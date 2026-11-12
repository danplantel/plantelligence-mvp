"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { AlertTriangle, GripVertical, Plus, Search } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UNGROUPED_TOPIC_GROUP_ID as UNGROUPED_KEY,
  UNGROUPED_TOPIC_GROUP_NAME,
} from "@/lib/topics/ungrouped";
import { cn } from "@/lib/utils";
import { TOPIC_LOCATION_LABELS } from "@/lib/topic-locations";
import type { ActionHubLink, EffectiveTopic, TopicLocation } from "@/types/topic";

/**
 * "Get Quick Answers" — the builder for one location's question list (TF-3).
 *
 * This is the admin half of the section participants see below the Featured cards. It
 * edits PLACEMENTS, not `Benefit.faqs`: a question is a topic in a named group, which
 * is what lets the same item later be promoted to a Featured card without being
 * retyped (and never appear in both places — a placement has one display mode).
 *
 * Data flow:
 *  - one SWR read of the board, shared by key with the preview, so saving here updates
 *    the preview beside it;
 *  - every mutation sends the WHOLE board (`PUT`), which the server reconciles inside
 *    one transaction. That is why a rename, a move and a reorder cannot half-apply;
 *  - the response's board replaces the local draft, so the client never invents ids
 *    for a group it just created.
 *
 * The select on each row is the keyboard-accessible equivalent of dragging between
 * zones, and is the only way to move a question here for now.
 */

interface BoardTopic extends EffectiveTopic {}

interface BoardGroup {
  id: string;
  name: string;
  sortOrder: number;
  topics: BoardTopic[];
}

/** The board the server sends (`GET /api/clients/:id/topics`). */
export interface BoardPayload {
  location: TopicLocation;
  featured: BoardTopic[];
  groups: BoardGroup[];
  hidden: BoardTopic[];
  featuredCap: number;
}

interface LibraryItem {
  slug: string;
  title: string;
  summary: string | null;
  isActionHub: boolean;
  group: string | null;
}

interface TopicsResponse {
  board: BoardPayload;
  library: LibraryItem[];
  error?: string;
}

/** Virtual group for questions whose placement has no group (or a stale one). */
// (Its id and label are shared with the board read — see `lib/topics/board.ts`.)

/**
 * How many Featured cards fill the page.
 *
 * The page shows NINE cards: the Account Access card (which is not a placement —
 * it is synthesised from the catalog) in the full-width row that owns the primary,
 * then two rows of four. So eight Featured questions is the ceiling, and promoting
 * the ninth is a decision the advisor has to make deliberately — one card has to
 * give way. `pendingPromotion` holds the question until they name it.
 *
 * (`FEATURED_CAP` in `lib/topics/board.ts` is the server's hard limit, which is
 * higher so an existing plan can always still be saved.)
 */
const FEATURED_ROW_CAP = 8;

export interface QuickAnswersBuilderProps {
  planId: string;
  location: TopicLocation;
  className?: string;
  /** Called after a successful save so a caller can revalidate a preview. */
  onSaved?: () => void;
  /**
   * Called with the board as the UI now has it — first OPTIMISTICALLY (before the
   * request settles), then with the reconciled board.
   *
   * The portal page renders Quick Answers from the BENEFIT payload
   * (`?forPortal=1&withTopics=1`), a different cache entry from this board. Without
   * this the section beside the panel kept the old questions until that heavy GET
   * came back (measured at several seconds), even though the row had already moved
   * here. The editor patches those topics into the benefit cache from this.
   */
  onBoardChange?: (board: BoardPayload) => void;
  /**
   * Which half of the board this instance edits.
   *
   * `"full"` (default) is Create/Edit Benefits: one builder for the whole board.
   * The portal's Employee Resources panel presents the page's two sections
   * separately — "How Can We Help You Today?" (the Featured cards) and "Quick
   * Answers" (the grouped questions) — so it mounts two instances over the SAME
   * board. Each edits only its own half, and every save still sends the complete
   * board, which is what keeps one half from dropping the other.
   */
  mode?: "full" | "featured" | "answers";
}

function boardKey(planId: string, location: TopicLocation): string {
  return `/api/clients/${planId}/topics?location=${encodeURIComponent(location)}`;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error || "Could not load the board.");
    return body as TopicsResponse;
  });

/**
 * One plan-location's placement board, shared by SWR key.
 *
 * The builder edits it; the Card Layout section beside it only READS it (it needs
 * the same Featured cards, in the same order, or the two lists disagree). Sharing
 * the hook means the second reader costs no request — SWR dedupes them — and both
 * re-render from the same cache write.
 */
export function useTopicBoard(
  planId: string | null | undefined,
  location: TopicLocation | null | undefined,
) {
  const key = planId && location ? boardKey(planId, location) : null;
  const response = useSWR<TopicsResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });
  return { key, ...response };
}

/** Placement sub-link, sent only when the row actually carries one. */
function placementLink(topic: BoardTopic) {
  return topic.isActionHub && topic.actionHubLink
    ? { actionHubLink: topic.actionHubLink }
    : {};
}

/**
 * Re-write the Featured placements in a given order.
 *
 * Section 6's Card Layout is where the page order is arranged, so a drop there has
 * to reach the placements — the Featured list reads the same board, and leaving
 * that stale is how the two views drifted apart. One `PUT` of the whole board (the
 * builder's own shape), with the cache written first so both lists move in the
 * same frame.
 *
 * `orderedTopicIds` must name every Featured placement; a partial list is ignored,
 * because reordering half a board would silently demote the rest.
 */
export async function reorderFeaturedCards(params: {
  planId: string;
  location: TopicLocation;
  board: BoardPayload;
  orderedTopicIds: string[];
}): Promise<void> {
  const { board, orderedTopicIds } = params;
  const byTopicId = new Map(board.featured.map((topic) => [topic.topicId, topic]));
  const featured = orderedTopicIds
    .map((topicId) => byTopicId.get(topicId))
    .filter((topic): topic is BoardTopic => Boolean(topic));
  if (featured.length !== board.featured.length) return;

  // The virtual "Questions" group is not a real row: its topics travel ungrouped.
  const realGroups = board.groups.filter((group) => group.id !== UNGROUPED_KEY);
  const ungrouped = board.groups.find((group) => group.id === UNGROUPED_KEY);

  const placements = [
    ...featured.map((topic, index) => ({
      topicId: topic.topicId,
      displayMode: "featured" as const,
      sortOrder: index,
      ...placementLink(topic),
    })),
    ...realGroups.flatMap((group) =>
      group.topics.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "quick_answers" as const,
        groupId: group.id,
        sortOrder: index,
        ...placementLink(topic),
      })),
    ),
    ...(ungrouped?.topics ?? []).map((topic, index) => ({
      topicId: topic.topicId,
      displayMode: "quick_answers" as const,
      groupId: null,
      sortOrder: index,
      ...placementLink(topic),
    })),
    ...board.hidden.map((topic, index) => ({
      topicId: topic.topicId,
      displayMode: "hidden" as const,
      sortOrder: index,
      ...placementLink(topic),
    })),
  ];

  const key = boardKey(params.planId, params.location);
  const nextBoard: BoardPayload = { ...board, featured };
  // INSTANT: both lists read this cache, so they re-order before the request lands.
  void globalMutate(
    key,
    (current: TopicsResponse | undefined) =>
      current ? { ...current, board: nextBoard } : current,
    { revalidate: false },
  );

  const response = await fetch(key, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: params.location,
      groups: realGroups.map((group, index) => ({
        id: group.id,
        name: group.name,
        sortOrder: index,
      })),
      placements,
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Could not save the card order.");
  }

  // The reconciled board, so nothing the server normalised is left behind.
  void globalMutate(
    key,
    (current: TopicsResponse | undefined) =>
      current
        ? {
            ...current,
            board: body.board as BoardPayload,
            library: body.library ?? current.library,
          }
        : current,
    { revalidate: false },
  );
}

/**
 * One group, draggable by its handle.
 *
 * Top-level (not declared inside the builder) on purpose: `useSortable` must keep the
 * same component identity across renders, or the drag would restart on every state
 * change. The handle is the ONLY drag surface — the name field and the per-question
 * selects inside stay fully usable while a group is sortable.
 */
function SortableGroupCard({
  id,
  name,
  index,
  onNameDraft,
  onNameCommit,
  children,
}: {
  id: string;
  name: string;
  index: number;
  /** Live edit, so typing does not hit the network on every keystroke. */
  onNameDraft: (value: string) => void;
  /** Commit on blur — this is what saves. */
  onNameCommit: (value: string) => void;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      data-testid="quick-answers-group"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "rounded-lg border border-muted bg-white p-3 dark:bg-gray-800",
        isDragging && "relative z-10 opacity-70 shadow-lg",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Reorder ${name}`}
          className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <Input
          value={name}
          aria-label={`Group name: ${name}`}
          onChange={(event) => onNameDraft(event.target.value)}
          onBlur={(event) => onNameCommit(event.target.value)}
          className="h-8 flex-1 text-[13px] font-semibold"
        />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Group {index + 1}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

/** The board as the UI edits it: groups carry new ones without an id yet. */
interface Draft {
  groups: BoardGroup[];
  hidden: BoardTopic[];
  featured: BoardTopic[];
  featuredCap: number;
  /** Group that questions with no group are shown under. */
  ungrouped: BoardTopic[];
}

function toDraft(board: BoardPayload): Draft {
  const ungrouped = board.groups
    .filter((group) => group.id === UNGROUPED_KEY)
    .flatMap((group) => group.topics);

  return {
    groups: board.groups.filter((group) => group.id !== UNGROUPED_KEY),
    hidden: board.hidden,
    featured: board.featured,
    featuredCap: board.featuredCap,
    ungrouped,
  };
}

/**
 * The board the PREVIEW should render for a given draft.
 *
 * Written into the shared SWR cache instead of triggering a refetch: the preview reads
 * the same key, so it re-orders the instant a group is dropped — no second round trip,
 * which is what made the animation feel seconds late.
 */
function optimisticResponse(
  draft: Draft,
  base: TopicsResponse | undefined,
  location: TopicLocation,
): TopicsResponse {
  const fallbackBoard: BoardPayload = {
    location,
    featured: [],
    groups: [],
    hidden: [],
    featuredCap: draft.featuredCap,
  };

  return {
    ...(base ?? { board: fallbackBoard, library: [] }),
    board: {
      ...(base?.board ?? fallbackBoard),
      featured: draft.featured,
      hidden: draft.hidden,
      groups: [
        ...draft.groups.map((group, index) => ({
          id: group.id,
          name: group.name,
          sortOrder: index,
          topics: group.topics,
        })),
        ...(draft.ungrouped.length > 0
          ? [
              {
                id: UNGROUPED_KEY,
                name: UNGROUPED_TOPIC_GROUP_NAME,
                sortOrder: draft.groups.length,
                topics: draft.ungrouped,
              },
            ]
          : []),
      ],
    },
  };
}

function countQuestions(draft: Draft): number {
  return (
    draft.groups.reduce((total, group) => total + group.topics.length, 0) +
    draft.ungrouped.length
  );
}

/**
 * A question row's entrance, move and exit.
 *
 * The portal's own sections animate the same way (`framer-motion` layout with
 * `initial={false}`), so hiding a question or restoring it reads as a card leaving
 * one list and joining another instead of the lists re-flowing instantly. The
 * per-topic `layoutId` is what lets one row morph BETWEEN the Hidden list and a
 * group: framer matches the two elements and animates the move.
 */
const QUESTION_ROW_TRANSITION = {
  duration: 0.12,
  ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
};

interface AnimatedRowProps {
  topicId: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * `forwardRef` because `AnimatePresence mode="popLayout"` clones the exiting child
 * to measure it — a plain function component would silently drop that ref and the
 * row could not be taken out of the list's flow while it leaves.
 */
const AnimatedRow = forwardRef<HTMLDivElement, AnimatedRowProps>(
  function AnimatedRow({ topicId, className, children }, ref) {
    return (
      <motion.div
        ref={ref}
        // Position only: interpolating the box too would scale the text mid-move.
        layout="position"
        layoutId={`quick-answer-row-${topicId}`}
        // New rows appear at their final state at once — the editor must feel
        // instant; only the space they take up eases in.
        initial={false}
        animate={{ opacity: 1 }}
        exit={{
          opacity: 0,
          height: 0,
          marginTop: 0,
          marginBottom: 0,
          paddingTop: 0,
          paddingBottom: 0,
        }}
        transition={QUESTION_ROW_TRANSITION}
        className={cn("overflow-hidden", className)}
      >
        {children}
      </motion.div>
    );
  },
);

/** The ↔ pill the builder shows on an Action Hub topic (TF-5). */
function ActionHubBadge() {
  return (
    <span
      title="This action applies to more than one benefit"
      aria-label="Action Hub: applies to more than one benefit"
      className="shrink-0 rounded-full border border-muted bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground"
    >
      ↔
    </span>
  );
}

/**
 * This LOCATION's Action Hub sub-link (TF-5).
 *
 * An Action Hub is one topic in more than one benefit, so the link belongs to the
 * placement, not the topic: "Update my beneficiaries" points at Voya on the Retirement
 * hub and at MetLife on the Group Life hub. Leaving both fields empty is meaningful —
 * the row then falls back to the category's provider login URL, and disappears if there
 * is none. Committed on blur, so typing never hits the network.
 */
function ActionHubLinkFields({
  link,
  locationLabel,
  onCommit,
}: {
  link?: ActionHubLink;
  locationLabel: string;
  onCommit: (patch: Partial<ActionHubLink>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      <Input
        defaultValue={link?.label ?? ""}
        aria-label={`Action Hub row label for ${locationLabel}`}
        placeholder={`Row label (${locationLabel})`}
        onBlur={(event) => onCommit({ label: event.target.value.trim() })}
        className="h-7 text-[11px]"
      />
      <Input
        defaultValue={link?.url ?? ""}
        aria-label={`Action Hub row link for ${locationLabel}`}
        placeholder="https://provider.com/beneficiaries"
        onBlur={(event) => onCommit({ url: event.target.value.trim() })}
        className="h-7 text-[11px]"
      />
    </div>
  );
}

export function QuickAnswersBuilder({
  planId,
  location,
  className,
  onSaved,
  onBoardChange,
  mode = "full",
}: QuickAnswersBuilderProps) {
  const { key, data, error: loadError, isLoading } = useTopicBoard(
    planId,
    location,
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [addTarget, setAddTarget] = useState("");
  /**
   * The question the advisor just chose to promote into a FULL Featured grid.
   * Held here (never persisted) until they name the card that gives way or cancel,
   * so opening and dismissing the dialog can never half-apply a move.
   */
  const [pendingPromotion, setPendingPromotion] = useState<BoardTopic | null>(
    null,
  );

  // Seed (and re-seed) the draft from the server's board.
  useEffect(() => {
    if (data?.board) setDraft(toDraft(data.board));
  }, [data]);

  const library = useMemo(() => {
    const items = data?.library ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.title} ${item.summary ?? ""}`.toLowerCase().includes(needle),
    );
  }, [data, query]);

  /**
   * Serialized, latest-wins saves.
   *
   * Every save sends the WHOLE board. When an advisor moves one question and then
   * moves another before the first response lands, the older response could arrive
   * last and be applied on top of the newer one — which is exactly how a topic
   * "went back to Hidden from participants" after being assigned to a section. So
   * saves are queued in order, a snapshot that a newer edit superseded is never
   * sent, and a response is only applied while it is still the newest.
   */
  const saveSequence = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  /**
   * Send the complete board. Featured placements are included unchanged so that a
   * question promoted to Featured keeps a stable order, and so nothing is silently
   * dropped by a board that only mentioned the Quick Answers half.
   */
  const persist = (next: Draft) => {
    const previous = draft;
    const previousData = data;
    const sequence = ++saveSequence.current;
    setDraft(next);
    setSaveError(null);
    setSaving(true);

    // INSTANT: the preview re-orders from the cache before the request even settles.
    const optimistic = optimisticResponse(next, previousData, location);
    if (key) {
      void globalMutate(key, optimistic, { revalidate: false });
    }
    // And the portal's own section, which reads the benefit payload, not this board.
    onBoardChange?.(optimistic.board);

    const placements = [
      ...next.featured.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "featured" as const,
        sortOrder: index,
        ...placementLink(topic),
      })),
      ...next.groups.flatMap((group) =>
        group.topics.map((topic, index) => ({
          topicId: topic.topicId,
          displayMode: "quick_answers" as const,
          // A group created in this request has no id; the server matches it by name.
          groupId: group.id.startsWith("new:") ? group.name : group.id,
          sortOrder: index,
          ...placementLink(topic),
        })),
      ),
      ...next.ungrouped.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "quick_answers" as const,
        groupId: null,
        sortOrder: index,
        ...placementLink(topic),
      })),
      ...next.hidden.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "hidden" as const,
        sortOrder: index,
        ...placementLink(topic),
      })),
    ];

    const send = async () => {
      // A newer edit replaced this snapshot while it waited its turn — the newest
      // board supersedes it completely, so there is nothing to send.
      if (sequence !== saveSequence.current) return;

      try {
        const response = await fetch(key as string, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location,
            groups: [
              // Existing groups keep their id; a group created in this request is sent
              // by name only, and the server returns its id.
              ...next.groups
                .filter((group) => !group.id.startsWith("new:"))
                .map((group, index) => ({
                  id: group.id,
                  name: group.name,
                  sortOrder: index,
                })),
              ...next.groups
                .filter((group) => group.id.startsWith("new:"))
                .map((group, index) => ({
                  name: group.name,
                  sortOrder: next.groups.length - 1 + index,
                })),
            ],
            placements,
          }),
        });

        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || "Could not save Quick Answers.");
        }

        // A newer save owns the screen now; its response is the truth.
        if (sequence !== saveSequence.current) return;

        setDraft(toDraft(body.board));
        // The response carries the reconciled board AND the refreshed library, so the
        // cache is written from it directly — no refetch, and no window where the
        // preview disagrees with what was saved.
        if (key) {
          void globalMutate(
            key,
            {
              ...(previousData ?? { board: body.board, library: [] }),
              board: body.board,
              library: body.library ?? previousData?.library ?? [],
            } as TopicsResponse,
            { revalidate: false },
          );
        }
        // The reconciled board (real ids for a topic added from the library).
        onBoardChange?.(body.board as BoardPayload);
        onSaved?.();
      } catch (error) {
        // A newer save supersedes this failure too — rolling back would undo its work.
        if (sequence !== saveSequence.current) return;
        // Put the last server truth back, so a rejected save cannot look applied.
        setDraft(previous);
        if (key && previousData) {
          void globalMutate(key, previousData, { revalidate: false });
        }
        setSaveError(
          error instanceof Error ? error.message : "Could not save Quick Answers.",
        );
      } finally {
        if (sequence === saveSequence.current) setSaving(false);
      }
    };

    // Chain, so the server always receives the snapshots in the order they were made.
    saveQueue.current = saveQueue.current.then(send, send);
  };

  /** Seed this location from the library — the first-use path for older plans. */
  const seed = async () => {
    if (!key) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Could not add the recommended questions.");
      }
      setDraft(toDraft(body.board));
      // Seed with the response's board in the cache, like a save — one render, no
      // refetch, so the preview fills in immediately.
      void globalMutate(
        key,
        {
          ...(data ?? { board: body.board, library: [] }),
          board: body.board,
          library: body.library ?? data?.library ?? [],
        } as TopicsResponse,
        { revalidate: false },
      );
      onSaved?.();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not add the recommended questions.",
      );
    } finally {
      setSaving(false);
    }
  };

  /** The draft with `topic` taken out of every list it could be sitting in. */
  const withoutTopic = (source: Draft, topic: BoardTopic): Draft => {
    const drop = (topics: BoardTopic[]) =>
      topics.filter((entry) => entry.topicId !== topic.topicId);
    return {
      ...source,
      groups: source.groups.map((group) => ({
        ...group,
        topics: drop(group.topics),
      })),
      ungrouped: drop(source.ungrouped),
      hidden: drop(source.hidden),
    };
  };

  const moveQuestion = (
    topic: BoardTopic,
    from: { groupId: string } | "ungrouped" | "hidden",
    to: string,
  ) => {
    if (!draft) return;
    void from;

    const next = withoutTopic(draft, topic);

    /**
     * A promotion into a full grid is a two-part decision: the grid is two rows of
     * four, so ONE card has to leave before this one can sit on the page. Ask which
     * one instead of refusing outright (the old behaviour) or silently growing a
     * third row. Nothing is written until the advisor answers.
     */
    if (to === "featured" && next.featured.length >= FEATURED_ROW_CAP) {
      setSaveError(null);
      setPendingPromotion(topic);
      return;
    }

    if (to === "hidden") {
      next.hidden = [...next.hidden, topic];
    } else if (to === "featured") {
      next.featured = [...next.featured, topic];
    } else if (to === UNGROUPED_KEY) {
      next.ungrouped = [...next.ungrouped, topic];
    } else {
      next.groups = next.groups.map((group) =>
        group.id === to ? { ...group, topics: [...group.topics, topic] } : group,
      );
    }

    void persist(next);
  };

  /**
   * Answer the promotion dialog: `outgoing` gives up its Featured slot, so the card
   * the advisor just promoted can take it. Both halves travel in ONE board write, so
   * the grid never has nine cards or a gap.
   */
  const swapIntoFeatured = (outgoing: BoardTopic) => {
    if (!draft || !pendingPromotion) return;
    const incoming = pendingPromotion;
    setPendingPromotion(null);

    const stripped = withoutTopic(draft, incoming);
    const remaining = stripped.featured.filter(
      (entry) => entry.topicId !== outgoing.topicId,
    );
    /**
     * The grid keeps `FEATURED_ROW_CAP` cards, with the promoted one appended in
     * its usual place. Anything past the cap is demoted too — that is what pulls
     * a plan which already carries too many back to the page's nine tiles in the
     * same save, instead of leaving it one card over.
     */
    const room = Math.max(FEATURED_ROW_CAP - 1, 0);
    const kept = remaining.slice(0, room);
    const overflowing = remaining.slice(room);

    let next: Draft = { ...stripped, featured: [...kept, incoming] };
    for (const card of [outgoing, ...overflowing]) {
      next = returnToQuickAnswers(next, card);
    }
    void persist(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Drop a group into a new position — the same gesture as Section 4's card list. */
  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!draft || !over || active.id === over.id) return;

    const from = draft.groups.findIndex((group) => group.id === active.id);
    const to = draft.groups.findIndex((group) => group.id === over.id);
    if (from < 0 || to < 0) return;

    const groups = [...draft.groups];
    const [moved] = groups.splice(from, 1);
    groups.splice(to, 0, moved);

    void persist({
      ...draft,
      groups: groups.map((group, order) => ({ ...group, sortOrder: order })),
    });
  };

  const renameGroup = (groupId: string, name: string) => {
    if (!draft) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const groups = draft.groups.map((group) =>
      group.id === groupId ? { ...group, name: trimmed } : group,
    );
    void persist({ ...draft, groups });
  };

  const addGroup = () => {
    if (!draft) return;
    const name = newGroupName.trim();
    if (!name) return;
    if (draft.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
      setSaveError("A group with that name already exists.");
      return;
    }
    setNewGroupName("");
    void persist({
      ...draft,
      groups: [
        ...draft.groups,
        {
          // Ids starting with `new:` are created by the server on save.
          id: `new:${name.toLowerCase()}`,
          name,
          sortOrder: draft.groups.length,
          topics: [],
        },
      ],
    });
  };

  const addFromLibrary = (item: LibraryItem, target: string) => {
    if (!draft) return;
    const topic: BoardTopic = {
      topicId: item.slug,
      placementId: "",
      slug: item.slug,
      location,
      displayMode: "quick_answers",
      title: item.title,
      ...(item.summary ? { summary: item.summary } : {}),
      bodyBlocks: [],
      tags: [],
      isActionHub: item.isActionHub,
      groupId: target === UNGROUPED_KEY ? null : target,
      sortOrder: 0,
    };
    moveQuestion(topic, "ungrouped", target);
  };

  /** Promote a library topic straight into the Featured cards. */
  const addFeaturedFromLibrary = (item: LibraryItem) => {
    if (!draft) return;
    const topic: BoardTopic = {
      topicId: item.slug,
      placementId: "",
      slug: item.slug,
      location,
      displayMode: "featured",
      title: item.title,
      ...(item.summary ? { summary: item.summary } : {}),
      bodyBlocks: [],
      tags: [],
      isActionHub: item.isActionHub,
      groupId: null,
      sortOrder: draft.featured.length,
    };

    // Same two-part decision the dropdown makes: a full grid has to give a card
    // back before this one can join it.
    if (draft.featured.length >= FEATURED_ROW_CAP) {
      setSaveError(null);
      setPendingPromotion(topic);
      return;
    }

    void persist({ ...draft, featured: [...draft.featured, topic] });
  };

  /**
   * Take a card off the grid and put it back where it belongs in Quick Answers.
   *
   * A question remembers the section it was promoted FROM (`groupId` stays on the
   * placement while it is Featured, see `planBoardApply`), so demoting it lands it
   * back in that group. Only a question that never had a section goes to the
   * ungrouped list — which is what keeps it off the "Add from the library" drawer.
   */
  const returnToQuickAnswers = (source: Draft, topic: BoardTopic): Draft => {
    const featured = source.featured.filter(
      (entry) => entry.topicId !== topic.topicId,
    );
    const group = topic.groupId
      ? source.groups.find((entry) => entry.id === topic.groupId)
      : undefined;
    const placed: BoardTopic = {
      ...topic,
      displayMode: "quick_answers",
      groupId: group ? group.id : null,
    };
    if (!group) {
      return { ...source, featured, ungrouped: [...source.ungrouped, placed] };
    }
    return {
      ...source,
      featured,
      groups: source.groups.map((entry) =>
        entry.id === group.id
          ? { ...entry, topics: [...entry.topics, placed] }
          : entry,
      ),
    };
  };

  /** Demote a Featured card back to its own Quick Answers section. */
  const demoteFeatured = (topic: BoardTopic) => {
    if (!draft) return;
    void persist(returnToQuickAnswers(withoutTopic(draft, topic), topic));
  };

  /**
   * Write this LOCATION's Action Hub sub-link onto one question.
   *
   * The same topic has a different link on each hub it is placed on, which is the whole
   * point of the per-placement field. The question object is replaced wherever it sits
   * (grouped, ungrouped or hidden) so dragging it afterwards cannot lose the link.
   */
  const setActionHubLink = (topic: BoardTopic, patch: Partial<ActionHubLink>) => {
    if (!draft) return;
    const link: ActionHubLink = { ...(topic.actionHubLink ?? {}), ...patch };
    const withLink = (topics: BoardTopic[]) =>
      topics.map((entry) =>
        entry.topicId === topic.topicId ? { ...entry, actionHubLink: link } : entry,
      );

    void persist({
      ...draft,
      groups: draft.groups.map((group) => ({
        ...group,
        topics: withLink(group.topics),
      })),
      ungrouped: withLink(draft.ungrouped),
      hidden: withLink(draft.hidden),
    });
  };

  if (!planId) return null;

  if (loadError) {
    return (
      <p className={cn("text-[13px] text-red-600", className)}>
        {loadError instanceof Error ? loadError.message : "Could not load Quick Answers."}
      </p>
    );
  }

  if (isLoading || !draft) {
    return (
      <p className={cn("text-[13px] text-muted-foreground", className)}>
        Loading Quick Answers…
      </p>
    );
  }

  const questionCount = countQuestions(draft);
  const isBare =
    questionCount === 0 && draft.hidden.length === 0 && draft.featured.length === 0;
  // Which halves this instance shows (see `mode`).
  const showFeatured = mode !== "answers";
  const showAnswers = mode !== "featured";
  const featuredOnly = showFeatured && !showAnswers;

  const moveOptions = (current: string) => (
    <>
      {draft.groups.map((group) => (
        <option key={group.id} value={group.id} disabled={group.id === current}>
          {group.name}
        </option>
      ))}
      {draft.ungrouped.length > 0 && (
        <option value={UNGROUPED_KEY}>Questions (ungrouped)</option>
      )}
      <option value="featured" disabled={current === "featured"}>
        Featured card
      </option>
      <option value="hidden">Hidden</option>
    </>
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-xs font-bold text-foreground">
            {featuredOnly ? "How Can We Help You Today?" : "Quick Answers"}
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {featuredOnly
              ? "The cards at the top of the page, in the order participants see them. A question lives here or in Quick Answers — never both."
              : "Grouped questions shown below the Featured cards. A question lives here or in Featured — never both."}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {saving
            ? "Saving…"
            : featuredOnly
              ? `${draft.featured.length} card${draft.featured.length === 1 ? "" : "s"}`
              : `${questionCount} question${questionCount === 1 ? "" : "s"}`}
        </span>
      </div>

      {saveError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
        >
          {saveError}
        </p>
      )}

      {showAnswers && isBare ? (
        <div className="rounded-lg border border-dashed border-muted p-4 text-center">
          <p className="text-[13px] text-muted-foreground">
            This benefit has no Quick Answers yet. Start from the questions we ship
            for this category, then edit them.
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={saving}
            onClick={() => void seed()}
          >
            Add the recommended questions
          </Button>
        </div>
      ) : (
        <>
          {showFeatured && (
            <div className="rounded-lg border border-muted bg-white p-3 dark:bg-gray-800">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
                  Featured Cards
                </Label>
                {/* Order and membership are arranged in Section 6's Card Layout,
                    so there is nothing to drag here — a card only moves out. */}
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {draft.featured.length} of {FEATURED_ROW_CAP}
                </span>
              </div>
              <div className="space-y-1.5">
                {draft.featured.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    No cards on this page yet. Promote a question below, or add one
                    from the library.
                  </p>
                )}
                <AnimatePresence initial={false} mode="popLayout">
                  {draft.featured.map((topic) => (
                    <AnimatedRow
                      key={topic.topicId}
                      topicId={topic.topicId}
                      className="flex flex-wrap items-center gap-1.5 rounded-md border border-muted/60 px-2 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                        {topic.title}
                      </span>
                      {topic.isActionHub && <ActionHubBadge />}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => demoteFeatured(topic)}
                      >
                        Move to Quick Answers
                      </Button>
                    </AnimatedRow>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {showAnswers && (
            <LayoutGroup>
              <div className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleGroupDragEnd}
          >
            <SortableContext
              items={draft.groups.map((group) => group.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {draft.groups.map((group, index) => (
                  <SortableGroupCard
                    key={group.id}
                    id={group.id}
                    name={group.name}
                    index={index}
                    onNameDraft={(name) =>
                      setDraft({
                        ...draft,
                        groups: draft.groups.map((entry) =>
                          entry.id === group.id ? { ...entry, name } : entry,
                        ),
                      })
                    }
                    onNameCommit={(name) => renameGroup(group.id, name)}
                  >
                    {group.topics.length === 0 && (
                      <p className="px-1 py-2 text-[12px] text-muted-foreground">
                        No questions in this group yet.
                      </p>
                    )}
                    <AnimatePresence initial={false} mode="popLayout">
                      {group.topics.map((topic) => (
                        <AnimatedRow
                          key={topic.topicId}
                          topicId={topic.topicId}
                          className={cn(
                            "rounded-md border border-muted/60 px-2 py-1.5",
                            topic.isActionHub && "space-y-1.5",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                              {topic.title}
                            </span>
                            {topic.isActionHub && <ActionHubBadge />}
                            <select
                              aria-label={`Move ${topic.title}`}
                              value={group.id}
                              onChange={(event) =>
                                moveQuestion(
                                  topic,
                                  { groupId: group.id },
                                  event.target.value,
                                )
                              }
                              className="h-7 rounded-md border border-muted bg-white px-1 text-[11px] dark:bg-gray-900"
                            >
                              {moveOptions(group.id)}
                            </select>
                          </div>
                          {topic.isActionHub && (
                            <ActionHubLinkFields
                              link={topic.actionHubLink}
                              locationLabel={TOPIC_LOCATION_LABELS[location]}
                              onCommit={(patch) => setActionHubLink(topic, patch)}
                            />
                          )}
                        </AnimatedRow>
                      ))}
                    </AnimatePresence>
                  </SortableGroupCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {draft.ungrouped.length > 0 && (
            <div className="rounded-lg border border-dashed border-muted p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Questions (ungrouped)
              </p>
              <div className="mt-2 space-y-1.5">
                <AnimatePresence initial={false} mode="popLayout">
                  {draft.ungrouped.map((topic) => (
                    <AnimatedRow
                      key={topic.topicId}
                      topicId={topic.topicId}
                      className={cn(
                        "rounded-md border border-muted/60 px-2 py-1.5",
                        topic.isActionHub && "space-y-1.5",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                          {topic.title}
                        </span>
                        {topic.isActionHub && <ActionHubBadge />}
                        <select
                          aria-label={`Move ${topic.title}`}
                          value={UNGROUPED_KEY}
                          onChange={(event) =>
                            moveQuestion(topic, "ungrouped", event.target.value)
                          }
                          className="h-7 rounded-md border border-muted bg-white px-1 text-[11px] dark:bg-gray-900"
                        >
                          {moveOptions(UNGROUPED_KEY)}
                        </select>
                      </div>
                      {topic.isActionHub && (
                        <ActionHubLinkFields
                          link={topic.actionHubLink}
                          locationLabel={TOPIC_LOCATION_LABELS[location]}
                          onCommit={(patch) => setActionHubLink(topic, patch)}
                        />
                      )}
                    </AnimatedRow>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Always mounted, even when empty: a row leaving this list animates
              INTO the group it was assigned to, and the container has to be there
              for framer to match the two elements (`layoutId`). */}
          <div className="rounded-lg border border-muted p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Hidden from participants
            </p>
            {draft.hidden.length === 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Nothing is hidden. Choose &ldquo;Hidden&rdquo; on a question to take
                it off the page.
              </p>
            )}
            <div className="mt-2 space-y-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {draft.hidden.map((topic) => (
                  <AnimatedRow
                    key={topic.topicId}
                    topicId={topic.topicId}
                    className={cn(
                      "rounded-md border border-muted/60 px-2 py-1.5",
                      topic.isActionHub && "space-y-1.5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                        {topic.title}
                      </span>
                      {topic.isActionHub && <ActionHubBadge />}
                      <select
                        aria-label={`Restore ${topic.title}`}
                        value="hidden"
                        onChange={(event) =>
                          moveQuestion(topic, "hidden", event.target.value)
                        }
                        className="h-7 rounded-md border border-muted bg-white px-1 text-[11px] dark:bg-gray-900"
                      >
                        <option value="hidden" disabled>
                          Hidden
                        </option>
                        {moveOptions("hidden")}
                      </select>
                    </div>
                    {topic.isActionHub && (
                      <ActionHubLinkFields
                        link={topic.actionHubLink}
                        locationLabel={TOPIC_LOCATION_LABELS[location]}
                        onCommit={(patch) => setActionHubLink(topic, patch)}
                      />
                    )}
                  </AnimatedRow>
                ))}
              </AnimatePresence>
            </div>
          </div>
              </div>
            </LayoutGroup>
          )}
        </>
      )}

      {/* New group — only meaningful for the Quick Answers half. */}
      {showAnswers && (
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="quick-answers-new-group" className="text-[11px]">
            New group
          </Label>
          <Input
            id="quick-answers-new-group"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="e.g. Taking Money Out"
            className="h-8 text-[13px]"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addGroup}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add group
        </Button>
      </div>
      )}

      {/* Library drawer */}
      <div className="rounded-lg border border-muted bg-white p-3 dark:bg-gray-800">
        <Label className="text-[11px]">Add from the library</Label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics"
            aria-label="Search the topic library"
            className="h-8 pl-7 text-[13px]"
          />
        </div>

        {library.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Every topic for this benefit is already on the page.
          </p>
        ) : (
          <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
            {library.map((item) => (
              <div
                key={item.slug}
                className="flex items-center gap-2 rounded-md border border-muted/60 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                  {item.title}
                </span>
                {featuredOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => addFeaturedFromLibrary(item)}
                  >
                    Add as card
                  </Button>
                ) : (
                  <>
                    <select
                      aria-label={`Group for ${item.title}`}
                      value={addTarget}
                      onChange={(event) => setAddTarget(event.target.value)}
                      className="h-7 rounded-md border border-muted bg-white px-1 text-[11px] dark:bg-gray-900"
                    >
                      <option value="">Choose a group</option>
                      {draft.groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                      <option value={UNGROUPED_KEY}>
                        Questions (ungrouped)
                      </option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!addTarget || saving}
                      onClick={() => addFromLibrary(item, addTarget)}
                    >
                      Add
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        The grid is two rows of four. Promoting a ninth card would grow a third,
        half-empty row, so the advisor names the card that gives way — or cancels.
        Nothing is persisted while this is open: `pendingPromotion` is pure state.
      */}
      <Dialog
        open={pendingPromotion !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPromotion(null);
        }}
      >
        <DialogContent
          // The portal's Editing Panel is `fixed z-[51]` — above the app's
          // dialog tier — so a modal left at `z-50` opens UNDERNEATH it. Raising
          // both the scrim and the content past the panel, the chat pill
          // (`z-[60]`) and the published pop-up (`z-[100]`) is the same rule the
          // portal's other editors follow.
          overlayClassName="z-[110]"
          className="z-[110] max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Featured is full
            </DialogTitle>
            <DialogDescription>
              The page shows nine cards — Account Access plus{" "}
              {FEATURED_ROW_CAP} Featured — which fills the grid. Choose a card to
              move back to Quick Answers so{" "}
              <span className="font-semibold text-foreground">
                {pendingPromotion?.title}
              </span>{" "}
              can take its place.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {draft.featured.map((card) => (
              <li key={card.topicId}>
                <button
                  type="button"
                  aria-label={`Move ${card.title} to Quick Answers`}
                  onClick={() => swapIntoFeatured(card)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-muted/60 px-3 py-2 text-left text-[12px] font-medium transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:hover:bg-gray-800"
                >
                  <span className="min-w-0 truncate">{card.title}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    Move to Quick Answers
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingPromotion(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default QuickAnswersBuilder;
