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

/** Image-bearing fields on a key contact. */
const CONTACT_IMAGE_FIELDS = ["headshot", "teamImage", "companyLogo"] as const;

/**
 * Replace inline (data-URL) contact images with R2 keys, returning the contacts in the
 * same shape they arrived in (array, or `{ contacts: [...] }`).
 *
 * `Client.keyContacts` is a Json column read by the benefits and portal routes, and
 * those responses are forwarded to the browser, so an inline headshot there costs every
 * reader hundreds of KB — measured at 447 KB on a single plan. The contact card renders
 * the value through `BrandingImage`/`Headshot`, both of which resolve an R2 key, so
 * storing keys loses nothing.
 *
 * Returns the ORIGINAL value unchanged when there is nothing to convert, so callers can
 * use it as a write guard and avoid rewriting untouched rows. Images that fail to upload
 * (e.g. R2 unconfigured) are left inline rather than silently dropped.
 */
export async function normalizeContactImagesToR2<T>(
  contacts: T,
  clientId: string,
): Promise<T> {
  if (contacts == null) return contacts;

  const isArray = Array.isArray(contacts);
  const list = isArray
    ? (contacts as unknown as Record<string, unknown>[])
    : ((contacts as Record<string, unknown>).contacts ??
      (contacts as Record<string, unknown>).Contacts);
  if (!Array.isArray(list) || list.length === 0) return contacts;

  let changed = false;
  const normalized = await Promise.all(
    list.map(async (contact) => {
      if (!contact || typeof contact !== "object") return contact;
      let next: Record<string, unknown> | null = null;
      for (const field of CONTACT_IMAGE_FIELDS) {
        const value = (contact as Record<string, unknown>)[field];
        if (typeof value !== "string" || !value.startsWith("data:")) continue;
        const key = await uploadBrandingToR2({
          dataUrlOrFile: value,
          fileName: `${field}.png`,
          clientId,
          slot: field === "companyLogo" ? "logo" : "thumbnail",
        });
        if (!key) continue;
        if (!next) next = { ...(contact as Record<string, unknown>) };
        next[field] = key;
        changed = true;
      }
      return next ?? contact;
    }),
  );

  if (!changed) return contacts;

  return (isArray
    ? normalized
    : { ...(contacts as Record<string, unknown>), contacts: normalized }) as T;
}
