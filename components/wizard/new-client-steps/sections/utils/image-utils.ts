import { getR2ObjectProxyUrl, toR2BrandingKey } from "@/lib/branding-image-url";

/**
 * Turn a stored brand-image value into something the crop editor can actually load.
 *
 * A persisted brand image is an R2 KEY (`org/…/uploads/branding/…`). Neither `<img>`
 * nor Fabric can load a bare key — the browser treats it as a relative path and 404s —
 * so handing the stored value straight to `SimpleImageEditorModal` shows a broken
 * preview and an empty canvas when an existing image is reopened for editing. Anything
 * already loadable (`data:`, `blob:`, `http…`, the `/api/r2/object` proxy) passes
 * through untouched.
 */
export function resolveBrandImageUrl(raw: string | null | undefined): string {
  const value = raw || "";
  if (!value) return "";
  const r2Key = toR2BrandingKey(value);
  if (!r2Key) return value;
  return getR2ObjectProxyUrl(r2Key) ?? value;
}

/**
 * Decode an image URL and re-encode it at its ORIGINAL resolution as a data URL.
 *
 * The crop editors need an uncropped, same-origin source to open against: a remote
 * gallery URL can fail the editor's CORS load, and a pre-cropped or pre-scaled image
 * would take the framing decision away from the advisor. Used by the "add default
 * photo" paths, so the picker hands the cropper the real photo and the user frames
 * the slot's crop themselves before anything is saved.
 */
export function exportFullResolutionImage(
  imageUrl: string,
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.92),
          width: canvas.width,
          height: canvas.height,
        });
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}
