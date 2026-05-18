import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  processImage,
  autoCropToSquare,
  cropImage,
  base64ToBuffer,
  bufferToBase64,
  type CropOptions,
} from "@/lib/image-processing";

/**
 * POST /api/images/crop
 * Обрізає фотографію на бекенді
 * 
 * Body:
 * - image: string (base64 або data URL)
 * - crop?: { x, y, width, height } - параметри обрізання
 * - autoSquare?: boolean - автоматично обрізати до квадрата
 * - outputSize?: { width, height } - фінальний розмір
 * - format?: "jpeg" | "png" | "webp"
 * - quality?: number (1-100)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      image,
      crop,
      autoSquare = false,
      outputSize,
      format = "jpeg",
      quality = 90,
    } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    const imageBuffer = base64ToBuffer(image);

    let processedBuffer: Buffer;

    if (autoSquare) {
      const size = outputSize?.width || outputSize?.height || 800;
      processedBuffer = await autoCropToSquare(imageBuffer, size);
    } else if (crop) {
      processedBuffer = await cropImage(
        imageBuffer,
        crop as CropOptions,
        outputSize
      );
    } else {
      processedBuffer = await processImage(imageBuffer, {
        resize: outputSize,
        format: format as "jpeg" | "png" | "webp",
        quality,
      });
    }
    const mimeType = `image/${format}`;
    const base64Result = bufferToBase64(processedBuffer, mimeType);

    return NextResponse.json({
      success: true,
      image: base64Result,
      format,
    });
  } catch (error: any) {
    console.error("Error cropping image:", error);
    return NextResponse.json(
      { error: "Failed to crop image", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/images/crop (FormData version)
 * Обрізає фотографію з FormData
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const cropX = formData.get("cropX");
    const cropY = formData.get("cropY");
    const cropWidth = formData.get("cropWidth");
    const cropHeight = formData.get("cropHeight");
    const autoSquare = formData.get("autoSquare") === "true";
    const outputWidth = formData.get("outputWidth");
    const outputHeight = formData.get("outputHeight");

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const imageBuffer = Buffer.from(bytes);

    let processedBuffer: Buffer;

    if (autoSquare) {
      const size = outputWidth
        ? parseInt(outputWidth as string)
        : outputHeight
        ? parseInt(outputHeight as string)
        : 800;
      processedBuffer = await autoCropToSquare(imageBuffer, size);
    } else if (cropX && cropY && cropWidth && cropHeight) {
      const crop: CropOptions = {
        x: parseInt(cropX as string),
        y: parseInt(cropY as string),
        width: parseInt(cropWidth as string),
        height: parseInt(cropHeight as string),
      };
      const outputSize =
        outputWidth && outputHeight
          ? {
              width: parseInt(outputWidth as string),
              height: parseInt(outputHeight as string),
            }
          : undefined;
      processedBuffer = await cropImage(imageBuffer, crop, outputSize);
    } else {
      const outputSize =
        outputWidth && outputHeight
          ? {
              width: parseInt(outputWidth as string),
              height: parseInt(outputHeight as string),
            }
          : undefined;
      processedBuffer = await processImage(imageBuffer, {
        resize: outputSize,
        format: "jpeg",
        quality: 90,
      });
    }

    const base64Result = bufferToBase64(processedBuffer, file.type);

    return NextResponse.json({
      success: true,
      image: base64Result,
      format: "jpeg",
    });
  } catch (error: any) {
    console.error("Error cropping image:", error);
    return NextResponse.json(
      { error: "Failed to crop image", details: error.message },
      { status: 500 }
    );
  }
}

