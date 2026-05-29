import type sharp from "sharp";

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProcessingOptions {
  crop?: CropOptions;
  resize?: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  };
  format?: "jpeg" | "png" | "webp";
  quality?: number; // 1-100
  rotate?: number; // degrees
  flip?: boolean;
  flop?: boolean; // horizontal flip
}

/**
 * Lazily load sharp — top-level `import sharp` causes native binary load errors
 * in all routes that import this module (e.g. DELETE /api/clients/[id]), even when
 * image-processing functions are never called for that request.
 */
let _sharp: typeof sharp | null = null;
const getSharp = async (): Promise<typeof sharp> => {
  if (!_sharp) {
    _sharp = (await import("sharp")).default;
  }
  return _sharp;
};

/**
 * Process and crop image on backend
 * @param imageBuffer - Image buffer
 * @param options - Processing options
 * @returns Processed image buffer
 */
export async function processImage(
  imageBuffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<Buffer> {
  const sharpModule = await getSharp();
  let pipeline = sharpModule(imageBuffer);

  if (options.crop) {
    const { x, y, width, height } = options.crop;
    pipeline = pipeline.extract({ left: x, top: y, width, height });
  }

  if (options.rotate) {
    pipeline = pipeline.rotate(options.rotate);
  }

  if (options.flip) {
    pipeline = pipeline.flip();
  }

  if (options.flop) {
    pipeline = pipeline.flop();
  }

  if (options.resize) {
    const resizeOptions: sharp.ResizeOptions = {};
    if (options.resize.width) resizeOptions.width = options.resize.width;
    if (options.resize.height) resizeOptions.height = options.resize.height;
    if (options.resize.fit) resizeOptions.fit = options.resize.fit;
    pipeline = pipeline.resize(resizeOptions);
  }
  const format = options.format || "jpeg";
  const quality = options.quality || 90;

  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality });
      break;
    case "png":
      pipeline = pipeline.png({ quality });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality });
      break;
  }

  return await pipeline.toBuffer();
}

/**
 * Automatically crop image to square (center and crop)
 * @param imageBuffer - Image buffer
 * @param size - Square size (default 800x800)
 * @returns Cropped image buffer
 */
export async function autoCropToSquare(
  imageBuffer: Buffer,
  size: number = 800
): Promise<Buffer> {
  const sharpModule = await getSharp();
  const metadata = await sharpModule(imageBuffer).metadata();
  const { width = 0, height = 0 } = metadata;

  const minDimension = Math.min(width, height);

  const x = Math.floor((width - minDimension) / 2);
  const y = Math.floor((height - minDimension) / 2);

  return await processImage(imageBuffer, {
    crop: {
      x,
      y,
      width: minDimension,
      height: minDimension,
    },
    resize: {
      width: size,
      height: size,
      fit: "cover",
    },
    format: "jpeg",
    quality: 90,
  });
}

/**
 * Crop image with given crop parameters
 * @param imageBuffer - Image buffer
 * @param crop - Crop parameters (x, y, width, height)
 * @param outputSize - Final size (if resize needed after crop)
 * @returns Cropped image buffer
 */
export async function cropImage(
  imageBuffer: Buffer,
  crop: CropOptions,
  outputSize?: { width: number; height: number }
): Promise<Buffer> {
  const options: ImageProcessingOptions = {
    crop,
    format: "jpeg",
    quality: 90,
  };

  if (outputSize) {
    options.resize = {
      width: outputSize.width,
      height: outputSize.height,
      fit: "cover",
    };
  }

  return await processImage(imageBuffer, options);
}

/**
 * Convert base64 string to Buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.includes(",")
    ? base64.split(",")[1]
    : base64;
  return Buffer.from(base64Data, "base64");
}

/**
 * Convert Buffer to base64 string
 */
export function bufferToBase64(
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/**
 * Get image metadata
 */
export async function getImageMetadata(
  imageBuffer: Buffer
): Promise<sharp.Metadata> {
  const sharpModule = await getSharp();
  return await sharpModule(imageBuffer).metadata();
}

/**
 * Process base64 image (crop to square and convert back to base64)
 * @param base64Image - base64 image string
 * @param size - square size (default 800x800)
 * @returns Processed base64 image string
 */
export async function processBase64Image(
  base64Image: string,
  size: number = 800
): Promise<string> {
  const isDataUrl = base64Image.includes(",");
  const base64Data = isDataUrl ? base64Image.split(",")[1] : base64Image;
  const mimeType = isDataUrl
    ? base64Image.split(",")[0].split(":")[1].split(";")[0]
    : "image/jpeg";

  const imageBuffer = Buffer.from(base64Data, "base64");
  const processedBuffer = await autoCropToSquare(imageBuffer, size);

  return bufferToBase64(processedBuffer, mimeType);
}

/**
 * Перевіряє чи рядок є base64 зображенням
 */
export function isBase64Image(str: string): boolean {
  if (!str) return false;
  return (
    str.startsWith("data:image/") ||
    (str.length > 100 && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)))
  );
}

/**
 * Interface for crop metadata
 */
export interface CropMetadata {
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  cropped: boolean;
  originalImage?: string;
}

/**
 * Process base64 image with crop metadata (in percentages)
 * If cropData is provided, uses it instead of automatic cropping
 * @param base64Image - base64 image string (can be cropped for UI or original)
 * @param cropData - crop metadata in percentages (0-100) (optional)
 * @param defaultSize - default size for automatic cropping
 * @returns Processed base64 image string
 */
export async function processBase64ImageWithCrop(
  base64Image: string,
  cropData?: CropMetadata,
  defaultSize: number = 800
): Promise<string> {
  if (cropData && cropData.cropped) {
    const imageToProcess = cropData.originalImage || base64Image;
    
    const isDataUrl = imageToProcess.includes(",");
    const base64Data = isDataUrl ? imageToProcess.split(",")[1] : imageToProcess;
    const mimeType = isDataUrl
      ? imageToProcess.split(",")[0].split(":")[1].split(";")[0]
      : "image/jpeg";

    const imageBuffer = Buffer.from(base64Data, "base64");

    const metadata = await getImageMetadata(imageBuffer);
    const originalWidth = metadata.width || cropData.originalWidth;
    const originalHeight = metadata.height || cropData.originalHeight;

    const cropX = Math.round((cropData.x / 100) * originalWidth);
    const cropY = Math.round((cropData.y / 100) * originalHeight);
    const cropWidth = Math.round((cropData.width / 100) * originalWidth);
    const cropHeight = Math.round((cropData.height / 100) * originalHeight);
    const processedBuffer = await cropImage(
      imageBuffer,
      {
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
      },
      {
        width: cropWidth,
        height: cropHeight,
      }
    );

    return bufferToBase64(processedBuffer, mimeType);
  }

  return await processBase64Image(base64Image, defaultSize);
}
