"use client";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Save, AlertTriangle } from "lucide-react";

interface SaveButtonProps {
  onSave: () => void;
  saving: boolean;
  clientStatus: string;
  isFormValid: boolean;
  /** Invoked when the "Complete all required fields" indicator is clicked
   *  (jumps to the first missing required field). */
  onInvalidClick?: () => void;
}

export function SaveButton({
  onSave,
  saving,
  clientStatus,
  isFormValid,
  onInvalidClick,
}: SaveButtonProps) {
  const canSave =
    clientStatus === "Draft" || (clientStatus === "Active" && isFormValid);

  return (
    <div className="flex items-center gap-3">
      {clientStatus === "Active" && !isFormValid && (
        onInvalidClick ? (
          <button
            type="button"
            onClick={onInvalidClick}
            title="Show the first missing required field"
            className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 underline-offset-2 hover:underline"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Complete all required fields to activate</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Complete all required fields to activate</span>
          </div>
        )
      )}

      <LoadingButton
        onClick={onSave}
        isLoading={saving}
        disabled={!canSave}
        className="min-w-[120px]"
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? "Saving..." : "Save Changes"}
      </LoadingButton>
    </div>
  );
}
