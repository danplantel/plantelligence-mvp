/**
 * Cloudflare R2 (S3-compatible) helpers.
 * - All file storage goes to R2; app server never holds file bodies.
 * - Upload: client gets presigned PUT URL, uploads directly to R2, then API stores metadata + key.
 * - Read: API returns presigned GET URL (Public Access disabled).
 *
 * Key structure: org/{orgId}/plans/{planId}/documents|branding|uploads/{...}
 * Document categories (canonical): retirement, group-health, group-life, other
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  R2_ACCESS_KEY_ID,
  R2_BUCKET,
  R2_ENDPOINT,
  R2_SECRET_ACCESS_KEY,
} from "@/constants/app";

const DEFAULT_SIGNED_URL_EXPIRY_S = 60 * 60; // 1 hour for read; 15 min for upload

function getR2Client(): S3Client | null {
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: "auto", // R2 requires "auto", not us-east-1 etc.
    endpoint: R2_ENDPOINT, // must be https://<account-id>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // required for Cloudflare R2 (path-style requests)
  });
}

/**
 * Upload a buffer directly to R2 (server-side). Use for migrating base64 to R2 (e.g. at wizard completion).
 */
export async function putObjectBuffer(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a presigned PUT URL for direct client upload.
 * Client should PUT the file with Content-Type header set.
 */
export async function getPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; key: string } | null> {
  const client = getR2Client();
  if (!client) return null;

  const expiresIn = params.expiresInSeconds ?? 15 * 60; // 15 min default
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { uploadUrl, key: params.key };
}

/**
 * Generate a presigned GET URL for reading an object (no public access).
 */
export async function getPresignedReadUrl(params: {
  key: string;
  expiresInSeconds?: number;
  responseContentDisposition?: string;
  responseContentType?: string;
}): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const expiresIn = params.expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRY_S;
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    ...(params.responseContentDisposition && {
      ResponseContentDisposition: params.responseContentDisposition,
    }),
    ...(params.responseContentType && {
      ResponseContentType: params.responseContentType,
    }),
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Read object bytes from R2 (server-side). Used by same-origin /api/r2/object for canvas/Fabric.
 */
export async function getObjectFromR2(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  const client = getR2Client();
  if (!client || !R2_BUCKET) return null;
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    );
    if (!res.Body) return null;
    const body = await res.Body.transformToByteArray();
    const contentType = res.ContentType || "application/octet-stream";
    return { body, contentType };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      const err = e as { name?: string; message?: string };
      console.warn("[getObjectFromR2]", key, err?.name ?? "", err?.message ?? e);
    }
    return null;
  }
}

/**
 * Delete an object from R2 by key. Returns true if deleted or key did not exist.
 */
export async function deleteObjectFromR2(key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function isR2Configured(): boolean {
  return !!(R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

/** Placeholder for Document.fileUrl when file is stored in R2 (so list UIs still treat doc as having a file). */
export const R2_FILEURL_PLACEHOLDER = "r2:stored";

/** Canonical document categories for key structure (order/labels). */
export const R2_DOCUMENT_CATEGORIES = [
  "retirement",
  "group-health",
  "group-life",
  "other",
] as const;

export type R2DocumentCategory = (typeof R2_DOCUMENT_CATEGORIES)[number];

const DISPLAY_TO_CANONICAL: Record<string, R2DocumentCategory> = {
  retirement: "retirement",
  "group health": "group-health",
  "group-health": "group-health",
  grouphealth: "group-health",
  "group life": "group-life",
  "group-life": "group-life",
  grouplife: "group-life",
  other: "other",
  "other benefits": "other",
};

export function toCanonicalCategory(category: string | null | undefined): R2DocumentCategory {
  if (!category || !category.trim()) return "other";
  const normalized = category.toLowerCase().trim().replace(/\s+/g, " ");
  return DISPLAY_TO_CANONICAL[normalized] ?? "other";
}

/**
 * Build R2 object key for plan documents.
 * org/{orgId}/plans/{planId}/documents/{category}/{timestamp}-{sanitizedFileName}
 */
export function buildDocumentKey(params: {
  orgId: string;
  planId: string;
  category: R2DocumentCategory;
  fileName: string;
  uniqueId?: string;
}): string {
  const safeName = params.fileName.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "file";
  const id = params.uniqueId ?? Date.now();
  return `org/${params.orgId}/plans/${params.planId}/documents/${params.category}/${id}-${safeName}`;
}

/**
 * Build R2 object key for branding assets (logo, background, thumbnail, etc.).
 * org/{orgId}/plans/{planId}/branding/{slot}/{timestamp}-{sanitizedFileName}
 */
export function buildBrandingKey(params: {
  orgId: string;
  planId: string;
  slot: string;
  fileName: string;
  uniqueId?: string;
}): string {
  const safeName = params.fileName.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "file";
  const id = params.uniqueId ?? Date.now();
  return `org/${params.orgId}/plans/${params.planId}/branding/${params.slot}/${id}-${safeName}`;
}

/**
 * Build R2 object key for general uploads (e.g. template images, marketing assets).
 * org/{orgId}/uploads/{subPath}/{timestamp}-{sanitizedFileName}
 */
export function buildUploadKey(params: {
  orgId: string;
  subPath: string;
  fileName: string;
  uniqueId?: string;
}): string {
  const safeName = params.fileName.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "file";
  const id = params.uniqueId ?? Date.now();
  return `org/${params.orgId}/uploads/${params.subPath}/${id}-${safeName}`;
}

/**
 * Marketing flyer outputs (PDF + PNG) — plan-scoped under org (userId).
 * org/{orgId}/plans/{planId}/marketing/flyers/{flyerId}/{variant}.pdf|png
 */
export function buildMarketingFlyerAssetKey(params: {
  orgId: string;
  planId: string;
  flyerId: string;
  variant: "pdf" | "png";
}): string {
  const ext = params.variant === "pdf" ? "pdf" : "png";
  return `org/${params.orgId}/plans/${params.planId}/marketing/flyers/${params.flyerId}/flyer.${ext}`;
}
