"use client";

import { useMemo, useRef, useState } from "react";
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
  /** Cmd/Ctrl+Enter. */
  onSubmit?: () => void;
}

/**
 * A Textarea with `@mention` autocomplete. Typing `@` (then letters) opens a short
 * list; Arrow keys move, Enter/Tab inserts, Escape dismisses. Inserting writes the
 * plain `@Name` token — the server re-parses mentions on save, so the client never
 * has to send ids.
 */
export function MentionTextarea({
  value,
  onValueChange,
  mentionable,
  placeholder,
  className,
  autoFocus,
  rows,
  maxLength,
  onSubmit,
}: MentionTextareaProps) {
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
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              insert(matches[highlight]);
              return;
            }
            if (event.key === "Escape") {
              setQuery(null);
              return;
            }
          }
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
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
}
