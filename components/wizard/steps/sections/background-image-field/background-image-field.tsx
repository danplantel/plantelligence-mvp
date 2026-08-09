"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Image as ImageIcon, Info } from "lucide-react";
import { InfoDialog } from "@/components/ui/info-dialog";

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

  const modal = (
    <UniversalImageEditorModal
      type="custom"
      icon={<ImageIcon className="w-4 h-4" />}
      value={value}
      fileName={fileName}
      previewDataUrl={previewDataUrl}
      onChange={(value, fileName, headshotData) => {
        // Use the DataURL preview passed back from the modal so preview works
        // with R2 keys (the stored value may be an R2 key, not a data URL).
        const previewDataUrl: string | undefined =
          (headshotData as any)?.previewDataUrl;
        const previewSrc =
          previewDataUrl ||
          (value?.startsWith("data:") ? value : undefined);
        onChange(value, fileName, previewSrc);
      }}
      onRemove={onRemove}
      placeholder="Upload Background Image"
      modalTitle="Background Image"
      modalDescription="Upload a background image. Adjust and fit it into the preview dimensions for best results."
      saveButtonText="Save Background Image"
      autoSizeOnOpen={true}
      destructive={destructive}
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
          <CardContent className="pt-0">{modal}</CardContent>
        </Card>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-1">
            Background Image (Optional)
            {infoButton}
          </label>
          {modal}
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
