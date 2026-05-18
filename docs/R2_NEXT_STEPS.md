# R2 Implementation — Status & Next Steps

Checked against your 7-step plan and the implementation requirements. **Step-by-step** actions at the end.

---

## Implementation status (requirements checklist)

### 1. Infra & R2 client — **DONE**

- **Env:** `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in `constants/app.ts` and `lib/r2.ts`. Local `.env` has them; **set same in Vercel (Preview + Production)**.
- **AWS SDK (S3-compatible):** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` in `lib/r2.ts` with `region: "auto"`, `forcePathStyle: true`, correct endpoint.
- **Helpers:** `getPresignedUploadUrl()`, `getPresignedReadUrl()`, `putObjectBuffer()`, `isR2Configured()`, `buildDocumentKey()`, `buildBrandingKey()`, `buildUploadKey()`, `toCanonicalCategory()`, `R2_DOCUMENT_CATEGORIES` = `retirement`, `group-health`, `group-life`, `other`.

### 2. API for signed URL — **DONE**

- **Upload:** `POST /api/r2/presign-upload` → `{ uploadUrl, key }` (purpose: document | branding | upload; document requires clientId + category; branding clientId + slot).
- **After upload:** Client stores only key; document APIs accept `storageKey` and set `fileUrl: "r2:stored"`.
- **Key structure:** `org/{orgId}/plans/{planId}/documents/{category}/...` and branding `.../branding/{slot}/...`.

### 3. Documents (plan docs) — **MOSTLY DONE, 2 GAPS**

- **Wizard Step 4** (`documents-upload-section.tsx`): Uses `uploadFileToR2()` when `clientId` is set; stores `storageKey`; fallback base64 when no clientId or R2 fails. **Done.**
- **New documents page** (`app/new/documents/page.tsx`): Uses `uploadFileToR2`. **Done.**
- **ComplianceDocumentsUpload:** Preview href uses `/api/documents/[id]/view` for DB docs and `/api/r2/signed-url?key=...&redirect=1` when doc has `storageKey`. **Done.**
- **handleManualSave** (optional-documents): Sends `storageKey` in `optionalFiles` when present. **Done.**

**Gaps:**

1. **Inline edit with new file (Documents tab)**  
   In `compliance-documents-upload.tsx`, `handleSaveInlineEdit` always converts the new file to base64 and never calls `uploadFileToR2`. When `clientId` is set, it should: get presigned URL → PUT to R2 → store `storageKey` + `file: "r2:stored"` in state (so manual/auto-save sends `storageKey` to optional-documents).

2. **Edit-client compliance section (SPD + “Replace file”)**  
   In `compliance-documents-section.tsx`, SPD upload (`handleSPDFileUpload`) and the “Replace File” DragDropUpload use `fileToBase64` only. When this page has a `clientId` (plan context), these should use R2: `uploadFileToR2` → store key (and pass through to whatever save API that section uses).

### 4. Branding / images — **DONE (with one optional improvement)**

- **Hero, thumbnail, logo, client branding:** Stored as R2 keys; at wizard completion, base64 is uploaded to R2 server-side (`putObjectBuffer`) and client record gets keys. Company-basics accepts R2 keys. **Done.**
- **Read:** `useBrandingImageUrl()` / `<BrandingImage>` resolve keys via `GET /api/r2/signed-url`. **Done.**
- **Optional:** Wizard/company-logo-section still sends base64 to server (server then uploads to R2). You could add direct-to-R2 upload for logo (presign → PUT → save key) to avoid sending large base64 to the app server at all.

### 5. Reading from R2 — **DONE**

- **Document view:** `GET /api/documents/[id]/view` uses `getPresignedReadUrl()` when `document.storageKey` is set and redirects to signed URL; otherwise serves legacy base64 from `fileUrl`. **Done.**
- **Generic read:** `GET /api/r2/signed-url?key=...` returns `{ url }` or redirect; auth required; key must start with `org/{userId}/`. **Done.**
- **Branding:** All display paths use signed URLs via hook/component. **Done.**

### 6. DB and migration — **DONE**

- **Schema:** Documents use `storageKey` + `fileUrl: "r2:stored"` for R2; legacy rows keep base64 in `fileUrl`.
- **Strategy:** Read-through: view route uses `storageKey` → signed URL when present; else uses `fileUrl` (base64). No mandatory migration; optional: background job to copy base64 docs to R2 and set `storageKey` + `fileUrl: "r2:stored"`.

### 7. Tests and edge cases — **MANUAL SO FAR**

- Checklist describes manual tests (large PDF, logo/headshot, two-plan isolation, no 413, key naming, simultaneous uploads, expired URL). **Action:** Run these in Preview/Production; add automated tests if desired.

---

## Other code paths (not yet on R2)

These still use **S3** via `POST /api/files/upload` (not R2):

