"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { userSetupSchema } from "@/lib/wizard-validation";
import { UserSetupSection } from "./sections/user-setup-section/user-setup-section";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import { X, Save } from "lucide-react";

interface Step4UserSetupProps {
  errorFields?: string[];
}

export function Step4UserSetup({ errorFields = [] }: Step4UserSetupProps) {
  const { data: session } = useSession();
  const {
    saveStepData,
    saveStepDataToServer,
    stepData,
    loadStepData,
    validateCurrentStepFields,
    setErrorFields,
  } = useOnboardingWizardStore();

  // Track if user is actively editing to prevent overwrites
  const [isEditing, setIsEditing] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Queue system for save operations to prevent race conditions
  const saveOperationRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef<{
    field: string;
    value: any;
    timestamp: string;
  } | null>(null);

  /** Headshot modal fires onChange 3× (headshot, fileName, headshotData); one flush avoids 3× POST+GET races that clear crop/filename. */
  const headshotBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const suppressNextDebouncedSaveRef = useRef(false);

  // Modal states for editing
  const [showHeadshotModal, setShowHeadshotModal] = useState(false);

  // Initialize form with validation (include headshotData/headshotFileName so they persist to Settings)
  const methods = useForm({
    resolver: zodResolver(userSetupSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      title: "",
      designations: [],
      headshot: "",
      headshotFileName: "",
      headshotData: null as any,
      primaryServiceCategories: [],
    },
    mode: "onSubmit",
  });

  const {
    watch,
    setValue,
    formState: { isValid },
  } = methods;
  const watchedData = watch();
  const watchedDataWithFiles = {
    ...watchedData,
    headshotFileName: stepData.userSetup?.headshotFileName || "",
    backgroundFileName: stepData.userSetup?.backgroundFileName || "",
  };

  // Debounce the form data for saving
  const debouncedFormData = useDebounce(watchedData, 2000);

  // Load data when component mounts or when session changes
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Load server data
        const serverData = await loadStepData("userSetup");

        if (serverData && (serverData.name || serverData.email)) {
          // Use server data if available and has meaningful data
          setValue("name", serverData.name || "");
          setValue("email", serverData.email || "");
          setValue("phone", serverData.phone || "");
          setValue("title", serverData.title || "");
          setValue("designations", serverData.designations || []);
          setValue("headshot", serverData.headshot || "");
          setValue("headshotData", serverData.headshotData ?? null);
          setValue(
            "primaryServiceCategories",
            serverData.primaryServiceCategories || [],
          );

          // Generate default filename for headshot if it exists but no filename is provided
          const headshotFileName =
            serverData.headshotFileName ||
            (serverData.headshot ? `${serverData.name || "Headshot"}.jpg` : "");
          setValue("headshotFileName", headshotFileName);

          // Also save to store immediately (so Settings sees same data)
          const userSetupData = {
            name: serverData.name || "",
            email: serverData.email || "",
            phone: serverData.phone || "",
            title: serverData.title || "",
            designations: serverData.designations || [],
            headshot: serverData.headshot || "",
            headshotFileName,
            headshotData: serverData.headshotData ?? null,
            primaryServiceCategories: serverData.primaryServiceCategories || [],
          };
          await saveStepData("userSetup", userSetupData, true);
        } else if (session?.user) {
          // Fallback to session data
          setValue("name", session.user.name || "");
          setValue("email", session.user.email || "");
          setValue("headshot", session.user.image || "");

          // Generate default filename for headshot if it exists
          const headshotFileName = session.user.image
            ? `${session.user.name || "Headshot"}.jpg`
            : "";

          // Also save to store immediately
          const userSetupData = {
            name: session.user.name || "",
            email: session.user.email || "",
            phone: "",
            title: "",
            designations: [],
            headshot: session.user.image || "",
            headshotFileName: headshotFileName,
            primaryServiceCategories: [],
          };
          await saveStepData("userSetup", userSetupData, false);
        }
      } catch (error) {
        console.error("Error loading step data:", error);
        // Fallback to session data
        if (session?.user) {
          setValue("name", session.user.name || "");
          setValue("email", session.user.email || "");
          setValue("headshot", session.user.image || "");

          // Also save to store immediately
          const userSetupData = {
            name: session.user.name || "",
            email: session.user.email || "",
            phone: "",
            title: "",
            designations: [],
            headshot: session.user.image || "",
            headshotFileName: "",
            primaryServiceCategories: [],
          };
          await saveStepData("userSetup", userSetupData, false);
        }
      }
    };

    initializeData();
  }, [session, loadStepData, setValue, saveStepData]);

  // Save data when debounced form data changes
  useEffect(() => {
    if (!isEditing) return;

    if (suppressNextDebouncedSaveRef.current) {
      suppressNextDebouncedSaveRef.current = false;
      return;
    }

    // Check if data has actually changed
    const hasDataChanged =
      JSON.stringify(debouncedFormData) !== JSON.stringify(stepData.userSetup);

    if (!hasDataChanged) return;

    const saveData = async () => {
      try {
        await saveStepData("userSetup", debouncedFormData, true);
      } catch (error) {
        console.error("Failed to save step data:", error);
      }
    };

    saveData();
  }, [debouncedFormData, isEditing, saveStepData, stepData.userSetup]);

  // Process pending save operations in queue
  const processPendingSave = async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;

    const { field, value } = pending;

    // Clear pending save immediately to prevent duplicate processing
    pendingSaveRef.current = null;

    // Always persist full form snapshot (headshot modal updates several fields together).
    const updatedData = methods.getValues();

    try {
      await saveStepData("userSetup", updatedData, false);

      await saveStepDataToServer("userSetup", updatedData);

      // Reload data from server to ensure form is in sync
      const serverData = await loadStepData("userSetup", true); // force reload

      if (serverData) {
        const cur = methods.getValues();
        // Update form with fresh server data (so onboarding stays in sync with Settings)
        setValue("phone", serverData.phone || "");
        setValue("headshot", serverData.headshot || "");
        // DB has no headshotFileName column — keep client filename after GET
        setValue(
          "headshotFileName",
          serverData.headshotFileName || cur.headshotFileName || "",
        );
        setValue(
          "headshotData",
          serverData.headshotData ?? cur.headshotData ?? null,
        );
      }

      suppressNextDebouncedSaveRef.current = true;
    } catch (error) {
      console.error("❌ Step4 - Failed to process pending save:", {
        field,
        error,
      });
    }
  };

  const flushHeadshotSave = async () => {
    if (headshotBatchTimerRef.current) {
      clearTimeout(headshotBatchTimerRef.current);
      headshotBatchTimerRef.current = null;
    }
    const snap = methods.getValues();
    pendingSaveRef.current = {
      field: "headshot",
      value: snap.headshot,
      timestamp: new Date().toISOString(),
    };
    if (saveOperationRef.current) {
      try {
        await saveOperationRef.current;
      } catch (error) {
        console.error("❌ Step4 - Previous save operation failed:", error);
      }
    }
    saveOperationRef.current = processPendingSave();
    try {
      await saveOperationRef.current;
    } catch (error) {
      console.error("❌ Step4 - Failed headshot batch save:", error);
    } finally {
      saveOperationRef.current = null;
    }
  };


  const onDataChange = async (field: string, value: any) => {
    setIsEditing(true);
    setValue(field as any, value);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a timeout to mark editing as complete
    saveTimeoutRef.current = setTimeout(() => {
      setIsEditing(false);
    }, 3000);

    // Batch headshot saves: modal calls onChange 3× in a row; one POST+GET prevents filename/crop wipe mid-flight.
    if (
      field === "headshot" ||
      field === "headshotFileName" ||
      field === "headshotData"
    ) {
      if (headshotBatchTimerRef.current) {
        clearTimeout(headshotBatchTimerRef.current);
      }
      headshotBatchTimerRef.current = setTimeout(async () => {
        headshotBatchTimerRef.current = null;
        try {
          await flushHeadshotSave();
        } catch (error) {
          console.error("❌ Step4 - Headshot batch save failed:", error);
        }
        try {
          const { validateCurrentStep } = await import(
            "@/lib/wizard-validation"
          );
          const currentFormData = methods.getValues();
          const currentStepData = { ...stepData, userSetup: currentFormData };
          const validationResult = await validateCurrentStep(
            4,
            currentStepData,
          );
          if (!validationResult.isValid && validationResult.errorFields) {
            setErrorFields(validationResult.errorFields);
          } else {
            setErrorFields([]);
          }
        } catch (validationError) {
          console.error("Error validating current step:", validationError);
        }
      }, 0);
      return;
    }

    // Save immediately for critical fields (not phone — phone is saved via debounce to avoid flicker)
    if (field === "email" || field === "name" || field === "title") {
      const timestamp = new Date().toISOString();
      pendingSaveRef.current = {
        field,
        value,
        timestamp,
      };

      // Wait for previous save operation to complete
      if (saveOperationRef.current) {
        try {
          await saveOperationRef.current;
        } catch (error) {
          console.error("❌ Step4 - Previous save operation failed:", error);
        }
      }

      // Start new save operation
      saveOperationRef.current = processPendingSave();

      try {
        await saveOperationRef.current;
      } catch (error) {
        console.error("❌ Step4 - Failed to save to server:", { field, error });
      } finally {
        saveOperationRef.current = null;
      }

      // Validate after successful save (this branch is only for non-phone fields)
      setTimeout(async () => {
        try {
          const { validateCurrentStep } = await import(
            "@/lib/wizard-validation"
          );
          const currentFormData = methods.getValues();
          const currentStepData = { ...stepData, userSetup: currentFormData };

          const validationResult = await validateCurrentStep(
            4,
            currentStepData,
          );

          if (!validationResult.isValid && validationResult.errorFields) {
            setErrorFields(validationResult.errorFields);
          } else {
            setErrorFields([]);
          }
        } catch (validationError) {
          console.error("Error validating current step:", validationError);
        }
      }, 200);
    } else {
      // For fields that don't require server save, validate immediately
      setTimeout(() => validateCurrentStepFields(), 100);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="space-y-4">
        {/* User Setup Section */}
        <UserSetupSection
          data={watchedData}
          errorFields={errorFields}
          onDataChange={onDataChange}
        />
      </div>

      {/* Headshot Edit Modal */}
      <Dialog open={showHeadshotModal} onOpenChange={setShowHeadshotModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Headshot</DialogTitle>
            <DialogDescription>
              Upload a clear, front-facing photo. Keep your face inside the
              circle guide for best results.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="space-y-3">
              <Label htmlFor="headshot-upload">Upload New Headshot</Label>
              <UniversalImageEditorModal
                type="headshot"
                value={watchedData.headshot || ""}
                fileName={watchedDataWithFiles.headshotFileName}
                onChange={(value, fileName) => {
                  onDataChange("headshot", value);
                  onDataChange("headshotFileName", fileName);
                }}
                onRemove={async () => {
                  await deleteFromR2(watchedData.headshot);
                  await onDataChange("headshot", "");
                  await onDataChange("headshotFileName", "");
                  await onDataChange("headshotData", null);
                }}
                placeholder="Choose headshot image"
              />
              <div className="mt-2">
                <Label>Preview</Label>
                <div className="w-32 h-32 rounded-full border overflow-hidden">
                  <Headshot
                    src={watchedData.headshot || undefined}
                    monogramName={watchedData.name}
                    alt="Current headshot"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHeadshotModal(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={() => setShowHeadshotModal(false)}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
