"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_COMMENT_LENGTH,
  formatAttachmentSize,
  type CommentAttachment,
} from "@/lib/comments/types";
import { cn } from "@/lib/utils";
import { useCommentMode } from "./comment-mode-provider";
import { EmojiPicker } from "./emoji-picker";
import {
  MentionTextarea,
  type MentionTextareaHandle,
} from "./mention-textarea";

export interface CommentComposerProps {
  /**
   * Receives the typed body and the already-uploaded attachments. MUST reject on failure —
   * the composer only clears itself once it resolves.
   */
  onSubmit: (body: string, attachments: CommentAttachment[]) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
}

/** An uploaded file waiting to be posted with the comment. */
type PendingAttachment = CommentAttachment & { id: string };

/**
 * The shared comment composer: a mention-aware textarea, a paperclip that uploads straight
 * to R2, removable chips for what's staged, and the submit button. Used by both the rail's
 * main composer and each thread's reply box, so attachments behave identically in both.
 *
 * The upload is two steps, both authorized the same way as commenting itself: ask the
 * server to presign a key under this plan's comment prefix, PUT the file to R2, then send
 * the descriptor with the comment.
 */
export function CommentComposer({
  onSubmit,
  placeholder = "Write a comment…",
  submitLabel = "Comment",
}: CommentComposerProps) {
  const { target, mentionable } = useCommentMode();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Guards a double submit WITHOUT locking the composer.
   *
   * A ref rather than state because it has to be true within the same tick as the second call, which
   * a `setBusy` would not be — and because nothing should look busy while a comment is in flight:
   * the comment is already on screen and the box is already clear.
   */
  const sendingRef = useRef(false);
  // Lets the emoji picker splice a glyph in at the caret rather than appending it.
  const textareaRef = useRef<MentionTextareaHandle>(null);

  const canSubmit = text.trim().length > 0 || pending.length > 0;
  // The counter appears only in the last stretch. A permanent "0 / 10,000" is noise on a
  // limit nobody reaches, but an invisible wall — `maxLength` silently swallowing keystrokes
  // — is worse, so it shows up while there is still room to react.
  const showCount = text.length >= MAX_COMMENT_LENGTH * 0.8;
  const atLimit = text.length >= MAX_COMMENT_LENGTH;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !target) return;

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
        const type = file.type || "application/octet-stream";

        const presign = await fetch(
          `/api/clients/${encodeURIComponent(target.clientId)}/comments/attachments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              type,
              size: file.size,
              category: target.category ?? null,
            }),
          },
        );
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
          headers: { "Content-Type": type },
          body: file,
        });
        if (!put.ok) {
          toast.error(`Could not upload ${file.name}.`);
          continue;
        }

        setPending((prev) => [
          ...prev,
          {
            id: payload.key as string,
            key: payload.key as string,
            name: file.name,
            type,
            size: file.size,
          },
        ]);
      }
    } finally {
      setUploading(false);
      // Allow re-picking the same file after a remove.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submit = async () => {
    // Same guard as the button's `disabled`, so pressing Enter during an upload cannot post a
    // comment that the button would have refused. `sendingRef` and not state, so a second Enter in
    // the same tick cannot double-post.
    if (!canSubmit || sendingRef.current || uploading) return;
    sendingRef.current = true;

    /**
     * Clear BEFORE awaiting the write.
     *
     * The comment is already on screen optimistically (`useCommentThreads` mutates through
     * SWR's optimistic path), so holding the text in the box until the response arrived made a
     * slow round-trip read as a broken one: the advisor watches their comment appear in the
     * list while still staring at the text they just sent, for as long as the write takes.
     *
     * The write still has to succeed. On failure the optimistic message rolls back, and the
     * text and the staged attachments come back with it, so nothing is silently lost.
     *
     * And nothing spins: there is no spinner on the button, because from the advisor's side there is
     * nothing to wait for — showing one would invent latency the UI has already decided not to show.
     */
    const submittedText = text.trim();
    const submittedAttachments = pending.map(({ key, name, type, size }) => ({
      key,
      name,
      type,
      size,
    }));

    setText("");
    setPending([]);
    try {
      await onSubmit(submittedText, submittedAttachments);
    } catch (error) {
      setText(submittedText);
      setPending(
        submittedAttachments.map((attachment) => ({
          ...attachment,
          id: attachment.key,
        })),
      );
      toast.error(
        error instanceof Error ? error.message : "Could not add comment.",
      );
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <MentionTextarea
        ref={textareaRef}
        value={text}
        onValueChange={setText}
        mentionable={mentionable}
        placeholder={placeholder}
        className="min-h-[64px] text-xs"
        maxLength={MAX_COMMENT_LENGTH}
        onSubmit={submit}
      />

      {pending.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {pending.map((file) => (
            <li
              key={file.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatAttachmentSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPending((prev) =>
                    prev.filter((entry) => entry.id !== file.id),
                  )
                }
                className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-red-600"
                aria-label={`Remove ${file.name}`}
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              uploading || pending.length >= MAX_ATTACHMENTS_PER_MESSAGE
            }
            title={
              pending.length >= MAX_ATTACHMENTS_PER_MESSAGE
                ? `Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files`
                : "Attach a file"
            }
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            Attach
          </Button>
          {/* Beside the paperclip. An emoji alone is a valid comment, so this stays enabled on an
              empty box — and never disabled by a submit, because the box is already clear. */}
          <EmojiPicker onPick={(emoji) => textareaRef.current?.insert(emoji)} />
        </div>

        <div className="flex items-center gap-2">
          {/* No `aria-live` on purpose: the value changes on every keystroke, and announcing
              the count each time would bury the text being typed. The cap itself is announced
              by the textarea refusing the input. */}
          {showCount ? (
            <span
              className={cn(
                "tabular-nums text-[10px]",
                atLimit ? "font-medium text-red-600" : "text-muted-foreground",
              )}
              title={`${text.length.toLocaleString()} of ${MAX_COMMENT_LENGTH.toLocaleString()} characters`}
            >
              {text.length.toLocaleString()} / {MAX_COMMENT_LENGTH.toLocaleString()}
            </span>
          ) : null}
          <Button
            size="sm"
            className="h-7 bg-accent-blue px-3 text-[11px] hover:bg-accent-blue/90"
            disabled={uploading || !canSubmit}
            onClick={submit}
          >
            {/* Never a spinner — the comment is already posted as far as this UI is concerned.
                `isMutating` is deliberately not consulted either: it stays true for the whole
                optimistic write, so disabling on it would freeze the box the moment you used it. */}
            <Send className="h-3.5 w-3.5" />
            <span className="ml-1.5">{submitLabel}</span>
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </div>
  );
}
