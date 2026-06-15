"use client";

import { useState } from "react";
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
}: ConfirmDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const busy = isLoading || isProcessing;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
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
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 p-3 rounded-full ${variantStyles.iconBg}`}
            >
              {variantStyles.icon}
            </div>
            <div className="flex-1 pt-1">
              <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-muted-foreground">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="flex-1 m-0" disabled={busy}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 ${variantStyles.confirmButtonClass}`}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
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
