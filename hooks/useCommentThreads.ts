"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import {
  normalizeBenefitCategoryKey,
  type CommentAnchorInput,
  type CommentAttachment,
  type CommentAuthorView,
  type CommentMessageView,
  type CommentTargetType,
  type CommentThreadView,
  type MentionableUser,
} from "@/lib/comments/types";

/**
 * The Plan/Benefit surface the rail is currently attached to.
 *
 * `clientId` may be an id or a slug — the API resolves either — but the rail passes a
 * real id wherever it has one so the SWR key is stable.
 */
export interface CommentTarget {
  clientId: string;
  targetType: CommentTargetType;
  /** Real category (not a slug) for a benefit surface. */
  category?: string | null;
}

interface CommentListPayload {
  clientId: string;
  threads: CommentThreadView[];
  /**
   * Whether this viewer may resolve/delete (Owner/Admin only). It lives in the cache rather
   * than being derived on the client, so EVERY optimistic write below must carry it forward
   * — dropping it would blink the moderation controls out of the rail mid-mutation.
   */
  canModerate: boolean;
}

/** Poll cadence while comments mode is open. */
const REFRESH_INTERVAL_MS = 10_000;

function listKey(target: CommentTarget): string {
  const params = new URLSearchParams({ targetType: target.targetType });
  if (target.targetType === "benefit" && target.category) {
    params.set("category", target.category);
  }
  return `/api/clients/${encodeURIComponent(target.clientId)}/comments?${params.toString()}`;
}

/**
 * A failed list fetch, carrying the HTTP status.
 *
 * The rail has to tell "you no longer have access" — a 403, where retrying can never succeed —
 * from "that did not work", which is worth a retry. An `Error` with no status cannot make that
 * distinction, so the status rides along on it.
 */
interface CommentFetchError extends Error {
  status?: number;
}

async function fetchThreads(url: string): Promise<CommentListPayload> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    clientId?: string;
    threads?: CommentThreadView[];
    canModerate?: boolean;
    error?: string;
  };
  if (!response.ok) {
    const failure: CommentFetchError = new Error(
      body?.error ?? "Could not load comments.",
    );
    failure.status = response.status;
    throw failure;
  }
  return {
    clientId: body.clientId ?? "",
    threads: Array.isArray(body.threads) ? body.threads : [],
    canModerate: Boolean(body.canModerate),
  };
}

/**
 * A placeholder message shown between posting and the server's authoritative reply.
 *
 * `author` is the current user when we know it (see `optimisticAuthor` below), which is what
 * keeps the avatar right from the first frame. Falling back to `null` renders a nameless
 * monogram until the write lands — the message is there, the face is not.
 */
function tempMessage(
  body: string,
  attachments: CommentAttachment[] = [],
  author: CommentAuthorView | null = null,
): CommentMessageView {
  return {
    id: `temp-msg-${Date.now()}`,
    authorUserId: author?.userId ?? "pending",
    author,
    body,
    mentions: [],
    attachments,
    createdAt: new Date().toISOString(),
    deletedAt: null,
    // Always a plain comment: this placeholder stands in for what the COMPOSER is about to post,
    // while an assignment is written from the assign dialog, which owns its own card.
    kind: "comment",
    task: null,
  };
}

export interface UseCommentThreadsResult {
  threads: CommentThreadView[];
  /** The real Client id the server resolved (id or slug in, id out). */
  resolvedClientId: string;
  /** Owner/Admin only: whether to render the resolve/delete controls at all. */
  canModerate: boolean;
  isLoading: boolean;
  error: string | null;
  /** The HTTP status behind `error`, when the failure was a response at all. */
  errorStatus: number | null;
  isMutating: boolean;
  refresh: () => void;
  createThread: (
    anchor: CommentAnchorInput,
    body: string,
    attachments?: CommentAttachment[],
  ) => Promise<void>;
  reply: (
    threadId: string,
    body: string,
    attachments?: CommentAttachment[],
  ) => Promise<void>;
  /**
   * Hand work to somebody from this thread.
   *
   * `assigneeName` is carried for the OPTIMISTIC card only — the server resolves the real one with
   * the thread it returns, so the card can never end up naming somebody the server did not.
   */
  assignTask: (
    threadId: string,
    input: {
      assigneeUserId: string;
      assigneeName: string;
      title: string;
      /** The picker's opaque id for a derived task, when the work came from one. */
      derivedTaskId?: string;
    },
  ) => Promise<void>;
  /**
   * Take an assignment back. The card stays; the work goes.
   *
   * Keyed by the MESSAGE alone: an id identifies exactly one card on this surface, so callers do not
   * have to know which thread it sits in — and cannot get it wrong.
   */
  withdrawAssignment: (messageId: string) => Promise<void>;
  setResolved: (threadId: string, resolved: boolean) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  deleteMessage: (messageId: string, threadId: string) => Promise<void>;
}

/**
 * The comment threads for one surface, polled every 10s while `enabled`.
 *
 * `refreshWhenHidden: false` keeps a backgrounded tab from polling, and the SWR key is
 * null while disabled, so a page with comments off issues no request at all. Writes are
 * optimistic with a rollback on error.
 */
