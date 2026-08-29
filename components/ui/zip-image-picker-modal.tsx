"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

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
              <span className="text-xs text-neutral-600 dark:text-gray-300 truncate text-center">
                {img.fileName}
              </span>
            </button>
          ))}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
