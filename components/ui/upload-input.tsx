"use client";

import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { useBrandingImageUrl } from "@/hooks/useBrandingImageUrl";
import { isR2BrandingKey } from "@/lib/branding-image-url";

interface UploadInputProps {
  id: string;
  value: string;
  fileName: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called when the file is removed. May return a promise; while it is pending
   *  the remove control shows a loading spinner. */
  onRemove: () => void | Promise<void>;
  placeholder: string;
  accept?: string;
  imageClassName?: string;
  destructive?: boolean;
  icon?: React.ReactNode;
}

export function UploadInput({
  id,
  value,
  fileName,
  onChange,
  onRemove,
  placeholder,
  accept = "image/*",
  imageClassName = "w-8 h-8 object-contain",
  destructive = false,
  icon,
}: UploadInputProps) {
  const isR2 = isR2BrandingKey(value);
  const { url: resolvedUrl, loading: resolving } = useBrandingImageUrl(isR2 ? value : null);
  const displaySrc = isR2 ? resolvedUrl : value;
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = () => {
    if (isRemoving) return;

    const inputEl = document.getElementById(id) as HTMLInputElement | null;

    // Keep the spinner visible for a short minimum even when removal resolves
    // instantly, so the user always sees the loading feedback.
    const MIN_REMOVE_FEEDBACK_MS = 450;
    setIsRemoving(true);
    const run = async () => {
      try {
        await new Promise<void>((r) => setTimeout(r, MIN_REMOVE_FEEDBACK_MS));
        await Promise.resolve(onRemove());
      } catch (error) {
        console.error("Failed to remove upload:", error);
      } finally {
        setIsRemoving(false);
        if (inputEl) inputEl.value = "";
      }
    };
    run();
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
        id={id}
      />
      <div
        onClick={() => document.getElementById(id)?.click()}
        className={`w-full h-9 border rounded-lg px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center relative ${
          destructive
            ? "border-red-500 focus-visible:ring-red-500/20"
            : value
            ? "border-accent-blue bg-[#23919C]/10 focus-visible:ring-ring"
            : "border-input bg-background focus-visible:ring-ring"
        }`}
      >
        {value ? (
          <>
            {displaySrc ? (
              <img
                src={displaySrc}
                alt="Uploaded file"
                className={`${imageClassName} mr-3`}
                style={{ opacity: isR2 && resolving ? 0.6 : 1 }}
              />
            ) : (
              <span className="w-8 h-8 flex items-center justify-center text-muted-foreground text-xs mr-3">…</span>
            )}
            <span className="flex-1 text-sm truncate">
              {fileName || `${placeholder} uploaded`}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              disabled={isRemoving}
              title="Delete"
              aria-label="Delete"
              className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRemoving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            {icon || <Upload className="w-4 h-4" />}
            <span>{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  );
}
