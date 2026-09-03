# PlanTelligence Default Image Library — guide (Next.js optimized)

> Rewritten for the `plantelligence-dev` codebase. The earlier `Downloads/image-metadata-filtering.md` was
> written without access to this app and assumed a generic content system (Cloudflare R2 / Postgres / HTTP API).
> This version right-sizes storage for what the feature actually is: **a fast, in-app picker over 250 fixed,
> curated default images** that users choose instead of uploading their own.

## 1. Scope and the storage decision

The library is **not** a user-upload system. It is 250 first-party, AI-generated banner images that ship with
the product. That makes static hosting + an in-process metadata index the correct architecture, not a bucket
or a database.

| Factor | Static in `/public` (chosen) | Cloudflare R2 | Postgres filtering |
| --- | --- | --- | --- |
| What it fits | Fixed curated defaults chosen at build | User uploads / original masters at scale | Editor-governed tags across many collections |
| Serving / caching | Next.js + hosting CDN edge-caches for you | Needs bucket + client/SDK plumbing | n/a (not a file store) |
| Latency per filter | ~0 ms (in-process) | n/a | network round-trip |
| Infrastructure | none | SDK, keys, upload pipeline | migrations + hosting |
| Cost at 250 assets | ~$0 | storage + egress | hosting |

**Decision:** keep the 250 images committed under `public/` and filter them in-process from one typed JSON
index. Add a single `assetUrl(image)` seam so that if a *separate* user-upload library later outgrows the repo,
only that helper changes and the shipped defaults are untouched.

## 2. Where everything lives

The 250 images originate from an external source folder **outside this repo**:

```text
C:\Users\eddie\Downloads\plantelligence-benefits-image-library-250
└─ plantelligence-benefits-image-library-250\    ← library root (auto-detected by gallery:sync)
   ├─ images\    ← 001-…jpg … 250-….jpg/.png  (the files that get copied)
   ├─ metadata.json    ← enrichment source of truth
   ├─ metadata.csv
   └─ README.txt
```

The full source-image path is:

```text
C:\Users\eddie\Downloads\plantelligence-benefits-image-library-250\plantelligence-benefits-image-library-250\images
```

`gallery:sync` reads from that location. It defaults `GALLERY_SOURCE_DIR` to the top-level
`C:\Users\eddie\Downloads\plantelligence-benefits-image-library-250` and automatically resolves the nested
library root (flat and nested extractions both work). To point at a specific folder instead:

```bash
# Windows PowerShell — point at the folder containing /images and metadata.json
$env:GALLERY_SOURCE_DIR = "C:\Users\eddie\Downloads\plantelligence-benefits-image-library-250\plantelligence-benefits-image-library-250"
pnpm gallery:sync
```

Inside this repo, the copied assets land in `public/gallery/`:

```
plantelligence-dev/
├─ public/
│  ├─ gallery/                        ← 250 default images (copied, names preserved)
│  │   001-7c8bd5a07bb4-destination-possibility.jpg
│  │   …
│  │   250-12e0c58cf5e0-family-support-bridge.jpg
│  └─ (existing asset folders untouched)
├─ data/
│  ├─ gallery-metadata.json           ← normalized single source of truth (generated)
│  └─ gallery-controlled-vocabulary.json  ← optional facet allow-lists (auto-generated once)
├─ lib/
│  └─ gallery.ts                      ← GalleryImage type + facet helpers + filterImages()
└─ scripts/
   └─ gallery/
      ├─ shared.ts                    ← shared facets + helpers
      ├─ sync-default-gallery.ts      ← copy + normalize (gallery:sync)
      └─ validate-gallery.ts          ← build-time validation (gallery:validate)
```

- `public/gallery/…` is served at `/gallery/…` with no rewrite.
- The manifest lives under `data/`, not `public/`, so it can be imported at build and is never double-served.
- `src` values in the manifest are public URLs; the picker and any API reuse the same index.

## 3. Data model

One image → many values per facet (do **not** split into one physical folder per category). Fields are kept from
the enrichment source of truth: `benefitCategories`, `industries`, `environments`, `subjects`, `lifeStages`,
`themes`, `useCases`, `visualStyles`, `tone`, `composition`, `altText`, `searchTerms`, `technical`, plus
`id`, `title`, `category` (original editorial label), `assetCollection`, and `src`/`filename`.

## 4. Manifest normalization (the src/filename trap)

The raw source manifest — `metadata.json` at the library root shown in §2 — stores:

```json
{ "src": "/images/7c8bd5a07bb4.jpg", "filename": "images/001-7c8bd5a07bb4-destination-possibility.jpg" }
```

