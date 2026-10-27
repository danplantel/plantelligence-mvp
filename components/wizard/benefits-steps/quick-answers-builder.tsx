"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { GripVertical, Plus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EffectiveTopic, TopicLocation } from "@/types/topic";

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

interface BoardPayload {
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
const UNGROUPED_KEY = "__ungrouped__";

export interface QuickAnswersBuilderProps {
  planId: string;
  location: TopicLocation;
  className?: string;
  /** Called after a successful save so a caller can revalidate a preview. */
  onSaved?: () => void;
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
                name: "Questions",
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

export function QuickAnswersBuilder({
  planId,
  location,
  className,
  onSaved,
}: QuickAnswersBuilderProps) {
  const key = planId ? boardKey(planId, location) : null;
  const { data, error: loadError, isLoading } = useSWR<TopicsResponse>(
    key,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [addTarget, setAddTarget] = useState("");

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
   * Send the complete board. Featured placements are included unchanged so that a
   * question promoted to Featured keeps a stable order, and so nothing is silently
   * dropped by a board that only mentioned the Quick Answers half.
   */
  const persist = async (next: Draft) => {
    const previous = draft;
    const previousData = data;
    setDraft(next);
    setSaveError(null);
    setSaving(true);

    // INSTANT: the preview re-orders from the cache before the request even settles.
    if (key) {
      void globalMutate(key, optimisticResponse(next, previousData, location), {
        revalidate: false,
      });
    }

    const placements = [
      ...next.featured.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "featured" as const,
        sortOrder: index,
      })),
      ...next.groups.flatMap((group) =>
        group.topics.map((topic, index) => ({
          topicId: topic.topicId,
          displayMode: "quick_answers" as const,
          // A group created in this request has no id; the server matches it by name.
          groupId: group.id.startsWith("new:") ? group.name : group.id,
          sortOrder: index,
        })),
      ),
      ...next.ungrouped.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "quick_answers" as const,
        groupId: null,
        sortOrder: index,
      })),
      ...next.hidden.map((topic, index) => ({
        topicId: topic.topicId,
        displayMode: "hidden" as const,
        sortOrder: index,
      })),
    ];

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
      onSaved?.();
    } catch (error) {
      // Put the last server truth back, so a rejected save cannot look applied.
      setDraft(previous);
      if (key && previousData) {
        void globalMutate(key, previousData, { revalidate: false });
      }
      setSaveError(
        error instanceof Error ? error.message : "Could not save Quick Answers.",
      );
    } finally {
      setSaving(false);
    }
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

  const moveQuestion = (
    topic: BoardTopic,
    from: { groupId: string } | "ungrouped" | "hidden",
    to: string,
  ) => {
    if (!draft) return;

    const withoutTopic = (topics: BoardTopic[]) =>
      topics.filter((entry) => entry.topicId !== topic.topicId);

    const next: Draft = {
      ...draft,
      groups: draft.groups.map((group) => ({
        ...group,
        topics: withoutTopic(group.topics),
      })),
      ungrouped: withoutTopic(draft.ungrouped),
      hidden: withoutTopic(draft.hidden),
    };

    if (to === "hidden") {
      next.hidden = [...next.hidden, topic];
    } else if (to === "featured") {
      if (next.featured.length >= next.featuredCap) {
        setSaveError(
          `Featured holds ${next.featuredCap} cards (3 rows of 4). Move one down to Quick Answers first.`,
        );
        return;
      }
      next.featured = [...next.featured, topic];
    } else if (to === UNGROUPED_KEY) {
      next.ungrouped = [...next.ungrouped, topic];
    } else {
      next.groups = next.groups.map((group) =>
        group.id === to ? { ...group, topics: [...group.topics, topic] } : group,
      );
    }

    void from;
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
            Quick Answers
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Grouped questions shown below the Featured cards. A question lives here
            or in Featured — never both.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {saving ? "Saving…" : `${questionCount} question${questionCount === 1 ? "" : "s"}`}
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

      {isBare ? (
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
                    {group.topics.length === 0 ? (
                      <p className="px-1 py-2 text-[12px] text-muted-foreground">
                        No questions in this group yet.
                      </p>
                    ) : (
                      group.topics.map((topic) => (
                        <div
                          key={topic.topicId}
                          className="flex items-center gap-2 rounded-md border border-muted/60 px-2 py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                            {topic.title}
                          </span>
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
                      ))
                    )}
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
                {draft.ungrouped.map((topic) => (
                  <div
                    key={topic.topicId}
                    className="flex items-center gap-2 rounded-md border border-muted/60 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                      {topic.title}
                    </span>
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
                ))}
              </div>
            </div>
          )}

          {draft.hidden.length > 0 && (
            <div className="rounded-lg border border-muted p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Hidden from participants
              </p>
              <div className="mt-2 space-y-1.5">
                {draft.hidden.map((topic) => (
                  <div
                    key={topic.topicId}
                    className="flex items-center gap-2 rounded-md border border-muted/60 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                      {topic.title}
                    </span>
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
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* New group */}
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
                  <option value={UNGROUPED_KEY}>Questions (ungrouped)</option>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickAnswersBuilder;
