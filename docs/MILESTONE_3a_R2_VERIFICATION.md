# Milestone 3a — Cloudflare R2 Storage Layer — Verification Report

**Scope:** PDFs, images, branding assets, generated flyers. Video excluded in MVP.

---

## Acceptance criteria — code verification

### 1. Upload PDF under 10MB and over 10MB (e.g. 25MB): both save, preview, and download reliably

| Check | Status | Evidence |
|-------|--------|----------|
| No 10MB limit in wizard document upload | **PASS** | `documents-upload-section.tsx`: `validateFile()` only checks `ALLOWED_FILE_TYPES` (PDF/Word); no `file.size` check. |
| No 10MB limit in document edit modal | **PASS** | `document-edit-modal.tsx`: `handleFileSelect` validates type only; no size validation. |
| Presign API accepts any size | **PASS** | `app/api/r2/presign-upload/route.ts`: JSON body only; no size validation. Client PUTs file directly to R2. |
| Save/preview/download path | **PASS** | R2 docs use `storageKey` → `GET /api/documents/[id]/view` redirects to signed URL; download uses same view or signed-url. |

**Manual test:** Upload a PDF &lt;10MB and one ~25MB in Step 4 (Documents) and in document edit; confirm both save, open in preview, and download.

---

### 2. Upload a logo and headshot: save and render consistently across all app contexts

| Check | Status | Evidence |
|-------|--------|----------|
| Logo stored as R2 key | **PASS** | `buildBrandingKey()` in `lib/r2.ts`; wizard completion uses `putObjectBuffer`; Client stores keys in `companyLogo`, etc. |
| Logo/headshot read via signed URL | **PASS** | `useBrandingImageUrl()` / `<BrandingImage>` resolve R2 keys via `GET /api/r2/signed-url`. |
| Company logo section | **PASS** | `company-logo-section.tsx`, `company-logo-card.tsx` use `maxFileSize={100}` (MB); no 10MB cap. |
| Headshot (key contacts) | **PASS** | Stored in client/contact data; can be base64 or R2 key; branding image resolution used where keys are used. |

**Manual test:** Upload logo and headshot in wizard and company basics; confirm they render in preview and portal (header, hero, mission, benefits, welcome).

---

### 3. Files are plan-scoped. Two-plan isolation test

| Check | Status | Evidence |
|-------|--------|----------|
| Document keys include planId | **PASS** | `buildDocumentKey({ orgId, planId: clientId, category, fileName })` → `org/{orgId}/plans/{planId}/documents/...`. |
| Branding keys include planId | **PASS** | `buildBrandingKey({ orgId, planId: clientId, slot, fileName })` → `org/{orgId}/plans/{planId}/branding/...`. |
| Document list filtered by client | **PASS** | `app/api/documents/route.ts` GET: `whereClause.clientId = clientId` when provided; `client.userId = session.user.id`. |
| Presign requires client ownership | **PASS** | `app/api/r2/presign-upload/route.ts`: for document/branding, `prisma.client.findFirst({ where: { id: clientId, userId: orgId } })`. |
| Signed URL restricted by org | **PASS** | `app/api/r2/signed-url/route.ts`: key must start with `org/${session.user.id}/`. |

**Manual test:** Create two plans; upload a document in Plan A; confirm it does not appear in Plan B’s document list and R2 key is under plan A path.

---

### 4. No payload-size errors from file transfers. Large file upload test

| Check | Status | Evidence |
|-------|--------|----------|
| File not sent through app server | **PASS** | Presign returns URL; client `fetch(uploadUrl, { method: 'PUT', body: file })` in `lib/upload-to-r2.ts`. |
| Presign request is JSON only | **PASS** | `POST /api/r2/presign-upload` body: `{ purpose, clientId, fileName, contentType, category?, slot? }` — no file body. |
| No bodyParser / 413 risk for R2 uploads | **PASS** | No file in request; no need to increase payload limits for R2 document/branding uploads. |

**Manual test:** Upload a large PDF (e.g. 25MB) in Step 4 or document edit; confirm no 413 or “payload too large” errors.

