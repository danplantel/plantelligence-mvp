"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface AddNowAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the advisor confirms the attestation. */
  onConfirm: () => void;
}

/**
 * Attestation shown when the advisor chooses "Add Now" on Step 5b. Continue is
 * gated on the attestation checkbox.
 */
export function AddNowAttestationModal({
  isOpen,
  onClose,
  onConfirm,
}: AddNowAttestationModalProps) {
  const [accepted, setAccepted] = useState(false);

  // Reset the attestation each time the dialog opens.
  useEffect(() => {
    if (isOpen) setAccepted(false);
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="dark:text-gray-100">
            Confirm Your Disclosures
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground dark:text-gray-300">
            {"You’re confirming the disclosures that will be applied to your Benefits Hubs and marketing materials."}
          </p>

          {/* Attestation checkbox inside an accent-blue-light alert */}
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-accent-blue/30 bg-accent-blue-light p-3">
            <Checkbox
              checked={accepted}
              onCheckedChange={(value) => setAccepted(value === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-accent-blue dark:text-white">
              {"I’ve reviewed these disclosures and confirm they meet my organization’s compliance requirements. PlanTelligence does not provide compliance review."}
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Go Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!accepted}
            className="bg-accent-blue text-white hover:bg-[#3f797f] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-blue-dark dark:hover:bg-accent-blue"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
