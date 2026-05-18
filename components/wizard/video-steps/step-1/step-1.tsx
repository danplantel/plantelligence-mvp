"use client";

import { useState, useEffect, useRef } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Upload, AlertTriangle, Plus } from "lucide-react";
import type { KeyContact } from "@/types/new-client-wizard";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import type { BrandImageData } from "@/types/new-client-wizard";
import {
  mapKeyContactsToContactInfo,
  type ContactInformation,
} from "@/lib/contact-info";
import { persistPlanSelection } from "@/lib/plan-selector-storage";

interface VideoStep1Props {
  errorFields?: string[];
}

interface Plan {
  id: string;
  companyName: string;
  clientName?: string;
  companyLogo?: string;
  backgroundImg?: string;
  backgroundImgName?: string;
  brandImages?: {
    header?: {
      url?: string;
      fileName?: string;
    };
  };
  brandColor?: string;
  videoThemeColor?: string;
  status?: string;
  keyContacts?: KeyContact[];
  resources?: {
    contactInformation?: ContactInformation;
    [key: string]: any;
  };
}

interface ImageData {
  url: string;
  originalUrl?: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  warnings: string[];
  cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata;
}

// Convert ImageData to BrandImageData
const convertImageDataToBrandImage = (
  imageData: ImageData | null,
): BrandImageData | undefined => {
  if (!imageData) return undefined;
  return {
    url: imageData.url,
    originalUrl: imageData.cropData?.originalImage || imageData.originalUrl,
    fileName: imageData.fileName,
    fileSize: imageData.fileSize,
    width: imageData.width,
    height: imageData.height,
    recommendedSize:
      imageData.width > 0
        ? `${imageData.width}×${imageData.height} px`
        : "900×900 px",
    status: imageData.warnings.length > 0 ? "warning" : "ok",
    warnings: imageData.warnings,
    cropData: imageData.cropData,
  };
};

// Convert BrandImageData to ImageData
const convertBrandImageToImageData = (
  brandImage: BrandImageData | null,
): ImageData | null => {
  if (!brandImage) return null;
  return {
    url: brandImage.url,
    originalUrl: brandImage.cropData?.originalImage || brandImage.originalUrl,
    fileName: brandImage.fileName,
    fileSize: brandImage.fileSize,
    width: brandImage.width,
    height: brandImage.height,
    warnings: brandImage.warnings || [],
    cropData: brandImage.cropData as any,
  };
};

function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}

