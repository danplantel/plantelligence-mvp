"use client";

import { Loader2, Pencil, Plus, X } from "lucide-react";

export interface ImageActionsRowProps {
  /** Reopen the editor that owns the crop, scale and background-removal controls. */
  onEdit: () => void;
  /** Pick a replacement file. */
  onNewImage: () => void;
  /** Clear the image. May be async; the caller owns its own busy flag. */
  onDelete: () => void | Promise<void>;
  /** Disables the Edit button. */
  editDisabled?: boolean;
  /** Disables the New Image button. */
  newImageDisabled?: boolean;
  /** Disables the Delete button. */
  deleteDisabled?: boolean;
  /** Shows the Delete button's spinner and "Deleting..." label. */
  isDeleting?: boolean;
}

/**
 * The Edit · New Image · Delete row that sits beneath an image preview.
 *
 * Deliberately a single row that SHRINKS rather than one that wraps. It used to be
 * `flex-wrap`, so in a narrow parent (an onboarding card, a settings column) Delete
 * was pushed onto a line of its own and read as a separate control instead of the
 * third of three. The row now takes the full width and the three buttons share it;
 * when there is not room for every label, the labels truncate — the buttons get
 * smaller, they do not break the line.
 *
 * Every handler stops propagation: the surrounding trigger opens the file picker on
 * click, and these buttons must not also open it.
 */
export function ImageActionsRow({
  onEdit,
  onNewImage,
  onDelete,
  editDisabled = false,
  newImageDisabled = false,
  deleteDisabled = false,
  isDeleting = false,
}: ImageActionsRowProps) {
  return (
    <div className="flex w-full min-w-0 items-center justify-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        disabled={editDisabled}
        className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-full border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-200 dark:hover:bg-gray-700 sm:gap-1.5 sm:px-3"
      >
        <Pencil className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Edit</span>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onNewImage();
        }}
        disabled={newImageDisabled}
        className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-full border border-accent-blue/30 bg-accent-blue-light px-2 py-1.5 text-xs font-medium text-accent-blue transition-colors hover:bg-accent-blue/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-accent-blue/50 dark:bg-accent-blue/15 dark:hover:bg-accent-blue/25 sm:gap-1.5 sm:px-3"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">New</span>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void onDelete();
        }}
        disabled={deleteDisabled}
        className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-full border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 sm:gap-1.5 sm:px-3"
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{isDeleting ? "Deleting..." : "Delete"}</span>
      </button>
    </div>
  );
}
