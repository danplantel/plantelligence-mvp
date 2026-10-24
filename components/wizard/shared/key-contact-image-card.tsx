"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ModalGallery } from "@/components/ui/modalGallery";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import { cn } from "@/lib/utils";

interface KeyContactImageCardProps {
  /** R2 key, absolute URL, data URL, or "" — empty means "use the headshot". */
  value?: string;
  onChange: (value: string) => void;
  /**
   * The key contact headshot. PREVIEW ONLY: it is drawn while no override is set
   * so the card shows the portrait the banner is actually using. It is never
   * written into `value` — the field stays empty, which is what says "default".
   */
  defaultImage?: string;
  /** Plan id, so the upload lands in this plan's R2 folder. */
  clientId?: string;
  /** Hide the card's own heading when the host Card already titles it. */
  showTitle?: boolean;
  className?: string;
}

/**
 * The welcome banner's circular portrait.
 *
 * The banner shows the category's key contact headshot by default; this card lets
 * the advisor replace that one image with a picture of their choosing (upload or
 * the in-app gallery) and put the headshot back with Remove. It writes a single
 * string — an R2 key or an absolute URL — so both Editing Panels (Edit Plan and
 * Edit Benefit → Section 2 Branding) can share one control and one stored value.
 */
export function KeyContactImageCard({
  value,
  onChange,
  defaultImage,
  clientId,
  showTitle = true,
  className,
}: KeyContactImageCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // The field itself stays empty until the advisor picks an image; the headshot is
  // only drawn in its place, so "no override" is still the stored state.
  const stored = String(value || "").trim();
  const overrideSrc = stored ? toNextImageSrc(stored, "") : "";
  const defaultSrc = defaultImage ? toNextImageSrc(defaultImage, "") : "";
  const displaySrc = overrideSrc || defaultSrc;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setBusy(true);
    try {
      const key = await uploadFileToR2({
        file,
        purpose: "upload",
        clientId,
        fileName: file.name,
        // Its own folder, so these portraits never collide with headshots or
        // branding slots in the same plan.
        subPath: "key-contact-image",
      });
      if (!key) {
        toast.error("Failed to upload that image. Please try again.");
        return;
      }
      onChange(key);
    } catch (error) {
      console.error("Key contact image upload error:", error);
      toast.error("An error occurred while uploading the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {showTitle && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs font-bold text-foreground">
            Key Contact Image
          </Label>
          <span className="text-[11px] text-muted-foreground">
            Defaults to the headshot
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-muted bg-muted/30">
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt="Key contact portrait"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-[10px] font-medium leading-tight text-muted-foreground">
              No headshot yet
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {stored ? "Your image" : "Key contact headshot (default)"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {stored
              ? "Shown in the portal welcome banner instead of the key contact headshot. Remove it to go back to the headshot."
              : "The circular portrait in the portal welcome banner. Upload your own to replace it, or leave it as is to keep the key contact headshot."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {busy ? "Uploading…" : "Upload Image"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setGalleryOpen(true)}
        >
          <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
          Choose Default Image
        </Button>
        {stored && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange("")}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      <ModalGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={(url) => {
          onChange(url);
          setGalleryOpen(false);
        }}
      />
    </div>
  );
}
