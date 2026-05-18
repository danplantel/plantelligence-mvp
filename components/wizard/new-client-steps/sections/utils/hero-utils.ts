import type { BrandImageData, CompanyLogoData } from "@/types/new-client-wizard";

export const HERO_RECOMMENDED_SIZE_LABEL = "1920×1080 px";
export const HERO_RECOMMENDED_WIDTH = 1920;
export const HERO_RECOMMENDED_HEIGHT = 1080;

export const FALLBACK_HEADER_IMAGE: BrandImageData = {
  url: "",
  fileName: "hero-background.png",
  fileSize: 0,
  width: HERO_RECOMMENDED_WIDTH,
  height: HERO_RECOMMENDED_HEIGHT,
  recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
  status: "ok",
  warnings: [],
};

export const convertBrandImageToLogo = (
  brandImage: BrandImageData | null,
): CompanyLogoData | null => {
  if (!brandImage) return null;
  return {
    url: brandImage.url,
    originalUrl: brandImage.originalUrl || brandImage.cropData?.originalImage,
    fileName: brandImage.fileName,
    fileSize: brandImage.fileSize,
    width: brandImage.width,
    height: brandImage.height,
    hasTransparency:
      brandImage.url.includes("data:image/png") ||
      brandImage.url.includes("data:image/svg"),
    warnings: brandImage.warnings || [],
    cropData: brandImage.cropData, // Preserve cropData when converting
  };
};

export const convertLogoToBrandImage = (
  logoData: CompanyLogoData | null,
): BrandImageData | undefined => {
  if (!logoData) return undefined;
  return {
    url: logoData.url, // Cropped image for UI
    originalUrl: logoData.originalUrl || logoData.cropData?.originalImage, // Original image for reset
    fileName: logoData.fileName,
    fileSize: logoData.fileSize,
    width: logoData.width,
    height: logoData.height,
    recommendedSize: "900×900 px",
    status:
      logoData.warnings && logoData.warnings.length > 0 ? "warning" : "ok",
    warnings: logoData.warnings || [],
    cropData: logoData.cropData, // Preserve cropData with originalImage
  };
};

export const autoCropHeroBackgroundImage = (
  imageUrl: string,
): Promise<{ croppedUrl: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const canvasWidth = 640;
    const canvasHeight = 600;
    const guidelineWidth = 580;
    const guidelineHeight = 240;
    const guidelinePadding = 20;

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

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvasWidth;
      tempCanvas.height = canvasHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      const scaleX = canvasWidth / img.width;
      const scaleY = canvasHeight / img.height;
      const scale = Math.max(scaleX, scaleY);

      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      const x = (canvasWidth - scaledWidth) / 2;
      const y = (canvasHeight - scaledHeight) / 2;

      tempCtx.drawImage(img, x, y, scaledWidth, scaledHeight);

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = outerWidth;
      cropCanvas.height = outerHeight;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) {
        reject(new Error("Failed to get crop canvas context"));
        return;
      }

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

