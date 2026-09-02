import { toR2BrandingKey } from "@/lib/branding-image-url";
import { verifyR2ObjectReadableViaApp } from "@/lib/r2-read-verify";

/** Server-side PutObject fallback (same bucket as /api/r2/object) for small advisor uploads. */
const MAX_SERVER_FALLBACK_BYTES = 15 * 1024 * 1024;

/** Server-side (same-origin) upload — no browser→R2 CORS preflight. */
async function uploadThroughAppServer(
  file: File,
  params: {
    purpose: PresignPurpose;
    subPath?: string;
    clientId?: string;
    fileName: string;
    contentType: string;
    slot?: string;
    category?: string;
    type?: string;
  },
): Promise<string | null> {
  if (file.size > MAX_SERVER_FALLBACK_BYTES) return null;
  const form = new FormData();
  form.append("file", file);
  form.append("fileName", params.fileName);
  form.append("contentType", params.contentType);
  form.append("purpose", params.purpose);
  if (params.subPath?.trim()) form.append("subPath", params.subPath.trim());
  if (params.clientId) form.append("clientId", params.clientId);
  if (params.slot) form.append("slot", params.slot);
  if (params.category) form.append("category", params.category);
  if (params.type) form.append("type", params.type);
  const res = await fetch("/api/r2/upload-direct", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[upload-to-r2] Server upload failed", res.status, text);
    return null;
  }
  const data = (await res.json()) as { key?: string };
  return data.key ?? null;
}

/**
 * Client-side helper: upload a file directly to R2 using a presigned URL.
 * Use this instead of sending file bytes to the app server.
 *
 * Flow: 1) POST /api/r2/presign-upload → { uploadUrl, key }
 *       2) PUT file to uploadUrl (with Content-Type)
 *       3) Return key for the API to store in DB
 */

export type PresignPurpose = "document" | "branding" | "upload";

export interface UploadToR2Options {
  file: File;
  purpose: PresignPurpose;
  clientId?: string;
  fileName?: string;
  category?: string;
  type?: string;
  slot?: string;
  subPath?: string;
  /** Fired during PUT to presigned URL (bytes sent / total). */
  onProgress?: (loaded: number, total: number) => void;
}

function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(ev.loaded, ev.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}

/**
 * Upload file to R2 via presigned URL. Returns the storage key on success, null on failure or if R2 is not configured.
 */
export async function uploadFileToR2(options: UploadToR2Options): Promise<string | null> {
  const {
    file,
    purpose,
    clientId,
    fileName = file.name,
    category,
    type,
    slot,
    subPath,
    onProgress,
  } = options;

  const contentType = file.type || "application/pdf";

  // Branding images (logo/background/thumbnail/banner/favicon) are uploaded
  // through the SAME-ORIGIN server route. A direct browser PUT to the R2
  // presigned URL is cross-origin and gets blocked by the bucket CORS policy
  // (e.g. on www.plantel.pro), which silently broke every background/logo upload.
  if (purpose === "branding") {
    const viaServer = await uploadThroughAppServer(file, {
      purpose,
      clientId,
      fileName,
      contentType,
      slot,
    });
    if (viaServer) return viaServer;
    // Server upload unavailable (e.g. R2 not configured, body too large) — fall
    // through to the presigned flow below, which returns null on a 503.
  }

  const presignRes = await fetch("/api/r2/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      clientId,
      fileName,
      contentType,
      category,
      type,
      slot,
      subPath,
    }),
  });

  if (!presignRes.ok) {
    if (presignRes.status === 503) {
      console.warn("[upload-to-r2] R2 not configured, use legacy upload");
      return null;
    }
    const err = await presignRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Presign failed: ${presignRes.status}`);
  }

  const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };
  if (!uploadUrl || !key) {
    console.error("[upload-to-r2] Missing uploadUrl or key in response");
    return null;
  }

  let putOk = false;
  try {
    await putFileToPresignedUrl(uploadUrl, file, contentType, onProgress);
    putOk = true;
  } catch (xhrErr) {
    console.warn("[upload-to-r2] XHR PUT failed, trying fetch", xhrErr);
  }

  if (!putOk) {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": contentType,
      },
    });

    if (!putRes.ok) {
      const errBody = await putRes.text().catch(() => "");
      console.error("[upload-to-r2] PUT failed", putRes.status, errBody);
      if (file.size <= MAX_SERVER_FALLBACK_BYTES) {
        const viaServer = await uploadThroughAppServer(file, {
          purpose,
          subPath,
          clientId,
          fileName,
          contentType,
          slot,
          category,
          type,
        });
        if (viaServer) return viaServer;
      }
      throw new Error(`Upload to R2 failed: ${putRes.status}`);
    }
    putOk = true;
  }

  if (
    purpose === "upload" &&
    file.size <= MAX_SERVER_FALLBACK_BYTES
  ) {
    const readable = await verifyR2ObjectReadableViaApp(key);
    if (!readable) {
      console.warn(
        "[upload-to-r2] Presigned PUT ok but object not readable; using server upload",
        key,
      );
      const viaServer = await uploadThroughAppServer(file, {
        purpose,
        subPath,
        clientId,
        fileName,
        contentType,
        slot,
        category,
        type,
      });
      if (viaServer) return viaServer;
    }
  }

  return key;
}

/**
 * Delete an object from R2 by key (client-side). Call when user removes logo/headshot so the file is removed from Cloudflare.
 * Returns true if delete succeeded or R2 not configured; false on API error.
 */
export async function deleteFromR2(key: string | null | undefined): Promise<boolean> {
  const canonical = toR2BrandingKey(key);
  if (!canonical) return true;
  try {
    const res = await fetch("/api/r2/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: canonical }),
      credentials: "include",
    });
    if (res.status === 503) return true; // R2 not configured, nothing to delete
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}
