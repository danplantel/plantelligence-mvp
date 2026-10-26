"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ModalGallery } from "@/components/ui/modalGallery";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { exportFullResolutionImage } from "@/components/wizard/new-client-steps/sections/utils/image-utils";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import { cn } from "@/lib/utils";

/**
 * The welcome banner draws this portrait in a 200px circle, so the crop frame is
 * SQUARE: anything else would be clipped by the circle, and the framing is the
 * advisor's to choose rather than whatever the gallery photo happened to be.
 *
 * The guide is 320px and the export is doubled, so the saved portrait is ~3× the
 * rendered size — sharp on a HiDPI screen without storing a huge image.
 */
const PORTRAIT_CANVAS_SIZE = 600;
const PORTRAIT_GUIDELINE_SIZE = 320;
const PORTRAIT_GUIDELINE_PADDING = 32;
const PORTRAIT_EXPORT_SCALE = 2;
const PORTRAIT_FILE_NAME = "key-contact-image.png";
const PORTRAIT_SUB_PATH = "key-contact-image";

/** A gallery pick waiting for the advisor to frame it in the cropper. */
interface PendingCrop {
  /** The full-resolution source handed to the editor. */
  url: string;
  fileName: string;
}

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
 *
 * Choosing from the gallery does NOT apply the picked photo directly: it opens
 * the square cropper first, because a gallery image is a finished picture (often
 * landscape) and the banner only shows the middle of it inside a circle. The crop
 * is kept as a DATA URL so the Portal Preview paints it immediately — nothing is
 * uploaded yet. `saveBenefit` uploads it to R2 on Save Changes and stores the key.
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
  /** The picked gallery photo, waiting to be framed. Opens the editor. */
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);

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
        subPath: PORTRAIT_SUB_PATH,
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

  /**
   * A gallery pick is only the SOURCE: read it back at full resolution and hand it
   * to the cropper. Nothing is stored until the advisor saves a framing.
   */
  const handleGallerySelect = async (url: string) => {
    let source = url;
    try {
      const { dataUrl } = await exportFullResolutionImage(url);
      if (dataUrl) source = dataUrl;
    } catch (error) {
      // Not fatal: the editor can still try to load the URL directly.
      console.error("Failed to prepare the default image for cropping:", error);
    }

    setGalleryOpen(false);
    setPendingCrop({ url: source, fileName: PORTRAIT_FILE_NAME });
  };

  /**
   * Store the crop as a data URL — no upload yet.
   *
   * The Portal Preview reads this component's value directly, so handing over the
   * data URL is what makes the freshly framed portrait appear in the welcome
   * banner straight away. The R2 upload is deliberately deferred to Save Changes
   * (`saveBenefit`), which keeps a cancelled edit from writing anything to the
   * plan — and means a stored data URL never reaches the plan record.
   */
  const handleCropSave = (croppedUrl: string) => {
    setPendingCrop(null);
    onChange(croppedUrl);
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
        // The pick is only the source: keep the dialog on its spinner while the
        // full-resolution photo is read back, then open the cropper.
        awaitSelection
        busyLabel="Preparing Image..."
        onSelect={handleGallerySelect}
      />

      {pendingCrop && (
        <SimpleImageEditorModal
          value={pendingCrop.url}
          originalValue={pendingCrop.url}
          fileName={pendingCrop.fileName}
          onChange={handleCropSave}
          onRemove={() => setPendingCrop(null)}
          isOpen
          onClose={() => setPendingCrop(null)}
          modalTitle="Key Contact Image"
          modalDescription="Frame the portrait to a square — the welcome banner draws it inside a circle."
          saveButtonText="Save Portrait"
          // The banner clips this portrait to a circle, so preview it that way
          // rather than in a rectangle the live page never shows.
          previewShape="circle"
          canvasWidth={PORTRAIT_CANVAS_SIZE}
          canvasHeight={PORTRAIT_CANVAS_SIZE}
          guidelineWidth={PORTRAIT_GUIDELINE_SIZE}
          guidelineHeight={PORTRAIT_GUIDELINE_SIZE}
          guidelinePadding={PORTRAIT_GUIDELINE_PADDING}
          exportScale={PORTRAIT_EXPORT_SCALE}
        />
      )}
    </div>
  );
}
