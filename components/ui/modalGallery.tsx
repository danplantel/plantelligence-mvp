"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ModalGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
}

const defaultImages = [
  "https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
];

export function ModalGallery({
  open,
  onOpenChange,
  onSelect,
}: ModalGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (url: string) => setSelected(url);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-[95vw] p-6 sm:p-8 md:p-10 bg-white dark:bg-[#0a0a0a] 
        border-0 shadow-2xl rounded-xl z-[9999] overflow-hidden"
      >
        {/* Header */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Choose a Default Image
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select one of the predefined images for quick setup.
          </p>
        </div>

        {/* Gallery grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh] pr-2">
          {defaultImages.map((url) => (
            <div
              key={url}
              onClick={() => handleSelect(url)}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                ${
                  selected === url
                    ? "border-primary ring-2 ring-primary ring-offset-2"
                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                }`}
            >
              <img
                src={url}
                alt="gallery item"
                className="w-full h-36 sm:h-40 object-cover rounded-md transition-transform duration-200 hover:scale-105"
              />
              {selected === url && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    Selected
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="rounded-full px-6 disabled:opacity-50"
          >
            Select Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
