"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import {
  normalizeBenefitCategoryKey,
  type CommentAnchorInput,
  type CommentMessageView,
  type CommentTargetType,
  type CommentThreadView,
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

async function fetchThreads(url: string): Promise<CommentListPayload> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    clientId?: string;
    threads?: CommentThreadView[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body?.error ?? "Could not load comments.");
  }
  return {
    clientId: body.clientId ?? "",
    threads: Array.isArray(body.threads) ? body.threads : [],
  };
}

/** A placeholder message shown between posting and the server's authoritative reply. */
function tempMessage(body: string): CommentMessageView {
  return {
    id: `temp-msg-${Date.now()}`,
    authorUserId: "pending",
    author: null,
    body,
    mentions: [],
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
}

export interface UseCommentThreadsResult {
  threads: CommentThreadView[];
  /** The real Client id the server resolved (id or slug in, id out). */
  resolvedClientId: string;
  isLoading: boolean;
  error: string | null;
  isMutating: boolean;
  refresh: () => void;
  createThread: (anchor: CommentAnchorInput, body: string) => Promise<void>;
  reply: (threadId: string, body: string) => Promise<void>;
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
): UseCommentThreadsResult {
  const key = target ? listKey(target) : null;
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
    async (anchor: CommentAnchorInput, body: string) => {
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
          messages: [tempMessage(body)],
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
              threads: [...(current?.threads ?? []), created],
            };
          },
          {
            optimisticData: (current) => ({
              clientId: resolvedClientId || target.clientId,
              threads: [...(current?.threads ?? []), optimistic],
            }),
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
      });
    },
    [key, mutate, resolvedClientId, run, target],
  );

  const reply = useCallback(
    async (threadId: string, body: string) => {
      await run(async () => {
        const optimistic = tempMessage(body);
        await mutate(
          async (current) => {
            const response = await fetch(
              `/api/comments/threads/${encodeURIComponent(threadId)}/messages`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body }),
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
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId ? updated : thread,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
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
              threads: (current?.threads ?? []).map((thread) =>
                thread.id === threadId ? updated : thread,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
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
              threads: (current?.threads ?? []).filter(
                (thread) => thread.id !== threadId,
              ),
            };
          },
          {
            optimisticData: (current) => ({
              clientId: current?.clientId ?? resolvedClientId,
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
    isLoading: enabled ? isLoading : false,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    isMutating,
    refresh: useCallback(() => {
      void mutate();
    }, [mutate]),
    createThread,
    reply,
    setResolved,
    deleteThread,
    deleteMessage,
  };
}