- `components/pages/create-dashboard/index.tsx`
- `components/pages/plan-update-dashboard/index.tsx`
- `components/pages/create-dashboard-old/index.tsx`
- `components/pages/create-dashboard/modal/CustomAvatarModal.tsx`
- `lib/preview-image-generator.ts`
- `lib/generateEligibilityImage.ts`

To fully “move all to R2”, these would need to use presign → PUT to R2 and store key/URL in metadata (similar to documents). Lower priority if those flows are secondary.

---

## Step-by-step next actions

Do these in order.

### Step 1: Env and CORS (≈15 min)

1. **Vercel:** In Project → Settings → Environment Variables, add (if not already):
   - `R2_BUCKET=plantelligence-assets`
   - `R2_ENDPOINT=https://...r2.cloudflarestorage.com`
   - `R2_ACCESS_KEY_ID=...`
   - `R2_SECRET_ACCESS_KEY=...`  
   Enable for **Preview** and **Production**. Redeploy after changes.

2. **R2 bucket CORS:** In Cloudflare R2 → bucket `plantelligence-assets` → Settings → CORS:
   - Allow origins: `http://localhost:3000` and your production domain(s).
   - Methods: `GET`, `PUT`, `HEAD`.
   - Header: `Content-Type`.

### Step 2: Inline document edit → R2 (≈1–2 hr)

1. In `components/pages/documents/components/compliance-documents-upload.tsx`, in **handleSaveInlineEdit**:
   - When `file` is provided and `clientId` is set:
     - Call `uploadFileToR2({ file, purpose: "document", clientId, fileName: file.name, category })` (derive category from doc or fixedCategory).
     - On success: set `file: "r2:stored"` and `storageKey: key` in the updated doc (and keep `originalFileName`).
   - When `file` is provided and `clientId` is not set (e.g. wizard): keep current base64 behavior.
2. Ensure the updated doc shape includes `storageKey` so that when **handleManualSave** runs, `optionalFiles` already contain `storageKey` for those docs.

### Step 3: Edit-client compliance (SPD + Replace file) → R2 (≈1–2 hr)

1. In `components/pages/edit-client/compliance-documents-section.tsx`:
   - Ensure the section has access to **clientId** (plan/client context).
   - **handleSPDFileUpload:** If clientId exists, call `uploadFileToR2` for the SPD file, then call `onDataChange("spdFile", { ... })` with a structure that includes `storageKey` and no base64 (or `file: "r2:stored"`). Ensure the save API used for this page (e.g. optional-documents or clients API) accepts and persists `storageKey`.
   - **Replace file** (DragDropUpload in the SPD edit card): Same pattern — upload to R2 when clientId exists, then set state with `storageKey` (and optional `file: "r2:stored"`).
   - If this page saves via a different endpoint than optional-documents, confirm that endpoint accepts `storageKey` and writes `fileUrl: "r2:stored"` + `storageKey` to the Document table.

### Step 4: Verify end-to-end (≈30 min)

1. **Documents:**  
   - Wizard Step 4: upload a document → complete/save draft → confirm DB has `storageKey` and `fileUrl: "r2:stored"`.  
   - Documents tab: add doc (R2), then **edit** and **replace file** → save → confirm document view and optional-documents still get `storageKey` and view works.  
   - Edit-client: upload SPD / replace file → save → confirm view and storage.

2. **Branding:** Upload logo/hero/thumbnail in wizard and company basics; confirm they appear in preview and portal (signed URL resolution).

3. **Large file:** Upload a PDF >10MB; confirm no 413 and no “plans not saved” (file goes client → R2 only).

### Step 5 (optional): Deprecate legacy FormData document uploads

- In `POST /api/documents` and `PATCH /api/documents/[id]`, the FormData path that accepts file and stores base64 is still present. To strictly avoid file transfer through the app server, you can:
  - Return 410 or 400 for FormData with file when R2 is configured, or
  - Restrict that path to admin-only and document it as legacy.

### Step 6 (optional): Migrate existing base64 documents to R2

- Add a script or admin job: for each Document with `fileUrl` containing base64 and no `storageKey`, decode → `putObjectBuffer` to R2 with `buildDocumentKey`, then update row to `storageKey` and `fileUrl: "r2:stored"`. Run in batches to avoid timeouts.

---

## Summary

- **Infra, APIs, key structure, reads, DB strategy:** Implemented.  
- **Remaining:** (1) Vercel env + R2 CORS, (2) **handleSaveInlineEdit** (Documents tab) to use R2 when clientId set, (3) **edit-client compliance** (SPD + Replace file) to use R2 when clientId set.  
- **Optional:** Direct-to-R2 for wizard logo, deprecate FormData doc uploads, migrate old base64 docs to R2, and move S3-only flows (create-dashboard, etc.) to R2 if you want everything off the app server.

This keeps file transfer off the app server for plan docs and branding and eliminates the server capacity / “plans not saved” issue for the main flows once Steps 1–4 are done.
