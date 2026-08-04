"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";

interface DisclaimerUpdateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  submitting?: boolean;
}

/**
 * Confirmation dialog shown when the user updates an existing disclaimer in the
 * Team & Disclaimers settings. The disclaimer must be explicitly acknowledged
 * before the "Confirm Update" action is enabled, mirroring the Publishing
 * Attestation dialog used in the Benefits flow.
 */
export function DisclaimerUpdateConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting = false,
}: DisclaimerUpdateConfirmDialogProps) {
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Reset the confirmation checkbox each time the dialog is opened so the user
  // has to actively re-confirm on every update attempt.
  useEffect(() => {
    if (open) {
      setConfirmChecked(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!confirmChecked || submitting) return;
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Do not allow dismissing while an update is in flight
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Update Disclaimer?
            </DialogTitle>
          </div>
          <DialogDescription className="text-left text-sm text-gray-600 dark:text-gray-300 space-y-3">
            <p>
              You are about to change this disclaimer. Your updated disclaimer
              will replace the existing one in the selected locations, and any
              portals or materials using it will reflect the updated text.
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 mt-0.5 shrink-0" />
              Please confirm that you intend to change/update this disclaimer
              before continuing.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id="disclaimer-update-confirm"
              checked={confirmChecked}
              onCheckedChange={(value) => setConfirmChecked(value === true)}
              className="mt-1"
            />
            <Label
              htmlFor="disclaimer-update-confirm"
              className="text-sm leading-relaxed font-normal cursor-pointer text-gray-700 dark:text-gray-200"
            >
              I confirm that I want to update this disclaimer with the changes I
              have made.
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!confirmChecked || submitting}
            className="bg-[#23919C] hover:bg-[#1b727a] text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? "Updating..." : "Confirm Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
