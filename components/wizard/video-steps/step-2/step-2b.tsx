"use client";

import React, { useState, useRef } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import {
  listAgeRequirement,
  listEntryDate,
  listServiceRequirement,
} from "./step-2";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import { Button } from "@/components/ui/button";
import { Upload, Plus, Trash2, ImageIcon } from "lucide-react";

interface VideoStep2bProps {}

interface ImageData {
  url: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  warnings: string[];
}

const avatarImagePaths: Record<string, string> = {
  alison: "/images/alison-trans.png",
  chad: "/images/chad-trans.png",
  leah: "/images/leah-trans.png",
  alicia: "/images/alicia-trans.png",
  paul: "/images/paul-trans.png",
  helena: "/images/helena-trans.png",
  maria: "/images/maria-trans.png",
  scott: "/images/scott-trans.png",
  custom: "/images/custom-trans.png",
};

export function VideoStep2b({}: VideoStep2bProps) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  // Background image editing state
  const [backgroundImageData, setBackgroundImageData] =
    useState<ImageData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pendingImageData, setPendingImageData] = useState<ImageData | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Get eligibility data from step2a
  const step2aData = (stepData as any).step2a || {};
  const eligibility = {
    ageRequirement: step2aData.ageRequirement || "",
    customAgeRequirement: step2aData.customAgeRequirement || "",
    serviceRequirement: step2aData.serviceRequirement || "",
    customServiceRequirement: step2aData.customServiceRequirement || "",
    entryDate: step2aData.entryDate || "",
    customEntryDate: step2aData.customEntryDate || "",
  };

  // Get branding data from selected plan or step1
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;
  const step1 = (stepData as any).step1 || {};
  const step2b = (stepData as any).step2b || {};
  // Use edited values from step2b first, then step1, then plan data
  const brandColor =
    step1.brandColor ||
    selectedPlan?.brandColor ||
    selectedPlan?.videoThemeColor ||
    "#005F73";
  // Background image priority: step2b (if explicitly set) > step1 > plan
  // If step2b.editedBackgroundImg is undefined, use step1.editedBackgroundImg
  // This allows editing the background from step1 in step2b context
  const step2bBackgroundImg = step2b.editedBackgroundImg;
  const step1BackgroundImg = step1.editedBackgroundImg;
  const backgroundImage =
    step2bBackgroundImg !== undefined
      ? step2bBackgroundImg
      : step1BackgroundImg ||
        selectedPlan?.backgroundImg ||
        selectedPlan?.videoBackgroundImage ||
        "";
  const barHeight = step1.barHeight ?? 15;
  const avatarChoice =
    stepData.avatarValue ||
    stepData.selectedAvatar ||
    selectedPlan?.videoAvatar ||
    "";

  const currentServiceRequirement = listServiceRequirement.find(
    (item) => item.value === eligibility.serviceRequirement,
  );

  const currentEntryDate = listEntryDate.find(
    (item) => item.value === eligibility.entryDate,
  );

  const currentAgeRequirement = listAgeRequirement.find(
    (item) => item.value === eligibility.ageRequirement,
  );

  // Initialize background image data from step1 or step2b
  React.useEffect(() => {
    // Use step1 background if step2b doesn't have one explicitly set
    const imageToUse =
      step2bBackgroundImg !== undefined
        ? step2bBackgroundImg
        : step1BackgroundImg || "";

    if (
      imageToUse &&
      (!backgroundImageData || backgroundImageData.url !== imageToUse)
    ) {
      setBackgroundImageData({
        url: imageToUse,
        fileName: "background.png",
        fileSize: 0,
        width: 1920,
        height: 1080,
        warnings: [],
      });
    } else if (!imageToUse && backgroundImageData) {
      // Clear background image data if image is empty
      setBackgroundImageData(null);
    }
  }, [step2bBackgroundImg, step1BackgroundImg, backgroundImageData]);

  // ---- IMAGE HANDLING ----
  const handleFileSelect = (file: File) => {
    const allowedTypes = [".png", ".jpg", ".jpeg"].map(
      (t) => `image/${t.replace(".", "")}`,
    );
    if (!allowedTypes.includes(file.type)) {
      alert("Unsupported format. Please upload .png,.jpg,.jpeg files.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("File too large. Please upload a file under 15 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const warnings: string[] = [];
        const recommendedSize = "1920×1080";
        const [recWidth, recHeight] = recommendedSize
          .split("×")
          .map((s) => parseInt(s));
        if (img.width < recWidth || img.height < recHeight) {
          warnings.push(
            `Below recommended size (${recommendedSize}). May appear blurry.`,
          );
        }

        const imageData: ImageData = {
          url: base64String,
          fileName: file.name,
          fileSize: file.size,
          width: img.width,
          height: img.height,
          warnings,
        };

        setPendingImageData(imageData);
        setIsModalOpen(true);
      };

      img.src = base64String;
    };

    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleModalSave = (value: string, fileName: string) => {
    if (pendingImageData) {
      const updatedImageData: ImageData = {
        ...pendingImageData,
        url: value,
        fileName,
      };

      setBackgroundImageData(updatedImageData);
      // Save to both step2b and step1 to keep them in sync
      saveStepDataLocally("step2b", {
        editedBackgroundImg: value,
      });
      saveStepDataLocally("step1", {
        ...step1,
        editedBackgroundImg: value,
      });
    }
    setIsModalOpen(false);
    setPendingImageData(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setPendingImageData(null);
  };

  const handleRemoveBackground = () => {
    setBackgroundImageData(null);
    // Remove from both step2b and step1 to keep them in sync
    saveStepDataLocally("step2b", {
      editedBackgroundImg: "",
    });
    saveStepDataLocally("step1", {
      ...step1,
      editedBackgroundImg: "",
    });
    setIsModalOpen(false);
    setPendingImageData(null);
  };

  const handleChangeImage = () => {
    // Close modal if open
    setIsModalOpen(false);
    setPendingImageData(null);
    // Small delay to ensure modal closes before opening file picker
    setTimeout(() => {
      handleUploadClick();
    }, 100);
  };

  const handleGallerySelect = (url: string) => {
    const imageData: ImageData = {
      url,
      fileName: "default-image.png",
      fileSize: 0,
      width: 1920,
      height: 1080,
      warnings: [],
    };

    setBackgroundImageData(imageData);
    // Save to both step2b and step1 to keep them in sync
    saveStepDataLocally("step2b", {
      editedBackgroundImg: url,
    });
    saveStepDataLocally("step1", {
      ...step1,
      editedBackgroundImg: url,
    });
    setGalleryOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white font-inter">
          Eligibility Preview
        </h2>
        <p className="text-gray-500 mt-1 font-inter">
          Review how your eligibility will appear
        </p>
      </div>

      {/* 16:9 aspect ratio container */}
      <div
        className="relative w-full rounded-lg overflow-hidden border border-gray-200"
        style={{ paddingBottom: "56.25%" }}
        data-preview-step="2"
      >
        {/* Background container with white base and image overlay */}
        <div className="absolute inset-0 bg-white overflow-hidden group">
          {/* Background image overlay if available */}
          {backgroundImage && (
            <div
              className="absolute inset-0 bg-no-repeat bg-center bg-cover opacity-25"
              style={{
                backgroundImage: `url(${backgroundImage})`,
              }}
            />
          )}

          {/* Edit/Upload/Change/Delete background buttons */}
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Use step1 background if step2b doesn't have one explicitly set
                const imageToEdit =
                  step2bBackgroundImg !== undefined
                    ? backgroundImage
                    : step1BackgroundImg || backgroundImage;

                if (backgroundImageData) {
                  setPendingImageData(backgroundImageData);
                  setIsModalOpen(true);
                } else if (imageToEdit) {
                  setPendingImageData({
                    url: imageToEdit,
                    fileName: "background.png",
                    fileSize: 0,
                    width: 1920,
                    height: 1080,
                    warnings: [],
                  });
                  setIsModalOpen(true);
                } else {
                  // If no image, open file picker
                  handleUploadClick();
                }
              }}
              className="bg-white shadow-md"
            >
              <Upload className="w-3 h-3 mr-1" />
              {backgroundImage ? "Edit Background" : "Upload Background"}
            </Button>
            {backgroundImage && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleChangeImage}
                  className="bg-white shadow-md"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  Change Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBackground}
                  className="bg-white shadow-md text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>

          {/* Text container */}
          <div className="absolute h-[85%] top-0 w-full flex flex-col items-start justify-center pl-12">
            <p className="text-3xl font-bold text-black tracking-tight text-left font-inter">
              Service Requirement:
            </p>
            <div className="text-2xl text-black tracking-tight text-left font-inter">
              {eligibility.customServiceRequirement ||
                currentServiceRequirement?.label ||
                "-"}
            </div>
            <p className="text-3xl font-bold text-black tracking-tight mt-4 text-left font-inter">
              Age Requirement:
            </p>
            <div className="text-2xl text-black tracking-tight text-left font-inter">
              {eligibility.customAgeRequirement ||
                currentAgeRequirement?.label ||
                "-"}
            </div>
            <p className="text-3xl font-bold text-black tracking-tight mt-4 text-left font-inter">
              Entry Period:
            </p>
            <div className="text-2xl text-black tracking-tight text-left font-inter">
              {eligibility.customEntryDate || currentEntryDate?.label || "-"}
            </div>
          </div>

          {/* Color bar at the bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[15%]"
            style={{ background: brandColor, height: `${barHeight}%` }}
          />

          {/* HeyGen Avatar — RIGHT SIDE */}
          <div
            className="absolute right-[-50px] bottom-[-200px] flex items-end"
            data-preview-avatar="true"
          >
            <div className="relative">
              <img
                src="/HeyGen-AI.png"
                alt="HeyGen Avatar"
                className="object-contain pointer-events-none select-none"
                style={{
                  width: 620,
                  height: 850,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={(el) => (fileInputRef.current = el)}
        type="file"
        accept=".png,.jpg,.jpeg"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Modal Gallery */}
      <ModalGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={handleGallerySelect}
      />

      {/* Simple Image Editor Modal */}
      {pendingImageData && (
        <SimpleImageEditorModal
          modalTitle="Background Image"
          modalDescription="Upload and edit your background image. Recommended size: 1920×1080 px."
          value={pendingImageData.url || ""}
          fileName={pendingImageData.fileName || ""}
          onChange={handleModalSave}
          onRemove={handleRemoveBackground}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          saveButtonText="Save Background"
          canvasWidth={640}
          canvasHeight={600}
          guidelineWidth={580}
          guidelineHeight={340}
          guidelinePadding={0}
        />
      )}
    </div>
  );
}
