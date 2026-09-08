"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlanChangeLoadingDialogProps {
  open: boolean;
  title?: string;
  description?: string;
}

/**
 * Non-dismissable spinner dialog shown while a selected plan's data is loading
 * after the advisor switches plans (Recent Plans chips / search dropdown).
 * Shared across the Documents, Marketing, Meetings, and Benefits pages.
 */
export function PlanChangeLoadingDialog({
  open,
  title = "Loading Plan",
  description = "Loading the selected plan, please wait…",
}: PlanChangeLoadingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-sm [&>button.absolute]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-accent-blue border-t-transparent" />
          <DialogTitle className="text-lg font-semibold text-accent-blue">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center">
            {description}
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  );
}
