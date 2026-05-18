"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";

interface BrandingImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fillContainer?: boolean;
}

function r2StableBoxStyle(style?: React.CSSProperties): React.CSSProperties {
  const mh = style?.maxHeight;
  if (mh != null) {
    return {
      ...style,
      minHeight: mh,
      height: mh,
      minWidth: 0,
    };
  }
  // Do not force minWidth/minHeight here — Tailwind on the wrapper (e.g. h-12 max-w-[120px])
  // defines the box; forcing 6rem min width made wide wordmarks look vertically squeezed.
  return { ...style };
}

export function BrandingImage({
  src,
  fillContainer = false,
  className,
  style,
  ...imgProps
}: BrandingImageProps) {
  const { url, loading, refetch } = useBrandingImageUrl(src);
  const [loadError, setLoadError] = useState(false);
  const refetchAttempted = useRef(false);
  const isR2 = isR2BrandingKey(src);
  const resolvedSrc = isR2 ? url : url ?? src;

  // Reset only when the logical source changes — not when refetch() bumps the proxy URL
  // (cache-bust), or refetchAttempted would reset and cause an infinite 404 retry loop.
  useEffect(() => {
    setLoadError(false);
    refetchAttempted.current = false;
  }, [src]);

  const handleError = () => {
    if (!resolvedSrc || !refetch) {
      setLoadError(true);
      return;
    }
    if (!refetchAttempted.current) {
      refetchAttempted.current = true;
      refetch().then(() => setLoadError(false));
    } else {
      setLoadError(true);
    }
  };

  if (!src && !imgProps.alt) return null;

  if (fillContainer) {
    return (
      <div
        className={cn(
          "relative h-full w-full min-h-0 min-w-0 overflow-hidden",
          className,
        )}
        style={style}
      >
        {isR2 && !resolvedSrc && !loadError && (
          <div
            className="absolute inset-0 animate-pulse bg-muted/40"
            aria-hidden
          />
        )}
        {loadError && (
          <span className="absolute inset-0 flex items-center justify-center bg-muted/50 px-2 text-center text-xs text-muted-foreground">
            Image unavailable
          </span>
        )}
        {resolvedSrc && !loadError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...imgProps}
            src={resolvedSrc}
            alt={imgProps.alt ?? ""}
            className="absolute inset-0 h-full w-full"
            style={{
              objectFit: "cover",
              objectPosition: "center",
              opacity: loading ? 0.85 : 1,
            }}
            onError={handleError}
          />
        )}
      </div>
    );
  }

  if (!isR2) {
    if (loadError) {
      return (
        <span
          className="inline-flex min-h-[2rem] items-center justify-center rounded bg-muted/50 px-2 text-xs text-muted-foreground"
          style={style}
        >
          Image unavailable
        </span>
      );
    }
    if (!resolvedSrc) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...imgProps}
        src={resolvedSrc}
        alt={imgProps.alt ?? ""}
        className={className}
        style={{
          objectFit: "contain",
          objectPosition: "center",
          ...style,
          opacity: loading ? 0.85 : (style?.opacity ?? 1),
        }}
        onError={handleError}
      />
    );
  }

  if (loadError) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded bg-muted/50 px-2 text-xs text-muted-foreground",
          className,
        )}
        style={r2StableBoxStyle(style)}
        title="Image unavailable or link expired"
      >
        Image unavailable
      </span>
    );
  }

  if (!resolvedSrc) {
    return (
      <div
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted/30",
          className,
        )}
        style={r2StableBoxStyle(style)}
        aria-label={imgProps.alt ?? "Loading image"}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative inline-flex min-w-0 shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={r2StableBoxStyle(style)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...imgProps}
        src={resolvedSrc}
        alt={imgProps.alt ?? ""}
        className="block h-auto w-auto max-h-full max-w-full object-contain object-center"
        style={{
          maxHeight: style?.maxHeight,
          opacity: loading ? 0.85 : 1,
        }}
        onError={handleError}
      />
    </div>
  );
}
