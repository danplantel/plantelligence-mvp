/**
 * Branding images in R2: detect R2 keys and convert data URLs to File for upload.
 * R2 keys are stored in Client.companyLogo, backgroundImg, thumbnailImg, etc.
 * Key format: org/{orgId}/plans/{planId}/branding/{slot}/...
 */

export const R2_KEY_PREFIX = "org/";

export function isR2Key(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith(R2_KEY_PREFIX);
}

/**
 * Convert a data URL (base64) to a File for uploadFileToR2.
 */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(base64);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new File([u8], fileName || "image.png", { type: mime });
}

const BRANDING_SLOTS = ["logo", "background", "thumbnail", "secondaryBanner", "favicon"] as const;
export type BrandingSlot = (typeof BRANDING_SLOTS)[number];

/**
 * Upload a single branding image (data URL or File) to R2 and return the storage key.
 * Returns null if R2 not configured or upload fails.
 */
export async function uploadBrandingToR2(params: {
  dataUrlOrFile: string | File;
  fileName: string;
  clientId: string;
  slot: BrandingSlot;
}): Promise<string | null> {
  const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
  const file =
    typeof params.dataUrlOrFile === "string"
      ? dataUrlToFile(params.dataUrlOrFile, params.fileName)
      : params.dataUrlOrFile;
  return uploadFileToR2({
    file,
    purpose: "branding",
    clientId: params.clientId,
    fileName: params.fileName,
    slot: params.slot,
  });
}
