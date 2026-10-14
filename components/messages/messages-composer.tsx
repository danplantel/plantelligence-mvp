"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker } from "@/components/comments/emoji-picker";
import { cn } from "@/lib/utils";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_DIRECT_MESSAGE_LENGTH,
  formatAttachmentSize,
  type DirectAttachment,
} from "@/lib/messages/types";

/**
 * The message composer: a textarea, a paperclip that uploads straight to R2, removable chips for
 * what is staged, and Send.
 *
 * `onSubmit` MUST reject on failure. The composer clears itself only once it resolves, which is what
 * keeps the text and the staged files through a refused write — the alternative loses whatever the
 * reader typed to a transient 403. The rail's `send` rolls its optimistic message back for the same
 * reason, so the two halves fail together instead of one of them lying.
 *
 * The upload is presigned per file by `POST /api/messages/attachments`, which checks thread
 * participation BEFORE minting a key — a presigned URL is a capability, so the read guard later is
 * too late to matter.
 */
export function MessagesComposer({
  threadId,
  onSubmit,
  onTyping,
  placeholder = "Write a message…",
}: {
  threadId: string;
  onSubmit: (body: string, attachments: DirectAttachment[]) => Promise<void>;
  /** Fired on the reader's own input so the peer can be told. Throttled by the caller. */
  onTyping?: () => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<DirectAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Lets the emoji picker splice a glyph in at the caret rather than appending it.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Guards a double send WITHOUT locking the composer.
   *
   * A ref and not state on purpose: it has to be true within the same tick as the second call, which
   * a `setBusy` would not be. Crucially it is invisible — nothing is disabled while a message is in
   * flight, because the whole point is that sending never feels like waiting.
   */
  const sendingRef = useRef(false);

  // An attachment alone is a complete message — "look at this" needs no caption — so either one
  // enables Send. A send in flight is not a reason to disable it: the box is already empty.
  const canSend =
    (draft.trim().length > 0 || pending.length > 0) && !uploading;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const room = MAX_ATTACHMENTS_PER_MESSAGE - pending.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files.`);
      return;
    }

    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is too large (max 15 MB).`);
          continue;
        }

        const presign = await fetch("/api/messages/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
          }),
        });
        const payload = (await presign.json().catch(() => ({}))) as {
          uploadUrl?: string;
          key?: string;
          error?: string;
        };
        if (!presign.ok || !payload.uploadUrl || !payload.key) {
          toast.error(payload.error ?? `Could not prepare ${file.name}.`);
          continue;
        }

        const put = await fetch(payload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) {
          toast.error(`Could not upload ${file.name}.`);
          continue;
        }

        setPending((prev) => [
          ...prev,
          {
            key: payload.key as string,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
          },
        ]);
      }
    } finally {
      setUploading(false);
      // Lets the same file be chosen again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /**
   * Send — and make it feel instant, the way a chat app does.
   *
   * The message is ALREADY on screen by the time this runs: `useDirectThread` writes it through
   * SWR's optimistic path, so the bubble, the inbox preview and the ordering all move immediately.
   * That is exactly why the box is cleared here and now rather than in a `then`: holding the text
   * until the round trip returned meant watching your own message appear while still staring at the
   * words that produced it, for as long as the write took. On a slow link the box looked stuck, and
   * the natural response — pressing Send again — was the one thing that made it worse.
   *
   * Nothing spins. There is no spinner on the button because from the reader's side there is nothing
   * in flight to wait for; a spinner here would *invent* latency the UI has already decided not to
   * show.
   *
   * Failure is fully recoverable, which is what makes the optimism safe: the optimistic bubble rolls
   * back (`rollbackOnError`) and the text and staged files come back with it, so nothing is silently
   * lost. Restoring unconditionally matches the comments composer, so the two behave identically.
   */
  const submit = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;

    const submittedText = draft;
    const submittedAttachments = pending;

    setDraft("");
    setPending([]);

    try {
      await onSubmit(submittedText, submittedAttachments);
    } catch (error) {
      setDraft(submittedText);
      setPending(submittedAttachments);
      toast.error((error as Error)?.message ?? "Could not send that message.");
    } finally {
      sendingRef.current = false;
    }
  };

  const remaining = MAX_DIRECT_MESSAGE_LENGTH - draft.length;

  /**
   * Splice a glyph in at the CARET, not at the end.
   *
   * The comments composer does this through `MentionTextarea`'s imperative handle, but a DM carries
   * no mentions, so a plain textarea and a direct splice is the whole requirement — and it keeps the
   * mention machinery out of this feature. The caret is restored on the next frame, after React has
   * committed the new value; without that the selection collapses to the end of the box.
   */
  const insertAtCaret = (glyph: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? start;
    const next = draft.slice(0, start) + glyph + draft.slice(end);
    // A splice bypasses the textarea's `maxLength`, so the limit is re-applied here — the server
    // must never be the one to refuse an over-long body.
    if (next.length > MAX_DIRECT_MESSAGE_LENGTH) return;
    const caret = start + glyph.length;
    setDraft(next);
    // An emoji is input like any other keystroke, so it counts as typing.
    onTyping?.();
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="shrink-0 border-t border-border p-3">
      {pending.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {pending.map((attachment) => (
            <li
              key={attachment.key}
              className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-[10px]"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{attachment.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatAttachmentSize(attachment.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                className="shrink-0 rounded-full p-0.5 hover:text-destructive"
                onClick={() =>
                  setPending((prev) =>
                    prev.filter((item) => item.key !== attachment.key),
                  )
                }
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onTyping?.();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            void submit();
          }}
          placeholder={placeholder}
          rows={1}
          maxLength={MAX_DIRECT_MESSAGE_LENGTH}
          aria-label="Write a message"
          className="min-h-[38px] max-h-32 resize-none text-xs"
        />

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => inputRef.current?.click()}
          disabled={
            uploading || pending.length >= MAX_ATTACHMENTS_PER_MESSAGE
          }
          aria-label="Attach a file"
          title={
            pending.length >= MAX_ATTACHMENTS_PER_MESSAGE
              ? `Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files`
              : "Attach a file"
          }
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>

        {/* The comments picker, reused. An emoji alone is a valid message, so it stays enabled on an
            empty box — and it is never disabled by a send, because the box is already clear. */}
        <EmojiPicker onPick={(emoji) => insertAtCaret(emoji)} />

        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send"
          title="Send (Enter)"
        >
          {/* Never a spinner. The message is already sent as far as this UI is concerned. */}
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Enter to send, Shift+Enter for a new line</span>
        {/* Only in the last stretch: a permanent counter is noise on a limit nobody reaches. */}
        {remaining <= MAX_DIRECT_MESSAGE_LENGTH * 0.2 && (
          <span className={cn(remaining <= 0 && "font-semibold text-destructive")}>
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
}
