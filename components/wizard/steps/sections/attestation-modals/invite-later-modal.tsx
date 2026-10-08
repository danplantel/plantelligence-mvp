"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InviteLaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the advisor confirms they will invite the team later. */
  onConfirm: () => void;
}

/**
 * Confirmation shown when the advisor chooses "Invite Later" on Step 5c. It
 * makes clear that skipping is safe and tells them exactly where to add Team
 * Members afterwards (Settings › People & Access).
 */
export function InviteLaterModal({
  isOpen,
  onClose,
  onConfirm,
}: InviteLaterModalProps) {
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
            Invite your team later?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground dark:text-gray-300">
            {"You can add Team Members anytime in Settings > People & Access. Each person you add there gets an email invite and access to the plans you share with them."}
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
