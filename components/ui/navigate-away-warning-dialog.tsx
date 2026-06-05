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

type NavigateAwayWarningDialogProps = {
  open: boolean;
  isSaving?: boolean;
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
  onStay,
  onSaveAndExit,
  onDiscardWithoutSaving,
  onDialogOpenChange,
  onDiscardPointerDownCapture,
}: NavigateAwayWarningDialogProps) {
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
        <AlertDialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            variant="default"
            onClick={onSaveAndExit}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save and exit"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onStay}
            disabled={isSaving}
            className="w-full relative right-2"
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
            disabled={isSaving}
            className="w-full relative right-2"
          >
            Discard without saving
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
