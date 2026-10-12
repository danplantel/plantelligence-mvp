"use client";

import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * A small, curated emoji set — deliberately not a full picker library.
 *
 * The comment box is a work surface, not a chat app: the emoji people reach for here are
 * "acknowledged", "done", "blocked", a flag and a couple of reactions. 60 hand-picked
 * glyphs cover that with no dependency, no category search and no skin-tone machinery,
 * and because the whole set fits in the bundle the popover opens instantly.
 *
 * If the set ever needs to grow past this, the moment to reach for a real library is
 * before the lists here become a maintenance burden — not after.
 */
const EMOJI_GROUPS: { label: string; emoji: readonly string[] }[] = [
  {
    label: "People",
    emoji: [
      "😀", "😄", "😁", "🙂", "😉", "😊", "😍", "🤩",
      "😎", "🤔", "🙌", "👏", "👍", "👎", "🙏", "💪",
      "🤝", "👀", "🎉", "🥳",
    ],
  },
  {
    label: "Work",
    emoji: [
      "✅", "❌", "⚠️", "❓", "❗", "📌", "📎", "📝",
      "📄", "📊", "📈", "📉", "💡", "⏰", "📅", "🔒",
      "🔑", "🧾", "💼", "🏦",
    ],
  },
  {
    label: "Reactions",
    emoji: [
      "❤️", "💙", "💚", "💛", "🧡", "💜", "🖤", "💯",
      "✨", "⭐", "🚀", "🐛", "🔍", "⚡", "💬", "☕",
      "🎯", "🧠", "🩺", "🏥",
    ],
  },
];

/**
 * The composer's emoji button and its popover grid.
 *
 * Picking an emoji hands the glyph back to the caller rather than owning any text — the
 * composer splices it into the textarea through `MentionTextarea`'s imperative handle, so
 * the emoji lands at the caret instead of at the end of the message. That also means the
 * button is meaningful on an otherwise empty box: an emoji alone is a valid comment.
 *
 * The popover closes on pick (focus returns to the textarea so typing continues straight
 * after the glyph), which is the common case; adding several means reopening it.
 */
export function EmojiPicker({
  onPick,
  disabled,
}: {
  /** Receives the chosen glyph. The caller decides where it goes. */
  onPick: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          disabled={disabled}
          aria-label="Add an emoji"
          title="Emoji"
        >
          <Smile className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      {/* Opens upward: the composer is pinned to the bottom of the rail. */}
      <PopoverContent align="start" side="top" className="w-64 p-2">
        <div className="comment-scroll max-h-56 space-y-3 overflow-y-auto pr-1">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emoji.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onPick(emoji)}
                    className="rounded-md p-1 text-base leading-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    aria-label={`Insert ${emoji}`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
