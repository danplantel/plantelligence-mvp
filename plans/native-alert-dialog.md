# Native Browser Dialogs → Toast / Confirm Dialog Refactor

> Inventory of every native browser dialog (`alert` / `confirm` / `prompt`) in the app, grouped by page area.
>
> **Replacement strategy**
> - `alert()` → **Sonner toast** (`toast.error` / `toast.success` from `sonner`)
> - `confirm()` → **styled "Are you sure" dialog** (existing `ConfirmDialog` from `@/components/ui/confirm-dialog`)

---

## 📊 Summary

| Metric        | Count |
| ------------- | ----- |
| `alert()`     | 48    |
| `confirm()`   | 9     |
| `prompt()`    | 0     |
| **Total**     | **57**|
| Files touched | 21    |

> **Note:** The only `prompt` text matches in the codebase are in comments (e.g. `Initial prompt (no disclaimer yet)` in `step-5a.tsx`), not actual dialogs.

---

## ✅ Legend

| Status | Meaning                                   |
| ------ | ----------------------------------------- |
| `[ ]`  | Not yet refactored                        |
| `[x]`  | Refactored (native dialog removed)        |

---

## 📄 Dashboard Pages

### [`app/(dashboard)/videos/page.tsx`](../app/(dashboard)/videos/page.tsx) — `[x]` 4 calls (3 alert, 1 confirm)

- `L1058` — `alert("Cannot delete video: missing ID. Please refresh the page.")` → `toast.error`
- `L1067` — `confirm(\`Are you sure you want to delete this video for ${video.planName}?\`)` → `ConfirmDialog`
- `L1108` — `alert(\`Failed to delete video: ${error?.message || "Unknown error"}. Please try again.\`)` → `toast.error`
- `L1198` — `alert("Failed to update placement. Please try again.")` → `toast.error`

### [`app/(dashboard)/communications/webinars/page.tsx`](../app/(dashboard)/communications/webinars/page.tsx) — `[x]` 1 call (confirm)

- `L410` — `confirm("Are you sure you want to delete this webinar?")` → `ConfirmDialog`

---

## 🧙 Onboarding / New-Client Wizard

### 🧹 Relevance review (inspected in context)

| Call | Type | Verdict | Why |
| ---- | ---- | ------- | --- |
| `lib/onboarding-wizard-store.ts` `L635` | alert | ✅ Keep → `toast.error` | Real failure path when the wizard-complete API rejects. |
| `lib/onboarding-wizard-store.ts` `L639` | alert | ✅ Keep → `toast.error` | Network/catch failure path for the same call. |
| `new-client-steps/step-1.tsx` `L414` | alert | ✅ Keep → `toast.error` | Guard: company name required before generating a welcome statement. |
| `new-client-steps/step-1.tsx` `L427` | alert | ⚠️ Dead in practice | `try` body is fully synchronous/local (no network), so this catch realistically never runs. |
| `sections/documents-upload-section.tsx` `L350` | alert | ✅ Keep → `toast.error` | Real unsupported-file validation (PDF-only mode). |
| `sections/documents-upload-section.tsx` `L358` | alert | ✅ Keep → `toast.error` | Real unsupported-file validation (PDF/Word). |
| `sections/documents-upload-section.tsx` `L864` | alert | ✅ Keep → `toast.error` | Required document-name validation. |
| `sections/documents-upload-section.tsx` `L870` | alert | ✅ Keep → `toast.error` | Name length limit (add mode). |
| `sections/documents-upload-section.tsx` `L875` | alert | ✅ Keep → `toast.error` | Description length limit (add mode). |
| `sections/documents-upload-section.tsx` `L882` | alert | ✅ Keep → `toast.error` | No file selected (edit mode). |
| `sections/documents-upload-section.tsx` `L888` | alert | ✅ Keep → `toast.error` | Name length limit (edit mode). |
| `sections/documents-upload-section.tsx` `L893` | alert | ✅ Keep → `toast.error` | Description length limit (edit mode). |
| `sections/documents-upload-section.tsx` `L958` | alert | ✅ Keep → `toast.error` | File-processing failure (catch). |
| `sections/documents-upload-section.tsx` `L963` | alert | ✅ Keep → `toast.error` | No file selected (add mode). |
| `sections/company-logo-section.tsx` `L48` | alert | ✅ Keep → `toast.error` | Unsupported logo format guard. |
| `…/company-name-selector.tsx` `L389` | confirm | ✅ Keep → `ConfirmDialog` | Confirms removing a contact's logo. |
| `steps/sections/add-team-members-section.tsx` `L77` | alert | ✅ Keep → `toast.error` | Guard: name/email/role required before sending invite. |
| `steps/sections/add-team-members-section.tsx` `L92` | alert | ⚠️ Dead in practice | `onSendInvite` never rejects, so this catch realistically never runs. |
| `steps/sections/add-team-members-section.funcs.ts` `L69` | alert | 🚫 Reword | Placeholder exposes **"Invite email functionality will be implemented later"** (a TODO) directly to end users — not final-product-safe. Replace with a neutral success toast. |
| `steps/sections/disclaimers-summary.tsx` `L46` | confirm | ✅ Keep → `ConfirmDialog` | Confirms deleting a disclaimer. |

