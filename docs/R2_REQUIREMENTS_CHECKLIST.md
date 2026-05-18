# R2 Implementation Requirements — Checklist

Reference: *Move all PDFs/images to R2, direct-to-R2 uploads via signed URLs, store only metadata + key in DB, reads via signed URLs (Public Access off).*

---

## 1. Move all PDFs/images to R2 — do not store files on the app server

| Area | Status | Notes |
|------|--------|--------|
| **Plan documents (wizard Step 4)** | Done | Client uses `uploadFileToR2()` → presign → PUT to R2 → only `storageKey` saved. Used when `clientId` (draftClientId) is set. |
| **Document create (JSON)** | Done | `POST /api/documents` accepts `storageKey` + metadata; creates record with `fileUrl: "r2:stored"` and `storageKey`. No file body. |
| **Document update (JSON)** | Done | `PATCH /api/documents/[id]` accepts `storageKey`; updates record. No file body. |
| **Branding (wizard)** | Done | At completion (`complete-v2`), base64 branding is uploaded to R2 server-side via `putObjectBuffer`; Client stores only keys. Company-basics API accepts R2 keys as-is. |
| **Marketing save-pdf** | Done | Accepts either `pdfBase64` or `storageKey`; when `storageKey`, creates document with R2 only. |
| **Clients create** | Done | Accepts `spdStorageKey`, SBC/optional items with `storageKey`; creates documents with R2 keys when provided. |
| **Save-draft / complete-v2 / optional-documents** | Done | All accept and persist `storageKey` for documents; create Document rows with `fileUrl: "r2:stored"`. |
| **Legacy FormData document uploads** | Still available | `POST /api/documents` (FormData) and `PATCH /api/documents/[id]` (FormData) still accept file → base64 and store in DB. Used as fallback when R2 is not used. To fully meet “do not store files on app server”, these could be deprecated or restricted to admin-only. |

**Summary:** All primary flows (wizard documents, branding, marketing save-pdf, clients create) support and prefer R2; only metadata + key stored. Legacy FormData paths still allow base64 through the server for backward compatibility.

---

## 2. Direct-to-R2 uploads via signed URLs (client uploads straight to R2)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Presigned PUT URL | Done | `POST /api/r2/presign-upload` returns `{ uploadUrl, key }`. |
| Client PUT to R2 | Done | `lib/upload-to-r2.ts` → `uploadFileToR2()`: calls presign, then `fetch(uploadUrl, { method: 'PUT', body: file })`. |
| Store only metadata + key in DB | Done | Documents: `storageKey` + `fileUrl: "r2:stored"`. Branding: `companyLogo`, `backgroundImg`, `thumbnailImg`, etc. store the key string (`org/...`). |

---

## 3. Reads via signed URLs (Public Access stays disabled)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Document view | Done | `GET /api/documents/[id]/view`: if `document.storageKey` set → `getPresignedReadUrl()` → redirect to signed URL. Else legacy: serve from `fileUrl` (base64). |
| Generic signed read URL | Done | `GET /api/r2/signed-url?key=...` returns `{ url }` (short-lived). Auth required; key must start with `org/{userId}/`. |
| Branding images | Done | `useBrandingImageUrl()` / `<BrandingImage>` and portal components resolve R2 keys via `/api/r2/signed-url` and use returned URL for `<img src>`. |

---

## 4. Env vars (Vercel Preview + Production)

| Variable | Status | Where |
|----------|--------|--------|
| `R2_BUCKET` | Used | `constants/app.ts`, `lib/r2.ts`. |
| `R2_ENDPOINT` | Used | `constants/app.ts`, `lib/r2.ts`. |
| `R2_ACCESS_KEY_ID` | Used | `constants/app.ts`, `lib/r2.ts`. |
| `R2_SECRET_ACCESS_KEY` | Used | `constants/app.ts`, `lib/r2.ts`. |

**Action:** Set all four in Vercel (Preview + Production) and in local `.env`. See `docs/R2_INTEGRATION.md` §1.

---

## 5. Key structure and categories

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Key structure | Done | `lib/r2.ts`: `buildDocumentKey()` → `org/{orgId}/plans/{planId}/documents/{category}/{id}-{fileName}`. |
| Branding keys | Done | `buildBrandingKey()` → `org/{orgId}/plans/{planId}/branding/{slot}/{id}-{fileName}`. |
| Canonical categories | Done | `R2_DOCUMENT_CATEGORIES = ["retirement", "group-health", "group-life", "other"]`; `toCanonicalCategory()` normalizes input. |

---

## 6. Server capacity / “plans not saved” — file transfer off app server

| Goal | Status |
|------|--------|
| Document uploads (wizard Step 4, edit doc) | Met when R2 + CORS are configured: file goes client → R2 only; server only handles presign and metadata. |
| Branding at wizard completion | Met: base64 is sent once to server, which uploads to R2 and stores keys; no ongoing file serving from server. |
| Document viewing | Met for R2-backed docs: server returns redirect to signed URL; no file stream through app server. |
| Legacy FormData flows | Still send file through server; to fully eliminate, use R2-only flows everywhere or deprecate FormData. |

---

## 7. CORS (browser uploads)

