"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_COMMENT_LENGTH,
  type CommentAttachment,
} from "@/lib/comments/types";
import { cn } from "@/lib/utils";
import { useCommentMode } from "./comment-mode-provider";
import { EmojiPicker } from "./emoji-picker";
import {
  MentionTextarea,
  type MentionTextareaHandle,
} from "./mention-textarea";
import {
  StagedAttachmentList,
  useStagedAttachments,
} from "./staged-attachments";

export interface CommentComposerProps {
  /**
   * Receives the typed body and the already-uploaded attachments. MUST reject on failure —
   * the composer only clears itself once it resolves.
   */
  onSubmit: (body: string, attachments: CommentAttachment[]) => Promise<void>;
  /**
   * Fired on the reader's own input, so a thread can be told they are typing. Throttled by the
   * caller.
   *
   * Only the REPLY composer passes this. The rail's persistent composer has no thread to attribute a
   * signal to — a thread does not exist until the first comment is posted, and creating one just to
   * say "typing" would litter the list with empty threads nobody ever finished.
   */
  onTyping?: () => void;
  placeholder?: string;
  submitLabel?: string;
}

/**
 * Put ONE file under this plan's comment prefix and return its key, or null.
 *
 * Deliberately never throws — the staging hook turns a null into a visibly failed chip, and a
 * rejection into the same thing. The shape this replaces was a `try`/`finally` with **no `catch`**
 * around two `fetch` calls, so a blocked or failed upload rejected into nothing at all: the spinner
 * stopped, no chip appeared, and no message was shown.
 *
 * TWO ATTEMPTS, and the second is the point:
 *
 *  1. Ask the server to presign a key, then PUT the file straight to R2. The fast path.
 *  2. If that cannot complete, send the bytes THROUGH our own origin, which stores them in R2
 *     server-side. A direct PUT is cross-origin, so it depends on the bucket's CORS policy naming the
 *     origin this page is served from — and the Portal Comments UI is served at the environment ROOT
 *     while the dashboard may be on a different host. Every other upload in this app has the same
 *     fallback; comments were the last one without it.
 *
 * A refusal from OUR OWN route (no access, too large, storage not configured) is reported and NOT
 * retried: the relay would be refused for exactly the same reason.
 */
async function uploadCommentAttachment(input: {
  file: File;
  clientId: string;
  category: string | null;
}): Promise<string | null> {
  const { file, clientId, category } = input;
  if (!clientId) return null;

  const type = file.type || "application/octet-stream";
  const endpoint = `/api/clients/${encodeURIComponent(
    clientId,
  )}/comments/attachments`;

  try {
    const presign = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, type, size: file.size, category }),
    });
    const payload = (await presign.json().catch(() => ({}))) as {
      uploadUrl?: string;
      key?: string;
      error?: string;
    };

    if (!presign.ok) {
      toast.error(payload.error ?? `Could not prepare ${file.name}.`);
      return null;
    }

    if (payload.uploadUrl && payload.key) {
      const put = await fetch(payload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": type },
        body: file,
      });
      if (put.ok) return payload.key;
    }
  } catch {
    // The cross-origin step threw. Fall through to the relay rather than give up silently.
  }

  try {
    const form = new FormData();
    form.append("file", file);
    if (category) form.append("category", category);
    const relay = await fetch(endpoint, { method: "POST", body: form });
    const payload = (await relay.json().catch(() => ({}))) as {
      key?: string;
      error?: string;
    };
    if (relay.ok && payload.key) return payload.key;
    toast.error(payload.error ?? `Could not upload ${file.name}.`);
    return null;
  } catch {
    toast.error(`Could not upload ${file.name}.`);
    return null;
  }
}

/**
 * The shared comment composer: a mention-aware textarea, a paperclip, removable chips for what's
 * staged, and the submit button. Used by both the rail's main composer and each thread's reply box,
 * so attachments behave identically in both.
 *
 * The staging itself — the previews, the per-file state, waiting for this message's own files — lives
 * in [`useStagedAttachments`](./staged-attachments), shared with the DM composer so the two cannot
 * drift into behaving differently.
 */
