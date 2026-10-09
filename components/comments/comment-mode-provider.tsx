"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import {
  useCommentThreads,
  type CommentTarget,
} from "@/hooks/useCommentThreads";
import { useCommentsLayout } from "@/lib/comments/comments-layout";
import {
  GENERAL_SECTION_KEY,
  type CommentAnchorInput,
  type CommentTargetType,
  type CommentThreadView,
  type MentionableUser,
} from "@/lib/comments/types";

/** localStorage key holding the reader's Comments on/off preference. */
const MODE_STORAGE_KEY = "comments:mode";

type CommentMode = "off" | "on";

/**
 * What a page tells the provider about itself. Registered by `useCommentSurface`.
 *
 * `persisted: false` is the Create-wizard case: the Plan/Benefit row does not exist
 * yet, so the toggle is shown DISABLED with a "save a draft" hint instead of being
 * hidden or silently doing nothing.
 */
export interface CommentSurfaceInput {
  clientId: string;
  targetType: CommentTargetType;
  category?: string | null;
  /** Defaults to true. Set false until the row has been saved. */
  persisted?: boolean;
}

interface CommentModeValue {
  /** True once a page has registered a surface (comments may or may not be available). */
  hasSurface: boolean;
  /** True when the surface has a persisted row, so commenting is possible. */
  canComment: boolean;
  mode: CommentMode;
  /** Requests the surface has not been saved yet — used by the toggle's hint. */
  needsDraft: boolean;
  setMode: (next: CommentMode) => void;
  toggleMode: () => void;

  target: CommentTarget | null;
  threads: CommentThreadView[];
  isLoading: boolean;
  error: string | null;
  isMutating: boolean;
  refresh: () => void;

  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  /**
   * Where the rail's persistent composer will post. Defaults to the whole-surface
   * "General" target; selecting text or clicking a section re-aims it.
   */
  composerAnchor: CommentAnchorInput;
  setComposerTarget: (anchor: CommentAnchorInput) => void;
  resetComposerTarget: () => void;

  createThread: (anchor: CommentAnchorInput, body: string) => Promise<void>;
  reply: (threadId: string, body: string) => Promise<void>;
  setResolved: (threadId: string, resolved: boolean) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  deleteMessage: (messageId: string, threadId: string) => Promise<void>;

  mentionable: MentionableUser[];

  /** The signed-in user's id, so the rail can label its own messages "You". */
  currentUserId: string | null;
  /** Section keys currently rendered on the page, for the rail's "Unanchored" group. */
  sectionKeys: string[];
  registerSection: (key: string) => void;
  unregisterSection: (key: string) => void;

  /** Internal: used by `useCommentSurface` to declare the active page's surface. */
  registerSurface: (next: CommentSurfaceInput | null) => void;
}

const CommentModeContext = createContext<CommentModeValue | null>(null);

/** The whole-surface target a fresh composer starts on. */
const GENERAL_ANCHOR: CommentAnchorInput = {
  anchorKind: "section",
  sectionKey: GENERAL_SECTION_KEY,
};

