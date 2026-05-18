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
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndSwitch: () => void;
  onDiscardAndSwitch: () => void;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSaveAndSwitch,
  onDiscardAndSwitch,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-lg flex justify-center items-center h-full w-full ml-[-46px] font-semibold text-gray-900">
              Unsaved Changes
            </AlertDialogTitle>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-1 pt-1">
              <AlertDialogDescription className="mt-2 text-sm text-gray-600">
                You have unsaved changes. What would you like to do?
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 sm:flex-row sm:justify-end">
          <AlertDialogAction
            onClick={onDiscardAndSwitch}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 focus:ring-slate-500"
          >
            Discard and Switch
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onSaveAndSwitch}
            className="flex-1 bg-accent-blue hover:bg-accent-blue/90 text-white focus:ring-accent-blue"
          >
            Save and Switch
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
