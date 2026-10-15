"use client";

/**
 * staged-attachments — files a reader has picked but not yet sent.
 *
 * Extracted because the comments composer and the DM composer need exactly this, and two copies of it
 * is how the two would drift — the same reasoning that put the scroll helper and the "N new messages"
 * pill in one place each (see `lib/scroll-to-bottom.ts`, `components/new-messages-pill.tsx`). It lives
 * under `components/comments/` because that is already where the shared bits both panels use live,
 * `CommentAttachmentModal` included.
 *
 * THREE THINGS IT OWNS, and each is a decision rather than plumbing:
 *
 *  1. **The preview is an Object URL, not a Data URL.** `URL.createObjectURL(file)` is a handle on
 *     bytes already in memory; a Data URL is a base64 string that inflates the image by a third and
 *     materialises it as a multi-megabyte string. A Data URL only earns that when the value has to
 *     cross a serialization boundary — a reload, a stored draft, a service worker — and none of that
 *     is in play here: the picture is on screen for a few seconds and then it is an R2 key. It must
 *     also never reach the database: the attachment column stores `{ key, name, type, size }`, and
 *     these rows come back on a 10-second poll, so a base64 body would be paid for on every poll
 *     forever. (`MAX_COMMENT_LENGTH` is 10,000 characters anyway, so it could not ride in the body.)
 *
 *  2. **The entry exists BEFORE the upload does.** That is what makes the picture appear the instant
 *     it is picked, and it is why the loading and failed states live on the chip rather than in a
 *     spinner that replaces the whole control.
 *
 *  3. **`collect()` waits for THIS message's files and nothing else.** The composers used to gate Send
 *     on a global `uploading` flag, so a slow upload disabled the button for everything — including a
 *     comment with no attachment at all. Waiting on the files the reader actually staged is the same
 *     guarantee without the collateral.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  formatAttachmentSize,
  isImageAttachment,
} from "@/lib/comments/types";
import { cn } from "@/lib/utils";

/** What the caller's upload returns, and what the server stores. */
export interface UploadedAttachment {
  key: string;
  name: string;
  type: string;
  size: number;
}

export interface StagedAttachment {
  /** Stable for the life of the entry — the preview and its upload promise are both keyed by it. */
  id: string;
  name: string;
  type: string;
  size: number;
  /** An Object URL when the file is an image, so the thumbnail is instant. Null otherwise. */
  previewUrl: string | null;
  /** The R2 key, once the upload lands. Null while it is still in flight. */
  key: string | null;
  /** True when the upload gave up. The entry stays so the reader can see it and take it off. */
  failed: boolean;
}

export interface StagedAttachmentsResult {
  entries: StagedAttachment[];
  /** Stage a picker's selection. Applies the count and size limits, and toasts when it refuses. */
  stage: (files: FileList | null) => void;
  remove: (id: string) => void;
  /**
   * The attachments to send, or null when any of them will never arrive.
   *
   * Awaits every upload this list is still waiting on. Null is a REFUSAL, not an empty result: the
   * caller must not send the message without them, because dropping a file the reader watched appear
   * is worse than not sending.
   */
  collect: () => Promise<UploadedAttachment[] | null>;
  /** Let the list go, releasing every preview. Called once the message is on its way. */
  clear: () => void;
  /** Put already-uploaded attachments back after a refused write, so nothing is lost. */
  restore: (attachments: UploadedAttachment[]) => void;
  /** Files still in flight — a hint for the paperclip, NEVER a gate on sending. */
  uploading: boolean;
  failed: boolean;
}

