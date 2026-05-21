"use client";

import { useState, useEffect } from "react";
import {
  OnboardingWizardState,
  useOnboardingWizardStore,
} from "@/lib/onboarding-wizard-store";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AddDisclaimerModal } from "./sections/add-disclaimer-modal/add-disclaimer-modal";
import { toast } from "sonner";
import { Disclaimer } from "@/types/wizard";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface DisclaimerCardProps {
  disclaimer: Disclaimer;
  onEdit: () => void;
  onDelete: () => void;
}

function DisclaimerCard({ disclaimer, onEdit, onDelete }: DisclaimerCardProps) {
  return (
    <div className="border border-gray-200 rounded p-3 bg-card relative">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 pr-2">
          <span className="text-[11px] font-semibold text-gray-700">
            {[
              ...disclaimer.locations,
              ...(disclaimer.customLocation ? [disclaimer.customLocation] : []),
            ].join(", ")}
          </span>
        </div>

        <div className="flex gap-1 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 px-1.5 text-gray-600 hover:text-accent-blue text-[11px] font-medium"
          >
            <Edit2 className="h-3 w-3 mr-0.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-gray-500 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
        {disclaimer.text}
      </div>
    </div>
  );
}

export function Step5Disclaimers({
  onValidationChange,
  errorFields,
  companyName,
  organizationName,
  useNewClientStore = false,
  disclaimerScopeFlag = false,
  forceUniversalScope = false,
}: {
  onValidationChange?: (isValid: boolean) => void;
  errorFields: string[];
  companyName?: string;
  organizationName?: string;
  useNewClientStore?: boolean;
  disclaimerScopeFlag?: boolean;
  forceUniversalScope?: boolean;
}) {
  const [isValidState, setIsValid] = useState(false);

  // Use appropriate store based on prop
  const onboardingStore = useOnboardingWizardStore();
  const newClientStore = useNewClientWizardStore();

  const store = useNewClientStore ? newClientStore : onboardingStore;
  const { stepData, saveStepDataLocally, saveStepData, saveStepDataToServer } =
    store;
  const saveAsDraft = (store as any).saveAsDraft;

  const loadStepData = (store as any).loadStepData;

  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>(
    stepData.disclaimers?.disclaimers || [],
  );
  const [addTiming, setAddTiming] = useState<"now" | "later" | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisclaimer, setEditingDisclaimer] = useState<Disclaimer | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [disclaimerToDelete, setDisclaimerToDelete] =
    useState<Disclaimer | null>(null);
  const [validationError, setValidationError] = useState<string>("");

  // Helper function to save disclaimer to universal template (onboarding-wizard)
  const saveToUniversalDisclaimer = async (disclaimers: Disclaimer[]) => {
    try {
      // Filter out plan-specific disclaimers
      // We keep 'universal' scope AND undefined scope (legacy disclaimers are treated as universal)
      const universalDisclaimers = disclaimers.filter(
        (d) => d.scope !== "plan",
      );

      const response = await fetch("/api/onboarding-wizard/disclaimers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ disclaimers: universalDisclaimers }),
      });

      if (!response.ok) {
        throw new Error("Failed to save universal disclaimer");
      }

      return true;
    } catch (error) {
      console.error("Error saving universal disclaimer:", error);
      toast.error("Failed to save universal disclaimer");
      return false;
    }
  };

  // Load data when component mounts
  useEffect(() => {
    if (typeof loadStepData === "function") {
      loadStepData("disclaimers");
    }
  }, [loadStepData]);

  // Update state when stepData changes
  useEffect(() => {
    if (stepData.disclaimers?.disclaimers) {
      const loadedDisclaimers = stepData.disclaimers.disclaimers;
      setDisclaimers(loadedDisclaimers);
      // If disclaimers are loaded and addTiming is not set, set it to "now"
      if (loadedDisclaimers.length > 0 && !addTiming) {
        setAddTiming("now");
      }
    }
  }, [stepData.disclaimers, addTiming]);

  // Notify parent component about validation status with stricter rules
  useEffect(() => {
    if (onValidationChange) {
      // Valid if any disclaimer exists OR user chose add later
      // Also valid if disclaimers exist but addTiming is not set (will be set to "now" by another effect)
      const isValid = disclaimers.length > 0 || addTiming === "later";
      setIsValid(isValid);
      onValidationChange(isValid);
    }
  }, [addTiming, disclaimers.length, onValidationChange]);

  useEffect(() => { }, [errorFields]);
  // If disclaimers already exist but timing not chosen, default to "now" for clarity
  useEffect(() => {
    if (disclaimers.length > 0 && !addTiming) {
      setAddTiming("now");
    }
    // If all disclaimers are deleted, reset addTiming only if it was "now"
    if (disclaimers.length === 0 && addTiming === "now") {
      setAddTiming(null);
    }
  }, [disclaimers.length, addTiming]);

  const handleAddTimingChange = async (value: string) => {
    const timing = value as "now" | "later";
    setAddTiming(timing);
    setValidationError(""); // Clear validation error when user makes a selection

    // Open modal immediately when "Add Now" is selected
    if (timing === "now") {
      setIsModalOpen(true);
    }

    // If user selects Add Later and no disclaimers exist, create a default disclaimer
    if (timing === "later" && disclaimers.length === 0) {
      const year = new Date().getFullYear();
      const defaultDisclaimer: Disclaimer = {
        id: Date.now().toString(),
        text: `
        The information and resources provided on this website are for educational and informational purposes only and are not intended as ERISA, tax, legal, investment, insurance, medical, or other professional advice. Each plan, employer, and participant situation is unique. Plan sponsors, employers, and participants should consult their qualified legal, tax, investment, insurance, medical, or other licensed professionals regarding their specific circumstances.
        Nothing on this website should be construed as a solicitation, recommendation, or endorsement to buy, sell, or maintain any security, insurance product, or investment strategy. PlanTelligence does not provide investment advice, does not act as an ERISA fiduciary, and does not determine plan design, benefit eligibility, or coverage.
        PlanTelligence is an independent technology platform and is not affiliated with any broker-dealer, registered investment advisor, insurance carrier, recordkeeper, or third-party administrator.
        Links to external websites are provided for informational purposes only and do not constitute an endorsement or approval by PlanTelligence or any associated firms.
        PlanTelligence, ${organizationName ||
          (useNewClientStore
            ? (stepData as any).companyBasics?.companyName
            : (stepData as any).branding?.organizationName) ||
          "[Organization Name]"
          }, and ${companyName || "[Company Name]"} are separate and unaffiliated entities.
        © 2026 PlanTelligence. All rights reserved.`,
        locations: ["Global"],
        customLocation: "",
      };
      const updated = [...disclaimers, defaultDisclaimer];
      setDisclaimers(updated);
      saveStepDataLocally("disclaimers", { disclaimers: updated });
      saveStepDataToServer("disclaimers", { disclaimers: updated });
      // Save to draft
      if (saveAsDraft) {
        try {
          await saveAsDraft();
        } catch (error) {
          console.error(
            "Failed to save draft when adding default disclaimer:",
            error,
          );
        }
      }
    }
  };

  const handleAddDisclaimer = async (disclaimer: Omit<Disclaimer, "id">) => {
    const newDisclaimer: Disclaimer = {
      ...disclaimer,
      id: Date.now().toString(),
    };

    const updatedDisclaimers = [...disclaimers, newDisclaimer];
    setDisclaimers(updatedDisclaimers);

    // Ensure addTiming is set when disclaimers are added
    if (!addTiming) {
      setAddTiming("now");
    }

    // Always save locally (to client draft)
    saveStepDataLocally("disclaimers", { disclaimers: updatedDisclaimers });
    saveStepDataToServer("disclaimers", { disclaimers: updatedDisclaimers });
    // Save to draft
    if (saveAsDraft) {
      try {
        await saveAsDraft();
      } catch (error) {
        console.error("Failed to save draft when adding disclaimer:", error);
      }
    }

    // If scope is "universal" OR forced universal, also save to onboarding-wizard
    if (disclaimer.scope === "universal" || forceUniversalScope) {
      await saveToUniversalDisclaimer(updatedDisclaimers);
    }

    toast.success("Disclaimer added successfully");
  };

  const handleUpdateDisclaimer = async (
    id: string,
    updatedDisclaimer: Omit<Disclaimer, "id">,
  ) => {
    const updatedDisclaimers = disclaimers.map((d) =>
      d.id === id ? { ...updatedDisclaimer, id } : d,
    );
    setDisclaimers(updatedDisclaimers);

    // Always save locally (to client draft)
    saveStepDataLocally("disclaimers", { disclaimers: updatedDisclaimers });
    saveStepDataToServer("disclaimers", { disclaimers: updatedDisclaimers });
    // Save to draft
    if (saveAsDraft) {
      try {
        await saveAsDraft();
      } catch (error) {
        console.error("Failed to save draft when adding disclaimer:", error);
      }
    }

    // If scope is "universal" OR forced universal, also save to onboarding-wizard
    if (updatedDisclaimer.scope === "universal" || forceUniversalScope) {
      await saveToUniversalDisclaimer(updatedDisclaimers);
    }

    toast.success("Disclaimer updated successfully");
  };

  const handleDeleteDisclaimer = (disclaimer: Disclaimer) => {
    setDisclaimerToDelete(disclaimer);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (disclaimerToDelete) {
      const updatedDisclaimers = disclaimers.filter(
        (d) => d.id !== disclaimerToDelete.id,
      );
      setDisclaimers(updatedDisclaimers);

      // Always save locally
      saveStepDataLocally("disclaimers", { disclaimers: updatedDisclaimers });
      saveStepDataToServer("disclaimers", { disclaimers: updatedDisclaimers });
      // Save to draft
      if (saveAsDraft) {
        try {
          await saveAsDraft();
        } catch (error) {
          console.error(
            "Failed to save draft when deleting disclaimer:",
            error,
          );
        }
      }

      // If the deleted disclaimer was universal OR forced universal, also update onboarding-wizard
      if (disclaimerToDelete.scope === "universal" || forceUniversalScope) {
        await saveToUniversalDisclaimer(updatedDisclaimers);
      }

      // If last disclaimer deleted, reset to initial view
      if (updatedDisclaimers.length === 0) {
        setAddTiming(null);
      }

      toast.success("Disclaimer deleted successfully");
    }
    setDeleteConfirmOpen(false);
    setDisclaimerToDelete(null);
  };

  // Show summary view if disclaimers exist, otherwise show initial view
  const showSummaryView = disclaimers.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {!showSummaryView ? (
        // Initial Landing State
        <>
          {/* Header */}
          <div className="text-left space-y-1">
            <h2 className="text-lg font-semibold">
              Add Disclaimers <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Provide compliance language for participant and client-facing
              materials
            </p>
            <p className="text-xs font-medium">
              add: (can be added later / modified in client builds)
            </p>
          </div>

          {/* Radio Group */}
          <Card className="shadow-none">
            <CardContent className="pt-3 pb-3">
              <RadioGroup
                value={addTiming || ""}
                onValueChange={handleAddTimingChange}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="now" id="now" />
                  <Label
                    htmlFor="now"
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    Add Now
                  </Label>
                </div>
                <div
                  className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${!isValidState ? "border-red-500" : ""
                    }`}
                >
                  <RadioGroupItem value="later" id="later" />
                  <Label
                    htmlFor="later"
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    Add Later
                  </Label>
                </div>
              </RadioGroup>

              {/* Validation Error */}
              {validationError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">
                    {validationError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        // Summary View
        <>
          {/* Header */}
          <div className="text-left space-y-1">
            <h2 className="text-lg font-semibold">
              Added Disclaimers ({disclaimers.length})
            </h2>
          </div>

          {/* Disclaimer Cards */}
          <div className="space-y-2">
            {disclaimers.map((disclaimer) => (
              <DisclaimerCard
                key={disclaimer.id}
                disclaimer={disclaimer}
                onEdit={() => {
                  setEditingDisclaimer(disclaimer);
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDeleteDisclaimer(disclaimer)}
              />
            ))}
          </div>

          {/* Add Another Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingDisclaimer(null);
              setIsModalOpen(true);
            }}
            className="w-full flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Another Disclaimer
          </Button>
        </>
      )}

      {/* Add/Edit Disclaimer Modal */}
      <AddDisclaimerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDisclaimer(null);
          // If user chose "Add Now" but closed without adding anything, clear the selection
          if (addTiming === "now" && disclaimers.length === 0) {
            setAddTiming(null);
          }
        }}
        onSave={
          editingDisclaimer
            ? (updatedDisclaimer) =>
              handleUpdateDisclaimer(editingDisclaimer.id, updatedDisclaimer)
            : handleAddDisclaimer
        }
        initialData={editingDisclaimer}
        companyName={
          companyName ||
          (useNewClientStore
            ? (stepData as any).companyBasics?.companyName
            : (stepData as any).branding?.organizationName) ||
          "[Company Name]"
        }
        organizationName={
          organizationName ||
          (useNewClientStore
            ? (stepData as any).companyBasics?.companyName
            : (stepData as any).branding?.organizationName) ||
          "[Organization Name]"
        }
        disclaimerScopeFlag={disclaimerScopeFlag ? disclaimerScopeFlag : false}
        forceUniversalScope={forceUniversalScope}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDisclaimerToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Disclaimer?"
        description={
          disclaimerToDelete
            ? `This will remove the disclaimer for ${disclaimerToDelete.locations.join(
              ", ",
            )}. This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
