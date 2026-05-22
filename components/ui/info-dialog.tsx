"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Info, X } from "lucide-react";

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}

export function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
}: InfoDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md dark:border-gray-600 dark:bg-gray-900">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
              <Info className="h-5 w-5 text-blue-accent dark:text-blue-accent" />
            </div>
            <div className="flex-1 pt-1">
              <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <div className="flex justify-end">
          <AlertDialogAction className="bg-accent-blue hover:bg-blue-700 text-white focus:ring-blue-500 dark:bg-accent-blue dark:hover:bg-blue-600">
            Got it
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
