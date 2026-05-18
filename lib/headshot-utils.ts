export async function validateImage(file: File): Promise<{ valid: boolean; message?: string }> {
    const maxSize = 5 * 1024 * 1024;
    const supportedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  
    if (!supportedTypes.includes(file.type)) {
      return { valid: false, message: "Unsupported file type. Upload JPG, PNG, or WebP." };
    }
  
    if (file.size > maxSize) {
      return { valid: false, message: "File is over 5 MB." };
    }
  
    const img = new Image();
    const url = URL.createObjectURL(file);
  
    return new Promise((resolve) => {
      img.onload = () => {
        if (img.width < 600 || img.height < 600) {
          resolve({ valid: false, message: "Image resolution is too low. Minimum 600×600 required." });
        } else {
          resolve({ valid: true });
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve({ valid: false, message: "Unable to load image." });
      img.src = url;
    });
  }

  type Crop = { x: number; y: number };

interface CropResult {
  blob: Blob;
  base64: string;
  width: number;
  height: number;
}

/**
 * Create cropped image from source image using crop/zoom/rotation.
 */
export async function getCroppedImg(
  imageSrc: string, // base64 or URL
  crop: Crop,
  zoom: number,
  rotation: number,
  outputSize = 800 // output size (square)
): Promise<CropResult> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Failed to get 2D context");

  const radians = (rotation * Math.PI) / 180;

  const safeArea = Math.max(image.width, image.height) * 2;

  canvas.width = safeArea;
  canvas.height = safeArea;

  // move origin to center of canvas
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(radians);
  ctx.scale(zoom, zoom);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  // Get the cropped image from canvas
  const data = ctx.getImageData(
    crop.x * zoom,
    crop.y * zoom,
    outputSize,
    outputSize
  );

  // Set canvas to final size
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.putImageData(data, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Canvas is empty"));

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;

          resolve({
            blob,
            base64: base64data,
            width: outputSize,
            height: outputSize,
          });
        };
      },
      "image/png",
      1
    );
  });
}

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
  });
}

  