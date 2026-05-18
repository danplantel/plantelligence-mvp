# R2 Implementation Requirements — Compliance Checklist

This document maps the stated implementation requirements to the current codebase.

---

## 1. Move all PDFs/images to R2 — do not store files on the app server

| Area | Status | Notes |
|------|--------|------|
| **Plan documents** | ✅ | Upload: client gets presigned PUT from `/api/r2/presign-upload`, PUTs file directly to R2; API stores only `storageKey` + metadata via `POST /api/documents` (JSON). No file body through app server. |
| **Branding images** | ✅ | Same flow: presign → client PUT to R2; keys stored in client/plan (e.g. `brandImages`, legacy fields). `complete-v2` uploads any base64 from wizard to R2 via `putObjectBuffer` and stores keys. |
| **Generated assets** | ✅ | R2 keys used for uploads; no file storage on app server. |
| **Legacy** | ⚠️ | Old documents/images may still have base64 in DB. New flows use R2 only. When R2 is configured, `POST /api/documents` and `PATCH /api/documents/[id]` reject FormData and require JSON + `storageKey`. |

---

## 2. Direct-to-R2 uploads via signed URLs; store only metadata + key in DB

| Item | Status | Location |
|------|--------|----------|
| Presigned PUT | ✅ | `lib/r2.ts` — `getPresignedUploadUrl()`; `app/api/r2/presign-upload/route.ts` returns `{ uploadUrl, key }`. |
| Client uploads straight to R2 | ✅ | `lib/upload-to-r2.ts` — `uploadFileToR2()`: POST presign → PUT file to `uploadUrl` (no file to app). |
| Store only metadata + key | ✅ | `POST /api/documents` (JSON): `clientId`, `storageKey`, `fileName`, `title`, `type`, `category`, etc.; DB has `fileUrl: "r2:stored"` and `storageKey`. No file bytes in DB for R2 flow. |

---

## 3. For reads — use signed URLs (Public Access disabled)

| Item | Status | Location |
|------|--------|----------|
| Document view | ✅ | `app/api/documents/[id]/view/route.ts`: if `document.storageKey` → `getPresignedReadUrl()` → 302 redirect to signed URL. No file stream through app. |
| Branding / images | ✅ | `lib/branding-image-url.ts`, `GET /api/r2/signed-url?key=...`: resolve R2 key to signed GET URL. |
| Public access | ✅ | No public bucket URLs; all reads via short-lived signed URLs from `getPresignedReadUrl()`. |

---

## 4. Env vars (Vercel Preview + Production)

| Variable | Status | Usage |
|----------|--------|--------|
| `R2_BUCKET` | ✅ | `constants/app.ts` → `lib/r2.ts` (S3Client, PutObject, GetObject, DeleteObject). |
| `R2_ENDPOINT` | ✅ | S3 client endpoint (e.g. `https://<account>.r2.cloudflarestorage.com`). |
| `R2_ACCESS_KEY_ID` | ✅ | S3 client credentials. |
| `R2_SECRET_ACCESS_KEY` | ✅ | S3 client credentials. |

Set these in Vercel for Preview and Production so R2 is used in all environments.

---

## 5. Key structure (organized)

| Requirement | Status | Location |
|-------------|--------|----------|
| `org/{orgId}/plans/{planId}/documents/{category}/...` | ✅ | `lib/r2.ts`: `buildDocumentKey({ orgId, planId, category, fileName })` → `org/{orgId}/plans/{planId}/documents/{category}/{id}-{safeName}`. |
| Branding | ✅ | `buildBrandingKey()` → `org/{orgId}/plans/{planId}/branding/{slot}/...`. |
| Other uploads | ✅ | `buildUploadKey()` → `org/{orgId}/uploads/{subPath}/...`. |
| Categories canonical | ✅ | `R2_DOCUMENT_CATEGORIES = ["retirement", "group-health", "group-life", "other"]`; `toCanonicalCategory()` normalizes (e.g. "Group Health" → `group-health`). |

`orgId` is taken from `session.user.id` in presign; `planId` is the client/plan id.

---

## 6. Benefit: server capacity / “plans not saved”

- File transfer is off the app server: upload (presign → PUT to R2) and read (redirect to signed URL) do not stream file bytes through the app.
- Only metadata and object keys are stored in the DB and sent over the app; this reduces server load and avoids large request/response bodies that could cause timeouts or “plans not saved” issues.

---

## Summary

The implementation **meets** the requirements:

1. PDFs/images and plan docs use R2; new flows do not store files on the app server.
2. Uploads are direct-to-R2 via signed URLs; DB stores only metadata + `storageKey`.
3. Reads use signed URLs; public access is not used.
4. Env vars are read from `process.env` and should be set in Vercel.
5. Key structure is `org/{orgId}/plans/{planId}/documents/{category}/...` with canonical categories: `retirement`, `group-health`, `group-life`, `other`.
