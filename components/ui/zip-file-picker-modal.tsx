"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Files,
  FileText,
  FolderOpen,
  Library,
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExtractedFile } from "@/lib/zip-image-extract";
import {
  deleteAllLibraryAssets,
  deleteLibraryAsset,
  fetchLibraryAssets,
  libraryAssetToExtractedFile,
  libraryKindForFileName,
  MAX_FILES_PER_LIBRARY_ADD,
  persistFilesToLibrary,
  type LibraryAsset,
  type LibraryKind,
} from "@/lib/profile-library";

interface ZipFilePickerModalProps {
  open: boolean;
  files: ExtractedFile[];
  title?: string;
  description?: string;
  /** When true, shows checkboxes and an "Add" button to import several files at
   *  once (used by the documents upload). When false, clicking a tile selects
   *  that single file immediately (used by image uploads). */
  multiple?: boolean;
  /**
   * When set, the dialog offers two things:
   *
   *  - "Add to my library" on the .zip contents, which keeps them for 24 hours
   *    so any other image/document section can reuse them;
   *  - a "Your library" source listing what was kept.
   *
   * With no `files` present the dialog opens straight on the library, so an
   * uploader can use this as a plain "choose from my library" surface.
   */
  libraryKind?: LibraryKind;
  /**
   * Entries of the *other* kind found in the same archive (documents in an image
   * upload, images in a documents upload). They are not selectable here — the
   * dialog lists them read-only so the advisor knows they exist and where to
   * upload them.
   */
  otherKindFiles?: ExtractedFile[];
  onSelect: (files: ExtractedFile[]) => void;
  onClose: () => void;
}

type Source = "zip" | "library";

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Both library kinds, in the order the library view lists them. */
const LIBRARY_KINDS: LibraryKind[] = ["image", "document"];

/** "Image" / "Document", for building both the singular and plural labels. */
function kindNoun(kind: LibraryKind): string {
  return kind === "image" ? "Image" : "Document";
}

/** "1 Image", "3 Images" — the count decides the plural. */
function kindLabel(kind: LibraryKind, count: number): string {
  return count === 1 ? kindNoun(kind) : `${kindNoun(kind)}s`;
}