**Bottom line:** 17 of 20 calls remain meaningful (15 → `toast.error`, 2 → `ConfirmDialog`). 2 alerts are effectively unreachable dead code (`step-1.tsx` `L427`, `add-team-members-section.tsx` `L92`). 1 alert (`add-team-members-section.funcs.ts` `L69`) is relevant but must be **reworded** so it no longer surfaces the "implemented later" placeholder to users (→ `toast.success`).

### [`lib/onboarding-wizard-store.ts`](../lib/onboarding-wizard-store.ts) — `[x]` 2 calls (alert)

- `L635` — `alert(\`Error completing onboarding: ${errorData.error || 'Unknown error'}\`)` → `toast.error`
- `L639` — `alert(\`Error completing onboarding: ${error.message || 'Network error'}\`)` → `toast.error`

### [`components/wizard/new-client-steps/step-1.tsx`](../components/wizard/new-client-steps/step-1.tsx) — `[x]` 2 calls (alert)

- `L414` — `alert("Please add a company name in Step 1A first.")` → `toast.error`
- `L427` — `alert("Failed to generate content. Please try again.")` → `toast.error`

### [`components/wizard/new-client-steps/sections/documents-upload-section.tsx`](../components/wizard/new-client-steps/sections/documents-upload-section.tsx) — `[x]` 10 calls (alert)

- `L350` — `alert(\`File ${file.name} is not supported. Only PDF files are allowed.\`)` → `toast.error`
- `L358` — `alert(\`File ${file.name} is not supported. Only PDF and Word documents are allowed.\`)` → `toast.error`
- `L864` — `alert("Document name is required")` → `toast.error`
- `L870` — `alert("Document name cannot exceed 60 characters")` → `toast.error`
- `L875` — `alert("Description cannot exceed 200 characters")` → `toast.error`
- `L882` — `alert("Please select a file")` → `toast.error`
- `L888` — `alert("Document name cannot exceed 60 characters")` → `toast.error`
- `L893` — `alert("Description cannot exceed 200 characters")` → `toast.error`
- `L958` — `alert("Failed to process file")` → `toast.error`
- `L963` — `alert("Please select a file")` → `toast.error`

### [`components/wizard/new-client-steps/sections/company-logo-section.tsx`](../components/wizard/new-client-steps/sections/company-logo-section.tsx) — `[x]` 1 call (alert)

- `L48` — `alert("Unsupported format. Please upload SVG, PNG, or JPEG.")` → `toast.error`

### [`components/wizard/new-client-steps/step-3-key-contacts/components/company-name-selector.tsx`](../components/wizard/new-client-steps/step-3-key-contacts/components/company-name-selector.tsx) — `[x]` 1 call (window.confirm)

- `L389` — `window.confirm("Are you sure you want to remove the logo for this contact?")` → `ConfirmDialog`

### [`components/wizard/steps/sections/add-team-members-section/add-team-members-section.tsx`](../components/wizard/steps/sections/add-team-members-section/add-team-members-section.tsx) — `[x]` 2 calls (alert)

- `L77` — `alert("Please fill in name, email, and role before sending invite")` → `toast.error`
- `L92` — `alert("Failed to send invite. Please try again.")` → `toast.error`

### [`components/wizard/steps/sections/add-team-members-section/add-team-members-section.funcs.ts`](../components/wizard/steps/sections/add-team-members-section/add-team-members-section.funcs.ts) — `[x]` 1 call (alert)

- `L69` — `alert(\`Invite email functionality will be implemented later. For now, team member "${member.name}" has been added with ${member.role} role.\`)` → `toast.info`

### [`components/wizard/steps/sections/disclaimers-summary/disclaimers-summary.tsx`](../components/wizard/steps/sections/disclaimers-summary/disclaimers-summary.tsx) — `[x]` 1 call (window.confirm)

