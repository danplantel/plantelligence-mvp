"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";
import { MonogramAvatar } from "@/components/ui/monogram-avatar";

export interface HeadshotProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  wrapperClassName?: string;
  /** `cover` for portraits (default). `contain` for logos and wide marks — same R2 proxy + retry logic. */
  objectFit?: "cover" | "contain";
  /** When no image (or image failed), show a two-letter monogram from this name. */
  monogramName?: string | null;
}

const wrapperBase = (wrapperClassName?: string) =>
  cn(
    "relative min-h-0 min-w-0 h-full w-full overflow-hidden",
    wrapperClassName,
  );

/**
 * R2-aware image: same-origin proxy URL, one refetch on error, skeleton while loading.
 * Default `objectFit="cover"` for headshots; use `contain` for company logos stored as `org/...` keys.
 */
export function Headshot({
  src,
  alt = "Photo",
  className,
  fallback = null,
  wrapperClassName,
  objectFit = "cover",
  monogramName,
}: HeadshotProps) {
  const isR2 = isR2BrandingKey(src);
  const { url: r2Url, loading: r2Loading, refetch } = useBrandingImageUrl(
    src ?? null,
  );
  const [loadError, setLoadError] = React.useState(false);
  const refetchAttempted = React.useRef(false);

  // Same as BrandingImage: do not reset refetch guard when proxy URL changes after refetch().
  React.useEffect(() => {
    setLoadError(false);
    refetchAttempted.current = false;
  }, [src]);

  /** Match BrandingImage: non-R2 resolves url from hook or use src on first paint. */
  const displaySrc = isR2 ? r2Url : (r2Url ?? src);
  const handleError = React.useCallback(() => {
    if (!isR2 || !refetch) {
      setLoadError(true);
      return;
    }
    if (!refetchAttempted.current) {
      refetchAttempted.current = true;
      refetch().then(() => setLoadError(false));
    } else {
      setLoadError(true);
    }
  }, [isR2, refetch]);

  if (isR2 && !displaySrc && !loadError) {
    return (
      <div className={wrapperBase(wrapperClassName)} aria-busy="true">
        <div
          className="absolute inset-0 animate-pulse bg-muted/40"
          aria-hidden
        />
      </div>
    );
  }

  if (displaySrc && !loadError) {
    return (
      <div className={wrapperBase(wrapperClassName)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full object-center",
            objectFit === "contain" ? "object-contain" : "object-cover",
            className,
          )}
          style={{
            objectFit,
            objectPosition: "center",
            opacity: isR2 && r2Loading ? 0.85 : 1,
          }}
          onError={handleError}
        />
      </div>
    );
  }

  const showMonogram =
    Boolean(monogramName?.trim()) && (!displaySrc || loadError);

  if (showMonogram) {
    return (
      <div
        className={cn(
          wrapperBase(wrapperClassName),
          "flex items-center justify-center rounded-full bg-muted",
        )}
      >
        <MonogramAvatar
          name={monogramName!.trim()}
          className={cn(
            "h-full w-full min-h-0 min-w-0 rounded-full text-[clamp(0.65rem,33%,1rem)] sm:text-sm md:text-base",
            className,
          )}
        />
      </div>
    );
  }

  if (loadError && isR2 && !monogramName?.trim()) {
    return (
      <div className={wrapperBase(wrapperClassName)}>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-muted/50 text-xs text-muted-foreground",
            className,
          )}
          title="Image unavailable or link expired"
        >
          Image unavailable
        </span>
      </div>
    );
  }

  if (fallback !== null && fallback !== undefined) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden",
          wrapperClassName,
        )}
      >
        {fallback}
      </div>
    );
  }

  return null;
}