export function CommentComposer({
  onSubmit,
  onTyping,
  placeholder = "Write a comment…",
  submitLabel = "Comment",
}: CommentComposerProps) {
  const { target, mentionable } = useCommentMode();
  const [text, setText] = useState("");
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

  const staging = useStagedAttachments({
    // Resolves to null rather than throwing when there is no surface yet: the chip then shows as
    // failed, which is the truth — the key could not be minted for a plan we do not know.
    upload: (file) =>
      target
        ? uploadCommentAttachment({
            file,
            clientId: target.clientId,
            category: target.category ?? null,
          })
        : Promise.resolve(null),
    maxAttachments: MAX_ATTACHMENTS_PER_MESSAGE,
    maxBytes: MAX_ATTACHMENT_BYTES,
  });

  const { entries } = staging;
  const canSubmit = text.trim().length > 0 || entries.length > 0;
  // The counter appears only in the last stretch. A permanent "0 / 10,000" is noise on a
  // limit nobody reaches, but an invisible wall — `maxLength` silently swallowing keystrokes
  // — is worse, so it shows up while there is still room to react.
  const showCount = text.length >= MAX_COMMENT_LENGTH * 0.8;
  const atLimit = text.length >= MAX_COMMENT_LENGTH;

  const handleFiles = (files: FileList | null) => {
    staging.stage(files);
    // Allow re-picking the same file after a remove.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    // `sendingRef` and not state, so a second Enter in the same tick cannot double-post. The button
    // is NOT disabled while a file uploads any more: waiting on this message's own files is what
    // `collect` does below, and gating the whole control on a global flag meant an attachment-free
    // comment could not be sent while an unrelated file was still moving.
    if (!canSubmit || sendingRef.current) return;
    sendingRef.current = true;

    /**
     * Clear the TEXT before awaiting anything.
     *
     * The comment is already on screen optimistically (`useCommentThreads` mutates through SWR's
     * optimistic path), so holding the text in the box until the response arrived made a slow
     * round-trip read as a broken one: the advisor watches their comment appear in the list while
     * still staring at the text they just sent, for as long as the write takes.
     *
     * The CHIPS stay until the files are actually on their way, because they are the only thing
     * showing that an upload is still running.
     */
    const submittedText = text.trim();
    setText("");

    const submittedAttachments = await staging.collect();
    if (!submittedAttachments) {
      // Something will never arrive. Put the text back and say so rather than sending a comment the
      // reader believes carries a file it does not.
      setText(submittedText);
      sendingRef.current = false;
      toast.error("Some files could not be uploaded. Remove them and try again.");
      return;
    }

    staging.clear();
    try {
      await onSubmit(submittedText, submittedAttachments);
    } catch (error) {
      // The write was refused, so nothing was lost but nothing was stored either: the text and the
      // (already uploaded) files come back with it.
      setText(submittedText);
      staging.restore(submittedAttachments);
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
        onValueChange={(next) => {
          setText(next);
          onTyping?.();
        }}
        mentionable={mentionable}
        placeholder={placeholder}
        className="min-h-[64px] text-xs"
        maxLength={MAX_COMMENT_LENGTH}
        onSubmit={submit}
      />

      <StagedAttachmentList
        entries={entries}
        onRemove={staging.remove}
        className="mt-2"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            // Not disabled while a file uploads: its progress is on the chip now, and staging another
            // file behind it is not a race — each upload is independent.
            disabled={entries.length >= MAX_ATTACHMENTS_PER_MESSAGE}
            title={
              entries.length >= MAX_ATTACHMENTS_PER_MESSAGE
                ? `Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files`
                : "Attach a file"
            }
          >
            {staging.uploading ? (
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
            // Only what the reader can see: text, or a file that is at least staged. A send in
            // flight is not consulted — `sendingRef` covers the double-press without a dead button.
            disabled={!canSubmit}
            onClick={submit}
          >
            {/* Never a spinner — `collect` waits on the files, so the button does not have to say so.
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
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
