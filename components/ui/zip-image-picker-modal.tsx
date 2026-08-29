"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractedImage } from "@/lib/zip-image-extract";

interface ZipImagePickerModalProps {
  open: boolean;
  images: ExtractedImage[];
  title?: string;
  description?: string;
  onSelect: (image: ExtractedImage) => void;
  onClose: () => void;
}

/**
 * Lets the user pick one image from a .zip that contained multiple images.
 * Rendered as a simple thumbnail grid so non-technical users can choose the
 * right file without ever manually extracting the archive.
 *
 * Rendered with Radix primitives directly (not the shared DialogContent) so the
 * overlay + content can use a very high z-index (z-[9999]) — it must appear
 * above the fixed Edit Panel overlays (z-[51]) in the wizard Step 2 pages when
 * the .zip is dropped from inside the editor.
 */
export function ZipImagePickerModal({
  open,
  images,
  title = "Choose an image",
  description = "That .zip folder contains multiple images. Click the one you'd like to use.",
  onSelect,
  onClose,
}: ZipImagePickerModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[9999] grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg max-h-[85vh] overflow-y-auto sm:rounded-lg md:w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="pr-6">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-2">
            {images.map((img) => (
              <button
                key={img.fileName}
                type="button"
                onClick={() => onSelect(img)}
                className="group flex flex-col items-stretch gap-2 rounded-lg border border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-left transition hover:border-accent-blue hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50"
              >
                <div className="aspect-square w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-gray-900 flex items-center justify-center">
                  <img
                    src={img.previewUrl}
                    alt={img.fileName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <span className="block text-xs text-neutral-600 dark:text-gray-300 truncate">
                    {img.fileName}
                  </span>
                  {img.width > 0 && img.height > 0 && (
                    <span className="block text-[10px] text-neutral-400 dark:text-gray-500">
                      {img.width} × {img.height} px
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
