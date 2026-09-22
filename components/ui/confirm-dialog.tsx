"use client";

import { useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "warning" | "info";
  /** When true, confirm button shows a spinner and buttons are disabled */
  isLoading?: boolean;
  /**
   * Label shown on the confirm button while it is busy. Defaults to "Deleting..."
   * for the delete confirmations this dialog was built for; callers whose action is
   * not a deletion should name it, so the spinner never reports the wrong verb.
   */
  loadingText?: string;
  /**
   * Label for a second dismiss action, rendered beside `cancelText`.
   *
   * This dialog is built for the two-answer shape — do it, or don't — so `cancelText`
   * is the only way out, and Radix's AlertDialog ignores Escape and outside clicks by
   * design. A caller whose "no" carries two distinct readings can supply this one
   * alongside it; it dismisses exactly like Cancel, so the difference is the label the
   * user is answering with. Left out, the footer is unchanged.
   */
  extraCancelText?: string;
  /**
   * Extra content rendered between the description and the buttons — e.g. a
   * before/after preview. Supplying it widens the dialog so a pair fits.
   */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Continue",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
  loadingText = "Deleting...",
  extraCancelText,
  children,
}: ConfirmDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  // Synchronous mirror of the busy state so we can block the dialog from
  // closing the instant the confirm button is clicked (before React re-renders).
  const busyRef = useRef(false);
  const busy = isLoading || isProcessing;

  const handleConfirm = async () => {
    busyRef.current = true;
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      busyRef.current = false;
      setIsProcessing(false);
      onOpenChange(false);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
          iconBg: "bg-red-100",
          confirmButtonClass:
            "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
          iconBg: "bg-amber-100",
          confirmButtonClass:
            "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
        };
      case "info":
        return {
          icon: <Info className="h-5 w-5 text-blue-600" />,
          iconBg: "bg-blue-100",
          confirmButtonClass:
            "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
        };
      default:
        return {
          icon: <CheckCircle className="h-5 w-5 text-gray-600" />,
          iconBg: "bg-gray-100",
          confirmButtonClass:
            "bg-gray-900 hover:bg-gray-800 text-white focus:ring-gray-500",
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Prevent closing while deletion is in progress
        if (!next && (busy || busyRef.current)) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className={`text-left ${children ? "max-w-lg" : "max-w-md"}`}
      >
        <AlertDialogHeader className="text-left">
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
            <div
              className={`flex-shrink-0 p-3 rounded-full ${variantStyles.iconBg}`}
            >
              {variantStyles.icon}
            </div>
            <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="col-span-2 text-sm text-gray-600 dark:text-gray-400 text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          {/* With a third button the dismissives size to their labels and the
              confirm button takes the rest, so the primary action is the one that
              still fits on a line. Alone, Cancel keeps the even split it has always
              had. */}
          <AlertDialogCancel
            className={`m-0 ${extraCancelText ? "" : "flex-1"}`}
            disabled={busy}
          >
            {cancelText}
          </AlertDialogCancel>
          {extraCancelText && (
            <AlertDialogCancel className="m-0" disabled={busy}>
              {extraCancelText}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 ${variantStyles.confirmButtonClass}`}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingText}
              </span>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
