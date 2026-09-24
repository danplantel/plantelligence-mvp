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
 * Server-side branding upload: PutObject straight to the bucket.
 *
 * `uploadFileToR2` cannot run here — it posts to the RELATIVE `/api/r2/upload-direct`
 * and falls back to `XMLHttpRequest`, neither of which exists in Node. It threw
 * `TypeError: Failed to parse URL from /api/r2/upload-direct`, so every server caller
 * kept the inline base64 instead of moving it to R2.
 *
 * The key must match what that route builds for `purpose: "branding"`, i.e.
 * `buildBrandingKey({ orgId })` where orgId is the plan's owner. The owner is read
 * from the DB (not the session) so a session-less caller such as the branding
 * migration produces exactly the same keys as the browser path.
 */
async function uploadBrandingToR2Direct(params: {
  file: File;
  fileName: string;
  clientId: string;
  slot: BrandingSlot;
}): Promise<string | null> {
  const [{ buildBrandingKey, isR2Configured, putObjectBuffer }, { prisma }] =
    await Promise.all([import("@/lib/r2"), import("@/lib/prisma")]);
  if (!isR2Configured()) return null;

  const owner = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { userId: true },
  });
  if (!owner?.userId) return null;

  const key = buildBrandingKey({
    orgId: owner.userId,
    planId: params.clientId,
    slot: params.slot,
    fileName: params.fileName,
  });
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const ok = await putObjectBuffer({
    key,
    body: buffer,
    contentType: params.file.type || "image/png",
  });
  return ok ? key : null;
}

/**
 * Upload a single branding image (data URL or File) to R2 and return the storage key.
 * Returns null if R2 not configured or upload fails.
 *
 * Dispatches on the runtime: the browser keeps using the relay/presigned flow in
 * `uploadFileToR2` (it is CORS-safe there), while the server goes straight to
 * PutObject. Callers do not need to know which one they are.
 */
export async function uploadBrandingToR2(params: {
  dataUrlOrFile: string | File;
  fileName: string;
  clientId: string;
  slot: BrandingSlot;
}): Promise<string | null> {
  const file =
    typeof params.dataUrlOrFile === "string"
      ? dataUrlToFile(params.dataUrlOrFile, params.fileName)
      : params.dataUrlOrFile;

  if (typeof window === "undefined") {
    return uploadBrandingToR2Direct({
      file,
      fileName: params.fileName,
      clientId: params.clientId,
      slot: params.slot,
    });
  }

  const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
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

/** Image-bearing columns on `User`. */
const USER_IMAGE_FIELDS = [
  "advisorLogo",
  "advisorLogoUrl",
  "backgroundImage",
  "headshot",
  "companyLogo",
] as const;

/**
 * Server-side upload for a NON-plan branding image (advisor logo / background /
 * headshot). Plan images use `buildBrandingKey`, which is plan-scoped; advisor
 * images belong to the user, so they land under `uploads/advisor-branding`.
 */
async function uploadUserImageToR2Direct(params: {
  dataUrl: string;
  userId: string;
  fileName: string;
}): Promise<string | null> {
  const { buildUploadKey, isR2Configured, putObjectBuffer } = await import(
    "@/lib/r2"
  );
  if (!isR2Configured()) return null;

  const file = dataUrlToFile(params.dataUrl, params.fileName);
  const key = buildUploadKey({
    orgId: params.userId,
    subPath: "advisor-branding",
    fileName: params.fileName,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const ok = await putObjectBuffer({
    key,
    body: buffer,
    contentType: file.type || "image/png",
  });
  return ok ? key : null;
}

/**
 * Replace inline (data-URL) advisor images on a `User` payload with R2 keys.
 *
 * `User` rows carry the advisor logo and background inline — measured at 2.72 MB
 * for a single advisor (2.17 MB `backgroundImage` + 280 KB logo). `/api/profile`
 * returns the whole row with no `select`, and the benefits wizard fetches that
 * profile several times per visit, so every one of those readers pays for those
 * inline bytes.
 *
 * `advisorLogo` and `advisorLogoUrl` historically receive the SAME value (see the
 * settings branding save), which is why the measurement shows the logo twice.
 * Identical data URLs are therefore uploaded ONCE and both fields are pointed at
 * the same key — every reader keeps working (both are read, e.g. in
 * `flyer-brand.ts` and `step-3-key-contacts.tsx`) while the storage halves.
 *
 * Returns a new object; the input is never mutated. Values that fail to upload are
 * left inline rather than dropped, and anything that is not a data URL (an R2 key
 * or a remote URL) passes through untouched. No-ops without a userId, since the
 * key needs an owner.
 */
export async function normalizeUserImagesToR2<T extends object>(
  data: T,
  userId: string,
): Promise<T> {
  if (!data || typeof data !== "object") return data;
  if (!userId) return data;

  let next: Record<string, unknown> | null = null;
  const uploaded = new Map<string, string | null>();

  for (const field of USER_IMAGE_FIELDS) {
    const value = (data as Record<string, unknown>)[field];
    if (typeof value !== "string" || !value.startsWith("data:")) continue;

    if (!uploaded.has(value)) {
      uploaded.set(
        value,
        await uploadUserImageToR2Direct({
          dataUrl: value,
          userId,
          fileName: `${field}.png`,
        }),
      );
    }
    const key = uploaded.get(value);
    if (!key) continue;

    if (!next) next = { ...(data as Record<string, unknown>) };
    next[field] = key;
  }

  return (next ?? data) as T;
}
