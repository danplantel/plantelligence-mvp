"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type NavigateAwayWarningDialogProps = {
  open: boolean;
  isSaving?: boolean;
  isDiscarding?: boolean;
  onStay: () => void;
  onSaveAndExit: () => void;
  onDiscardWithoutSaving: () => void;
  /** Pass from useNavigateAwayGuard().dialogOnOpenChange so Escape/outside close does not clear pending nav before Discard runs. */
  onDialogOpenChange: (open: boolean) => void;
  /** Pass from useNavigateAwayGuard().suppressStayOnNextClose — run on Discard pointerdown before Radix onOpenChange. */
  onDiscardPointerDownCapture?: () => void;
};

export function NavigateAwayWarningDialog({
  open,
  isSaving = false,
  isDiscarding = false,
  onStay,
  onSaveAndExit,
  onDiscardWithoutSaving,
  onDialogOpenChange,
  onDiscardPointerDownCapture,
}: NavigateAwayWarningDialogProps) {
  const isLoading = isSaving || isDiscarding;

  return (
    <AlertDialog open={open} onOpenChange={onDialogOpenChange}>
      <AlertDialogContent className="sm:max-w-[460px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this setup?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. If you leave now, your updates may be
            lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch sm:space-x-0">
          <Button
            type="button"
            variant="default"
            onClick={onSaveAndExit}
            disabled={isLoading}
            className="w-full"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save and exit"
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onStay}
            disabled={isLoading}
            className="w-full"
          >
            Stay and keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            onPointerDownCapture={
              onDiscardPointerDownCapture
                ? () => onDiscardPointerDownCapture()
                : undefined
            }
            onClick={onDiscardWithoutSaving}
            disabled={isLoading}
            className="w-full"
          >
            {isDiscarding ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Discarding...
              </span>
            ) : (
              "Discard without saving"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
