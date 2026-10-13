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
import { useSession } from "next-auth/react";
import { useDirectInbox } from "@/hooks/useDirectThreads";
import { useMessagesLayout } from "@/lib/messages/messages-layout";
import { useRightPanel } from "@/lib/right-panel";
import type { DirectConversationView } from "@/lib/messages/types";

/** localStorage key holding the reader's Messages open/closed preference. */
const MODE_STORAGE_KEY = "messages:mode";

/** The query parameter a notification's `href` carries to open a specific conversation. */
const THREAD_PARAM = "messages";

type MessagesMode = "off" | "on";

interface MessagesModeValue {
  mode: MessagesMode;
  /** True when the rail is actually on screen (the mode is on and nothing has evicted it). */
  open: boolean;
  setMode: (next: MessagesMode) => void;
  toggle: () => void;

  conversations: DirectConversationView[];
  unreadTotal: number;
  isLoading: boolean;
  error: string | null;
  errorStatus: number | null;
  refresh: () => void;

  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;

  /** The signed-in user's id, so the rail can label their own messages "You". */
  currentUserId: string | null;
}

const MessagesModeContext = createContext<MessagesModeValue | null>(null);

/**
 * Owns the Messages rail: whether it is open, what it is showing, and the inbox behind it.
 *
 * Mounted once in the dashboard layout beside `CommentModeProvider`, and it claims the right-hand
 * column through `lib/right-panel.ts` — so opening Messages closes Comments and vice versa. The
 * inbox lives here rather than in the rail because the header badge needs it while the rail is
 * closed, which is exactly when it matters.
 */
export function MessagesModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<MessagesMode>("off");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;

  // Restore the reader's preference once on the client. Absent or blocked storage just leaves the
  // rail closed.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MODE_STORAGE_KEY) === "on") {
        setModeState("on");
      }
    } catch {
      // Private mode / storage disabled — the rail defaults to closed.
    }
  }, []);

  const setMode = useCallback((next: MessagesMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // The preference is a nicety; the session still reflects it.
    }
  }, []);

  const open = mode === "on";

  // Losing the column closes the rail: the arbiter notifies only when the OTHER panel has taken it,
  // so this cannot fire for our own claim.
  const setModeRef = useRef(setMode);
  setModeRef.current = setMode;
  useRightPanel("messages", open, () => setModeRef.current("off"));

  useMessagesLayout(open);

  const inbox = useDirectInbox();

  /**
   * A notification's deep link: `?messages=<threadId>` opens the rail on that conversation.
   *
   * Read from the URL in an effect (a client page needs no Suspense boundary). The thread id is
   * used directly rather than looked up in the inbox — the recipient may be opening a conversation
   * that the poll has not returned yet, and the id is all the thread read needs.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get(THREAD_PARAM);
    if (!id) return;
    setActiveThreadId(id);
    setMode("on");
  }, [setMode]);

  // Keyboard shortcut: Shift+M toggles messages, unless the reader is typing — the same guard the
  // comments shortcut uses. The two panels are mutually exclusive, so neither shortcut can mask
  // the other by opening underneath it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== "m") return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      event.preventDefault();
      setMode(mode === "on" ? "off" : "on");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, setMode]);

  /**
   * Escape closes the rail — the promise the plan makes for the panel.
   *
   * Guarded against a focused field on purpose: the composer keeps its draft in local state and the
   * rail unmounts when it closes, so an unguarded Escape would silently discard a half-written
   * message. Escape from the panel's own chrome closes it; Escape from inside a field does not.
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      setMode("off");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setMode]);

  const toggle = useCallback(() => {
    setMode(mode === "on" ? "off" : "on");
  }, [mode, setMode]);

  const value = useMemo<MessagesModeValue>(
    () => ({
      mode,
      open,
      setMode,
      toggle,
      conversations: inbox.conversations,
      unreadTotal: inbox.unreadTotal,
      isLoading: inbox.isLoading,
      error: inbox.error,
      errorStatus: inbox.errorStatus,
      refresh: inbox.refresh,
      activeThreadId,
      setActiveThreadId,
      currentUserId,
    }),
    [
      mode,
      open,
      setMode,
      toggle,
      inbox.conversations,
      inbox.unreadTotal,
      inbox.isLoading,
      inbox.error,
      inbox.errorStatus,
      inbox.refresh,
      activeThreadId,
      currentUserId,
    ],
  );

  return (
    <MessagesModeContext.Provider value={value}>
      {children}
    </MessagesModeContext.Provider>
  );
}

export function useMessagesMode(): MessagesModeValue {
  const value = useContext(MessagesModeContext);
  if (!value) {
    throw new Error("useMessagesMode must be used within MessagesModeProvider");
  }
  return value;
}

/** Null outside the provider, so a rail rendered by mistake is inert rather than fatal. */
export function useOptionalMessagesMode(): MessagesModeValue | null {
  return useContext(MessagesModeContext);
}
