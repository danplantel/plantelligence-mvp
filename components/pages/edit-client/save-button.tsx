"use client";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Save, AlertTriangle } from "lucide-react";

interface SaveButtonProps {
  onSave: () => void;
  saving: boolean;
  clientStatus: string;
  isFormValid: boolean;
}

export function SaveButton({
  onSave,
  saving,
  clientStatus,
  isFormValid,
}: SaveButtonProps) {
  const canSave =
    clientStatus === "Draft" || (clientStatus === "Active" && isFormValid);

  return (
    <div className="flex items-center gap-3">
      {clientStatus === "Active" && !isFormValid && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <span>Complete all required fields to activate</span>
        </div>
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