---

### 5. Object keys follow naming convention. Spot-check 5 files in R2 console

| Convention | Implementation |
|------------|----------------|
| Documents | `org/{orgId}/plans/{planId}/documents/{category}/{id}-{sanitizedFileName}` — `lib/r2.ts` `buildDocumentKey()`. |
| Branding | `org/{orgId}/plans/{planId}/branding/{slot}/{id}-{sanitizedFileName}` — `buildBrandingKey()`. |
| General uploads | `org/{orgId}/uploads/{subPath}/{id}-{sanitizedFileName}` — `buildUploadKey()`. |
| Categories | Canonical: `retirement`, `group-health`, `group-life`, `other` — `toCanonicalCategory()`. |

**Manual test:** After uploading 2–3 documents and 2 branding assets, open R2 bucket in Cloudflare console and confirm 5 keys match the patterns above.

---

### 6. Rapid simultaneous uploads: UI handles async loading states gracefully without freezing or orphaned spinners

| Check | Status | Evidence |
|-------|--------|----------|
| Single batch overlay | **PASS** | `documents-upload-section.tsx`: `isUploading` state; `<LoadingOverlay show={isUploading} />`; no per-file spinner that can orphan. |
| Sequential processing | **PASS** | `addDocumentsFromFiles()` uses `for (const file of validFiles)` with `await uploadFileToR2(...)`; one overlay for entire batch. |
| Reset on completion/error | **PASS** | `setIsUploading(false)` in `finally`; no separate “stuck” state. |

**Manual test:** Drop multiple files at once in Step 4; confirm one overlay during upload and it disappears when done; no frozen UI or leftover spinners.

---

### 7. Expired signed URL returns an appropriate error, not a broken image

| Context | Status | Evidence |
|---------|--------|----------|
| Branding images | **PASS** | `components/ui/branding-image.tsx`: `onError` → refetch once via `refetch()`; if still failing, show “Image unavailable” (not broken image). Comment references AC72. |
| Document preview (iframe) | **PASS** | `components/ui/document-preview-modal.tsx`: iframe `onError` → `setLoadingError(true)`; UI shows “Something’s missing” / “document doesn’t exist or has been moved” with Go back / Download. |
| Signed URL endpoint | **PASS** | Each view request gets a fresh signed URL (document view redirect; signed-url returns new URL). Expiry is per-URL (e.g. 1h read). |

**Manual test:** (Branding) Block image or wait for expiry; confirm “Image unavailable” or recovery after refetch. (Document) Open view link, then use an old redirect URL after expiry; confirm error message instead of blank/broken content.

---

## Scope checklist (implementation)

| Scope item | Status |
|------------|--------|
| R2 for all file types (PDFs, plan docs, branding, flyers) | **Done** — presign + PUT for documents; branding keys at completion; marketing save-pdf / clients create accept `storageKey`. |
| Direct-to-R2 uploads via presigned URLs | **Done** — client PUTs to R2; server only returns presign and stores metadata. |
| Secure access: signed URLs only, public off | **Done** — no public bucket access; read via `getPresignedReadUrl` and `/api/r2/signed-url`. |
| File size limit removal (10MB) | **Done** — no size check in documents-upload-section, document-edit-modal, or presign; branding uses 100MB where applicable. |
| Metadata only in DB | **Done** — Document: `storageKey` + `fileUrl: "r2:stored"`; branding: key strings in Client. |
| Object key naming (org/plan/category) | **Done** — `buildDocumentKey`, `buildBrandingKey`, `buildUploadKey` in `lib/r2.ts`. |

---

## Summary

- **All 7 acceptance criteria** are satisfied by the current implementation, with manual tests recommended as above.
- **No code changes required** for Milestone 3a acceptance; optional improvement: in document preview modal, add “or the link may have expired” to the error copy for expired signed URLs.
- **Reminders:** Ensure R2 env vars are set in Vercel (Preview + Production) and R2 bucket CORS is configured for your app origins (see `docs/R2_INTEGRATION.md`).
