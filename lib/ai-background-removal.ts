/**
 * Background removal, from the browser's side of the API.
 *
 * The model runs on the server — see
 * [`lib/background-removal.server.ts`](lib/background-removal.server.ts:1) and
 * `app/api/remove-background/route.ts` — so nothing here downloads weights, and no
 * visitor pays for a 168 MB model. This module uploads a downscaled copy of the logo,
 * receives the predicted alpha matte, and applies it to the full-resolution original.
 *
 * That split is the point, not an implementation detail. The mask is 1024² because that
 * is the model's output resolution, so uploading the original would buy nothing: the
 * artwork the user sees, crops and saves never leaves the browser, and the request stays
 * a few hundred kilobytes — comfortably inside the platform's body limit, which the
 * original file would not be.
 *
 * The colour pipeline in [`lib/image-background-removal.ts`](lib/image-background-removal.ts:1)
 * stays as the instant, offline-capable fallback: if this route is unreachable, refuses
 * the caller, or fails, the editor falls back to it and *says so*.
 */

import { detectTransparency } from "@/lib/image-editor-crop";
import {
  MEANINGFUL_REMOVAL_RATIO,
  loadSourceCanvas,
  trimTransparent,
  type RemovalResult,
} from "@/lib/image-background-removal";

/** The model's input, and therefore the size of the copy that gets uploaded. */
const MODEL_INPUT_SIZE = 1024;

/**
 * Longest side the working canvas may reach before the mask is applied.
 *
 * The mask is 1024² however big the source is, so beyond roughly double that the extra
 * pixels are interpolation — and the colour read-back used to measure and trim the
 * result grows with the square. 2048 keeps a logo edge crisp without risking a large
 * allocation on a phone.
 */
const MAX_WORKING_DIMENSION = 2048;

/**
 * Above this, the downscaled copy is re-encoded as JPEG.
 *
 * A 1024² PNG of a photograph can be several megabytes — over Vercel's 4.5 MB request
 * limit — while the same image as JPEG is a couple of hundred kilobytes. Edge quality is
 * unaffected: the matte is smooth, and JPEG artefacts at this quality are far below what
 * the model notices.
 */
const UPLOAD_PNG_LIMIT_BYTES = 3 * 1024 * 1024;

/** The route this module talks to. */
export const REMOVE_BACKGROUND_ENDPOINT = "/api/remove-background";

/**
 * Whether this browser can use the route at all.
 *
 * Cheap and synchronous, so the editor can choose between the model and the colour pass
 * without a request. It cannot know whether the route will *succeed* — no server health
 * check is worth a round trip on every modal open — so failure is handled at the call
 * site instead, by falling back.
 */
export function isAiRemovalAvailable(): boolean {
  return typeof window !== "undefined" && typeof fetch === "function";
}

/** `canvas.toBlob` as a promise, rejecting rather than hanging on an encode failure. */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare the image for the server."));
      },
      type,
      quality,
    );
  });
}

/** Decode a blob into an image element, revoking the object URL either way. */
function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The server returned a mask that could not be read."));
    };
    image.src = url;
  });
}

/**
 * The copy that gets uploaded: the source at the model's input scale, flattened onto
 * white.
 *
 * Flattening mirrors what the server does before inference, so a logo that already
 * carries transparency is segmented as the opaque image the model was trained on rather
 * than with its transparent regions read as black. It costs nothing: the client applies
 * the returned mask to its own original, whose alpha is still intact.
 */
async function buildUpload(
  source: HTMLCanvasElement,
): Promise<{ blob: Blob; fileName: string }> {
  const scale = Math.min(
    1,
    MODEL_INPUT_SIZE / Math.max(source.width, source.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image for the server.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const png = await canvasToBlob(canvas, "image/png");
  if (png.size <= UPLOAD_PNG_LIMIT_BYTES) {
    return { blob: png, fileName: "logo.png" };
  }

  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
  return { blob: jpeg, fileName: "logo.jpg" };
}

/** Turn a failed response into something worth putting in front of a user. */
async function describeFailure(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Your session has expired, so the background model is unavailable.";
  }
  if (response.status === 413) {
    return "This image is too large for the background model.";
  }
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // Not JSON — fall through to the status-based message.
  }
  return `The background model failed (HTTP ${response.status}).`;
}

