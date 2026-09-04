"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import curatedBackgrounds from "@/data/gallery-default-backgrounds.json";

export interface GalleryBackground {
  id: string;
  title: string;
  category: string;
  mode: string;
  src: string;
  altText: string;
}

interface ModalGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void | Promise<void>;
  /**
   * Optional image list to show in the grid/preview. When omitted the default
   * curated set is used. This lets each "Choose a Default Image" flow show its
   * own imagery (e.g. benefit-hub backgrounds vs website homepage backgrounds).
   */
  images?: GalleryBackground[];
  /**
   * When true, the "Select Image" button shows a loading spinner and the dialog
   * stays open until `onSelect`'s promise resolves (e.g. so the caller can await
   * image processing + preview rendering before the modal closes). When false,
   * selection closes the dialog immediately after `onSelect` is invoked.
   */
  awaitSelection?: boolean;
  /** Label shown on the confirm button while `awaitSelection` work is in flight. */
  busyLabel?: string;
}

type GalleryView = "grid" | "preview";

export function ModalGallery({
  open,
  onOpenChange,
  onSelect,
  images,
  awaitSelection = false,
  busyLabel = "Loading Preview...",
}: ModalGalleryProps) {
  // When a custom image set is provided use it; otherwise fall back to the
  // default curated benefit-hub backgrounds.
  const galleryImages =
    images && images.length > 0 ? images : curatedBackgrounds;
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Two "slides": the image grid, and a full-size preview of the picked image.
  const [view, setView] = useState<GalleryView>("grid");

  // Start on the grid slide whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setView("grid");
      setBusy(false);
    }
  }, [open]);

  const selectedImage = selected
    ? galleryImages.find((image) => image.src === selected)
    : undefined;

  // Clicking a thumbnail selects it and slides over to the full preview.
  const handlePickImage = (image: GalleryBackground) => {
    if (busy) return;
    setSelected(image.src);
    setView("preview");
  };

  const handleBack = () => {
    if (busy) return;
    setView("grid");
  };

  const handleConfirm = async () => {
    if (!selected || busy) return;

    if (!awaitSelection) {
      // Legacy behavior: invoke the callback and close immediately.
      onSelect(selected);
      onOpenChange(false);
      return;
    }

    // Await the full selection pipeline (crop → persist → preview loaded)
    // before closing so the caller's preview is fully rendered.
    setBusy(true);
    try {
      await Promise.resolve(onSelect(selected));
    } catch (error) {
      console.error("Error selecting default image:", error);
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  };

  const renderGridSlide = () => (
    <section aria-label="Gallery" className="w-full shrink-0">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh] pr-2">
        {galleryImages.map((image) => {
          const isSelected = selected === image.src;
          return (
            <div
              key={image.src}
              role="button"
              tabIndex={0}
              onClick={() => handlePickImage(image)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePickImage(image);
                }
              }}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${
                  isSelected
                    ? "border-primary ring-2 ring-primary ring-offset-2"
                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                }`}
            >
              <img
                src={image.src}
                alt={image.altText || `${image.title} background`}
                title={image.title}
                loading="lazy"
                className="w-full h-36 sm:h-40 object-cover rounded-md transition-transform duration-200 hover:scale-105"
              />
              {isSelected && (
                <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white shadow">
                  <Check className="w-4 h-4" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5">
                <span className="block text-white text-[11px] leading-tight font-medium">
                  {image.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderPreviewSlide = () => {
    if (!selectedImage) return null;
    return (
      <section aria-label="Image preview" className="w-full shrink-0 flex">
        <div className="w-full max-h-[60vh] overflow-y-auto flex flex-col justify-center items-center px-1 sm:px-2 py-2">
          <div className="w-full mb-3 flex justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={busy}
              className="rounded-full px-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to images
            </Button>
          </div>

          <div className="w-full max-w-3xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
            <img
              src={selectedImage.src}
              alt={selectedImage.altText || `${selectedImage.title} preview`}
              className="w-full max-h-[42vh] object-contain"
            />
          </div>

          <div className="mt-4 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {selectedImage.title}
            </p>
            {selectedImage.category && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {selectedImage.category}
                {selectedImage.mode ? ` • ${selectedImage.mode}` : ""}
              </p>
            )}
          </div>
        </div>
      </section>
    );
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
            {view === "grid" ? "Choose a Default Image" : "Preview Image"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {view === "grid"
              ? "Select an image to preview it, then confirm your choice."
              : "Make sure this image looks right before selecting it."}
          </p>
        </div>

        {/* Slides (grid ⇄ preview) */}
        <div className="relative overflow-hidden">
          <div
            className={`flex items-stretch transition-transform duration-300 ease-out ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
            style={{
              transform: `translateX(${view === "grid" ? "0%" : "-100%"})`,
            }}
          >
            {renderGridSlide()}
            {renderPreviewSlide()}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-800 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-full px-6"
          >
            Cancel
          </Button>
          {view === "preview" && (
            <Button
              onClick={handleConfirm}
              disabled={!selected || busy}
              className="rounded-full px-6 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {busy ? busyLabel : "Select Image"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
