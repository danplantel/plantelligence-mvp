# Cloudflare R2 Integration

All PDFs and images (plan docs, branding, generated assets) are stored in **Cloudflare R2**. The app server never holds file bodies: uploads go **direct-to-R2** via signed URLs; reads use **signed URLs** (Public Access stays disabled).

---

## 1. Environment variables

Add these in **Vercel** (and locally in `.env`) for **Preview** and **Production**:

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_BUCKET` | Bucket name | `plantelligence-assets` |
| `R2_ENDPOINT` | S3-compatible endpoint; **must include account-id** | `https://0b09416d5a27c2cdd8eb538ca80e4088.r2.cloudflarestorage.com` — wrong: `https://r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 API token access key | *(from Cloudflare dashboard)* |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | *(from Cloudflare dashboard)* |
| `R2_PUBLIC_HOST` | *(Optional)* Custom domain for signed URL host | Leave empty unless using a custom domain |

**Security:** Never commit credentials. Set them only in Vercel Environment Variables (or `.env` locally, and ensure `.env` is in `.gitignore`).

**Vercel:** Add the same variables in **Settings → Environment Variables** and enable **Preview** and **Production**. After adding or changing, **redeploy**.

---

## 2. Common mistakes (checklist)

| # | Mistake | Our setup / action |
|---|--------|---------------------|
| 1 | **Wrong endpoint** — using `https://r2.cloudflarestorage.com` without account-id | Correct: `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` (see §1). Code uses `constants/app.ts` → `lib/r2.ts`. |
| 2 | **Missing `forcePathStyle: true`** | Set in `lib/r2.ts` S3 client config (required for R2). |
| 3 | **Wrong region** (e.g. `us-east-1`) | We use `region: "auto"` in `lib/r2.ts`. |
| 4 | **Env vars only locally, not in Vercel** | Add all four in Vercel (Preview + Production) and redeploy. |
| 5 | **bodyParser breaking uploads** | Our R2 API routes do not receive file bodies: presign-upload accepts JSON only; client PUTs file directly to R2. No `bodyParser: false` needed for R2. |
| 6 | **Wrong bucket name** | Must match exactly (e.g. `R2_BUCKET=plantelligence-assets`). Check Cloudflare R2 bucket name. |
| 7 | **No CORS on bucket** | Required for browser uploads (e.g. Step 4). See §8 below. |
| 8 | **Expecting public access** | We use **signed URLs only**; Public Access stays disabled. |
| 9 | **Key = file.name only** (overwrites) | We use structured keys: `buildDocumentKey` / `buildBrandingKey` → `org/.../documents/{category}/{uniqueId}-{sanitizedFileName}`. |
| 10 | **Very large uploads through server** | Large files go **client → R2** (presigned PUT); server never streams file body. Server-side `putObjectBuffer` is only for branding at completion (typically small). |

---

## 3. Key structure in R2

Objects are organized under:

- **Documents:** `org/{orgId}/plans/{planId}/documents/{category}/{uniqueId}-{sanitizedFileName}`
- **Branding:** `org/{orgId}/plans/{planId}/branding/{slot}/{uniqueId}-{sanitizedFileName}`
- **Other uploads:** `org/{orgId}/uploads/{subPath}/{uniqueId}-{sanitizedFileName}`

**Document categories** (canonical order/labels): `retirement`, `group-health`, `group-life`, `other`.

---

## 4. Backend implementation summary

| Piece | Purpose |
|-------|---------|
| `lib/r2.ts` | R2 client, presigned PUT/GET, key builders, `isR2Configured()`, category helpers |
| `constants/app.ts` | R2 env vars (`R2_BUCKET`, `R2_ENDPOINT`, etc.) |
| `app/api/r2/presign-upload/route.ts` | `POST` → returns `{ uploadUrl, key }` for direct client upload |
| `app/api/r2/signed-url/route.ts` | `GET ?key=...` → returns `{ url }` (signed read URL), auth required |
| `prisma/schema.prisma` | `Document.storageKey` (optional); `fileUrl` kept for legacy base64 |
| `app/api/documents/route.ts` | `POST` with JSON `{ clientId, storageKey, fileName, title, type, category, ... }` creates document (R2 flow) |
| `app/api/documents/[id]/route.ts` | `PATCH` with JSON `{ storageKey, fileName, ... }` updates document to R2 |
| `app/api/documents/[id]/view/route.ts` | If `document.storageKey` set → redirect to R2 signed URL; else serve legacy base64 from `fileUrl` |
| `lib/upload-to-r2.ts` | Client helper: presign → PUT file → return key |
| `lib/r2.ts` | `putObjectBuffer()` for server-side upload (e.g. branding at wizard completion) |
| `lib/branding-image-url.ts` | `isR2BrandingKey()`, `getBrandingSignedUrl()` for resolving keys to signed URLs |
| `hooks/useBrandingImageUrl.ts` | Hook: value → resolved URL (fetches signed URL when value is R2 key) |
| `components/ui/branding-image.tsx` | `<BrandingImage src={...} />` for logo/thumbnails (resolves R2 keys) |

**Branding (logo, header, thumbnail, secondaryBanner, favicon):**

- **Store only key:** `companyLogo`, `backgroundImg`, `thumbnailImg`, etc. store the R2 key string (e.g. `org/.../branding/logo/...`). Wizard company-basics API accepts keys as-is (no base64 processing when value starts with `org/`). At wizard completion (`complete-v2`), any base64 branding is uploaded to R2 server-side and the new client is updated with keys.
- **Read via signed URL:** Use `useBrandingImageUrl(value)` or `<BrandingImage src={value} />` wherever branding is displayed (preview, portal header/hero, benefits, etc.). When `value` starts with `org/`, the hook fetches `GET /api/r2/signed-url?key=...` and uses the returned URL for `<img src>`.