/**
 * Remove the background with the server-side model.
 *
 * Returns the same [`RemovalResult`](lib/image-background-removal.ts:88) the colour
 * pipeline returns, so the editor cannot tell which engine ran: the offer dialog's
 * precomputed result, the re-seed, the auto-size and the save path are all unchanged.
 *
 * `detectedColor` is null — a segmentation model has no single backdrop colour to report
 * — and `artworkRisk` is always false, because a model that segments by content does not
 * confuse white artwork with a white background.
 *
 * @throws Error with a user-safe message; the caller falls back to the colour pipeline.
 */
export async function removeBackgroundWithAi(
  src: string,
  options: { signal?: AbortSignal } = {},
): Promise<RemovalResult> {
  const source = await loadSourceCanvas(src, MAX_WORKING_DIMENSION);
  const alreadyTransparent = detectTransparency(source);

  const { blob, fileName } = await buildUpload(source);

  const form = new FormData();
  form.append("image", blob, fileName);

  const response = await fetch(REMOVE_BACKGROUND_ENDPOINT, {
    method: "POST",
    body: form,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await describeFailure(response));
  }

  const maskImage = await loadBlobImage(await response.blob());

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskImage.naturalWidth || MODEL_INPUT_SIZE;
  maskCanvas.height = maskImage.naturalHeight || MODEL_INPUT_SIZE;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!maskCtx) throw new Error("Could not read the mask the server returned.");
  maskCtx.drawImage(maskImage, 0, 0);

  const maskData = maskCtx.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height,
  );

  // Measured on the mask rather than the full result: it is 1024² in any case, and the
  // proportion it gives is the same one the user is being told about.
  let removed = 0;
  for (let index = 3; index < maskData.data.length; index += 4) {
    if (maskData.data[index] < 128) removed++;
  }
  const removedRatio = removed / (maskCanvas.width * maskCanvas.height);

  const width = source.width;
  const height = source.height;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) throw new Error("Could not build the removed background.");

  outputCtx.drawImage(source, 0, 0);
  outputCtx.globalCompositeOperation = "destination-in";
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = "high";
  outputCtx.drawImage(maskCanvas, 0, 0, width, height);
  outputCtx.globalCompositeOperation = "source-over";

  const box = trimTransparent(maskData, 0);

  let trimmed = false;
  let result = output;

  if (box) {
    const scaleX = width / maskCanvas.width;
    const scaleY = height / maskCanvas.height;
    const padding = 2;
    const cropX = Math.max(0, Math.floor(box.x * scaleX) - padding);
    const cropY = Math.max(0, Math.floor(box.y * scaleY) - padding);
    const cropRight = Math.min(
      width,
      Math.ceil((box.x + box.width) * scaleX) + padding,
    );
    const cropBottom = Math.min(
      height,
      Math.ceil((box.y + box.height) * scaleY) + padding,
    );
    const cropWidth = cropRight - cropX;
    const cropHeight = cropBottom - cropY;

    if (
      cropWidth > 0 &&
      cropHeight > 0 &&
      (cropWidth < width || cropHeight < height)
    ) {
      const cropped = document.createElement("canvas");
      cropped.width = cropWidth;
      cropped.height = cropHeight;
      const croppedCtx = cropped.getContext("2d");
      if (croppedCtx) {
        croppedCtx.drawImage(
          output,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight,
        );
        result = cropped;
        trimmed = true;
      }
    }
  }

  return {
    dataUrl: result.toDataURL("image/png"),
    width: result.width,
    height: result.height,
    detectedColor: null,
    removedRatio,
    trimmed,
    alreadyTransparent,
    noChange: alreadyTransparent && removedRatio < MEANINGFUL_REMOVAL_RATIO,
    artworkRisk: false,
  };
}
