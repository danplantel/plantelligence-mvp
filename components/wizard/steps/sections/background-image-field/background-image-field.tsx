"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Image as ImageIcon, Info } from "lucide-react";
import { InfoDialog } from "@/components/ui/info-dialog";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import type { BrandImageData } from "@/types/new-client-wizard";

interface BackgroundImageFieldProps {
  value: string;
  fileName: string;
  previewDataUrl?: string;
  onChange: (
    value: string,
    fileName: string,
    previewDataUrl?: string,
  ) => void;
  onRemove: () => void;
  destructive?: boolean;
  /**
   * When true, renders the field inside a Card (with a section header) so it
   * matches the visual style of the other step-3 sections in both light and
   * dark mode. When false, renders just the field (e.g. inside an existing
   * card on the settings page).
   */
  asCard?: boolean;
}

export function BackgroundImageField({
  value,
  fileName,
  previewDataUrl,
  onChange,
  onRemove,
  destructive = false,
  asCard = false,
}: BackgroundImageFieldProps) {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  // Mirror Step 1's "Background Header Image (Hero)" upload: BrandImageUpload
  // WITHOUT the universal crop editor passes the ORIGINAL image back as a data
  // URL (only compressed in place when >200KB), so the background keeps its
  // original resolution — no 500×500 canvas export.
  const currentImage: BrandImageData | undefined = value
    ? {
        url: value,
        originalUrl: value,
        previewUrl: previewDataUrl || undefined,
        fileName: fileName || "background.png",
        fileSize: 0,
        width: 0,
        height: 0,
        recommendedSize: "1920 px—1080 px",
        status: "ok",
        warnings: [],
      }
    : undefined;

  const infoButton = (
    <button
      type="button"
      onClick={() => setInfoDialogOpen(true)}
      className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
      title="About the background image"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );

  const field = (
    <BrandImageUpload
      slotKey="header"
      slot={{
        title: "Background Header Image (Hero)",
        description:
          "This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results.",
        recommendedSize: "1920 px—1080 px",
        defaultPhoteButton: false,
        required: false,
        accept: ".png,.jpg,.jpeg",
        previewAspectRatio: 2.75,
        previewLabel: "Hero preview (2.75:1)",
      }}
      currentImage={currentImage}
      onImageChange={(imageData) => {
        // BrandImageUpload passes the ORIGINAL image as a data URL — same as
        // Step 1's Header Background. Pass it through to the form/preview.
        onChange(imageData.url, imageData.fileName || fileName, imageData.url);
      }}
      onImageRemove={onRemove}
      hideButtons={true}
      maxFileSize={10}
      previewObjectFit="cover"
    />
  );

  return (
    <>
      {asCard ? (
        <Card className="shadow-none dark:bg-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
              <ImageIcon className="w-5 h-5 text-accent-blue" />
              Background Image
              <span className="text-xs text-muted-foreground dark:text-gray-400 font-normal">
                (Optional)
              </span>
              {infoButton}
            </CardTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Upload a background image that will appear behind your content.
            </p>
          </CardHeader>
          <CardContent className="pt-0">{field}</CardContent>
        </Card>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-1">
            Background Image (Optional)
            {infoButton}
          </label>
          <div
            className={
              destructive
                ? "rounded-lg ring-2 ring-red-500/60 ring-offset-2"
                : ""
            }
          >
            {field}
          </div>
        </div>
      )}
      <InfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        title="Background Image"
        description="Upload a background image that will appear behind your content."
      />
    </>
  );
}
