"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SkipAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the advisor confirms the skip attestation. */
  onConfirm: () => void;
}

/**
 * Attestation shown when the advisor chooses "Confirm Disclosures / Skip for
 * Now" on Step 5b.
 */
export function SkipAttestationModal({
  isOpen,
  onClose,
  onConfirm,
}: SkipAttestationModalProps) {
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
            Skip Disclosures for now?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Yellow alert */}
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            {"Benefits Hubs can’t be published until your disclosures are reviewed and confirmed. You can do this anytime in Settings > Disclosures."}
          </div>

          {/* Status note */}
          <p className="text-sm text-muted-foreground dark:text-gray-300">
            {"Your status will show as “Disclosures not reviewed” on the Dashboard."}
          </p>
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
            className="bg-accent-blue text-white hover:bg-[#3f797f] dark:bg-accent-blue-dark dark:hover:bg-accent-blue"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