- `src` points at an **id-only** name that does **not** exist on disk.
- `filename` matches the **real** sequenced file.

`gallery:sync` keeps the real files and rewrites every record so `src = "/gallery/<real-file>"`. Any image whose
file cannot be found aborts the sync with a clear list — the same gate the build validator enforces later.

## 5. Asset sync and build validation

Run from the repo root:

```bash
pnpm gallery:sync        # copy the 250 files + normalize manifest
pnpm gallery:validate    # quality gates below; exit 1 on any error
pnpm gallery:sync --dry-run   # preview without writing
pnpm gallery:sync --force     # overwrite existing files
```

The default source folder resolves to
`C:\Users\eddie\Downloads\plantelligence-benefits-image-library-250\plantelligence-benefits-image-library-250`,
whose `images\` subfolder is where the 250 files are copied from. Override the source root with the
`GALLERY_SOURCE_DIR` environment variable (see §2).

Wiring (already in `package.json`):

```jsonc
"gallery:sync": "npx tsx scripts/gallery/sync-default-gallery.ts",
"gallery:validate": "npx tsx scripts/gallery/validate-gallery.ts",
"gallery:optimize": "npx tsx scripts/gallery/convert-png-to-webp.ts",
"check:gallery": "npm run gallery:validate"
```

`gallery:validate` fails the build when an image has:

- no benefit category, industry (or `Industry Neutral` fallback), environment, subject, theme, use case, style,
  tone, composition, or alt text
- a `src` that does not resolve to a real file under `public/gallery`
- a duplicate `id` or duplicate `src`
- missing or inconsistent `technical` dimensions (width/height/aspect ratio)
- (optional) a value outside `data/gallery-controlled-vocabulary.json`

It exits 0 with a warning when no manifest has been generated yet, so it is safe to run in CI/prebuild before
the first sync. To make the manifest mandatory in CI, call `pnpm gallery:validate --required`.

## 6. Filtering (in-process — no API needed yet)

250 rows filter in well under a millisecond, so prefer importing the index directly over an HTTP round trip:

- Server Component / client util calls `filterImages({ benefit, industry, environment, theme, q })` from
  `lib/gallery.ts`.
- **AND across dimensions**, **OR within a dimension**, and text search narrows the filtered set over
  `searchTerms`.
- Facet counts are computed in the same pass and used to disable zero-result options.
- One action clears all metadata filters; state is serialized to the URL (`?benefit=Retirement&environment=Corporate`).

Expose `GET /api/images` only if a non-Next client must filter — it can reuse `lib/gallery.ts` and still needs
no database at this scale.

## 7. Selecting an image (picker behavior)

The picker shows a grid of `next/image` thumbnails with live counts. When a user chooses, persist **only a small
reference** (the asset `id` or `/gallery/…` `src`) on the plan/company record — mirror the existing per-category
override pattern (e.g. `lib/portal-category-hero-background.ts`). Never store image bytes in the DB.

## 8. Image performance

- All masters are ~16:9 banner crops; render them via `next/image` with explicit `width`/`height`/`sizes` so the
  optimizer serves appropriately sized derivatives.
- The nine former PNG masters (files `165`–`173`) were 2–3 MB each and dominated payload. They are now lossy
  WebP (~0.1–0.3 MB) — converted in the source library with `gallery:optimize`
  (`scripts/gallery/convert-png-to-webp.ts`), which also rewrites `metadata.json` (`format: "WebP"`,
  `fileSizeBytes`, and `.webp` filenames). Run `gallery:sync` after converting so the repo copies match, then
  remove any stale `.png` copies left in `public/gallery`.
- `gallery:sync` prints any master still larger than 1.5 MB so oversized assets are easy to spot.

## 9. Editorial workflow

- Assign benefit category, subject, environment, and use case to every new image.
- Add an industry only when the visible setting/equipment supports it; otherwise `Industry Neutral`.
- Keep theme/tone to the two or three strongest values.
- Review alt text manually (visible scene, not marketing copy); avoid inferred demographic labels.
- Preserve controlled spellings/slugs; do not add near-duplicates.
- Re-run `gallery:sync` and `gallery:validate` whenever images are added or replaced.
- The controlled-vocabulary file is generated once from the current manifest; curate it, then any new typo or
  out-of-vocabulary value fails the build.

## 10. When to migrate off static files

Move the **user-upload / custom-image** flow to R2/S3 (the repo already depends on `@aws-sdk/client-s3`) when
upload volume or repo size demands it. Move **facet filtering** to Postgres only when a CMS/editor needs to
rename, merge, or report on tags across many collections at scale. Neither is justified for the 250 fixed
defaults.