| Requirement | Status |
|-------------|--------|
| Bucket CORS | **You must configure** in Cloudflare R2 bucket (e.g. `plantelligence-assets`) → Settings → CORS: allow your app origins (e.g. `http://localhost:3000`, production domain), methods `GET`, `PUT`, `HEAD`, and header `Content-Type`. See `docs/R2_INTEGRATION.md` §7. |

---

## 8. MVP Scope & Acceptance Criteria (66–72)

### Scope (exact wording)

- **R2 for All File Types:** PDFs, plan docs, branding assets (logos, headshots, hero images), generated flyers (PDF/PNG).
- **Direct-to-R2 Uploads:** Via pre-signed URLs. No file storage or streaming through the app server.
- **Secure Access:** Signed URLs for all preview and download. R2 Public Access remains disabled.
- **File Size Limit Removal:** Remove the 10MB limit across both UI and backend validation.
- **Metadata Only in DB:** Database stores only file metadata and object key/URL. No binary blobs.
- **Object Key Naming:** Consistent, deterministic naming by org/plan/category.

### Scope checklist (implementation)

| Scope item | Status | Notes |
|------------|--------|--------|
| R2 for all file types (PDFs, plan docs, branding, flyers) | Done | Documents: presign → PUT; branding (logos, hero, thumbnail, etc.): complete-v2 / company-basics with R2 keys; marketing save-pdf / generated flyers: `storageKey`. Key contact headshots: stored in Client JSON (base64 or URL); can use same R2 key pattern if UI sends `org/` keys. |
| Direct-to-R2 via presigned URLs | Done | Documents: client PUTs to R2; no file through app server. Branding at completion: one-time server upload to R2; company-basics accepts R2 keys for direct-to-R2 flows. |
| Secure access: signed URLs only, public off | Done | `getPresignedReadUrl` for document view; `/api/r2/signed-url` for branding/images. |
| File size limit removal (10MB) | Done | Removed from: `documents-upload-section`, `document-edit-modal`, `retirement-documents-accordion`, `compliance-documents-section`, `company-logo-section`, `new-client-wizard-validation`; branding components use 100MB cap. |
| Metadata only in DB | Done | Documents: `storageKey` + `fileUrl: "r2:stored"`; branding: key strings in Client (no binary blobs). |
| Object key naming (org/plan/category) | Done | `buildDocumentKey`, `buildBrandingKey`, `buildUploadKey` in `lib/r2.ts` (org/planId/documents|branding|uploads/...). |

### Acceptance criteria

| AC | Description | Implementation / how to verify |
|----|-------------|--------------------------------|
| **66** | Upload PDF under and over 10MB (e.g. 25MB): both save, preview, download | No size check in wizard doc upload or edit flows; presign accepts any size. **Test:** Upload &lt;10MB and 25MB PDF in Step 4 and in document edit; confirm save, preview, and download. |
| **67** | Logo and headshot: save and render in all app contexts | R2 keys stored in Client; `<BrandingImage>` / `useBrandingImageUrl` used in wizard preview and portal (header, hero, mission, benefits, welcome banner). **Test:** Upload logo/headshot in wizard and company basics; confirm in preview and portal. |
| **68** | Files plan-scoped; two-plan isolation | Keys include `org/{orgId}/plans/{planId}/...`; API enforces `clientId` and `userId`. **Test:** Two plans; upload doc in A, confirm not visible in B and key in R2 under plan A. |
| **69** | No payload-size errors with large file upload | File not sent through app server (direct PUT to R2). **Test:** Upload large PDF (e.g. 25MB); no 413 or body-size errors. |
| **70** | Object keys follow naming convention | `org/{orgId}/plans/{planId}/documents/{category}/{id}-{fileName}`; branding: `.../branding/{slot}/...`. **Test:** Spot-check 5 objects in R2 console. |
| **71** | Rapid simultaneous uploads: UI handles async, no freeze or orphaned spinners | Single `isUploading` overlay in `documents-upload-section`; uploads processed in sequence. **Test:** Drop multiple files; confirm one overlay, no stuck spinners. |
| **72** | Expired signed URL shows appropriate error, not broken image | `<BrandingImage>`: onError refetches signed URL once; if still failing shows “Image unavailable”. Document view: each request issues fresh redirect URL; bookmarking the redirect URL can expire after 1h — use app’s view link. **Test:** (Branding) Simulate expiry or block image URL; confirm “Image unavailable” or recovery after refetch. |

---

## Summary

- **Direct-to-R2 uploads:** Implemented (presign-upload, `uploadFileToR2`, documents + branding + marketing + clients create/store keys only).
- **Reads via signed URLs:** Implemented (documents view, `/api/r2/signed-url`, branding resolution).
- **File size limit:** 10MB limit removed from R2 document and branding flows (UI and validation).
- **Expired URL handling (AC72):** Branding images refetch once on load error and show “Image unavailable” if still failing.
- **Env vars:** Code reads all four; set them in Vercel and `.env`.
- **Key structure and categories:** Implemented as specified.
- **Remaining:** (1) Set env vars in Vercel and locally; (2) Configure CORS on the R2 bucket for browser uploads; (3) optionally deprecate or limit legacy FormData document uploads if you want to strictly avoid any file transfer through the app server.