/**
 * Lets the user pick files extracted from a .zip before importing them.
 * Rendered as a tile grid so non-technical users can see what's inside the
 * archive (image thumbnails for images, a file icon + name + size for PDFs /
 * documents) and choose without ever manually extracting the folder.
 *
 * When `libraryKind` is supplied, the archive's contents can be added to the
 * advisor's 24-hour library, and a second source lists what is already kept —
 * so the same archive does not have to be dragged in again for every slot.
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
  libraryKind,
  otherKindFiles = [],
  onSelect,
  onClose,
}: ZipFilePickerModalProps) {
  const [source, setSource] = useState<Source>("zip");
  // Keys are the zip entry's file name for "zip", the asset id for "library".
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Both kinds are read into state: the library view lists an Images accordion
  // and a Documents accordion, whichever section opened the dialog.
  const [libraryAssets, setLibraryAssets] = useState<
    Record<LibraryKind, LibraryAsset[]>
  >({ image: [], document: [] });
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // "Delete All" asks inline rather than opening a second dialog, which would
  // have to fight this one's z-index. There is one per kind now that both are
  // listed here.
  const [confirmDeleteKind, setConfirmDeleteKind] =
    useState<LibraryKind | null>(null);
  const [deletingKind, setDeletingKind] = useState<LibraryKind | null>(null);
  // Which library accordion is expanded. The picker's own kind starts open; the
  // other kind is shown for context but cannot be chosen from this section.
  const [openLibraryKinds, setOpenLibraryKinds] = useState<
    Record<LibraryKind, boolean>
  >({ image: true, document: false });
  // Set once the archive has been added: its files now live in the library, so
  // the ".zip" source is retired and the dialog stays on the library view.
  const [zipRetired, setZipRetired] = useState(false);
  // The read-only "other files in this .zip" accordion starts closed.
  const [showOtherKind, setShowOtherKind] = useState(false);

  const hasFiles = files.length > 0;
  // An archive can hold ONLY the kind this picker cannot take — a PDF bundle
  // dropped on a logo slot. That still has something to say (the read-only list
  // below), so the ".zip" view and the source tabs stay available for it.
  const hasOtherKind = otherKindFiles.length > 0;
  const showTabs =
    Boolean(libraryKind) && (hasFiles || hasOtherKind) && !zipRetired;
  // Which label the read-only list uses ("2 Documents are present in this .zip",
  // "1 Document is present in this .zip").
  const otherKindNoun =
    hasOtherKind &&
    libraryKindForFileName(otherKindFiles[0].fileName) === "document"
      ? "Document"
      : "Image";
  const otherKindLabel =
    otherKindFiles.length === 1 ? otherKindNoun : `${otherKindNoun}s`;
  // The kind this picker does take, used when the archive holds none of it.
  const intendedKindLabel = libraryKind === "document" ? "documents" : "images";

  // Reset the selection each time the dialog is reopened, and land on the source
  // that actually has something in it. An archive holding only the other kind
  // opens on ".zip" too — that is the whole point of showing it — and its
  // read-only list starts expanded, because a collapsed notice above an empty
  // grid would look like the .zip was simply empty.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setZipRetired(false);
    setConfirmDeleteKind(null);
    setShowOtherKind(!hasFiles && hasOtherKind);
    setOpenLibraryKinds({
      image: libraryKind !== "document",
      document: libraryKind === "document",
    });
    setSource(
      hasFiles || hasOtherKind ? "zip" : libraryKind ? "library" : "zip",
    );
  }, [open, hasFiles, hasOtherKind, libraryKind]);

  // Load (or refresh) the saved library whenever it is the visible source. Both
  // kinds are fetched: the view has one accordion per kind, and "Add all files"
  // fills both of them at once.
  useEffect(() => {
    if (!open || source !== "library") return;
    let cancelled = false;
    setLibraryLoading(true);
    void Promise.all([
      fetchLibraryAssets("image"),
      fetchLibraryAssets("document"),
    ])
      .then(([images, documents]) => {
        if (!cancelled) {
          setLibraryAssets({ image: images, document: documents });
        }
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source]);

  const switchSource = (next: Source) => {
    if (next === source) return;
    setSource(next);
    setSelected(new Set());
    setConfirmDeleteKind(null);
  };

  /**
   * Selection toggle, capped at what one "Add to Library" action may store
   * (`MAX_FILES_PER_LIBRARY_ADD`). The 21st pick is refused with a message
   * instead of being dropped silently when the request is built.
   */
  const toggle = (key: string) => {
    if (selected.has(key)) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    if (selected.size >= MAX_FILES_PER_LIBRARY_ADD) {
      toast.info(
        `You can add up to ${MAX_FILES_PER_LIBRARY_ADD} files to your library at a time.`,
      );
      return;
    }
    setSelected((prev) => new Set(prev).add(key));
  };

  const handleTileClick = (file: ExtractedFile) => {
    if (multiple) {
      toggle(file.fileName);
    } else {
      onSelect([file]);
    }
  };

  const selectedFiles = files.filter((f) => selected.has(f.fileName));

  /**
   * "Add to my library": keep the archive's files (or just the selection), then
   * hand the dialog over to the library itself — the .zip is now redundant, so
   * its tab goes away.
   *
   * `kinds` is normally just the picker's own kind; "Add all files" passes both,
   * so one request per kind stores the images AND the documents the archive held.
   */
  const addToLibrary = async (
    subset: ExtractedFile[],
    kinds: LibraryKind[],
  ) => {
    if (!libraryKind || subset.length === 0) return;
    setSavingToLibrary(true);
    const results = await Promise.all(
      kinds.map((kind) => persistFilesToLibrary({ files: subset, kind })),
    );
    setSavingToLibrary(false);
    if (results.some((result) => result.failed)) {
      toast.error(
        "Could not save those files to your library. Please try again.",
      );
      return;
    }
    const stored = results.reduce((total, result) => total + result.stored, 0);
    if (stored > 0) {
      toast.success(
        `Added ${stored} file${
          stored === 1 ? "" : "s"
        } to your library for 24 hours.`,
      );
    } else {
      toast.info("Those files are already in your library.");
    }
    // Expand whatever just received files, so the advisor lands on them.
    setOpenLibraryKinds((prev) => {
      const next = { ...prev };
      kinds.forEach((kind) => {
        next[kind] = true;
      });
      return next;
    });
    // The archive's contents are in the library now: drop the ".zip" source and
    // show them where they live from here on.
    setZipRetired(true);
    setSelected(new Set());
    setSource("library");
  };

  const pickLibraryAsset = async (asset: LibraryAsset) => {
    if (multiple) {
      toggle(asset.id);
      return;
    }
    setResolving(true);
    const file = await libraryAssetToExtractedFile(asset);
    setResolving(false);
    if (!file) {
      toast.error("Could not load that file from your library.");
      return;
    }
    onSelect([file]);
  };

  const addLibrarySelection = async () => {
    const chosen = pickableLibraryAssets.filter((asset) =>
      selected.has(asset.id),
    );
    if (chosen.length === 0) return;
    setResolving(true);
    const resolved = await Promise.all(
      chosen.map((asset) => libraryAssetToExtractedFile(asset)),
    );
    setResolving(false);
    const picked = resolved.filter((f): f is ExtractedFile => f !== null);
    if (picked.length === 0) {
      toast.error("Could not load those files from your library.");
      return;
    }
    onSelect(multiple ? picked : [picked[0]]);
    setSelected(new Set());
  };

  /** "Delete All": one sweep for that kind, with an inline confirmation. */
  const removeAllAssets = async (kind: LibraryKind) => {
    setDeletingKind(kind);
    const ok = await deleteAllLibraryAssets(kind);
    setDeletingKind(null);
    setConfirmDeleteKind(null);
    if (!ok) {
      toast.error("Could not clear your library.");
      return;
    }
    setLibraryAssets((prev) => ({ ...prev, [kind]: [] }));
    setSelected(new Set());
    toast.success(
      `Removed all ${kindNoun(kind).toLowerCase()}s from your library.`,
    );
  };

  const removeLibraryAsset = async (asset: LibraryAsset) => {
    setDeletingId(asset.id);
    const ok = await deleteLibraryAsset(asset.id);
    setDeletingId(null);
    if (!ok) {
      toast.error("Could not remove that file from your library.");
      return;
    }
    setLibraryAssets((prev) => ({
      ...prev,
      [asset.kind]: prev[asset.kind].filter((row) => row.id !== asset.id),
    }));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(asset.id);
      return next;
    });
  };

  // The dialog may open on "This .zip" and then land on the library once the
  // archive has been kept, so the caller's ".zip" wording would be stale.
  const shownDescription =
    hasFiles && libraryKind && source === "library"
      ? "These files are now in your library. They stay there for 24 hours."
      : description;

  const confirmingLibrary = source === "library" && multiple;
  const confirmDisabled = resolving || selected.size === 0;
  const libraryAddTarget = selected.size > 0 ? selectedFiles : files;
  // Only the picker's own kind can be chosen from the library grid; the other
  // kind is listed read-only, exactly like the archive's "other files" list.
  const pickableLibraryAssets = libraryKind ? libraryAssets[libraryKind] : [];
  const libraryTotal =
    libraryAssets.image.length + libraryAssets.document.length;
  // Everything the archive held, both kinds — what "Add all files" keeps.
  const allArchiveFiles = [...files, ...otherKindFiles];
  // One keep action stores at most MAX_FILES_PER_LIBRARY_ADD files, so a target
  // bigger than that cannot be sent: the advisor is asked to select instead.
  const archiveTooBigToKeepAll =
    libraryAddTarget.length > MAX_FILES_PER_LIBRARY_ADD;
  const allFilesTooBigToKeep =
    allArchiveFiles.length > MAX_FILES_PER_LIBRARY_ADD;
  // "Image" / "Images" for the keep button, matching what is about to be stored.
  const addKindLabel = libraryKind
    ? kindLabel(libraryKind, selected.size > 0 ? selected.size : files.length)
    : "";
  const toggleLibraryKind = (kind: LibraryKind) =>
    setOpenLibraryKinds((prev) => ({ ...prev, [kind]: !prev[kind] }));

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
            {shownDescription && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {shownDescription}
              </DialogPrimitive.Description>
            )}
          </div>

          {showTabs && (
            <div
              role="tablist"
              aria-label="File source"
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={source === "zip"}
                onClick={() => switchSource("zip")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  source === "zip"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                This .zip
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={source === "library"}
                onClick={() => switchSource("library")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  source === "library"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Library className="h-3.5 w-3.5" />
                Your library
              </button>
            </div>
          )}

          {source === "zip" ? (
            <div className="space-y-3 py-2">
              {/* The opt-in "keep this archive" action. Nothing is stored unless
                  the advisor asks for it — see lib/profile-library.
                  Two choices: the kind this section can use ("Add all 3 Images
                  to Library"), or everything the archive held — documents
                  included — so the other kind is kept for its own section. */}
              {libraryKind && files.length > 0 && (
                // Two columns at every width: the explanation stays readable on
                // the left while the keep actions line up on the right.
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Keep this .zip&rsquo;s files for 24 hours so you can reuse
                      them from any image or document section.
                    </p>
                    {/* One action = one request, so the limit has to be stated
                        here rather than discovered through a failed request. */}
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      You can add up to {MAX_FILES_PER_LIBRARY_ADD} files at a
                      time.
                      {(archiveTooBigToKeepAll || allFilesTooBigToKeep) &&
                        " This .zip holds more — select the files you want to keep."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingToLibrary || archiveTooBigToKeepAll}
                      onClick={() =>
                        void addToLibrary(libraryAddTarget, [libraryKind])
                      }
                      title={
                        archiveTooBigToKeepAll
                          ? `Select up to ${MAX_FILES_PER_LIBRARY_ADD} files to keep.`
                          : undefined
                      }
                    >
                      {savingToLibrary ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {selected.size > 0
                        ? `Add ${selected.size} ${addKindLabel} to Library`
                        : files.length === 1
                        ? `Add ${addKindLabel} to Library`
                        : `Add all ${files.length} ${addKindLabel} to Library`}
                    </Button>
                    {hasOtherKind && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingToLibrary || allFilesTooBigToKeep}
                        onClick={() =>
                          void addToLibrary(allArchiveFiles, LIBRARY_KINDS)
                        }
                        title={
                          allFilesTooBigToKeep
                            ? `Select up to ${MAX_FILES_PER_LIBRARY_ADD} files to keep.`
                            : "Keep every file in this .zip — the images and the documents"
                        }
                      >
                        {savingToLibrary ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Files className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Add all {allArchiveFiles.length} Files to Library
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {!hasFiles && (
                <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <FolderOpen className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">
                    No {intendedKindLabel} were found in this .zip
                  </p>
                  {hasOtherKind && (
                    <p className="max-w-sm text-xs text-muted-foreground">
                      This archive holds{" "}
                      {otherKindFiles.length === 1
                        ? `1 ${otherKindLabel.toLowerCase()}`
                        : `${
                            otherKindFiles.length
                          } ${otherKindLabel.toLowerCase()}`}{" "}
                      instead. They are listed below so you know they arrived —
                      upload them from the {otherKindLabel.toLowerCase()}{" "}
                      section.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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

              {/* The archive's other kind. Read-only on purpose: an image slot
                  cannot upload a PDF, but the advisor should still see that the
                  .zip contained one — and where to take it. */}
              {otherKindFiles.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    aria-expanded={showOtherKind}
                    onClick={() => setShowOtherKind((open) => !open)}
                    className="flex w-full items-center justify-between gap-2 bg-muted/40 px-3 py-2 text-left transition hover:bg-muted/60"
                  >
                    <span className="text-xs font-medium text-foreground">
                      {otherKindFiles.length} {otherKindLabel}{" "}
                      {otherKindFiles.length === 1 ? "is" : "are"} present in
                      this .zip
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        showOtherKind ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showOtherKind && (
                    <div className="border-t border-border p-3">
                      <p className="pb-2 text-[11px] text-muted-foreground">
                        These stay inside the .zip — upload them from the{" "}
                        {otherKindLabel.toLowerCase()} section instead.
                      </p>
                      <div
                        role="group"
                        aria-disabled
                        aria-label={`${otherKindLabel} in this .zip (not selectable here)`}
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                      >
                        {otherKindFiles.map((f, index) => (
                          <div
                            // Two folders may hold the same file name; the name
                            // alone is not a stable key here.
                            key={`${f.fileName}-${index}`}
                            aria-disabled
                            title={`${
                              f.fileName
                            } — upload from the ${otherKindLabel.toLowerCase()} section`}
                            className="pointer-events-none flex cursor-not-allowed select-none flex-col gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-2 opacity-60 dark:border-gray-700 dark:bg-gray-900/40"
                          >
                            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-neutral-100 dark:bg-gray-900">
                              {f.previewUrl ? (
                                <img
                                  src={f.previewUrl}
                                  alt=""
                                  className="max-h-full max-w-full object-contain grayscale"
                                />
                              ) : (
                                <FileText className="h-10 w-10 text-neutral-400 dark:text-gray-500" />
                              )}
                            </div>
                            <div className="text-center">
                              <span className="block truncate text-xs text-neutral-500 dark:text-gray-400">
                                {f.fileName}
                              </span>
                              <span className="block text-[10px] text-neutral-400 dark:text-gray-500">
                                {formatBytes(f.size)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {libraryLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your library…
                </div>
              ) : libraryTotal === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
                  <Library className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">
                    Your library is empty
                  </p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Drop a .zip into any upload area, then choose &ldquo;Add to
                    library&rdquo; to keep its files here for 24 hours.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Files are kept for 24 hours after you add them. Remove any
                    you no longer need with the bin icon.
                  </p>

                  {/* One accordion per kind. The picker's own kind is selectable;
                      the other is only here so the advisor sees everything they
                      kept — an image section cannot upload a document. */}
                  {LIBRARY_KINDS.map((kind) => {
                    const assets = libraryAssets[kind];
                    const isPickerKind = kind === libraryKind;
                    const isOpen = openLibraryKinds[kind];
                    const confirming = confirmDeleteKind === kind;
                    const deleting = deletingKind === kind;
                    return (
                      <div
                        key={kind}
                        className="overflow-hidden rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-2 bg-muted/40 pr-2">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => toggleLibraryKind(kind)}
                            className="flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/60"
                          >
                            <span className="text-xs font-medium text-foreground">
                              {kindNoun(kind)}s in your library ({assets.length}
                              ){!isPickerKind && " — not selectable here"}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {assets.length > 0 &&
                            (confirming ? (
                              <span className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={deleting}
                                  onClick={() => setConfirmDeleteKind(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={deleting}
                                  onClick={() => void removeAllAssets(kind)}
                                  aria-label={`Delete all ${kindNoun(
                                    kind,
                                  ).toLowerCase()}s`}
                                  // The dark token is a 30%-lightness maroon
                                  // that reads as "disabled" on a dark surface;
                                  // a real red keeps the destructive action
                                  // legible either way.
                                  className="dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                                >
                                  {deleting ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Delete All
                                </Button>
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmDeleteKind(kind)}
                                aria-label={`Delete all ${kindNoun(
                                  kind,
                                ).toLowerCase()}s`}
                                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete All
                              </Button>
                            ))}
                        </div>

                        {isOpen && (
                          <div className="border-t border-border p-3">
                            {assets.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground">
                                No {kindNoun(kind).toLowerCase()}s kept yet.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                {assets.map((asset) => {
                                  const isSelected =
                                    isPickerKind && selected.has(asset.id);
                                  const isDeleting = deletingId === asset.id;
                                  return (
                                    <div
                                      key={asset.id}
                                      aria-disabled={
                                        isPickerKind ? undefined : true
                                      }
                                      title={
                                        isPickerKind
                                          ? undefined
                                          : `${
                                              asset.fileName
                                            } — upload from the ${kindNoun(
                                              kind,
                                            ).toLowerCase()} section`
                                      }
                                      className={`group relative flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left transition ${
                                        isSelected
                                          ? "border-accent-blue bg-accent-blue/5 shadow-sm"
                                          : isPickerKind
                                          ? "border-neutral-200 bg-white hover:border-accent-blue hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
                                          : "border-dashed border-neutral-200 bg-neutral-50 opacity-60 dark:border-gray-700 dark:bg-gray-900/40"
                                      }`}
                                    >
                                      {isPickerKind && (
                                        <button
                                          type="button"
                                          disabled={resolving || isDeleting}
                                          onClick={() =>
                                            void pickLibraryAsset(asset)
                                          }
                                          className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 disabled:cursor-wait"
                                          aria-label={`Use ${asset.fileName}`}
                                        />
                                      )}
                                      {multiple && isSelected && (
                                        <span className="pointer-events-none absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-white text-[10px] font-bold">
                                          ✓
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void removeLibraryAsset(asset)
                                        }
                                        disabled={isDeleting}
                                        className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 bg-background/95 text-muted-foreground opacity-0 shadow-sm transition hover:border-red-300 hover:text-destructive focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive/40 group-hover:opacity-100 dark:border-gray-600 dark:bg-gray-900/95 dark:text-gray-300 dark:hover:border-red-500/60 dark:hover:text-red-400"
                                        aria-label={`Remove ${asset.fileName} from your library`}
                                        title="Remove from library"
                                      >
                                        {isDeleting ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                      <div className="pointer-events-none relative z-10 aspect-square w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-gray-900 flex items-center justify-center">
                                        {asset.kind === "image" ? (
                                          <img
                                            src={asset.url}
                                            alt={
                                              isPickerKind ? asset.fileName : ""
                                            }
                                            className={`max-h-full max-w-full object-contain ${
                                              isPickerKind ? "" : "grayscale"
                                            }`}
                                          />
                                        ) : (
                                          <FileText className="h-10 w-10 text-neutral-400 dark:text-gray-500" />
                                        )}
                                      </div>
                                      <div className="pointer-events-none relative z-10 text-center">
                                        <span className="block text-xs text-neutral-600 dark:text-gray-300 truncate">
                                          {asset.fileName}
                                        </span>
                                        <span className="block text-[10px] text-neutral-400 dark:text-gray-500">
                                          {formatBytes(asset.size)}
                                          {asset.width > 0 && asset.height > 0
                                            ? ` · ${asset.width}×${asset.height} px`
                                            : ""}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

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
                  disabled={confirmDisabled}
                  onClick={() => {
                    if (confirmingLibrary) {
                      void addLibrarySelection();
                      return;
                    }
                    onSelect(selectedFiles);
                    setSelected(new Set());
                  }}
                >
                  {resolving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>Add{selected.size > 0 ? ` (${selected.size})` : ""}</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 pt-2">
              {resolving ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading file…
                </span>
              ) : (
                <span />
              )}
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
