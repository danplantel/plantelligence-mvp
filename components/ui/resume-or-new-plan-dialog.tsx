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
import { FileText, Plus } from "lucide-react";

type ResumeOrNewPlanDialogProps = {
  open: boolean;
  /** The company / plan name to display in the dialog */
  planName?: string;
  /** A formatted "saved at" timestamp shown in the description */
  savedAt?: string;
  /** Called when the user chooses to continue the existing draft */
  onContinue: () => void;
  /** Called when the user chooses to start a new plan */
  onCreateNew: () => void;
  /** True while the wizard is performing the selected action */
  isLoading?: boolean;
};

/**
 * A dialog presented when the user returns to the Create Plan page and an
 * in-progress draft is detected.  Gives them the choice to either:
 *
 *  1. **Continue** where they left off (loads the existing draft data), or
 *  2. **Start a new plan** (discards the draft and begins fresh).
 */
export function ResumeOrNewPlanDialog({
  open,
  planName,
  savedAt,
  onContinue,
  onCreateNew,
  isLoading = false,
}: ResumeOrNewPlanDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-[480px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            You have an in-progress plan
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground space-y-2">
            {planName ? (
              <span className="block font-medium text-foreground">
                &ldquo;{planName}&rdquo;
              </span>
            ) : null}
            <span className="block">
              We found a draft plan{savedAt ? ` saved ${savedAt}` : ""}. Would
              you like to continue where you left off or start fresh?
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            variant="default"
            onClick={onContinue}
            disabled={isLoading}
            className="w-full gap-2"
          >
            <FileText className="h-4 w-4" />
            Continue this plan
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCreateNew}
            disabled={isLoading}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Create a new plan
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
