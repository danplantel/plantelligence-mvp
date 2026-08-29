"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractedFile } from "@/lib/zip-image-extract";

interface ZipFilePickerModalProps {
  open: boolean;
  files: ExtractedFile[];
  title?: string;
  description?: string;
  /** When true, shows checkboxes and an "Add" button to import several files at
   *  once (used by the documents upload). When false, clicking a tile selects
   *  that single file immediately (used by image uploads). */
  multiple?: boolean;
  onSelect: (files: ExtractedFile[]) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Lets the user pick files extracted from a .zip before importing them.
 * Rendered as a tile grid so non-technical users can see what's inside the
 * archive (image thumbnails for images, a file icon + name + size for PDFs /
 * documents) and choose without ever manually extracting the folder.
 *
 * Rendered with Radix primitives directly (not the shared DialogContent) so the
 * overlay + content use a very high z-index (z-[9999]) — above the fixed Edit
 * Panel overlays (z-[51]) in the wizard Step 2 pages.
 */
export function ZipFilePickerModal({
  open,
  files,
  title = "Choose files",
  description,
  multiple = false,
  onSelect,
  onClose,
}: ZipFilePickerModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset the selection each time the dialog is reopened.
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const toggle = (fileName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  };

  const handleTileClick = (file: ExtractedFile) => {
    if (multiple) {
      toggle(file.fileName);
    } else {
      onSelect([file]);
    }
  };

  const selectedFiles = files.filter((f) => selected.has(f.fileName));

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
            {files.map((f) => {
              const isSelected = selected.has(f.fileName);
              return (
                <button
                  key={f.fileName}
                  type="button"
                  onClick={() => handleTileClick(f)}
                  className={`group relative flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 ${
                    isSelected
                      ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                      : "border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-accent-blue hover:shadow-sm"
                  }`}
                >
                  {multiple && isSelected && (
                    <span className="absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-white text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                  <div className="aspect-square w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-gray-900 flex items-center justify-center">
                    {f.previewUrl ? (
                      <img
                        src={f.previewUrl}
                        alt={f.fileName}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-neutral-400 dark:text-gray-500" />
                    )}
                  </div>
                  <div className="text-center">
                    <span className="block text-xs text-neutral-600 dark:text-gray-300 truncate">
                      {f.fileName}
                    </span>
                    <span className="block text-[10px] text-neutral-400 dark:text-gray-500">
                      {formatBytes(f.size)}
                      {f.width > 0 && f.height > 0
                        ? ` · ${f.width}×${f.height} px`
                        : ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {multiple ? (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {selected.size} file{selected.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={() => {
                    onSelect(selectedFiles);
                    setSelected(new Set());
                  }}
                >
                  Add{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          )}

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