export function CommentModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [surface, setSurface] = useState<CommentSurfaceInput | null>(null);
  const [mode, setModeState] = useState<CommentMode>("off");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [composerAnchor, setComposerAnchor] =
    useState<CommentAnchorInput>(GENERAL_ANCHOR);
  const [sectionKeys, setSectionKeys] = useState<string[]>([]);

  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;

  const registerSection = useCallback((key: string) => {
    setSectionKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);
  const unregisterSection = useCallback((key: string) => {
    setSectionKeys((prev) => prev.filter((entry) => entry !== key));
  }, []);

  // Restore the reader's preference once on the client. Absent/blocked storage just
  // leaves comments off.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MODE_STORAGE_KEY) === "on") {
        setModeState("on");
      }
    } catch {
      // Private mode / storage disabled — comments default to off.
    }
  }, []);

  const setMode = useCallback((next: CommentMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Preference is a nicety; the session still reflects it.
    }
  }, []);

  const registerSurface = useCallback((next: CommentSurfaceInput | null) => {
    setSurface(next);
  }, []);

  const hasSurface = surface !== null;
  const canComment = surface !== null && surface.persisted !== false;
  const needsDraft = surface !== null && surface.persisted === false;

  const target = useMemo<CommentTarget | null>(
    () =>
      canComment && surface
        ? {
            clientId: surface.clientId,
            targetType: surface.targetType,
            category: surface.category ?? null,
          }
        : null,
    [canComment, surface],
  );

  const open = canComment && mode === "on";
  useCommentsLayout(open);

  const commentThreads = useCommentThreads(target, open);

  const pendingThreadIdRef = useRef<string | null>(null);

  // Deep link: a notification's `?comment=<threadId>` opens the rail and selects that
  // thread. Read from the URL in an effect (a client page needs no Suspense boundary),
  // and re-run when the plan/benefit changes so a cross-plan link still lands.
  useEffect(() => {
    // Only honoured on a page that is a comment surface, so a stray `?comment=` does not
    // switch comments on for a later page.
    if (typeof window === "undefined" || !target) return;
    const id = new URLSearchParams(window.location.search).get("comment");
    if (!id) return;
    pendingThreadIdRef.current = id;
    setMode("on");
  }, [setMode, target]);

  // Select the deep-linked thread once the list that contains it has loaded.
  useEffect(() => {
    const pending = pendingThreadIdRef.current;
    if (!pending) return;
    if (commentThreads.threads.some((thread) => thread.id === pending)) {
      setActiveThreadId(pending);
      pendingThreadIdRef.current = null;
    }
  }, [commentThreads.threads]);

  // A different plan/benefit resets any selection or in-progress anchor.
  useEffect(() => {
    setActiveThreadId(null);
    setComposerAnchor(GENERAL_ANCHOR);
    setSectionKeys([]);
  }, [target?.clientId, target?.targetType, target?.category]);

  // Keyboard shortcut: Shift+C toggles comments, unless the reader is typing.
  useEffect(() => {
    if (!hasSurface) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== "c") return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      event.preventDefault();
      if (!canComment) return;
      setMode(mode === "on" ? "off" : "on");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSurface, canComment, mode, setMode]);

  // Mention candidates, fetched only while the rail is open.
  const mentionableKey =
    open && target
      ? `/api/clients/${encodeURIComponent(target.clientId)}/comments/mentionable`
      : null;
  const { data: mentionableData } = useSWR(
    mentionableKey,
    async (url: string): Promise<MentionableUser[]> => {
      const response = await fetch(url, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as {
        users?: MentionableUser[];
      };
      return response.ok && Array.isArray(body.users) ? body.users : [];
    },
  );

  const toggleMode = useCallback(() => {
    if (!canComment) return;
    setMode(mode === "on" ? "off" : "on");
  }, [canComment, mode, setMode]);

  // Aim the rail's composer at a section or a text range. Any selected thread steps aside
  // so the composer — not a thread card — owns the reader's attention.
  const setComposerTarget = useCallback((anchor: CommentAnchorInput) => {
    setComposerAnchor(anchor);
    setActiveThreadId(null);
  }, []);

  const resetComposerTarget = useCallback(
    () => setComposerAnchor(GENERAL_ANCHOR),
    [],
  );

  const value = useMemo<CommentModeValue>(
    () => ({
      hasSurface,
      canComment,
      mode,
      needsDraft,
      setMode,
      toggleMode,
      target,
      threads: commentThreads.threads,
      isLoading: commentThreads.isLoading,
      error: commentThreads.error,
      isMutating: commentThreads.isMutating,
      refresh: commentThreads.refresh,
      activeThreadId,
      setActiveThreadId,
      composerAnchor,
      setComposerTarget,
      resetComposerTarget,
      createThread: commentThreads.createThread,
      reply: commentThreads.reply,
      setResolved: commentThreads.setResolved,
      deleteThread: commentThreads.deleteThread,
      deleteMessage: commentThreads.deleteMessage,
      mentionable: mentionableData ?? [],
      currentUserId,
      sectionKeys,
      registerSection,
      unregisterSection,
      registerSurface,
    }),
    [
      hasSurface,
      canComment,
      mode,
      needsDraft,
      setMode,
      toggleMode,
      target,
      commentThreads.threads,
      commentThreads.isLoading,
      commentThreads.error,
      commentThreads.isMutating,
      commentThreads.refresh,
      commentThreads.createThread,
      commentThreads.reply,
      commentThreads.setResolved,
      commentThreads.deleteThread,
      commentThreads.deleteMessage,
      activeThreadId,
      composerAnchor,
      setComposerTarget,
      resetComposerTarget,
      mentionableData,
      currentUserId,
      sectionKeys,
      registerSection,
      unregisterSection,
      registerSurface,
    ],
  );

  return (
    <CommentModeContext.Provider value={value}>
      {children}
    </CommentModeContext.Provider>
  );
}

/**
 * Declare the current page as a comment surface. Call once per page with the plan id
 * and (for a benefit) its category. Passing `persisted: false` keeps the toggle visible
 * but disabled until the row is saved.
 */
export function useCommentSurface(surface: CommentSurfaceInput | null): void {
  const context = useContext(CommentModeContext);
  const registerSurface = context?.registerSurface;

  const clientId = surface?.clientId ?? null;
  const targetType = surface?.targetType ?? null;
  const category = surface?.category ?? null;
  const persisted = surface?.persisted ?? true;

  useEffect(() => {
    if (!registerSurface) return;
    if (!clientId || !targetType) {
      registerSurface(null);
      return;
    }
    registerSurface({ clientId, targetType, category, persisted });
    return () => registerSurface(null);
  }, [registerSurface, clientId, targetType, category, persisted]);
}

export function useCommentMode(): CommentModeValue {
  const value = useContext(CommentModeContext);
  if (!value) {
    throw new Error("useCommentMode must be used within CommentModeProvider");
  }
  return value;
}

export function useOptionalCommentMode(): CommentModeValue | null {
  return useContext(CommentModeContext);
}
