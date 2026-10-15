"use client";

/**
 * attachment-thumbnail — an image attachment in a message, with a loading state.
 *
 * Why it exists: a posted attachment is streamed from R2 through `/api/r2/object`, and until those
 * bytes arrive an `<img>` has **no intrinsic size** — so the bubble simply grew a picture out of
 * nothing a moment later, with no space reserved and nothing saying one was coming. On a slow
 * connection that reads as a message that was sent without its image.
 *
 * So the three states are explicit:
 *
 *  - **loading** — a skeleton box the size a thumbnail will plausibly occupy, pulsing, with a spinner
 *    inside it. The spinner is the honest half: a pulse alone says "something is happening here",
 *    while a spinner says "this is loading".
 *  - **loaded** — the image fades and grows in from nothing, which is why it is mounted from the
 *    start rather than rendered on demand: an `<img>` that is not in the DOM never starts fetching.
 *    `max-h-0` collapses it without hiding it, so it still loads — `display: none` is not guaranteed
 *    to fetch across browsers.
 *  - **error** — "Preview unavailable", announced once instead of pulsing forever. A file that will
 *    not render is a fact worth stating; a skeleton that never resolves is a lie.
 *
 * The cache guard matters: a browser-cached image can be COMPLETE before React attaches `onLoad`, so
 * the event never fires and the thumbnail would sit behind its skeleton forever. One check after mount
 * covers it.
 *
 * Shared by the comments rail and the DM rail for the reason `staged-attachments` is: the same
 * gesture in two panels must not behave differently.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AttachmentThumbnail({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setState("loading");
    const image = imageRef.current;
    if (!image) return;
    // Already in the cache and therefore already complete: no `load` event is coming.
    if (image.complete) {
      setState(image.naturalWidth > 0 ? "loaded" : "error");
    }
  }, [src]);

  return (
    <>
      {state === "loading" ? (
        <span
          className={cn(
            "flex h-24 w-32 animate-pulse items-center justify-center rounded-md border border-border bg-muted",
            className,
          )}
          // The spinner is decorative; the file's name is on the button's `title` and the image's
          // `alt`, so a screen reader announcing "loading" on every poll would be noise.
          aria-hidden="true"
        >
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </span>
      ) : null}

      <img
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={cn(
          "block w-auto max-w-full rounded-md border transition-all duration-200",
          state === "loaded"
            ? "max-h-24 border-border opacity-100 hover:opacity-90"
            : // Collapsed, not hidden: still fetched, still out of the way.
              "max-h-0 border-transparent opacity-0",
          className,
        )}
      />

      {state === "error" ? (
        <span className="flex h-24 w-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-2 text-center text-[10px] text-muted-foreground">
          Preview unavailable
        </span>
      ) : null}
    </>
  );
}
