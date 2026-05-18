"use client";

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
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 p-3 rounded-full ${variantStyles.iconBg}`}
            >
              {variantStyles.icon}
            </div>
            <div className="flex-1 pt-1">
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm text-gray-600">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="flex-1 m-0">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={`flex-1 ${variantStyles.confirmButtonClass}`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