---

## 5. Upload flow (direct-to-R2)

1. **Client** calls `POST /api/r2/presign-upload` with body:
   - `purpose`: `"document"` | `"branding"` | `"upload"`
   - `clientId` (required for document/branding)
   - `fileName`, `contentType`
   - `category` (documents), `slot` (branding), or `subPath` (upload)
2. **Server** returns `{ uploadUrl, key }`.
3. **Client** `PUT`s the file to `uploadUrl` with header `Content-Type: <contentType>`.
4. **Client** saves metadata by calling the relevant API with the **key** (no file body):
   - **Document:** `POST /api/documents` with JSON `{ clientId, storageKey: key, fileName, title, type, category, ... }`  
     or `PATCH /api/documents/:id` with `{ storageKey: key, fileName, ... }`.
   - **Branding:** store the key in client record (e.g. `backgroundImg` = key or a dedicated field; serve via signed URL).
   - **Other uploads:** use key in your metadata/store as needed.

Use the client helper when possible:

```ts
import { uploadFileToR2 } from "@/lib/upload-to-r2";

const key = await uploadFileToR2({
  file,
  purpose: "document",
  clientId,
  fileName: file.name,
  category: "retirement",
  type: "SPD",
});
if (key) {
  await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, storageKey: key, fileName: file.name, title: "SPD", type: "SPD" }),
  });
} else {
  // R2 not configured: fall back to legacy base64 upload
}
```

---

## 6. Read flow (signed URLs)

- **Document view:** User opens `/api/documents/:id/view`. If the document has `storageKey`, the server redirects to a short-lived signed GET URL for that key; otherwise it serves from legacy `fileUrl` (base64).
- **Generic signed URL:** Authenticated request to `GET /api/r2/signed-url?key=...` returns `{ url }`. The key must start with `org/{userId}/` (enforced server-side).

---

## 7. Migrating existing upload paths to R2

Backend already supports both:

- **Legacy:** FormData with file → server converts to base64 → stored in `Document.fileUrl`.
- **R2:** Client gets presign URL → uploads to R2 → API stores `storageKey` and `fileUrl = "r2:stored"`.

To move a flow to R2:

1. Replace “read file and send to server” with: get presign URL → PUT file to R2 → call API with `storageKey` (and metadata).
2. Use `uploadFileToR2()` where applicable (documents, branding, uploads).
3. For **documents**, create/update via:
   - `POST /api/documents` (JSON) or `PATCH /api/documents/:id` (JSON) with `storageKey` and `fileName`.

Places that still send file bytes to the server (to be switched to R2 when you’re ready):

- `app/api/documents/route.ts` – FormData POST (SPD/SBC)
- `app/api/documents/[id]/route.ts` – FormData PATCH with file
- `app/api/marketing/save-pdf/route.ts`
- `app/api/clients/create/route.ts` – document creation
- `app/api/clients/[id]/route.ts` – document updates
- `app/api/new-client-wizard/save-draft/route.ts`, `complete-v2/route.ts`, `optional-documents/route.ts`
- `app/api/files/upload/route.ts` – general file upload (currently S3)
- `app/api/upload-template-image/route.ts` – writes to `public/uploads`

For **branding images** (Client: `companyLogo`, `backgroundImg`, etc.), you can store the R2 key (or a namespaced identifier) and resolve to a signed URL when serving.

---

## 8. CORS for browser uploads (required for Step 4 / direct PUT)

When the app runs in the browser (e.g. `http://localhost:3000` or your production domain), the **browser** sends the PUT request to the presigned R2 URL. R2 must allow that origin via CORS, otherwise you get:

`Access to fetch at 'https://...r2.cloudflarestorage.com/...' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Fix:** Configure CORS on your R2 bucket.

1. In **Cloudflare Dashboard** go to **R2** → your bucket (e.g. `plantelligence-assets`) → **Settings**.
2. Find **CORS policy** and add a rule (or use **Edit CORS policy**).
3. Use a configuration that allows your app origins and PUT/GET. Example (JSON format, if the dashboard accepts it):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length", "Content-Disposition"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- Replace `https://your-production-domain.com` with your real production (and preview) domain(s).
- **AllowedHeaders:** must include `Content-Type` (and any other headers your client sends). Using `*` is not supported by R2 for some fields, so list explicitly.
- **AllowedMethods:** `PUT` for uploads, `GET`/`HEAD` if you ever read directly from the bucket URL in the browser.

After saving, retry the document upload on Step 4; the preflight (OPTIONS) should succeed and the PUT should go through.

References: [Configure CORS (Cloudflare R2)](https://developers.cloudflare.com/r2/buckets/cors/).

---

## 9. Vercel setup checklist

1. **R2 bucket:** Created (e.g. `plantelligence-assets`), Object Read & Write.
2. **API token:** Created in Cloudflare R2, scoped to the bucket; copy Access Key ID and Secret Access Key.
3. **Vercel env:**
   - Project → Settings → Environment Variables.
   - Add `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` for Production and Preview.
4. **Redeploy** so the server uses the new variables.
5. **CORS:** If the app uploads to R2 from the browser (e.g. wizard Step 4 documents), set the bucket CORS policy as in **§8** above.

This removes file transfer from the app server and avoids “plans not saved” / capacity issues caused by large request bodies.
