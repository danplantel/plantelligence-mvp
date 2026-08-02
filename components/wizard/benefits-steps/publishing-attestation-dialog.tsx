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

interface PublishingAttestationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  submitting?: boolean;
}

/**
 * Publishing Attestation dialog shown when the user attempts to submit/publish
 * a Benefits Hub from Step 5 of the Create Benefit flow. Both attestations must
 * be acknowledged before the "Confirm and Publish" action is enabled.
 */
export function PublishingAttestationDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting = false,
}: PublishingAttestationDialogProps) {
  const [certifyChecked, setCertifyChecked] = useState(false);
  const [understandChecked, setUnderstandChecked] = useState(false);

  // Reset the attestation checkboxes each time the dialog is opened so the
  // user has to actively re-confirm on every publish attempt.
  useEffect(() => {
    if (open) {
      setCertifyChecked(false);
      setUnderstandChecked(false);
    }
  }, [open]);

  const bothChecked = certifyChecked && understandChecked;

  const handleConfirm = () => {
    if (!bothChecked || submitting) return;
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Do not allow dismissing while a publish is in flight
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publishing Attestation</DialogTitle>
          <DialogDescription>
            Review and confirm the attestations below to publish this Benefits Hub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Checkbox 1 — Authorization & content approval */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="attest-certify"
              checked={certifyChecked}
              onCheckedChange={(value) => setCertifyChecked(value === true)}
              className="mt-1"
            />
            <Label
              htmlFor="attest-certify"
              className="text-sm leading-relaxed font-normal cursor-pointer text-gray-700 dark:text-gray-200"
            >
              I certify that I am authorized to approve and publish this
              Benefits Hub. I have reviewed the content and disclosures and
              confirm that they are accurate, complete, current, and approved
              by all required parties within my organization, including legal,
              compliance, fiduciary, broker-dealer/RIA, insurance, or HR
              reviewers, as applicable.
            </Label>
          </div>

          {/* Checkbox 2 — PlanTelligence role & responsibility */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="attest-understand"
              checked={understandChecked}
              onCheckedChange={(value) => setUnderstandChecked(value === true)}
              className="mt-1"
            />
            <Label
              htmlFor="attest-understand"
              className="text-sm leading-relaxed font-normal cursor-pointer text-gray-700 dark:text-gray-200"
            >
              I understand that PlanTelligence provides technology services
              only and does not provide legal, tax, ERISA, investment,
              insurance, or compliance advice or independently approve the
              content submitted through the platform. My organization remains
              responsible for the content it submits, approves, and publishes.
              I agree to the Terms of Service and Privacy Policy.
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
            disabled={!bothChecked || submitting}
            className="bg-[#23919C] hover:bg-[#1b727a] text-white"
          >
            {submitting ? "Publishing..." : "Confirm and Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
