"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker } from "@/components/comments/emoji-picker";
import {
  StagedAttachmentList,
  useStagedAttachments,
} from "@/components/comments/staged-attachments";
import { cn } from "@/lib/utils";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_DIRECT_MESSAGE_LENGTH,
  type DirectAttachment,
} from "@/lib/messages/types";

/**
 * Put ONE file under this thread's attachment prefix and return its key, or null.
 *
 * Never throws, for the same reason its comment-side twin does not: the staging hook turns a null
 * into a visibly failed chip, and an unhandled rejection would leave an entry waiting forever behind
 * no spinner and no message.
 *
 * Unlike the comment upload this has no same-origin relay, and it does not need one: the DM rail is
 * mounted only in the dashboard, so the browser→R2 PUT is never made from the portal's origin — which
 * is the only case where the bucket's CORS policy could refuse it. If the rail is ever mounted
 * somewhere else, that assumption is the thing to revisit first.
 *
 * `POST /api/messages/attachments` checks thread participation BEFORE minting a key — a presigned URL
 * is a capability, so a later read guard would be too late to matter.
 */
async function uploadDirectAttachment(input: {
  file: File;
  threadId: string;
}): Promise<string | null> {
  const { file, threadId } = input;
  if (!threadId) return null;

  const type = file.type || "application/octet-stream";

  try {
    const presign = await fetch("/api/messages/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, name: file.name, type, size: file.size }),
    });
    const payload = (await presign.json().catch(() => ({}))) as {
      uploadUrl?: string;
      key?: string;
      error?: string;
    };
    if (!presign.ok || !payload.uploadUrl || !payload.key) {
      toast.error(payload.error ?? `Could not prepare ${file.name}.`);
      return null;
    }

    const put = await fetch(payload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": type },
      body: file,
    });
    if (!put.ok) {
      toast.error(`Could not upload ${file.name}.`);
      return null;
    }

    return payload.key;
  } catch {
    // Reported rather than swallowed: this used to reject into a `finally` with no `catch`, so the
    // spinner stopped and nothing else happened.
    toast.error(`Could not upload ${file.name}.`);
    return null;
  }
}

/**
 * The message composer: a textarea, a paperclip, removable chips for what is staged, and Send.
 *
 * `onSubmit` MUST reject on failure. The composer clears itself only once it resolves, which is what
 * keeps the text and the staged files through a refused write — the alternative loses whatever the
 * reader typed to a transient 403. The rail's `send` rolls its optimistic message back for the same
 * reason, so the two halves fail together instead of one of them lying.
 *
 * The staging — previews, per-file state, waiting for this message's own files — is shared with the
 * comments composer: [`useStagedAttachments`](../comments/staged-attachments).
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

  const staging = useStagedAttachments({
    upload: (file) => uploadDirectAttachment({ file, threadId }),
    maxAttachments: MAX_ATTACHMENTS_PER_MESSAGE,
    maxBytes: MAX_ATTACHMENT_BYTES,
  });

  const { entries } = staging;
  // An attachment alone is a complete message — "look at this" needs no caption — so either one
  // enables Send. A file still uploading does NOT disable it: `collect` waits for it below, which is
  // the same guarantee without freezing the box for an unrelated reason.
  const canSend = draft.trim().length > 0 || entries.length > 0;

  const handleFiles = (files: FileList | null) => {
    staging.stage(files);
    // Lets the same file be chosen again after a failure.
    if (inputRef.current) inputRef.current.value = "";
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
   * The staged FILES are the exception, and deliberately: they are the only thing showing that an
   * upload is still running, so they stay until they are on their way.
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
    setDraft("");

    const submittedAttachments = await staging.collect();
    if (!submittedAttachments) {
      // A file will never arrive. Say so and put the text back rather than sending a message the
      // reader believes carries a picture it does not.
      setDraft(submittedText);
      sendingRef.current = false;
      toast.error("Some files could not be uploaded. Remove them and try again.");
      return;
    }

    staging.clear();

    try {
      await onSubmit(submittedText, submittedAttachments);
    } catch (error) {
      setDraft(submittedText);
      staging.restore(submittedAttachments);
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
      <StagedAttachmentList
        entries={entries}
        onRemove={staging.remove}
        className="mb-2"
      />

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
          onChange={(event) => handleFiles(event.target.files)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => inputRef.current?.click()}
          // Not disabled while a file uploads — its state is on the chip, and staging another behind
          // it is not a race.
          disabled={entries.length >= MAX_ATTACHMENTS_PER_MESSAGE}
          aria-label="Attach a file"
          title={
            entries.length >= MAX_ATTACHMENTS_PER_MESSAGE
              ? `Up to ${MAX_ATTACHMENTS_PER_MESSAGE} files`
              : "Attach a file"
          }
        >
          {staging.uploading ? (
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
          // Text, or a file that is at least staged. `collect` handles the in-flight ones.
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
