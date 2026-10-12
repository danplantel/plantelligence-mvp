"use client";

import { Download, ExternalLink, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  commentAttachmentDownloadUrl,
  commentAttachmentInlineUrl,
  formatAttachmentSize,
  isImageAttachment,
  isPdfAttachment,
  type CommentAttachment,
} from "@/lib/comments/types";

/**
 * Viewer for one comment attachment: images inline, PDFs in a frame, anything else with
 * its name, size and open/download actions.
 *
 * Both URLs are same-origin routes (`/api/r2/object`, `/api/r2/signed-url`) that check the
 * caller's plan assignment, so nothing here needs signing or a public bucket.
 */
export function CommentAttachmentModal({
  attachment,
  onOpenChange,
}: {
  /** Null closes the modal. */
  attachment: CommentAttachment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const inlineUrl = attachment ? commentAttachmentInlineUrl(attachment.key) : "";

  return (
    <Dialog open={attachment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {attachment?.name ?? "Attachment"}
          </DialogTitle>
        </DialogHeader>

        {attachment ? (
          <div className="max-h-[70vh] overflow-auto">
            {isImageAttachment(attachment.type) ? (
              <img
                src={inlineUrl}
                alt={attachment.name}
                className="mx-auto max-h-[68vh] w-auto rounded-md"
              />
            ) : isPdfAttachment(attachment.type) ? (
              <iframe
                src={inlineUrl}
                title={attachment.name}
                className="h-[68vh] w-full rounded-md border border-border"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="max-w-full truncate text-sm font-medium">
                  {attachment.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatAttachmentSize(attachment.size)}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {attachment ? (
          <div className="flex flex-wrap justify-end gap-2">
            <a
              href={inlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open in new tab
            </a>
            <a
              href={commentAttachmentDownloadUrl(attachment.key, attachment.name)}
              download={attachment.name}
              className="inline-flex h-8 items-center rounded-md bg-accent-blue px-3 text-xs font-medium text-white transition-colors hover:bg-accent-blue/90"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </a>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
