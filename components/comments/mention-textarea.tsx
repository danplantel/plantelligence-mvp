"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MentionableUser } from "@/lib/comments/types";

/** Matches an in-progress `@Name` token immediately before the caret. */
const MENTION_QUERY = /@([\p{L}\p{N} .'\-]*)$/u;

export interface MentionTextareaProps {
  value: string;
  onValueChange: (next: string) => void;
  mentionable: MentionableUser[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  rows?: number;
  maxLength?: number;
  /** Called on Enter (and Cmd/Ctrl+Enter). Shift+Enter is a newline, never a submit. */
  onSubmit?: () => void;
}

/**
 * Imperative surface for callers that insert on the writer's behalf — the emoji picker is
 * the one that needs it.
 *
 * A caret-aware insert has to live where the textarea's selection does, and it must not
 * become a second implementation of "splice text into the value": the mention autocomplete
 * below is the first one, and both now share `insertAtCaret`.
 */
export interface MentionTextareaHandle {
  /** Insert at the caret, replacing the selection; the caret ends up after the text. */
  insert: (text: string) => void;
}

/**
 * A Textarea with `@mention` autocomplete. Typing `@` (then letters) opens a short
 * list; Arrow keys move, Enter/Tab inserts, Escape dismisses. Inserting writes the
 * plain `@Name` token — the server re-parses mentions on save, so the client never
 * has to send ids.
 *
 * Enter submits and Shift+Enter adds a newline — see the `onKeyDown` comments for why the
 * mention list takes precedence over that, and why IME composition is exempt.
 *
 * `ref` exposes `insert(text)` for insertion at the caret — see `MentionTextareaHandle`.
 */
export const MentionTextarea = forwardRef<
  MentionTextareaHandle,
  MentionTextareaProps
>(function MentionTextarea(
  {
    value,
    onValueChange,
    mentionable,
    placeholder,
    className,
    autoFocus,
    rows,
    maxLength,
    onSubmit,
  },
  handleRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (query === null) return [];
    const term = query.toLowerCase();
    return mentionable
      .filter((user) => user.name.toLowerCase().includes(term))
      .slice(0, 6);
  }, [query, mentionable]);

  const open = query !== null && matches.length > 0;

  const detectQuery = (el: HTMLTextAreaElement) => {
    const caret = el.selectionStart ?? 0;
    const match = MENTION_QUERY.exec(el.value.slice(0, caret));
    if (match) {
      setQuery(match[1]);
      setHighlight(0);
    } else {
      setQuery(null);
    }
  };

  const insert = (user: MentionableUser) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const match = MENTION_QUERY.exec(el.value.slice(0, caret));
    const start = match ? caret - match[0].length : caret;
    const next = `${el.value.slice(0, start)}@${user.name} ${el.value.slice(caret)}`;
    onValueChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const position = start + user.name.length + 2;
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  /**
   * The generic splice: replace the selection (or insert at the caret) and leave the caret
   * after what was inserted. Reads the DOM value rather than the `value` prop so back-to-back
   * inserts in one tick cannot overwrite each other.
   */
  const insertAtCaret = (text: string) => {
    const el = ref.current;
    if (!el) {
      onValueChange(`${value}${text}`);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    onValueChange(`${el.value.slice(0, start)}${text}${el.value.slice(end)}`);
    requestAnimationFrame(() => {
      const position = start + text.length;
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  // No dependency array: the handle is rebuilt each render, so it always closes over the
  // current `insertAtCaret` and can never go stale mid-composition.
  useImperativeHandle(handleRef, () => ({ insert: insertAtCaret }));

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        autoFocus={autoFocus}
        maxLength={maxLength}
        placeholder={placeholder}
        className={className}
        onChange={(event) => {
          onValueChange(event.target.value);
          detectQuery(event.target);
        }}
        onKeyDown={(event) => {
          // The open mention list owns Enter/Tab FIRST: picking a teammate out of the popup
          // must never submit the half-typed comment. Shift+Enter is exempt from the Enter
          // arm so it stays a newline even while the popup is showing.
          if (open) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlight((h) => (h + 1) % matches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((h) => (h - 1 + matches.length) % matches.length);
              return;
            }
            if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
              event.preventDefault();
              insert(matches[highlight]);
              return;
            }
            if (event.key === "Escape") {
              setQuery(null);
              return;
            }
          }

          // Enter submits, Cmd/Ctrl+Enter included. Shift+Enter deliberately falls through
          // to the browser so a comment can still be multi-line.
          if (event.key === "Enter" && !event.shiftKey) {
            // An IME uses Enter to confirm a composition (Japanese, Korean, Chinese…).
            // Submitting there would post a half-converted comment, so let it through.
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            onSubmit?.();
          }
        }}
        // Delay so a click on a suggestion lands before the list unmounts.
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
      />
      {open ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {matches.map((user, index) => (
            <li key={user.userId}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  index === highlight
                    ? "bg-accent-blue/10 text-accent-blue"
                    : "hover:bg-muted",
                )}
                // Keep focus in the textarea so the caret survives the insert.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(user)}
              >
                <span className="truncate font-medium">{user.name}</span>
                <span className="ml-auto truncate text-[10px] text-muted-foreground">
                  {user.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

MentionTextarea.displayName = "MentionTextarea";