export function useCommentThreads(
  target: CommentTarget | null,
  enabled: boolean,
  /**
   * The organization's people, already fetched by the rail for @mentions, and the signed-in
   * user's id. Used only to give the optimistic message its author — no extra request.
   */
  mentionable: MentionableUser[] = [],
  currentUserId: string | null = null,
): UseCommentThreadsResult {
  const key = target ? listKey(target) : null;

  /**
   * The optimistic message's author.
   *
   * Without it a just-posted comment renders as a nameless monogram for however long the write
   * takes — and on a slow connection that is the part that looks broken, because the comment
   * itself is already on screen. The mentionable list already carries every member of the
   * organization (the current user included) with their name and headshot, and the rail fetches
   * it regardless of this, so the identity costs no request. It is simply null until that list
   * arrives, and the placeholder falls back to "You".
   */
  const optimisticAuthor = useMemo<CommentAuthorView | null>(() => {
    if (!currentUserId) return null;
    const me = mentionable.find((user) => user.userId === currentUserId);
    return me
      ? { userId: me.userId, name: me.name, headshot: me.headshot }
      : null;
  }, [mentionable, currentUserId]);
  const { data, error, isLoading, mutate } = useSWR(
    enabled && key ? key : null,
    fetchThreads,
    {
      refreshInterval: enabled ? REFRESH_INTERVAL_MS : 0,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const [isMutating, setIsMutating] = useState(false);
  const threads = data?.threads ?? [];
  const resolvedClientId = data?.clientId ?? target?.clientId ?? "";

  const run = useCallback(async (action: () => Promise<void>) => {
    setIsMutating(true);
    try {
      await action();
    } finally {
      setIsMutating(false);
    }
  }, []);

  const createThread = useCallback(
    async (
      anchor: CommentAnchorInput,
      body: string,
      attachments: CommentAttachment[] = [],
    ) => {
      if (!target || !key) return;
      await run(async () => {
        const optimistic: CommentThreadView = {
          id: `temp-thread-${Date.now()}`,
          targetType: target.targetType,
          clientId: resolvedClientId || target.clientId,
          benefitCategory:
            target.targetType === "benefit"
              ? normalizeBenefitCategoryKey(target.category)
              : null,
          anchorKind: anchor.anchorKind,
          sectionKey: anchor.sectionKey,
          fieldKey: anchor.fieldKey ?? null,
          rangeStart: anchor.rangeStart ?? null,
          rangeEnd: anchor.rangeEnd ?? null,
          quote: anchor.quote ?? null,
          resolvedAt: null,
          resolvedByUserId: null,
          createdByUserId: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [tempMessage(body, attachments, optimisticAuthor)],
        };

        await mutate(
          async (current) => {
            const response = await fetch(key, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                targetType: target.targetType,
                category: target.category ?? null,
                anchor,
                body,
                attachments,
              }),
            });
            const payload = (await response.json().catch(() => ({}))) as {
              thread?: CommentThreadView;
              error?: string;
            };
            if (!response.ok || !payload.thread) {
              throw new Error(payload?.error ?? "Could not add comment.");
            }
            const created = payload.thread;
            return {
              clientId: created.clientId,
              canModerate: current?.canModerate ?? false,
              threads: [...(current?.threads ?? []), created],
            };
          },
          {
            optimisticData: (current) => ({
              clientId: resolvedClientId || target.clientId,
              canModerate: current?.canModerate ?? false,
              threads: [...(current?.threads ?? []), optimistic],
            }),
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [key, mutate, optimisticAuthor, resolvedClientId, run, target],
  );

  const reply = useCallback(
    async (
      threadId: string,
      body: string,
      attachments: CommentAttachment[] = [],
    ) => {
      await run(async () => {
        const optimistic = tempMessage(body, attachments, optimisticAuthor);
        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/threads/${encodeURIComponent(threadId)}/messages`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body, attachments }),
              },
            );
            const payload = (await response.json().catch(() => ({}))) as {
              thread?: CommentThreadView;
              error?: string;
            };
            if (!response.ok || !payload.thread) {
              throw new Error(payload?.error ?? "Could not reply.");
            }
            const updated = payload.thread;
            return {
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId ? updated : thread,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId
                  ? { ...thread, messages: [...thread.messages, optimistic] }
                  : thread,
              ),
            }),
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [mutate, optimisticAuthor, resolvedClientId, run],
  );

  const assignTask = useCallback(
    async (
      threadId: string,
      input: {
        assigneeUserId: string;
        assigneeName: string;
        title: string;
        derivedTaskId?: string;
      },
    ) => {
      await run(async () => {
        // The optimistic card is built from what the dialog already knows, so the work appears to land
        // without a round trip. Its task id is a PLACEHOLDER and nothing reads it as an id: the card
        // renders title/byline/state, and the withdrawal control is withheld while it is a placeholder
        // because there is no server row to withdraw yet.
        const optimistic: CommentMessageView = {
          ...tempMessage(
            `Assigned a task to ${input.assigneeName}: ${input.title}`,
            [],
            optimisticAuthor,
          ),
          kind: "task_assignment",
          task: {
            id: "pending-task",
            title: input.title,
            done: false,
            doneAt: null,
            assignedByUserId: currentUserId ?? "pending",
            assignedToUserId: input.assigneeUserId,
            assignedToName: input.assigneeName,
            derivedKind: null,
            benefitCategory: null,
            clientId: resolvedClientId || null,
          },
        };

        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/threads/${encodeURIComponent(threadId)}/assignments`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  assigneeUserId: input.assigneeUserId,
                  title: input.title,
                  derivedTaskId: input.derivedTaskId,
                }),
              },
            );
            const payload = (await response.json().catch(() => ({}))) as {
              data?: CommentThreadView;
              error?: string;
            };
            if (!response.ok || !payload.data) {
              throw new Error(payload?.error ?? "Could not assign the task.");
            }
            const updated = payload.data;
            return {
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId ? updated : thread,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId
                  ? { ...thread, messages: [...thread.messages, optimistic] }
                  : thread,
              ),
            }),
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [currentUserId, mutate, optimisticAuthor, resolvedClientId, run],
  );

  const withdrawAssignment = useCallback(
    async (messageId: string) => {
      await run(async () => {
        /**
         * The card is DETACHED rather than removed — its `task` becomes null and it reads as
         * withdrawn, which is exactly what the server leaves behind. So the withdrawal renders from
         * the same rule the server applies: no task, nothing left to report on.
         *
         * Applied across EVERY thread rather than one named by the caller: a message id already
         * identifies exactly one card on this surface, so there is no thread to be told about and no
         * way to patch the wrong one.
         */
        const detach = (current: CommentListPayload | undefined) => ({
          clientId: current?.clientId ?? resolvedClientId,
          canModerate: current?.canModerate ?? false,
          threads: (current?.threads ?? []).map((thread) => ({
            ...thread,
            messages: thread.messages.map((message) =>
              message.id === messageId ? { ...message, task: null } : message,
            ),
          })),
        });

        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/assignments/${encodeURIComponent(messageId)}`,
              { method: "DELETE" },
            );
            const payload = (await response.json().catch(() => ({}))) as {
              error?: string;
            };
            if (!response.ok) {
              throw new Error(payload?.error ?? "Could not withdraw the assignment.");
            }
            return detach(current);
          },
          {
            optimisticData: detach,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [mutate, resolvedClientId, run],
  );

  const setResolved = useCallback(
    async (threadId: string, resolved: boolean) => {
      await run(async () => {
        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/threads/${encodeURIComponent(threadId)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resolved }),
              },
            );
            const payload = (await response.json().catch(() => ({}))) as {
              thread?: CommentThreadView;
              error?: string;
            };
            if (!response.ok || !payload.thread) {
              throw new Error(payload?.error ?? "Could not update the thread.");
            }
            const updated = payload.thread;
            return {
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId ? updated : thread,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId
                  ? {
                      ...thread,
                      resolvedAt: resolved ? new Date().toISOString() : null,
                    }
                  : thread,
              ),
            }),
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [mutate, resolvedClientId, run],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      await run(async () => {
        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/threads/${encodeURIComponent(threadId)}`,
              { method: "DELETE" },
            );
            if (!response.ok) {
              const payload = (await response.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(payload?.error ?? "Could not delete the thread.");
            }
            return {
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).filter(
                (thread) => thread.id !== threadId,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
              canModerate: current?.canModerate ?? false,
              threads: (current?.threads ?? []).filter(
                (thread) => thread.id !== threadId,
              ),
            }),
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [mutate, resolvedClientId, run],
  );

  const deleteMessage = useCallback(
    async (messageId: string, threadId: string) => {
      await run(async () => {
        const markDeleted = (current: CommentListPayload | undefined) => ({
          clientId: current?.clientId ?? resolvedClientId,
          canModerate: current?.canModerate ?? false,
          threads: (current?.threads ?? []).map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  messages: thread.messages.map((message) =>
                    message.id === messageId
                      ? {
                          ...message,
                          body: "",
                          deletedAt: new Date().toISOString(),
                        }
                      : message,
                  ),
                }
              : thread,
          ),
        });

        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/messages/${encodeURIComponent(messageId)}`,
              { method: "DELETE" },
            );
            if (!response.ok) {
              const payload = (await response.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(payload?.error ?? "Could not delete the comment.");
            }
            return markDeleted(current);
          },
          {
            optimisticData: markDeleted,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [mutate, resolvedClientId, run],
  );

  return {
    threads,
    resolvedClientId,
    canModerate: data?.canModerate ?? false,
    isLoading: enabled ? isLoading : false,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    errorStatus:
      error && typeof (error as CommentFetchError).status === "number"
        ? Number((error as CommentFetchError).status)
        : null,
    isMutating,
    refresh: useCallback(() => {
      void mutate();
    }, [mutate]),
    createThread,
    reply,
    assignTask,
    withdrawAssignment,
    setResolved,
    deleteThread,
    deleteMessage,
  };
}