export function useStagedAttachments(input: {
  /** Uploads ONE file and resolves to its key, or null. Must not reject — see `stage`. */
  upload: (file: File) => Promise<string | null>;
  maxAttachments: number;
  maxBytes: number;
}): StagedAttachmentsResult {
  const { upload, maxAttachments, maxBytes } = input;
  const [entries, setEntries] = useState<StagedAttachment[]>([]);
  const uploadsRef = useRef(new Map<string, Promise<string | null>>());
  // A mirror for the callbacks, so `collect` reads the list as it is at call time rather than as it
  // was when the callback was created.
  const entriesRef = useRef<StagedAttachment[]>([]);
  entriesRef.current = entries;

  // Previews are handles into memory, so they have to be handed back. Every one still here when the
  // composer unmounts is released — otherwise closing a rail with a picture staged leaks it.
  useEffect(() => {
    return () => {
      for (const entry of entriesRef.current) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
    };
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const target = prev.find((entry) => entry.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((entry) => entry.id !== id);
    });
    uploadsRef.current.delete(id);
  }, []);

  const stage = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const room = maxAttachments - entriesRef.current.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${maxAttachments} files.`);
        return;
      }

      for (const file of Array.from(files).slice(0, room)) {
        if (file.size > maxBytes) {
          toast.error(`${file.name} is too large (max 15 MB).`);
          continue;
        }

        const type = file.type || "application/octet-stream";
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setEntries((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            type,
            size: file.size,
            // Only an image needs a preview, and only an image should pay for one.
            previewUrl: isImageAttachment(type)
              ? URL.createObjectURL(file)
              : null,
            key: null,
            failed: false,
          },
        ]);

        // `upload` must not reject; the catch here is the backstop that turns a broken one into a
        // visible failure instead of an entry that waits forever with no spinner and no message.
        uploadsRef.current.set(
          id,
          upload(file)
            .catch(() => null)
            .then((key) => {
              setEntries((prev) =>
                prev.map((entry) =>
                  entry.id === id ? { ...entry, key, failed: key === null } : entry,
                ),
              );
              return key;
            }),
        );
      }
    },
    [upload, maxAttachments, maxBytes],
  );

  const collect = useCallback(async (): Promise<
    UploadedAttachment[] | null
  > => {
    const staged = entriesRef.current;
    if (staged.length === 0) return [];

    const keys = await Promise.all(
      staged.map(
        (entry) => uploadsRef.current.get(entry.id) ?? Promise.resolve(entry.key),
      ),
    );
    if (keys.some((key) => !key)) return null;

    return staged.map((entry, index) => ({
      key: keys[index] as string,
      name: entry.name,
      type: entry.type,
      size: entry.size,
    }));
  }, []);

  const clear = useCallback(() => {
    setEntries((prev) => {
      for (const entry of prev) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
      return [];
    });
    uploadsRef.current.clear();
  }, []);

  const restore = useCallback((attachments: UploadedAttachment[]) => {
    // No preview: the Object URL was released when the list was cleared, and resurrecting a revoked
    // one is exactly the kind of half-truth this file exists to avoid. The chip still names the file.
    setEntries(
      attachments.map((attachment) => ({
        id: attachment.key,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        previewUrl: null,
        key: attachment.key,
        failed: false,
      })),
    );
  }, []);

  return {
    entries,
    stage,
    remove,
    collect,
    clear,
    restore,
    uploading: entries.some((entry) => entry.key === null && !entry.failed),
    failed: entries.some((entry) => entry.failed),
  };
}

/**
 * The staged files, as chips.
 *
 * One look for one gesture: the chip names the file, shows a size, and — critically — says what is
 * happening to it. A thumbnail while the upload runs, a spinner until the key lands, and an explicit
 * "Failed" rather than a chip that just sits there.
 */
export function StagedAttachmentList({
  entries,
  onRemove,
  className,
}: {
  entries: StagedAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px]",
            entry.failed && "border-red-300 dark:border-red-800",
          )}
        >
          {entry.previewUrl ? (
            // Alt is empty on purpose: the file's name is right beside it, and a screen reader
            // announcing both would say the same thing twice.
            <img
              src={entry.previewUrl}
              alt=""
              className="h-6 w-6 shrink-0 rounded-sm object-cover"
            />
          ) : entry.failed ? (
            <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
          ) : entry.key === null ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate" title={entry.name}>
            {entry.name}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {formatAttachmentSize(entry.size)}
          </span>
          {entry.failed ? (
            <span className="shrink-0 font-medium text-red-600">failed</span>
          ) : null}
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-red-600"
            aria-label={`Remove ${entry.name}`}
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
