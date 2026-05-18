"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { useVideoWizardStore } from "@/lib/video-wizard-store";

export function ResetOnboardingButton() {
  const [open, setOpen] = useState(false);
  const [deletePlansAndScopedData, setDeletePlansAndScopedData] =
    useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const router = useRouter();
  const { resetWizard } = useOnboardingWizardStore();

  const resetPersistedOnboardingLocal = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("onboarding-wizard-store");
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/reset-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deletePlansAndScopedData }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset onboarding");
      }

      const result = await response.json();

      resetWizard();
      resetPersistedOnboardingLocal();

      if (deletePlansAndScopedData) {
        useBenefitsWizardStore.getState().resetWizard();
        useNewClientWizardStore.getState().resetWizard();
        useVideoWizardStore.getState().resetWizard();
        if (typeof window !== "undefined") {
          localStorage.removeItem("benefits-wizard-store");
          localStorage.removeItem("video-wizard-storage");
          localStorage.removeItem("new-client-wizard");
        }
      }

      if (deletePlansAndScopedData) {
        toast.success("Full reset complete", {
          description:
            "Onboarding was restarted and all plans and related portal data were removed.",
          duration: 4000,
        });
      } else {
        toast.success("Onboarding reset successfully!", {
          description:
            "You'll be redirected to start the setup process again. Your existing plans are unchanged.",
          duration: 3000,
        });
      }

      setOpen(false);
      setDeletePlansAndScopedData(false);

      router.push(result.redirectUrl || "/new/onboarding");
    } catch (error) {
      console.error("Error resetting onboarding:", error);
      toast.error("Failed to reset onboarding", {
        description:
          "Please try again. If the problem persists, contact support.",
        duration: 5000,
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isResetting}
        onClick={() => setOpen(true)}
        className="group relative overflow-hidden border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 text-red-700 hover:from-red-100 hover:to-orange-100 hover:border-red-300 hover:text-red-800 transition-all duration-300 shadow-sm hover:shadow-md"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-center">
          {isResetting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-red-600" />
              <span className="font-medium">Resetting...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-300" />
              <span className="font-medium">Reset Onboarding</span>
            </>
          )}
        </div>
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDeletePlansAndScopedData(false);
        }}
      >
        <AlertDialogContent className="max-w-md mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                Reset onboarding
              </AlertDialogTitle>
              <p className="text-sm text-gray-500">
                This clears saved onboarding progress on our servers
              </p>
            </div>
          </div>

          <AlertDialogDescription className="text-gray-600 leading-relaxed space-y-4">
            <p>
              You can restart the setup wizard while keeping your retirement and
              benefits plans as they are, or wipe plans and plan-related portal
              data for a clean slate.
            </p>

            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
              <Checkbox
                id="reset-delete-plans"
                checked={deletePlansAndScopedData}
                onCheckedChange={(v) =>
                  setDeletePlansAndScopedData(v === true)
                }
                disabled={isResetting}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="reset-delete-plans"
                  className="text-gray-900 cursor-pointer leading-snug font-normal"
                >
                  Also delete all plans and associated assets (documents,
                  meetings, portal contacts, videos)
                </Label>
                <p className="text-xs text-gray-500 leading-snug">
                  Leaves advisor-only profile data (such as saved advisor
                  contacts where stored separately). Unchecked by default.
                </p>
              </div>
            </div>
          </AlertDialogDescription>

          {deletePlansAndScopedData ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-900">
                  <strong>Hard reset:</strong> All plans for your account and
                  related portal data will be permanently deleted. This cannot be
                  undone.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>Onboarding only:</strong> Organization details, team
                  info, and branding from the setup wizard will be cleared. Your
                  plans stay in place.
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-6">
            <AlertDialogCancel className="w-full sm:w-auto order-2 sm:order-1">
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isResetting}
              onClick={() => void handleReset()}
              className={
                deletePlansAndScopedData
                  ? "w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  : "w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              }
            >
              {isResetting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </span>
              ) : deletePlansAndScopedData ? (
                "Reset onboarding & delete plans"
              ) : (
                "Reset onboarding only"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
