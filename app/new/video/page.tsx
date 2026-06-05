"use client";

import { VideoWizard } from "@/components/wizard/video-wizard";
import {
  useVideoWizardStore,
  videoWizardSteps,
} from "@/lib/video-wizard-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { toast } from "sonner";
import {
  VideoStep1,
  VideoStep2,
  VideoStep3,
  VideoStep4,
  VideoStep5,
} from "@/components/wizard/video-steps";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildVideoPreviewTemplate } from "@video-steps/preview-template";
import html2canvas from "html2canvas";
import { PreviewImagesContext } from "@/lib/preview-images-context";
import {
  dataURLtoFile,
  uploadPreviewImage,
} from "@/lib/preview-image-generator";
import { hasUnsavedVideoWizardWork } from "@/lib/video-wizard-dirty";
import { useNavigateAwayGuard } from "@/hooks/use-navigate-away-guard";
import { NavigateAwayWarningDialog } from "@/components/ui/navigate-away-warning-dialog";

export default function VideoPage() {
  const { setTitle } = usePageTitleContext();
  const [isLoading, setIsLoading] = useState(false);
  const {
    currentStep,
    totalSteps,
    steps,
    stepData,
    nextStep,
    previousStep,
    completeStep,
    completeWizard,
    resetWizard,
    errorFields,
    isCompleted,
  } = useVideoWizardStore();
  const router = useRouter();
  const [previewImages, setPreviewImages] = useState<Record<number, string>>(
    {},
  );
  const hasUnsavedChanges = useVideoWizardStore((s) =>
    hasUnsavedVideoWizardWork({
      currentStep: s.currentStep,
      isCompleted: s.isCompleted,
      stepData: s.stepData,
    }),
  );
  const leaveGuard = useNavigateAwayGuard({
    enabled: !isLoading,
    hasUnsavedChanges,
    onSaveAndExit: async () => {
      // Video wizard draft is persisted in zustand storage.
      return;
    },
  });
  const previewImagesRef = useRef<Record<number, string>>({});
  const previewImageUrlsRef = useRef<Record<number, string>>({});
  const isUploadingImagesRef = useRef(false);
  const isGeneratingVideoRef = useRef(false);

  const capturePreviewImage = useCallback(async (step: number) => {
    if (typeof window === "undefined") return null;
    const selector = `[data-preview-step="${step}"]`;
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) return null;
    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: "#ffffff",
        scale: window.devicePixelRatio || 1,
        ignoreElements: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          return Boolean(
            node.dataset.previewAvatar === "true" ||
              node.closest('[data-preview-avatar="true"]'),
          );
        },
      });
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error capturing preview image:", error);
      return null;
    }
  }, []);

  const getPreviewImage = useCallback(
    async (step: number, attempt = 0): Promise<string | null> => {
      const image = await capturePreviewImage(step);
      if (!image && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return getPreviewImage(step, attempt + 1);
      }
      return image;
    },
    [capturePreviewImage],
  );

  const uploadPreviewImages = useCallback(async () => {
    if (isUploadingImagesRef.current) {
      return previewImageUrlsRef.current;
    }
    isUploadingImagesRef.current = true;
    try {
      const entries = Object.entries(previewImagesRef.current).filter(
        ([, dataUrl]) => Boolean(dataUrl),
      );
      for (const [key, dataUrl] of entries) {
        const numericKey = Number(key);
        if (
          dataUrl &&
          !previewImageUrlsRef.current[numericKey] &&
          dataUrl.startsWith("data:")
        ) {
          try {
            const file = dataURLtoFile(dataUrl, `preview-${numericKey}.png`);
            const url = await uploadPreviewImage(file);
            previewImageUrlsRef.current[numericKey] = url;
          } catch (error) {
            console.error("Error uploading preview image", error);
          }
        }
      }
      return previewImageUrlsRef.current;
    } finally {
      isUploadingImagesRef.current = false;
    }
  }, []);

  const getPlanMetadata = useCallback(() => {
    const selectedPlan =
      stepData.selectedPlan || (stepData as any).step1?.selectedPlan || {};
    const step1 = (stepData as any).step1 || {};
    const planName =
      step1.editedPlanName ||
      selectedPlan?.companyName ||
      selectedPlan?.clientName ||
      "Plan";
    const brandColor =
      step1.brandColor ||
      selectedPlan?.brandColor ||
      selectedPlan?.videoThemeColor ||
      "#FFFFFF";
    return { planName, brandColor };
  }, [stepData]);

  const generateVideoFromTemplate = useCallback(
    async (shouldToast: boolean) => {
      if (isGeneratingVideoRef.current) return;
      isGeneratingVideoRef.current = true;

      // Run video generation in background without blocking UI
      // Only show toast on error, success is silent
      const runInBackground = async () => {
        try {
          await uploadPreviewImages();
          const remoteTemplate = buildVideoPreviewTemplate(stepData, {
            previewImages: previewImageUrlsRef.current,
          });

          if (!remoteTemplate.planId) {
            throw new Error("Plan ID missing; please select a plan first.");
          }

          const { planName, brandColor } = getPlanMetadata();
          const avatarId =
            stepData.avatarValue ||
            stepData.selectedAvatar ||
            stepData.avatarId ||
            "natalie_mk2_20240201";
          const voiceId =
            stepData.voiceId ||
            stepData.selectedVoice ||
            "elevenlabs-premium-01";

          const response = await fetch("/api/videos/generate-from-previews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              template: remoteTemplate,
              planId: remoteTemplate.planId,
              clientName: planName,
              clientColor: brandColor,
              avatarId,
              voiceId,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to start video generation");
          }

          // Silent success - video generation started in background
        } catch (error: any) {
          console.error("Error generating video:", error);
          const message =
            error?.message || "Failed to generate video from previews";
          // Only show error toast if explicitly requested
          if (shouldToast) {
            toast.error(message);
          }
        } finally {
          isGeneratingVideoRef.current = false;
        }
      };

      // Start background process without blocking
      runInBackground();
    },
    [getPlanMetadata, stepData, uploadPreviewImages],
  );

  const getStep2SubStep = useCallback(() => {
    const raw =
      (stepData as any).step2SubStep?.step2SubStep ||
      (stepData as any).step2SubStep;
    return raw || "form";
  }, [stepData]);

  const getStep5SubStep = useCallback(() => {
    const raw =
      (stepData as any).step5SubStep?.step5SubStep ||
      (stepData as any).step5SubStep;
    return raw || "form";
  }, [stepData]);

  const getStorageKeyForCurrentView = useCallback(() => {
    if (currentStep === 2) {
      const subStep = getStep2SubStep();
      if (subStep === "employeeDeferralsPreview") {
        return 6;
      }
      return 2;
    }
    if (currentStep >= 1 && currentStep <= 5) {
      return currentStep;
    }
    return currentStep;
  }, [currentStep, getStep2SubStep]);

  const logWizardSnapshot = useCallback(
    async (reason: string) => {
      if (typeof window === "undefined") return;
      const timestamp = new Date().toISOString();
      const subStepFor = (stepKey: string) => {
        const value = (stepData as any)?.[stepKey];
        if (typeof value === "object" && value !== null) {
          return value[stepKey] || "form";
        }
        return value || "form";
      };
      const subSteps = {
        step2: subStepFor("step2SubStep"),
        step3: subStepFor("step3SubStep"),
        step4: subStepFor("step4SubStep"),
        step5: subStepFor("step5SubStep"),
      };

      const storageKey = getStorageKeyForCurrentView();
      const capturedImage = await getPreviewImage(currentStep);
      if (capturedImage) {
        previewImagesRef.current = {
          ...previewImagesRef.current,
          [storageKey]: capturedImage,
        };
        setPreviewImages(previewImagesRef.current);
      }

      const previewTemplate = buildVideoPreviewTemplate(stepData, {
        previewImages: previewImagesRef.current,
      });

      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(
            "videoPreviewTemplate",
            JSON.stringify(previewTemplate),
          );
        } catch (error) {
          console.warn("Unable to persist preview template:", error);
        }
      }

      (window as any).__videoPreviewTemplate = previewTemplate;

      console.groupCollapsed(
        `[VideoPage] ${reason} @ ${timestamp} (current step: ${currentStep})`,
      );
      console.groupEnd();
      const shouldGenerateVideo =
        reason.startsWith("Next clicked") &&
        currentStep === 5 &&
        getStep5SubStep() === "preview";

      if (shouldGenerateVideo) {
        // Start video generation in background without blocking
        generateVideoFromTemplate(false);
      }
    },
    [
      currentStep,
      generateVideoFromTemplate,
      getPreviewImage,
      getStep5SubStep,
      getStorageKeyForCurrentView,
      stepData,
    ],
  );
  useEffect(() => {
    setTitle("Video");
  }, [setTitle]);

  useEffect(() => {
    const initializeWizard = async () => {
      // Reset wizard state for new video
      resetWizard();
    };

    initializeWizard();
  }, [resetWizard]);

  const onNext = async () => {
    await logWizardSnapshot("Next clicked - preparing to save step data");
    // Complete the current step
    completeStep(currentStep);
  };

  const onPrevious = () => {
    previousStep();
  };

  const onComplete = async () => {
    await logWizardSnapshot("Complete clicked - finalizing wizard");
    setIsLoading(true);
    try {
      completeStep(currentStep);
      await completeWizard();
      toast.success("Video wizard completed successfully!");
    } catch (error: any) {
      toast.error("Cannot complete wizard:", {
        description: error.message,
        duration: 5000,
        dismissible: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we're on the first step
  const isFirstStep = currentStep === 1;

  // Check if we're on the last step, considering sub-steps
  // For step 5: only last step if we're on preview sub-step
  // For step 4: only last step if we're on preview sub-step
  const step4SubStep =
    (stepData as any).step4SubStep?.step4SubStep ||
    (stepData as any).step4SubStep;
  const step5SubStep =
    (stepData as any).step5SubStep?.step5SubStep ||
    (stepData as any).step5SubStep;

  const isLastStep =
    currentStep === totalSteps &&
    (currentStep === 5
      ? step5SubStep === "disclaimer"
      : currentStep === 4
      ? step4SubStep === "preview"
      : true);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <VideoStep1 errorFields={errorFields} />;
      case 2:
        return <VideoStep2 errorFields={errorFields} />;
      case 3:
        return <VideoStep3 errorFields={errorFields} />;
      case 4:
        return <VideoStep4 errorFields={errorFields} />;
      case 5:
        return <VideoStep5 errorFields={errorFields} />;
      default:
        return <VideoStep1 errorFields={errorFields} />;
    }
  };

  const handleCreateAnotherVideo = () => {
    router.push("/new/dashboard");
  };

  useEffect(() => {
    (async () => {
      await logWizardSnapshot("Wizard state updated");
    })();
  }, [stepData, currentStep, logWizardSnapshot]);

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-8 py-20 px-6">
        <div className="flex flex-col items-center gap-4 max-w-2xl">
          <CheckCircle2 className="size-16 text-emerald-500" />
          <h1 className="text-3xl font-semibold text-gray-900">Success!</h1>
          <p className="text-base text-gray-600">
            Your video is being processed. Once generation is complete, you will
            receive a notification.
          </p>
          <p className="text-base text-gray-600">
            Please allow up to 24 hours for AI video generation.
          </p>
        </div>
        <Button onClick={handleCreateAnotherVideo} size="lg">
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <>
      <PreviewImagesContext.Provider value={previewImages}>
        <VideoWizard
          steps={videoWizardSteps}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={onNext}
          onPrevious={onPrevious}
          onComplete={onComplete}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          isLoading={isLoading}
        >
          {renderStep()}
        </VideoWizard>
      </PreviewImagesContext.Provider>
      <NavigateAwayWarningDialog
        open={leaveGuard.dialogOpen}
        isSaving={leaveGuard.isSaving}
        isDiscarding={leaveGuard.isDiscarding}
        onStay={leaveGuard.stayAndKeepEditing}
        onSaveAndExit={leaveGuard.saveAndExit}
        onDiscardWithoutSaving={leaveGuard.discardWithoutSaving}
        onDialogOpenChange={leaveGuard.dialogOnOpenChange}
        onDiscardPointerDownCapture={leaveGuard.suppressStayOnNextClose}
      />
    </>
  );
}
