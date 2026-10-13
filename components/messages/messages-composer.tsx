"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  placeholder = "Write a message…",
}: {
  threadId: string;
  onSubmit: (body: string, attachments: DirectAttachment[]) => Promise<void>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<DirectAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // An attachment alone is a complete message — "look at this" needs no caption — so either one
  // enables Send.
  const canSend =
    (draft.trim().length > 0 || pending.length > 0) && !busy && !uploading;

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

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSubmit(draft, pending);
      setDraft("");
      setPending([]);
    } catch (error) {
      toast.error((error as Error)?.message ?? "Could not send that message.");
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX_DIRECT_MESSAGE_LENGTH - draft.length;

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
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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
            uploading || busy || pending.length >= MAX_ATTACHMENTS_PER_MESSAGE
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

        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send"
          title="Send (Enter)"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
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