- `L46` — `window.confirm("Are you sure you want to delete this disclaimer?")` → `ConfirmDialog`

---

## 🗂️ Edit-Client Pages & Documents

### 🧹 Relevance review (inspected in context)

| Call | Type | Verdict | Why |
| ---- | ---- | ------- | --- |
| `edit-client/compliance-documents-section.tsx` `L174` | alert | ✅ Keep → `toast.error` | Real file-type guard when uploading an SPD document. |
| `edit-client/compliance-documents-section.tsx` `L219` | alert | ✅ Keep → `toast.error` | Real catch around R2/base64 SPD conversion. |
| `edit-client/compliance-documents-section.tsx` `L571` | alert | ✅ Keep → `toast.error` | Real catch around inline document file conversion. |
| `documents/components/compliance-documents-upload.tsx` `L273` | confirm | ✅ Keep → `ConfirmDialog` | Confirms archiving a DB-backed document (soft archive — still worth confirming). |
| `client-portal/sections/documents-section.tsx` `L148` | alert | ✅ Keep → `toast.error` | Required document-name validation on save. |
| `client-portal/sections/documents-section.tsx` `L177` | alert | ✅ Keep → `toast.error` | Server error path on document update. |
| `client-portal/sections/documents-section.tsx` `L181` | alert | ✅ Keep → `toast.error` | Network/exception path on document update. |
| `client-portal/sections/documents-section.tsx` `L313` | alert | ✅ Keep → `toast.error` | Guard: at least one retirement-plan document required. |
| `client-portal/sections/documents-section.tsx` `L357` | alert | ✅ Keep → `toast.success` | **Success** message ("Documents saved successfully!") — use a success toast. |
| `client-portal/sections/documents-section.tsx` `L459` | alert | ✅ Keep → `toast.error` | Server error path when saving documents. |
| `client-portal/sections/documents-section.tsx` `L463` | alert | ✅ Keep → `toast.error` | Network/exception path when saving documents. |
| `client-portal/…/retirement-documents-accordion.tsx` `L710` | alert | ✅ Keep → `toast.error` | Title-required guard (card edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L714` | alert | ✅ Keep → `toast.error` | Title length guard (card edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L718` | alert | ✅ Keep → `toast.error` | Description length guard (card edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L755` | alert | ✅ Keep → `toast.error` | PDF-only file guard (card edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L1276` | alert | ✅ Keep → `toast.error` | Title-required guard (list edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L1280` | alert | ✅ Keep → `toast.error` | Title length guard (list edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L1284` | alert | ✅ Keep → `toast.error` | Description length guard (list edit). |
| `client-portal/…/retirement-documents-accordion.tsx` `L1350` | alert | ✅ Keep → `toast.error` | PDF-only file guard (list edit). |

**Bottom line:** all **19** calls remain useful. **18 alerts** → toasts (17 → `toast.error`, 1 → `toast.success` for `L357`), and **1 confirm** → `ConfirmDialog`. No dead code or placeholder messages found in this group.

### 🧪 Message-accuracy check (claim vs. actual enforcement)

Each message below was checked against the code that enforces it:

| Call | Message | Enforcement found | Accurate? |
| ---- | ------- | ----------------- | --------- |
| `compliance-documents-section.tsx` `L174` | "Only PDF and Word documents are allowed" | `allowedTypes` = `application/pdf`, `application/msword` (`.doc`), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`); input `accept=".pdf,.doc,.docx"` | ✅ Yes |
| `compliance-documents-section.tsx` `L219` | "Failed to process SPD file" | `catch` of R2 upload + `FileReader`→base64 (rejects via `reader.onerror`) | ✅ Yes |
| `compliance-documents-section.tsx` `L571` | "Failed to process file" | `catch` of inline conversion (R2 / base64) on an `accept=".pdf,.doc,.docx"` input | ✅ Yes |
| `documents/components/compliance-documents-upload.tsx` `L273` | "…removed from the Benefits Hub but kept for your records" | `PATCH …{ archivedAt }`, then removed from the list (soft archive) | ✅ Yes |
| `documents-section.tsx` `L148` | "Document name is required" | guard `!editedTitle.trim()` | ✅ Yes |
| `documents-section.tsx` `L177` | server `error.error \|\| "Failed to update document"` | non-OK branch of `PATCH /api/documents/{id}` | ✅ Yes |
| `documents-section.tsx` `L181` | "Failed to update document" | `catch` around the PATCH | ✅ Yes |
| `documents-section.tsx` `L313` | "Please add at least one document" | guard `retirementPlanDocuments.length === 0` | ✅ Yes |
| `documents-section.tsx` `L357` | "Documents saved successfully!" | OK branch of `POST …/optional-documents` (success, not error) | ✅ Yes → use `toast.success` |
| `documents-section.tsx` `L459` | `error.error \|\| "Failed to save documents"` | non-OK branch of the POST | ✅ Yes |
| `documents-section.tsx` `L463` | "Failed to save documents" | `catch` around the POST | ✅ Yes |
| `retirement-documents-accordion.tsx` `L710` | "Title cannot be empty" | guard `editTitle.trim().length === 0` (card edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L714` | "Title cannot exceed 85 characters" | guard `editTitle.length > 85` (card edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L718` | "Description cannot exceed 200 characters" | guard `editDescription.length > 200` (card edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L755` | "Please upload a PDF file" | guard `file.type !== "application/pdf"` (card edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L1276` | "Title cannot be empty" | guard `title.trim().length === 0` (list edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L1280` | "Title cannot exceed 85 characters" | guard `title.length > 85` (list edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L1284` | "Description cannot exceed 160 characters" | guard `description.length > 160` (list edit) | ✅ Yes |
| `retirement-documents-accordion.tsx` `L1350` | "Please upload a PDF file" | guard `file.type !== "application/pdf"` (list edit) | ✅ Yes |

**Flags / notes**
- `retirement-documents-accordion.tsx` uses **two different description caps** on the same page — card edit allows 200 chars, list edit allows 160. Each message matches its own guard, but the inconsistency may deserve a product decision.
- In `compliance-documents-section.tsx`, only the SPD handler (`L166`) performs a **runtime type check**; the sibling edit-document upload relies on `accept=".pdf,.doc,.docx"` alone (no runtime guard) — no alert exists there, so out of scope, but worth noting for parity.
- `documents-section.tsx` `L357` is the only non-error message in the group → `toast.success`.

### [`components/pages/edit-client/compliance-documents-section.tsx`](../components/pages/edit-client/compliance-documents-section.tsx) — `[x]` 3 calls (alert)

- `L174` — `alert("Only PDF and Word documents are allowed")` → `toast.error`
- `L219` — `alert("Failed to process SPD file")` → `toast.error`
- `L571` — `alert("Failed to process file")` → `toast.error`

### [`components/pages/documents/components/compliance-documents-upload.tsx`](../components/pages/documents/components/compliance-documents-upload.tsx) — `[x]` 1 call (window.confirm)

- `L273` — `window.confirm("Archive this document? It will be removed from the Benefits Hub but kept for your records.")` → `ConfirmDialog`

### [`components/pages/client-portal/sections/documents-section.tsx`](../components/pages/client-portal/sections/documents-section.tsx) — `[x]` 7 calls (alert)

- `L148` — `alert("Document name is required")` → `toast.error`
- `L177` — `alert(error.error || "Failed to update document")` → `toast.error`
- `L181` — `alert("Failed to update document")` → `toast.error`
- `L313` — `alert("Please add at least one document")` → `toast.error`
- `L357` — `alert("Documents saved successfully!")` → `toast.success`
- `L459` — `alert(error.error || "Failed to save documents")` → `toast.error`
- `L463` — `alert("Failed to save documents")` → `toast.error`

### [`components/pages/client-portal/sections/retirement-documents-accordion.tsx`](../components/pages/client-portal/sections/retirement-documents-accordion.tsx) — `[x]` 8 calls (alert)

- `L710` — `alert("Title cannot be empty")` → `toast.error`
- `L714` — `alert("Title cannot exceed 85 characters")` → `toast.error`
- `L718` — `alert("Description cannot exceed 200 characters")` → `toast.error`
- `L755` — `alert("Please upload a PDF file")` → `toast.error`
- `L1276` — `alert("Title cannot be empty")` → `toast.error`
- `L1280` — `alert("Title cannot exceed 85 characters")` → `toast.error`
- `L1284` — `alert("Description cannot exceed 160 characters")` → `toast.error`
- `L1350` — `alert("Please upload a PDF file")` → `toast.error`

---

## 🖼️ Image / Brand Upload & Editors

### 🧹 Relevance review (inspected in context)

| Call | Type | Verdict | Why |
| ---- | ---- | ------- | --- |
| `ui/brand-image-upload.tsx` `L157` | alert | ✅ Keep → `toast.error` | Real fallback guard for non-image/non-zip files in `processImageFile`. |
| `ui/brand-image-upload.tsx` `L163` | alert | ✅ Keep → `toast.error` | Real size guard — `file.size > maxFileSize MB`, message uses the same dynamic `maxFileSize`. |
| `ui/brand-image-upload.tsx` `L252` | alert | ✅ Keep → `toast.error` | Real catch around `extractImagesFromZip` (surfaces user-friendly zip errors). |
| `ui/universal-image-editor-modal.tsx` `L1589` | confirm | ✅ Keep → `ConfirmDialog` | Warns before saving a logo/normalizer that touches the boundary / may get cropped. |
| `ui/universal-image-editor-modal.tsx` `L1847` | confirm | ✅ Keep → `ConfirmDialog` | "Cancel? Your changes will be lost" — real unsaved-changes guard (image loaded + canvas active). |
| `ui/simple-image-editor-modal.tsx` `L1085` | confirm | ✅ Keep → `ConfirmDialog` | Same real cancel-with-unsaved-changes guard. |
| `video-steps/step-2/step-2b.tsx` `L136` | alert | ✅ Keep → `toast.error` | Format guard matches `allowedTypes` = PNG/JPG/JPEG. |
| `video-steps/step-2/step-2b.tsx` `L141` | alert | ✅ Keep → `toast.error` | Size guard `> 15 MB` matches message. |
| `benefits-steps/benefits-editor-panel.tsx` `L209` | alert | ✅ Keep → `toast.error` | Guard `!file.type.startsWith("video/")`. |
| `benefits-steps/benefits-editor-panel.tsx` `L238` | alert | ✅ Keep → `toast.error` | `uploadFileToR2` returned no key → real upload failure. |
| `benefits-steps/benefits-editor-panel.tsx` `L242` | alert | ✅ Keep → `toast.error` | Real catch around the video upload. |

**Bottom line:** all **11** calls remain useful — **8 alerts** → `toast.error`, **3 confirms** → `ConfirmDialog`. No dead code or placeholder messages found in this group.

### [`components/ui/brand-image-upload.tsx`](../components/ui/brand-image-upload.tsx) — `[x]` 3 calls (alert)

- `L157` — `alert("Unsupported file. Please upload an image (PNG, JPG, JPEG, WebP, or SVG), or a .zip folder of images.")` → `toast.error`
- `L163` — `alert(\`File too large. Please upload a file under ${maxFileSize} MB.\`)` → `toast.error`
- `L252` — `alert((err as Error).message || "Could not read that .zip file.")` → `toast.error`

### [`components/ui/universal-image-editor-modal.tsx`](../components/ui/universal-image-editor-modal.tsx) — `[x]` 2 calls (confirm)

- `L1589` — `window.confirm(\`⚠️ Your ${previewTitle ? previewTitle : "logo"} touches the boundary and may get cropped. Continue?\`)` → `ConfirmDialog`
- `L1847` — `confirm("Are you sure you want to cancel? Your changes will be lost.")` → `ConfirmDialog`

### [`components/ui/simple-image-editor-modal.tsx`](../components/ui/simple-image-editor-modal.tsx) — `[x]` 1 call (confirm)

- `L1085` — `confirm("Are you sure you want to cancel? Your changes will be lost.")` → `ConfirmDialog`

### [`components/wizard/video-steps/step-2/step-2b.tsx`](../components/wizard/video-steps/step-2/step-2b.tsx) — `[x]` 2 calls (alert)

- `L136` — `alert("Unsupported format. Please upload .png,.jpg,.jpeg files.")` → `toast.error`
- `L141` — `alert("File too large. Please upload a file under 15 MB.")` → `toast.error`

### [`components/wizard/benefits-steps/benefits-editor-panel.tsx`](../components/wizard/benefits-steps/benefits-editor-panel.tsx) — `[x]` 3 calls (alert)

- `L209` — `alert("Please select a valid video file.")` → `toast.error`
- `L238` — `alert("Failed to upload video. Please try again.")` → `toast.error`
- `L242` — `alert("An error occurred while uploading the video.")` → `toast.error`

---

## 📅 Meetings & Auth

### [`components/meetings/plan-meeting-schedule-form.tsx`](../components/meetings/plan-meeting-schedule-form.tsx) — `[ ]` 1 call (confirm)

- `L606` — `confirm("Archive this meeting?")` → `ConfirmDialog`

### [`components/modals/invite-code-modal.tsx`](../components/modals/invite-code-modal.tsx) — `[ ]` 1 call (alert)

- `L42` — `alert("Incorrect invite code")` → `toast.error`