export function VideoStep1({ errorFields = [] }: VideoStep1Props) {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();

  const getExistingStep5aData = () => (stepData as any).step5a || {};

  const hasMeaningfulContactInfo = (info?: ContactInformation): boolean => {
    if (!info) return false;
    return Boolean(
      info.planId ||
        info.primaryName ||
        info.primaryEmail ||
        info.primaryPhone ||
        info.secondaryName ||
        info.secondaryEmail ||
        info.secondaryPhone ||
        info.tertiaryName ||
        info.tertiaryEmail ||
        info.tertiaryPhone,
    );
  };

  const autoFillContactsFromPlan = (plan?: Plan | null) => {
    if (!plan) return;
    const contactInfoFromPlan =
      plan.resources?.contactInformation ||
      mapKeyContactsToContactInfo(plan.keyContacts);
    if (!contactInfoFromPlan) return;

    const existingStep5a = getExistingStep5aData();
    const existingContactInfo = existingStep5a.contactInformation as
      | ContactInformation
      | undefined;
    const previousPlanId = stepData.step1?.selectedPlanId || "";
    const shouldOverwrite =
      plan.id !== previousPlanId ||
      !hasMeaningfulContactInfo(existingContactInfo);

    if (!shouldOverwrite) return;

    const normalizedContactInfo: ContactInformation = {
      primaryType: contactInfoFromPlan.primaryType,
      primaryTypeCustom: contactInfoFromPlan.primaryTypeCustom,
      primaryName: contactInfoFromPlan.primaryName,
      primaryEmail: contactInfoFromPlan.primaryEmail,
      primaryPhone: contactInfoFromPlan.primaryPhone,
      secondaryType: contactInfoFromPlan.secondaryType,
      secondaryTypeCustom: contactInfoFromPlan.secondaryTypeCustom,
      secondaryName: contactInfoFromPlan.secondaryName,
      secondaryEmail: contactInfoFromPlan.secondaryEmail,
      secondaryPhone: contactInfoFromPlan.secondaryPhone,
      tertiaryType: contactInfoFromPlan.tertiaryType,
      tertiaryTypeCustom: contactInfoFromPlan.tertiaryTypeCustom,
      tertiaryName: contactInfoFromPlan.tertiaryName,
      tertiaryEmail: contactInfoFromPlan.tertiaryEmail,
      tertiaryPhone: contactInfoFromPlan.tertiaryPhone,
      planId:
        contactInfoFromPlan.planId ||
        plan.resources?.contactInformation?.planId ||
        plan.id ||
        "",
    };

    saveStepDataLocally("step5a", {
      ...existingStep5a,
      contactInformation: normalizedContactInfo,
    });
  };

  // ---- STATE ----
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const selectedPlanId = stepData.step1?.selectedPlanId || "";

  const [editedPlanName, setEditedPlanName] = useState(
    stepData.step1?.editedPlanName || "",
  );
  const [editedLogo, setEditedLogo] = useState(
    stepData.step1?.editedLogo || "",
  );
  const [editedBackgroundImg, setEditedBackgroundImg] = useState(
    stepData.step1?.editedBackgroundImg || "",
  );
  const [backgroundOpacity, setBackgroundOpacity] = useState(
    stepData.step1?.backgroundOpacity || 25,
  );
  const [logoSize, setLogoSize] = useState(
    stepData.step1?.logoSize || { width: 260, height: 160 },
  );
  const [logoPosition, setLogoPosition] = useState(
    stepData.step1?.logoPosition || { x: 40, y: 250 },
  );
  const [avatarSize, setAvatarSize] = useState(
    stepData.step1?.avatarSize || { width: 420, height: 650 },
  );
  const [planType, setPlanType] = useState<string>(
    stepData.step1?.planType ||
      (stepData.step1 as any)?.selectedPlan?.planDetails?.planType ||
      "",
  );

  // Get branding data from selected plan
  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) ||
    (stepData.step1 as any)?.selectedPlan ||
    stepData.selectedPlan;
  const planBrandColor =
    selectedPlan?.brandColor || selectedPlan?.videoThemeColor || "#B30000";

  const [primaryColor, setPrimaryColor] = useState(
    stepData.step1?.brandColor || planBrandColor,
  );
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // Image handling state
  const [logoImageData, setLogoImageData] = useState<ImageData | null>(
    stepData.step1?.logoImageData || null,
  );
  const [backgroundImageData, setBackgroundImageData] =
    useState<ImageData | null>(stepData.step1?.backgroundImageData || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeImageType, setActiveImageType] = useState<
    "logo" | "background" | null
  >(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImageType, setGalleryImageType] = useState<
    "logo" | "background" | null
  >(null);
  const [pendingImageData, setPendingImageData] = useState<{
    type: "logo" | "background";
    data: ImageData;
  } | null>(null);
  const [barHeight, setBarHeight] = useState<number>(
    stepData.step1?.barHeight ?? 13,
  );

  const isResizing = useRef(false);
  const isResizingLogo = useRef(false);
  const isResizingAvatar = useRef(false);
  const isResizingBar = useRef(false);
  const isDraggingLogo = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const startLogoPos = useRef({ x: 0, y: 0 });
  const startBarHeight = useRef(stepData.step1?.barHeight ?? 13);
  const lastSavedLogoPosition = useRef({ x: 0, y: 0 });
  const currentLogoPosition = useRef({ x: 0, y: 0 });
  const currentBarHeight = useRef(stepData.step1?.barHeight ?? 13);
  const isSavingLogoPosition = useRef(false);
  const isSavingBarHeight = useRef(false);

  const logoRef = useRef<HTMLImageElement>(null);
  const avatarRef = useRef<HTMLImageElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Local state for touched fields and errors
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---- FETCH PLANS ----
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch("/api/clients");
        const result = await response.json();

        if (result.success) {
          // Filter out clients with "Draft" status - only show active plans
          const activePlans = result.data.filter(
            (plan: Plan) => (plan.status || "").toLowerCase() !== "draft",
          );
          setPlans(activePlans);
          // Removed automatic plan selection
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Update primaryColor when plan changes
  useEffect(() => {
    if (selectedPlan) {
      const newBrandColor =
        selectedPlan.brandColor || selectedPlan.videoThemeColor || "#B30000";
      if (!stepData.step1?.brandColor) {
        setPrimaryColor(newBrandColor);
      }
    }
  }, [selectedPlan, stepData.step1?.brandColor]);

  // Prefill background image from selected plan (brandImages.header or backgroundImg)
  useEffect(() => {
    if (editedBackgroundImg || backgroundImageData) return;
    if (!selectedPlan) return;

    const headerUrl =
      selectedPlan.brandImages?.header?.url || selectedPlan.backgroundImg;
    const headerFileName =
      selectedPlan.brandImages?.header?.fileName ||
      selectedPlan.backgroundImgName ||
      "background.png";

    if (headerUrl) {
      setEditedBackgroundImg(headerUrl);
      setBackgroundImageData({
        url: headerUrl,
        fileName: headerFileName,
        fileSize: 0,
        width: 0,
        height: 0,
        warnings: [],
      });
      // will be persisted by autosave when step1 data changes
    }
  }, [selectedPlan, editedBackgroundImg, backgroundImageData]);

  // ---- VALIDATION ----
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    let error = "";

    switch (field) {
      case "selectedPlanId":
        if (!selectedPlanId) {
          error = "Please select a plan";
        }
        break;
      case "planType":
        if (!planType) {
          error = "Please select a plan type";
        }
        break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  const validateAll = () => {
    const fields = ["selectedPlanId", "planType"];
    let isValid = true;

    fields.forEach((field) => {
      if (!validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  };

  // Mark all fields as touched when errorFields change (validation failed)
  useEffect(() => {
    if (errorFields.length > 0) {
      setTouched((prev) => ({
        ...prev,
        selectedPlanId: true,
        planType: true,
      }));
      // Validate all fields to show errors
      validateField("selectedPlanId");
      validateField("planType");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorFields]);

  // ---- IMAGE HANDLING ----

  const handleModalSave = (
    value: string,
    fileName: string,
    arg3?: any,
    arg4?: any,
  ) => {
    // UniversalImageEditorModal calls: (value, fileName, headshotData?, cropData?)
    // SimpleImageEditorModal calls: (value, fileName, cropData?)
    const cropData =
      (arg4 as import("@/components/ui/simple-image-editor-modal").CropMetadata | undefined) ??
      ((arg3 &&
        typeof arg3 === "object" &&
        "cropped" in arg3 &&
        "width" in arg3 &&
        "height" in arg3
          ? (arg3 as import("@/components/ui/simple-image-editor-modal").CropMetadata)
          : undefined));

    if (pendingImageData) {
      const updatedImageData: ImageData = {
        ...pendingImageData.data,
        url: value,
        fileName,
        cropData: cropData ?? pendingImageData.data.cropData,
        originalUrl:
          cropData?.originalImage ||
          pendingImageData.data.originalUrl ||
          pendingImageData.data.cropData?.originalImage,
      };

      if (pendingImageData.type === "logo") {
        setEditedLogo(value);
        setLogoImageData(updatedImageData);
        saveCurrentState({ editedLogo: value, logoImageData: updatedImageData });
      } else {
        setEditedBackgroundImg(value);
        setBackgroundImageData(updatedImageData);
        saveCurrentState({
          editedBackgroundImg: value,
          backgroundImageData: updatedImageData,
        });
      }
    }
    setIsModalOpen(false);
    setPendingImageData(null);
    setActiveImageType(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setPendingImageData(null);
    setActiveImageType(null);
  };

  const handleGallerySelect = (url: string) => {
    if (!galleryImageType) return;

    const recommendedSize =
      galleryImageType === "logo" ? "900×900" : "1920×1080";
    const imageData: ImageData = {
      url,
      fileName: "default-image.png",
      fileSize: 0,
      width: 0,
      height: 0,
      warnings: [],
    };

    if (galleryImageType === "logo") {
      setEditedLogo(url);
      setLogoImageData(imageData);
      saveCurrentState({ editedLogo: url, logoImageData: imageData });
    } else {
      setEditedBackgroundImg(url);
      setBackgroundImageData(imageData);
      saveCurrentState({ editedBackgroundImg: url, backgroundImageData: imageData });
    }
    setGalleryOpen(false);
    setGalleryImageType(null);
  };

  // Handle logo image change from BrandImageUpload
  const handleLogoImageChange = (imageData: BrandImageData) => {
    const convertedData = convertBrandImageToImageData(imageData);
    if (convertedData) {
      setEditedLogo(imageData.url);
      setLogoImageData(convertedData);
      saveCurrentState({ editedLogo: imageData.url, logoImageData: convertedData });
    }
  };

  // Handle logo image remove from BrandImageUpload
  const handleLogoImageRemove = () => {
    setEditedLogo("");
    setLogoImageData(null);
    saveCurrentState({ editedLogo: "", logoImageData: null });
  };

  // Handle logo edit click
  const handleLogoEditClick = () => {
    if (logoImageData) {
      setPendingImageData({ type: "logo", data: logoImageData });
      setActiveImageType("logo");
      setIsModalOpen(true);
    }
  };

  // Handle logo file select for edit
  const handleLogoFileSelect = (imageData: BrandImageData) => {
    const convertedData = convertBrandImageToImageData(imageData);
    if (convertedData) {
      setPendingImageData({ type: "logo", data: convertedData });
      setActiveImageType("logo");
      setIsModalOpen(true);
    }
  };

  // Handle background image change from BrandImageUpload
  const handleBackgroundImageChange = (imageData: BrandImageData) => {
    const convertedData = convertBrandImageToImageData(imageData);
    if (convertedData) {
      setEditedBackgroundImg(imageData.url);
      setBackgroundImageData(convertedData);
      saveCurrentState({
        editedBackgroundImg: imageData.url,
        backgroundImageData: convertedData,
      });
    }
  };

  // Handle background image remove from BrandImageUpload
  const handleBackgroundImageRemove = () => {
    setEditedBackgroundImg("");
    setBackgroundImageData(null);
    saveCurrentState({ editedBackgroundImg: "", backgroundImageData: null });
  };

  // Handle background edit click
  const handleBackgroundEditClick = () => {
    if (backgroundImageData) {
      setPendingImageData({ type: "background", data: backgroundImageData });
      setActiveImageType("background");
      setIsModalOpen(true);
    }
  };

  // Handle background file select for edit
  const handleBackgroundFileSelect = (imageData: BrandImageData) => {
    const convertedData = convertBrandImageToImageData(imageData);
    if (convertedData) {
      setPendingImageData({ type: "background", data: convertedData });
      setActiveImageType("background");
      setIsModalOpen(true);
    }
  };

  // Auto-crop logo image function
  const autoCropLogoImage = (
    imageUrl: string,
  ): Promise<{ croppedUrl: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      // For logo, we don't need cropping - just return the original
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        resolve({
          croppedUrl: imageUrl,
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };
      img.src = imageUrl;
    });
  };

  // Auto-crop background image function
  const autoCropBackgroundImage = (
    imageUrl: string,
  ): Promise<{ croppedUrl: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const canvasWidth = 640;
      const canvasHeight = 600;
      const guidelineWidth = 580;
      const guidelineHeight = 240;
      const guidelinePadding = 20;

      // Calculate guideline bounds (centered)
      const pad =
        guidelinePadding ??
        Math.max(10, Math.min(canvasWidth, canvasHeight) * 0.05);
      const outerWidth = Math.min(
        guidelineWidth ?? canvasWidth - pad * 2,
        canvasWidth - pad * 2,
      );
      const outerHeight = Math.min(
        guidelineHeight ?? canvasHeight - pad * 2,
        canvasHeight - pad * 2,
      );
      const outerLeft = (canvasWidth - outerWidth) / 2;
      const outerTop = (canvasHeight - outerHeight) / 2;

      // Load the image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Create a canvas for the full image with guideline dimensions
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Calculate scale to cover the guideline area
        const scaleX = canvasWidth / img.width;
        const scaleY = canvasHeight / img.height;
        const scale = Math.max(scaleX, scaleY);

        // Calculate scaled dimensions
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Center the image
        const x = (canvasWidth - scaledWidth) / 2;
        const y = (canvasHeight - scaledHeight) / 2;

        // Draw the scaled image
        tempCtx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // Create crop canvas for guideline area
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = outerWidth;
        cropCanvas.height = outerHeight;
        const cropCtx = cropCanvas.getContext("2d");
        if (!cropCtx) {
          reject(new Error("Failed to get crop canvas context"));
          return;
        }

        // Crop to guideline bounds
        cropCtx.drawImage(
          tempCanvas,
          outerLeft,
          outerTop,
          outerWidth,
          outerHeight,
          0,
          0,
          outerWidth,
          outerHeight,
        );

        // Get cropped image as data URL
        const croppedUrl = cropCanvas.toDataURL("image/png");
        resolve({
          croppedUrl,
          width: outerWidth,
          height: outerHeight,
        });
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = imageUrl;
    });
  };

  // Initialize and sync image data from existing URLs
  useEffect(() => {
    if (editedLogo) {
      if (!logoImageData || logoImageData.url !== editedLogo) {
        setLogoImageData({
          url: editedLogo,
          fileName: logoImageData?.fileName || "logo.png",
          fileSize: logoImageData?.fileSize || 0,
          width: logoImageData?.width || 0,
          height: logoImageData?.height || 0,
          warnings: logoImageData?.warnings || [],
        });
      }
    } else {
      setLogoImageData(null);
    }
  }, [editedLogo]);

  useEffect(() => {
    if (editedBackgroundImg) {
      if (
        !backgroundImageData ||
        backgroundImageData.url !== editedBackgroundImg
      ) {
        setBackgroundImageData({
          url: editedBackgroundImg,
          fileName: backgroundImageData?.fileName || "background.png",
          fileSize: backgroundImageData?.fileSize || 0,
          width: backgroundImageData?.width || 0,
          height: backgroundImageData?.height || 0,
          warnings: backgroundImageData?.warnings || [],
        });
      }
    } else {
      setBackgroundImageData(null);
    }
  }, [editedBackgroundImg]);

  // ---- SELECT PLAN ----
  const handleSelectPlan = (plan: Plan) => {
    const planTypeValue = (plan as any).planDetails?.planType || planType || "";

    saveStepDataLocally("step1", {
      selectedPlanId: plan.id,
      selectedPlan: plan,
      editedPlanName: plan.companyName || plan.clientName || "",
      editedLogo: plan.companyLogo || "",
      editedBackgroundImg: plan.backgroundImg || "",
      backgroundOpacity: 25,
      logoSize: { width: 260, height: 160 },
      logoPosition: { x: 40, y: 250 },
      avatarSize: { width: 420, height: 650 },
      planType: planTypeValue,
      brandColor: plan.brandColor || plan.videoThemeColor || primaryColor,
    });
    persistPlanSelection("video", plan.id);

    autoFillContactsFromPlan(plan);

    setEditedPlanName(plan.companyName || plan.clientName || "");
    setEditedLogo(plan.companyLogo || "");
    setEditedBackgroundImg(plan.backgroundImg || "");
    setLogoSize({ width: 260, height: 160 });
    setLogoPosition({ x: 40, y: 250 });
    setAvatarSize({ width: 420, height: 650 });
    setPrimaryColor(plan.brandColor || plan.videoThemeColor || "#B30000");
    if (planTypeValue) {
      setPlanType(planTypeValue);
    }

    // Clear error when plan is selected
    if (touched.selectedPlanId) {
      validateField("selectedPlanId");
    }
  };

  // ---- UPDATE PLAN TYPE ----
  const handlePlanTypeChange = (value: string) => {
    setPlanType(value);

    const currentPlan =
      plans.find((p) => p.id === selectedPlanId) ||
      (stepData.step1 as any)?.selectedPlan ||
      stepData.selectedPlan ||
      null;

    if (currentPlan) {
      const updatedPlan = {
        ...currentPlan,
        planDetails: {
          ...(currentPlan as any).planDetails,
          planType: value,
        },
      };

      saveStepDataLocally("step1", {
        selectedPlanId,
        selectedPlan: updatedPlan,
        planType: value,
      });
    } else {
      saveStepDataLocally("step1", {
        planType: value,
      });
    }

    // Clear error when plan type is selected
    if (touched.planType) {
      validateField("planType");
    }
  };

  // ---- SAVE CHANGES ----
  const saveCurrentState = (override?: Partial<any>) => {
    const fallbackPlan =
      plans.find((p) => p.id === selectedPlanId) ||
      (stepData.step1 as any)?.selectedPlan ||
      stepData.selectedPlan ||
      null;

    const nextPlanName =
      override?.editedPlanName ??
      editedPlanName ??
      fallbackPlan?.companyName ??
      "";
    const nextLogo =
      override?.editedLogo ?? editedLogo ?? fallbackPlan?.companyLogo ?? "";
    const nextBackground =
      override?.editedBackgroundImg ??
      editedBackgroundImg ??
      fallbackPlan?.backgroundImg ??
      "";
    const nextOpacity = override?.backgroundOpacity ?? backgroundOpacity;
    const nextLogoSize = override?.logoSize ?? logoSize;
    const nextLogoPosition = override?.logoPosition ?? logoPosition;
    const nextAvatarSize = override?.avatarSize ?? avatarSize;
    const nextPlanType = override?.planType ?? planType;
    const nextBrandColor = override?.brandColor ?? primaryColor;
    const nextBarHeight = override?.barHeight ?? barHeight;

    const planForStore = fallbackPlan
      ? {
          ...fallbackPlan,
          companyName: nextPlanName,
          clientName: nextPlanName,
          companyLogo: nextLogo || fallbackPlan.companyLogo,
          backgroundImg: nextBackground || fallbackPlan.backgroundImg,
          planDetails: {
            ...(fallbackPlan as any).planDetails,
            planType:
              nextPlanType || (fallbackPlan as any).planDetails?.planType,
          },
        }
      : undefined;

    saveStepDataLocally("step1", {
      selectedPlanId,
      selectedPlan: planForStore,
      editedPlanName: nextPlanName,
      editedLogo: nextLogo,
      editedBackgroundImg: nextBackground,
      backgroundOpacity: nextOpacity,
      logoSize: nextLogoSize,
      logoPosition: nextLogoPosition,
      avatarSize: nextAvatarSize,
      planType: nextPlanType,
      brandColor: nextBrandColor,
      barHeight: nextBarHeight,
      ...override,
    });
  };

  // Sync local state with store
  const step1Data = stepData.step1 || {};
  useEffect(() => {
    if (step1Data.editedPlanName !== undefined) {
      setEditedPlanName(step1Data.editedPlanName);
    }
    if (step1Data.editedLogo !== undefined) {
      setEditedLogo(step1Data.editedLogo);
    }
    if (step1Data.logoImageData !== undefined) {
      setLogoImageData(step1Data.logoImageData);
    }
    if (step1Data.editedBackgroundImg !== undefined) {
      setEditedBackgroundImg(step1Data.editedBackgroundImg);
    }
    if (step1Data.backgroundImageData !== undefined) {
      setBackgroundImageData(step1Data.backgroundImageData);
    }
    if (step1Data.backgroundOpacity !== undefined) {
      setBackgroundOpacity(step1Data.backgroundOpacity);
    }
    if (step1Data.logoSize !== undefined) {
      setLogoSize(step1Data.logoSize);
    }
    if (
      step1Data.logoPosition !== undefined &&
      !isDraggingLogo.current &&
      !isSavingLogoPosition.current &&
      (step1Data.logoPosition.x !== logoPosition.x ||
        step1Data.logoPosition.y !== logoPosition.y) &&
      // Don't update if we just saved this position
      (step1Data.logoPosition.x !== lastSavedLogoPosition.current.x ||
        step1Data.logoPosition.y !== lastSavedLogoPosition.current.y)
    ) {
      setLogoPosition(step1Data.logoPosition);
      lastSavedLogoPosition.current = step1Data.logoPosition;
    }
    if (step1Data.avatarSize !== undefined) {
      setAvatarSize(step1Data.avatarSize);
    }
    if (step1Data.planType !== undefined) {
      setPlanType(step1Data.planType);
    } else if ((step1Data as any)?.selectedPlan?.planDetails?.planType) {
      setPlanType((step1Data as any).selectedPlan.planDetails.planType);
    }
    if (step1Data.brandColor !== undefined) {
      setPrimaryColor(step1Data.brandColor);
    }
    if (
      step1Data.barHeight !== undefined &&
      !isResizingBar.current &&
      !isSavingBarHeight.current &&
      step1Data.barHeight !== currentBarHeight.current &&
      // Don't update if we just saved this height
      step1Data.barHeight !== startBarHeight.current
    ) {
      setBarHeight(step1Data.barHeight);
      currentBarHeight.current = step1Data.barHeight;
      startBarHeight.current = step1Data.barHeight;
    }
  }, [
    step1Data.editedPlanName,
    step1Data.editedLogo,
    step1Data.editedBackgroundImg,
    step1Data.backgroundOpacity,
    step1Data.logoSize,
    step1Data.logoPosition?.x,
    step1Data.logoPosition?.y,
    step1Data.avatarSize,
    step1Data.planType,
    step1Data.brandColor,
    step1Data.barHeight,
    (step1Data as any)?.selectedPlan?.planDetails?.planType,
    // Don't include logoPosition directly to avoid re-renders during drag
  ]);

  // ---- Auto-save after edits ----
  useEffect(() => {
    if (
      !selectedPlanId ||
      isResizing.current ||
      isResizingLogo.current ||
      isResizingAvatar.current ||
      isResizingBar.current ||
      isDraggingLogo.current
    )
      return;

    const t = setTimeout(() => {
      saveCurrentState();
    }, 400);

    return () => clearTimeout(t);
  }, [
    editedPlanName,
    editedLogo,
    editedBackgroundImg,
    backgroundOpacity,
    logoSize,
    logoPosition,
    avatarSize,
    planType,
    primaryColor,
    barHeight,
    selectedPlanId,
  ]);

  // ---- Logo Drag (move) ----
  const startDragLogo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only drag if clicking on the image itself, not on resize handle
    if ((e.target as HTMLElement).classList.contains("resize-handle")) {
      return;
    }

    isDraggingLogo.current = true;

    const logoElement = logoRef.current;
    if (!logoElement) {
      isDraggingLogo.current = false;
      return;
    }

    const logoParent = logoElement.closest(
      '[data-preview-step="1"]',
    ) as HTMLElement;
    if (!logoParent) {
      isDraggingLogo.current = false;
      return;
    }

    // Use current state position instead of getBoundingClientRect to avoid jumps
    startPos.current = { x: e.clientX, y: e.clientY };
    startLogoPos.current = { ...logoPosition };
    currentLogoPosition.current = { ...logoPosition };

    let rafId: number | null = null;
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingLogo.current) return;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (!isDraggingLogo.current) return;

        const dx = ev.clientX - startPos.current.x;
        const dy = ev.clientY - startPos.current.y;

        // Get fresh container rect in case it changed
        const currentContainerRect = logoParent.getBoundingClientRect();

        const newX = Math.max(
          0,
          Math.min(
            currentContainerRect.width - logoSize.width,
            startLogoPos.current.x + dx,
          ),
        );
        const newY = Math.max(
          0,
          Math.min(
            currentContainerRect.height - logoSize.height,
            startLogoPos.current.y + dy,
          ),
        );

        const newPos = { x: newX, y: newY };
        // Only update if position actually changed
        if (
          newPos.x !== currentLogoPosition.current.x ||
          newPos.y !== currentLogoPosition.current.y
        ) {
          setLogoPosition(newPos);
          currentLogoPosition.current = newPos;
        }
      });
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      isDraggingLogo.current = false;
      isSavingLogoPosition.current = true;

      // Update last saved position with current position
      lastSavedLogoPosition.current = { ...currentLogoPosition.current };

      // Save after a small delay to ensure state is updated
      setTimeout(() => {
        saveCurrentState();
        // Unblock after save completes
        setTimeout(() => {
          isSavingLogoPosition.current = false;
        }, 150);
      }, 50);

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ---- Logo Resize (centered) ----
  const startResizeCentered = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingLogo.current = true;

    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...logoSize };

    const onMove = (ev: MouseEvent) => {
      if (!isResizingLogo.current) return;

      const dx = ev.clientX - startPos.current.x;
      const dy = ev.clientY - startPos.current.y;

      const delta = Math.max(dx, dy);

      const newWidth = Math.max(60, startSize.current.width + delta);
      const newHeight = Math.max(60, startSize.current.height + delta);

      setLogoSize({
        width: newWidth,
        height: newHeight,
      });
    };

    const onUp = () => {
      isResizingLogo.current = false;
      saveCurrentState();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ---- Bar Resize (height) ----
  const startResizeBar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingBar.current = true;

    const previewContainer = (e.target as HTMLElement).closest(
      '[data-preview-step="1"]',
    ) as HTMLElement;
    if (!previewContainer) {
      isResizingBar.current = false;
      return;
    }

    // Use current state height instead of getBoundingClientRect to avoid jumps
    startPos.current = { x: e.clientX, y: e.clientY };
    startBarHeight.current = barHeight;
    currentBarHeight.current = barHeight;

    let rafId: number | null = null;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingBar.current || !previewContainer) return;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (!isResizingBar.current || !previewContainer) return;

        const containerRect = previewContainer.getBoundingClientRect();
        const containerHeight = containerRect.height;

        const dy = startPos.current.y - ev.clientY; // Inverted: up = positive
        const heightDeltaPercent = (dy / containerHeight) * 100;

        const newHeight = Math.max(
          5,
          Math.min(30, startBarHeight.current + heightDeltaPercent),
        );

        if (newHeight !== currentBarHeight.current) {
          setBarHeight(newHeight);
          currentBarHeight.current = newHeight;
        }
      });
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      isResizingBar.current = false;
      isSavingBarHeight.current = true;

      // Update last saved height with current height
      startBarHeight.current = currentBarHeight.current;

      // Save after a small delay to ensure state is updated
      setTimeout(() => {
        saveCurrentState({ barHeight: currentBarHeight.current });
        // Unblock after save completes
        setTimeout(() => {
          isSavingBarHeight.current = false;
        }, 150);
      }, 50);

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ---- Render ----
  const currentSelectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="space-y-6">
      {/* FORM SECTION */}
      <Card>
        <CardHeader>
          <CardTitle>Select Plan</CardTitle>
        </CardHeader>

        <CardContent>
          {/* SELECT */}
          <div className="space-y-2">
            <Label>Select Plan *</Label>
            <Select
              value={selectedPlanId}
              onValueChange={(value) => {
                const plan = plans.find((p) => p.id === value);
                if (plan) handleSelectPlan(plan);
              }}
              onOpenChange={() => handleBlur("selectedPlanId")}
              disabled={isLoading}
            >
              <SelectTrigger
                className={
                  (touched.selectedPlanId && errors.selectedPlanId) ||
                  errorFields.includes("selectedPlanId")
                    ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                    : "focus:ring-0 focus:ring-offset-0"
                }
              >
                <SelectValue>
                  {currentSelectedPlan
                    ? currentSelectedPlan.companyName ||
                      currentSelectedPlan.clientName
                    : "Choose a plan..."}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.companyName || plan.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched.selectedPlanId && (
              <ErrorMessage error={errors.selectedPlanId} />
            )}
          </div>

          {/* EDIT FIELDS */}
          <div className="mt-6 space-y-6 border-t pt-6">
            <div className="space-y-2">
              <Label>Plan Type</Label>
              <Select
                value={planType}
                onValueChange={handlePlanTypeChange}
                onOpenChange={() => handleBlur("planType")}
              >
                <SelectTrigger
                  className={
                    (touched.planType && errors.planType) ||
                    errorFields.includes("planType")
                      ? "border-red-500 focus:ring-0 focus:ring-offset-0"
                      : "focus:ring-0 focus:ring-offset-0"
                  }
                >
                  <SelectValue placeholder="Choose a plan type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="401k">401(k)</SelectItem>
                  <SelectItem value="403b">403(b)</SelectItem>
                  <SelectItem value="401a">401(a)</SelectItem>
                  <SelectItem value="simpleIRA">Simple IRA</SelectItem>
                  <SelectItem value="457">457</SelectItem>
                </SelectContent>
              </Select>
              {touched.planType && <ErrorMessage error={errors.planType} />}
            </div>

            {/* Plan Name */}
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={editedPlanName}
                onChange={(e) => setEditedPlanName(e.target.value)}
              />
            </div>

            {/* Logo */}
            <div className="space-y-3">
              <BrandImageUpload
                slotKey="logo"
                slot={{
                  title: "Company Logo",
                  description: "",
                  recommendedSize: "900×900 px",
                  accept: ".svg,.png,.jpg,.jpeg",
                  required: false,
                  previewAspectRatio: 1,
                  previewLabel: "Logo preview (1:1)",
                  defaultPhoteButton: false,
                }}
                currentImage={convertImageDataToBrandImage(logoImageData)}
                onImageChange={handleLogoImageChange}
                onImageRemove={handleLogoImageRemove}
                onEditClick={handleLogoEditClick}
                onFileSelect={handleLogoFileSelect}
                useUniversalModal={true}
                universalModalType="normalizer"
                maxFileSize={10}
              />
            </div>

            {/* Background */}
            <div className="space-y-3">
              <BrandImageUpload
                slotKey="background"
                slot={{
                  title: "Background Image",
                  description: "",
                  recommendedSize: "1920×1080 px",
                  accept: ".png,.jpg,.jpeg",
                  required: false,
                  previewAspectRatio: 2,
                  previewLabel: "Background preview (2:1)",
                  defaultPhoteButton: true,
                }}
                currentImage={convertImageDataToBrandImage(backgroundImageData)}
                onImageChange={handleBackgroundImageChange}
                onImageRemove={handleBackgroundImageRemove}
                onDefaultPhotoClick={() => {
                  setGalleryImageType("background");
                  setGalleryOpen(true);
                }}
                onEditClick={handleBackgroundEditClick}
                onFileSelect={handleBackgroundFileSelect}
                maxFileSize={15}
              />
            </div>

            {/* Opacity */}
            {editedBackgroundImg && (
              <div className="space-y-2">
                <Label>Background Opacity: {backgroundOpacity}%</Label>
                <Slider
                  value={[backgroundOpacity]}
                  onValueChange={(v) => setBackgroundOpacity(v[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            )}

            {/* Brand Color */}
            <div className="space-y-2 flex flex-col items-start pt-4 border-t">
              <Label className="pr-5">Brand Color</Label>
              <div className="relative inline-block">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                    className="h-10 px-3"
                  >
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ background: primaryColor }}
                    />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {primaryColor}
                  </span>
                </div>
                <ColorPicker
                  value={primaryColor}
                  onChange={(color) => {
                    setPrimaryColor(color);
                    saveCurrentState({ brandColor: color });
                  }}
                  isOpen={isColorPickerOpen}
                  onOpenChange={(open) => setIsColorPickerOpen(open)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PREVIEW SECTION */}
      {selectedPlanId && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold font-inter">
              Title Screen Preview
            </h2>
            <p className="text-gray-500 font-inter">
              edit plan title | edit logo | edit background
            </p>
          </div>

          <div
            className="relative w-full overflow-hidden rounded-xl border shadow bg-white"
            style={{ paddingBottom: "56.25%" }}
            data-preview-step="1"
          >
            <div className="absolute inset-0">
              {/* BACKGROUND */}
              {editedBackgroundImg && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${editedBackgroundImg})`,
                    opacity: backgroundOpacity / 100,
                  }}
                />
              )}

              {/* LEFT-ALIGNED TEXT */}
              <div className="absolute top-10 left-10 text-left max-w-[55%]">
                <h1 className="text-4xl md:text-5xl font-extrabold leading-tight font-inter">
                  {editedPlanName || "Plan Name"}
                </h1>

                <h2 className="text-2xl md:text-3xl font-semibold mt-2 font-inter">
                  {planType ? `${planType.toUpperCase()} ` : ""}Profit Sharing
                  Plan and Trust
                </h2>
              </div>

              {/* DRAGGABLE LOGO */}
              {editedLogo && (
                <div
                  className="absolute flex items-start group"
                  style={{
                    left: `${logoPosition.x}px`,
                    top: `${logoPosition.y}px`,
                  }}
                >
                  <div className="relative inline-block">
                    <img
                      src={editedLogo}
                      alt="Logo"
                      ref={logoRef}
                      className="object-contain cursor-move"
                      style={{
                        width: logoSize.width,
                        height: logoSize.height,
                      }}
                      onMouseDown={startDragLogo}
                    />

                    {/* Resize handle */}
                    <div
                      className="resize-handle absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white cursor-se-resize z-10"
                      onMouseDown={startResizeCentered}
                    />
                  </div>
                </div>
              )}

              {/* LEFT-ALIGNED TAGLINE */}
              <div className="absolute left-10 bottom-[23%] text-left">
                <p className="text-xl font-semibold font-inter">
                  Your future retirement begins here
                </p>
              </div>

              {/* AVATAR — RIGHT SIDE */}
              <div
                className="absolute right-[-50px] z-20 bottom-[-200px] flex items-end"
                data-preview-avatar="true"
              >
                <div className="relative">
                  <img
                    ref={avatarRef}
                    src="/HeyGen-AI.png"
                    alt="Avatar"
                    className="object-contain pointer-events-none select-none"
                    style={{
                      width: 520,
                      height: 750,
                    }}
                  />
                </div>
              </div>

              {/* BRAND COLOR BAR */}
              <div
                ref={barRef}
                className="absolute bottom-0 left-0 right-0 group"
                style={{
                  height: `${barHeight}%`,
                  background: primaryColor,
                }}
              >
                {/* Resize handle on top edge */}
                <div
                  className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onMouseDown={startResizeBar}
                  style={{
                    background: "rgba(59, 130, 246, 0.5)",
                  }}
                >
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-1 bg-blue-500 rounded-full" />
                </div>
                {/* Visible drag knob */}
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-blue-500 bg-white shadow cursor-ns-resize z-30"
                  onMouseDown={startResizeBar}
                  title="Drag to adjust bar height"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gallery */}
      <ModalGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={async (url) => {
          if (!galleryImageType) return;

          // Determine file extension from URL
          let fileName = "default-image.png";
          let fileExtension = "png";

          // Check if it's a data URL
          if (url.startsWith("data:image/")) {
            const match = url.match(/data:image\/(\w+);/);
            if (match && match[1]) {
              fileExtension = match[1];
              fileName = `default-image.${fileExtension}`;
            }
          } else {
            // Try to extract extension from URL
            const urlMatch = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
            if (urlMatch && urlMatch[1]) {
              fileExtension = urlMatch[1].toLowerCase();
              fileName = `default-image.${fileExtension}`;
            }
          }

          try {
            let croppedUrl: string;
            let width: number;
            let height: number;

            if (galleryImageType === "logo") {
              // For logo, no cropping needed
              const result = await autoCropLogoImage(url);
              croppedUrl = result.croppedUrl;
              width = result.width;
              height = result.height;
            } else {
              // For background, auto-crop
              const result = await autoCropBackgroundImage(url);
              croppedUrl = result.croppedUrl;
              width = result.width;
              height = result.height;
            }

            // Check warnings
            const warnings: string[] = [];
            const recommendedSize =
              galleryImageType === "logo" ? "900×900" : "1920×1080";
            const [recWidth, recHeight] = recommendedSize
              .split("×")
              .map((s) => parseInt(s));
            if (width < recWidth || height < recHeight) {
              warnings.push(
                `Below recommended size (${recommendedSize}). May appear blurry.`,
              );
            }

            const imageData: ImageData = {
              url: croppedUrl,
              fileName,
              fileSize: 0,
              width,
              height,
              warnings,
            };

            if (galleryImageType === "logo") {
              setEditedLogo(croppedUrl);
              setLogoImageData(imageData);
              saveCurrentState({ editedLogo: croppedUrl });
            } else {
              setEditedBackgroundImg(croppedUrl);
              setBackgroundImageData(imageData);
              saveCurrentState({ editedBackgroundImg: croppedUrl });
            }
            setGalleryOpen(false);
            setGalleryImageType(null);
          } catch (error) {
            console.error("Failed to auto-crop image:", error);
            // Fallback: save without cropping
            const img = new Image();
            img.onload = () => {
              const warnings: string[] = [];
              const recommendedSize =
                galleryImageType === "logo" ? "900×900" : "1920×1080";
              const [recWidth, recHeight] = recommendedSize
                .split("×")
                .map((s) => parseInt(s));
              if (img.width < recWidth || img.height < recHeight) {
                warnings.push(
                  `Below recommended size (${recommendedSize}). May appear blurry.`,
                );
              }

              const imageData: ImageData = {
                url,
                fileName,
                fileSize: 0,
                width: img.width,
                height: img.height,
                warnings,
              };

              if (galleryImageType === "logo") {
                setEditedLogo(url);
                setLogoImageData(imageData);
                saveCurrentState({ editedLogo: url });
              } else {
                setEditedBackgroundImg(url);
                setBackgroundImageData(imageData);
                saveCurrentState({ editedBackgroundImg: url });
              }
              setGalleryOpen(false);
              setGalleryImageType(null);
            };

            img.onerror = () => {
              // Final fallback
              const imageData: ImageData = {
                url,
                fileName,
                fileSize: 0,
                width: 0,
                height: 0,
                warnings: [],
              };

              if (galleryImageType === "logo") {
                setEditedLogo(url);
                setLogoImageData(imageData);
                saveCurrentState({ editedLogo: url });
              } else {
                setEditedBackgroundImg(url);
                setBackgroundImageData(imageData);
                saveCurrentState({ editedBackgroundImg: url });
              }
              setGalleryOpen(false);
              setGalleryImageType(null);
            };

            img.src = url;
          }
        }}
      />

      {/* Universal Image Editor Modal for Logo */}
      {pendingImageData && pendingImageData.type === "logo" && (
        <UniversalImageEditorModal
          type="normalizer"
          value={pendingImageData.data.url || ""}
          originalValue={
            pendingImageData.data.cropData?.originalImage ||
            pendingImageData.data.originalUrl
          }
          fileName={pendingImageData.data.fileName || ""}
          existingCropData={pendingImageData.data.cropData}
          onChange={handleModalSave}
          onRemove={handleModalClose}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}
      {/* Simple Image Editor Modal for Background */}
      {pendingImageData && pendingImageData.type === "background" && (
        <SimpleImageEditorModal
          modalTitle="Background Image"
          modalDescription="Upload a background image for your video title screen."
          value={pendingImageData.data.url || ""}
          originalValue={
            pendingImageData.data.cropData?.originalImage ||
            pendingImageData.data.originalUrl
          }
          fileName={pendingImageData.data.fileName || ""}
          existingCropData={pendingImageData.data.cropData}
          onChange={handleModalSave}
          onRemove={handleModalClose}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          saveButtonText="Save Background"
          canvasWidth={640}
          canvasHeight={600}
          guidelineWidth={580}
          guidelineHeight={240}
          guidelinePadding={20}
        />
      )}
    </div>
  );
}
