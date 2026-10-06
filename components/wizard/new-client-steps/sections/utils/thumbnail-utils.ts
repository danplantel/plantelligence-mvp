import {
  THUMBNAIL_GUIDE_WIDTH,
  THUMBNAIL_GUIDE_HEIGHT,
  THUMBNAIL_RECOMMENDED_WIDTH,
  THUMBNAIL_RECOMMENDED_HEIGHT,
} from "../../constants/brand-image-guides";

/**
 * Crop an uploaded thumbnail to the slot's guide, for the paths that bypass the
 * cropper (gallery pick, plain upload).
 *
 * The guide comes from `constants/brand-image-guides` rather than being written out
 * again here: this is one of three things that crop this slot, and a hard-coded pair
 * meant the automatic crop could keep exporting the old shape after the ratio moved.
 */
export function autoCropThumbnailImage(
  imageUrl: string,
): Promise<{ croppedUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const canvasWidth = 600;
    const canvasHeight = 600;
    const guidelineWidth = THUMBNAIL_GUIDE_WIDTH;
    const guidelineHeight = THUMBNAIL_GUIDE_HEIGHT;
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
      // Cover-fit the source across the editor canvas, exactly as the cropper does.
      // That mapping is what turns the guide rectangle into a region of the source
      // image, so the region can be sampled straight from the original.
      const scaleX = canvasWidth / img.width;
      const scaleY = canvasHeight / img.height;
      const scale = Math.max(scaleX, scaleY);

      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;

      const x = (canvasWidth - scaledWidth) / 2;
      const y = (canvasHeight - scaledHeight) / 2;

      // Export at the slot's recommended size (900×1000), not at the on-screen
      // frame size (396×440). Sampling the original directly — instead of the
      // 600px cover-fit canvas — keeps the resolution the source actually has, so
      // the crop is not softer than the default image it replaces.
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = THUMBNAIL_RECOMMENDED_WIDTH;
      cropCanvas.height = THUMBNAIL_RECOMMENDED_HEIGHT;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) {
        reject(new Error("Failed to get crop canvas context"));
        return;
      }

      cropCtx.drawImage(
        img,
        (outerLeft - x) / scale,
        (outerTop - y) / scale,
        outerWidth / scale,
        outerHeight / scale,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
      );

      const croppedUrl = cropCanvas.toDataURL("image/png");
      resolve({
        croppedUrl,
        width: cropCanvas.width,
        height: cropCanvas.height,
      });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageUrl;
  });
}

