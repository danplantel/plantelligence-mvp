export function autoCropThumbnailImage(
  imageUrl: string,
): Promise<{ croppedUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const canvasWidth = 600;
    const canvasHeight = 600;
    const guidelineWidth = 400;
    const guidelineHeight = 400;
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
}

