# Logo Background Removal — Implementation Plan

## Problem

A logo delivered as a full-frame image with a solid white or black backdrop is
sized by the **backdrop**, not the artwork. Every downstream behaviour in
[`UniversalImageEditorModal`](components/ui/universal-image-editor-modal.tsx:294)
derives from the Fabric object's natural pixel size:

| Behaviour | Derives from |
| --- | --- |
| Auto-fit on open | `img.width / img.height` — [line 1274](components/ui/universal-image-editor-modal.tsx:1274) |
| Auto-size button | `activeObject.width / height` — [line 2215](components/ui/universal-image-editor-modal.tsx:2215) |
| Safe-zone checks | `obj.getBoundingRect()` — [line 971](components/ui/universal-image-editor-modal.tsx:971) |
| Aspect-ratio cap warning | `img.width / img.height` vs `350/140` — [line 1236](components/ui/universal-image-editor-modal.tsx:1236) |
| Normalizer header metrics | `obj.getBoundingRect()` — [line 867](components/ui/universal-image-editor-modal.tsx:867) |
| Save crop rect | `activeObject.getBoundingRect()` — [line 1638](components/ui/universal-image-editor-modal.tsx:1638) |

So both the on-screen guidance **and** the saved crop are computed against the
backdrop frame. Removing the backdrop alone is not sufficient: the transparent
margins must also be trimmed, or the math stays wrong.

## Decision

Client-side only. No new dependencies, no API routes, works offline, instant.

Pipeline: **detect the backdrop colour from the image border → flood-fill it away
with a tolerance slider → soft-edge the anti-aliased rim → trim the transparent
margins → re-seed the editor.**

**Button-driven, never automatic.** The entire pipeline runs only when the user
presses the Remove Background button. Nothing runs on upload, nothing runs when
the modal opens, and nothing runs while the tolerance slider is dragged. The
tolerance and trim controls are inputs that the next button press consumes.
Logos are brand assets; the editor must never alter one on its own initiative.

```mermaid
flowchart TD
    Z[User presses Remove Background] --> A[Original upload]
    A --> B[Taint-safe pixel load]
    B --> C[Detect backdrop from 1px border ring]
    C -->|uniform backdrop found| D[Connected flood fill from border]
    C -->|non-uniform| E[Report no solid background]
    D --> F[Soft edge / halo pass]
    F --> G[Trim transparent margins]
    G --> H[PNG data URL]
    H --> I[Re-seed Fabric canvas]
    I --> J[Auto-fit recalculated on artwork]
    J --> K[Safe zone and crop now use artwork bounds]
```

## Scope

In scope:

- `type="logo"` and `type="normalizer"` only — the two configs that edit logos.
- **Button-driven only.** The pipeline runs exclusively from the Remove
  Background button press, and the button lives in the card for these two types.
- Transparency-safe presentation of the result in the editor and previews.

Out of scope:

- `headshot` and `custom` — a face photo or a hero background has no backdrop to
  remove; the control stays hidden.
- AI/model-based removal for photographic or gradient backdrops.
- [`simple-image-editor-modal.tsx`](components/ui/simple-image-editor-modal.tsx:1).
  The helper library will be written so it can be adopted there later.

## Architecture

Follows the existing convention from
[`plans/shared-image-editor-core.md`](plans/shared-image-editor-core.md): stable
browser-only pixel/geometry code goes in `lib/`, presentational UI goes in
`components/ui/`, and the modal keeps only wiring.

### New file — `lib/image-background-removal.ts`

Browser-only, no server imports (same rule as
[`lib/image-editor-crop.ts`](lib/image-editor-crop.ts:1)).

```ts
export interface BorderDetection {
  /** Detected backdrop colour as [r, g, b], or null when the border is not uniform. */
  color: [number, number, number] | null;
  /** Share of border samples matching the detected colour, 0-1. */
  uniformity: number;
}

export interface RemovalOptions {
  /** 0-100 from the UI slider. */
  tolerance: number;
  /** Remove the anti-aliased rim / colour fringe. Default true. */
  softEdge?: boolean;
  /** Keep the artwork edges clear of the safe-zone border. Default 2. */
  paddingPx?: number;
  /** Manual override; skips border detection. */
  colorOverride?: [number, number, number];
}

export interface RemovalResult {
  /** PNG data URL of the trimmed artwork. */
  dataUrl: string;
  width: number;
  height: number;
  detectedColor: [number, number, number] | null;
  /** Cleared pixels / total pixels, 0-1. */
  removedRatio: number;
  /** True when transparent margins were trimmed. */
  trimmed: boolean;
  /** Source already had alpha below 255 before processing. */
  alreadyTransparent: boolean;
}
```

Exports:

1. `loadSourceCanvas(src: string): Promise<HTMLCanvasElement>`
2. `detectBorderColor(ctx, size): BorderDetection`
3. `floodFillBackground(imageData, options): number`
4. `softenEdges(imageData, options): void`
5. `trimTransparent(imageData, paddingPx): { x, y, width, height } | null`
6. `removeImageBackground(src, options): Promise<RemovalResult>` — orchestrator

### The Background card — inline in the modal

The card is rendered inline in
[`universal-image-editor-modal.tsx`](components/ui/universal-image-editor-modal.tsx:1)
rather than extracted into its own component file, so the button is visible
alongside the rest of the editor wiring. It reads directly from the `bgRemoval`
state and the `handleRemoveBackground` / `handleResetBackground` handlers, with
no prop drilling. Styled to match the existing guideline and warning cards.

### Modified file — `components/ui/universal-image-editor-modal.tsx`

Wiring only. No change required at any of the 14 call sites.

## Phase 1 — Removal library

### 1.1 Taint-safe pixel load

`getImageData` throws `SecurityError` on a canvas tainted by a cross-origin
image. [`toFabricImageLoadUrl()`](lib/branding-image-url.ts:96) rewrites R2 keys
and legacy presigned `/org/` URLs to the same-origin `/api/r2/object` proxy, so
stored logos are safe — but a logo sourced from a company-suggestion result or
an external site is not.

Reuse the proven pattern from
[`extractColorsFromImage()`](lib/extract-colors-from-image.ts:47): for any
non-`data:` source, `fetch` the bytes, draw from a same-origin `blob:` object
URL, then revoke it. This makes every read safe regardless of source headers and
degrades to a friendly error when the fetch itself fails.

Cap the working canvas at a max dimension (4096 px longest side) to bound
processing time; logos are far below this in practice.

### 1.2 Backdrop detection from the border

- Sample the outer 1-2 px ring.
- Quantise each sample to 5 bits per channel and take the modal bucket, then
  average that bucket's samples — the same quantisation approach already used at
  [`extract-colors-from-image.ts:96`](lib/extract-colors-from-image.ts:96) so
  anti-aliasing doesn't split one colour across buckets.
- `uniformity` = share of ring samples within a small distance of the candidate.
- `uniformity < 0.85` → return `color: null` and let the UI report that no solid
  backdrop was found.

### 1.3 Connected flood fill from the border

This is the critical correctness detail. A naive global colour-key would erase
**every** pixel matching the backdrop colour, punching holes in white text
inside a coloured badge or a white highlight inside a mark. Instead:

- Seed the queue with every border pixel within detection distance of the
  backdrop colour.
- BFS with 4-neighbour connectivity; clear a pixel only when it is both
  **reachable from the border** and within `tolerance` of the backdrop colour.
- Expansion stops naturally at the artwork, so all enclosed regions survive.

Tolerance mapping: slider 0-100 → RGB Euclidean distance `4 + (t / 100) * 76`.
Default 12 (~13/255), which covers JPEG compression noise around a nominally
white backdrop without eating light artwork.

### 1.4 Soft edges

Anti-aliased artwork edges leave a rim of half-backdrop pixels, which reads as a
grey halo on a white backdrop. After the fill, for each transparent pixel with an
opaque neighbour at distance `d` from the backdrop colour:

- `d < tolerance` → clear it as well.
- `tolerance <= d < tolerance * 2` → set
  `alpha = clamp((d - tolerance) / tolerance, 0, 1) * 255` — a cheap alpha-matte
  approximation that fades the halo out instead of leaving a hard step.

### 1.5 Trim

Scan the alpha channel for the bounding box of pixels with `alpha > 8` (the
threshold ignores stray anti-alias specks), add `paddingPx` (default 2 so the
Fabric selection border doesn't clip the artwork), and crop into a fresh canvas.
Return `trimmed: false` when the box already matches the full frame.

### 1.6 Reporting

- `removedRatio < 0.005` → "No background pixels matched. Increase the tolerance."
- `alreadyTransparent && removedRatio < 0.005` → "This logo already has a
  transparent background." (still offer trim, which is independently useful)

Compute `alreadyTransparent` with the existing
[`detectTransparency()`](lib/image-editor-crop.ts:89) rather than adding a second
alpha scan.

## Phase 2 — Wire into the modal

### 2.1 Config flag

Add to [`ImageEditorConfig`](components/ui/universal-image-editor-modal.tsx:49):

```ts
allowBackgroundRemoval?: boolean;
```

Set `true` on [`logo`](components/ui/universal-image-editor-modal.tsx:120) and
[`normalizer`](components/ui/universal-image-editor-modal.tsx:143). Leaving it
`undefined` on `headshot` and `custom` hides the control entirely, so every
existing call site inherits the feature with no edits and no regressions.

#### Per-call-site override

Type-level defaults are convenient but they leak. Two slots in Benefits Step 2
borrow the `normalizer` type for images that are **not** logos — the Inner Header
Image and the insurance Background Image — so they inherited an action that would
have made a hero photo transparent. The modal therefore accepts an explicit prop
with three-level precedence, **call-site prop > `customConfig` > type default**:

```ts
allowBackgroundRemoval: allowBackgroundRemoval ?? baseConfig.allowBackgroundRemoval
```

`baseConfig` already folds in `customConfig`, so the single nullish coalesce gives
the prop the final say while every untouched call site keeps the type behaviour.
[`BrandImageUpload`](components/ui/brand-image-upload.tsx:1) forwards it as
`universalModalAllowBackgroundRemoval`, since that wrapper is what most slots use.

Audited call sites:

| Slot | Flag | Why |
| --- | --- | --- |
| edit-client Company Logo | `true` | `type="logo"`; opt-in stated, not inherited |
| edit-client Contact Company Logo | `true` | Portal-card logo |
| `CompanyLogoCard` (Benefits Logo via `EditPlanPreviewSection`) | `true` | Shared by the new-client wizard and edit-client |
| Benefits Step 1 Benefit Logo | `true` | Provider logo |
| Benefits Step 2 Provider Logo | `true` | Provider logo |
| Benefits Step 1 Headshot | `false` | Makes the headshot guarantee explicit at the call site |
| Benefits Step 2 Inner Header Image | `false` | Full-height hero photo; borrows `normalizer` only for the header-bar fit |
| Benefits Step 2 Background Image | `false` | 1920×1080 section background |

Every other slot falls back to its type default, so nothing else changed.

### 2.2 Re-seeding the canvas — the key mechanism

Rather than duplicating the ~168-line canvas init block (which is what
[`resetImage()`](components/ui/universal-image-editor-modal.tsx:1900) currently
does), add one helper that hands the new bitmap back to the existing effects:

```ts
const applySourceImage = (nextSrc: string) => {
  if (fabricCanvasRef.current) {
    fabricCanvasRef.current.dispose();
    fabricCanvasRef.current = null;
  }
  setPreviews({});
  isInitializedRef.current = true; // skip regenerating upload warnings
  setImageSrc(nextSrc);
};
```

The existing effects then do the right thing with no new code:

1. The mode-detection effect ([line 1186](components/ui/universal-image-editor-modal.tsx:1186))
   re-runs because `imageSrc` changed **and** `fabricCanvasRef.current` is null →
   recomputes `canvasMode` and the responsive canvas dimensions for the new
   aspect ratio.
2. The init effect ([line 1214](components/ui/universal-image-editor-modal.tsx:1214))
   re-runs on `isDetectingMode` → rebuilds the canvas, applies auto-fit against
   the trimmed artwork, recomputes `minScale`/`maxScale`/`baseScale`, redraws
   guidelines, and regenerates previews.

Net result: auto-fit, safe-zone checks, aspect-ratio cap, normalizer header
metrics, and the save crop all operate on the artwork bounds — the actual bug is
fixed by re-seeding, not by patching each consumer. Guard against double-dispose,
matching the existing cleanup at
[line 1415](components/ui/universal-image-editor-modal.tsx:1415).

### 2.3 State

Add `backgroundRemoval` state: `tolerance` (12), `isProcessing`, `isRemoved`,
`detectedColor`, `alreadyTransparent`, `error`, `trimEnabled` (true), plus a ref
holding the bitmap the pipeline reads from.

There is no effect, watcher, or on-load call anywhere in this state — the only
entry point into the pipeline is the `onRemove` handler wired to the button.
`tolerance` and `trimEnabled` sit inert until the next press.

The pipeline always processes from the **original upload**, never from its own
output, so pressing the button a second time re-derives from a clean source
instead of compounding — a second press with a higher tolerance is not a second
removal pass over already-cleared pixels. That same ref makes
"Reset Background" a one-liner.

Reset all of this in the modal-close effect at
[line 1415](components/ui/universal-image-editor-modal.tsx:1415) alongside the
existing state resets.

### 2.4 UI placement

The **button** goes in the bottom action row, immediately after Auto-size, so it
sits alongside the other one-press actions rather than being buried in the
scrolling side panel. Auto-size lives inside the shared
[`ImageEditorControls`](components/ui/image-editor-controls.tsx:41), so that
component gains an optional `actions?: React.ReactNode` slot rendered after the
Auto-size button. It is opt-in, so
[`simple-image-editor-modal.tsx`](components/ui/simple-image-editor-modal.tsx:1)
is unaffected.

**The action row must wrap — this is load-bearing, not cosmetic.** The row is a
`justify-between` flex row, and the modal wrapper is `overflow-hidden`. Adding a
fourth button makes the left group exceed the available width; because the new
button is the last child of that group, it is clipped *before* the right-hand
Cancel/Save group is. The symptom is indistinguishable from the feature not
existing at all — it rendered, in the DOM, off the edge. `flex-wrap` plus `gap-2`
on the row is what keeps it visible; removing those classes silently hides the
button again.

The **settings and status** stay in a card at the top of the right info panel
([line 2757](components/ui/universal-image-editor-modal.tsx:2757)), above the
existing Logo Guidelines card: Tolerance, Trim transparent edges, Reset
Background, the detected-backdrop readout and the warning/info lines. Splitting
them this way keeps one primary action (in the toolbar) while the panel holds the
inputs that action consumes. The panel is already `overflow-y-auto`; the toolbar
is not scrollable, which is why the action belongs there.

**The button is a two-state toggle.** One control, no separate undo affordance:

| State | Label | Action |
| --- | --- | --- |
| Nothing removed yet | **Remove Background** | Runs the pipeline, then auto-sizes |
| Removal applied | **Undo Background Removal** | Re-seeds the original upload |

Undoing restores the untouched original, so a second removal always re-runs from
a clean source rather than compounding on the first result — which is also how a
user re-runs with a different tolerance: undo, adjust, press again. The card's
hint says exactly that.

**Reset undoes a removal too.** `resetImage()` already rebuilds from
`originalImageSrc`, so it undid the *image* — but it left `bgRemoval` untouched,
stranding the toolbar button on "Undo Background Removal" with nothing left to
undo. The state clear is therefore extracted into `clearBgRemovalState()` and
called from both the toggle's undo branch and Reset, so the two can never
disagree about whether a removal is applied.

The button uses the same `variant="outline" size="sm"` styling and the same
responsive height ramp as Center / Reset / Auto-size, so it reads as one of the
row rather than a special case. Only the icon changes with state (`Eraser` vs
`RotateCcw`).

**Removal also auto-sizes.** The trimmed artwork has a different aspect ratio, so
leaving it at the pre-removal scale would waste the whole point of the feature.
`autoSizeImage()` cannot be called straight after the re-seed because the Fabric
canvas is rebuilt asynchronously (mode detection, then the image load), so a
`pendingAutoSizeRef` flag is set at removal time and consumed by a dedicated
effect that waits for the new object to exist. That effect intentionally has no
dependency array — no piece of state signals canvas readiness — and its guards
make the repeat runs free.

Card contents:

- **Tolerance** slider — a plain value consumed by the next press. Dragging it
  changes nothing on its own.
- **Trim transparent edges** — checkbox, consumed by the same press.
- Detected backdrop swatch, "No solid background detected", or the
  already-transparent note — populated only from the last completed run, so the
  card is blank until the first press.
- Inline error/info line for the two reporting cases above.
- The artwork-risk warning, whose escape hatch is the toolbar undo.

The card deliberately holds **no** action button: undo and re-run both live on
the single toolbar control, so there is exactly one press to find.

### 2.5 SVG

The `logo` and `normalizer` configs accept `.svg`
([line 131](components/ui/universal-image-editor-modal.tsx:131)), but rasterising
an SVG through an `<img>` yields its intrinsic size, which is often small, and
detection on vector art is unreliable. Recommended default: hide the control for
SVG sources and show a short note that SVG logos are already vector and carry
their own transparency. Revisit only if a real SVG case needs it.

## Phase 3 — Transparency-safe presentation

The checkerboard already exists behind the editing canvas
([line 2555](components/ui/universal-image-editor-modal.tsx:2555)), but the
previews do not have it. After removal a transparent logo would be shown as
white-on-white. Required changes:

| Location | Current | Change |
| --- | --- | --- |
| Trigger preview box | `bg-white dark:bg-gray-700` ([line 2423](components/ui/universal-image-editor-modal.tsx:2423)) | checkerboard, shared style |
| Logo preview box | `bg-white` ([line 2870](components/ui/universal-image-editor-modal.tsx:2870)) | checkerboard, shared style |
| Normalizer header bar preview | `bg-white` ([line 2837](components/ui/universal-image-editor-modal.tsx:2837)) | keep white — it represents the real header |

Extract the existing inline checkerboard gradient into one shared constant so the
canvas and previews cannot drift apart.

Additionally, warn when the removal may have eaten artwork: if the detected
backdrop colour is close to the logo's dominant artwork colour (reuse
[`extractColorsFromImage()`](lib/extract-colors-from-image.ts:47) or the removal
result's colour histogram), surface "The logo artwork may share the background
colour. Check the preview." — with **Reset Background** as the escape hatch.

No changes are needed on the save path. `handleSave` already picks the format via
[`detectTransparency()`](components/ui/universal-image-editor-modal.tsx:1729) on
the export canvas, so a transparent logo exports as PNG with a `.png` filename
and uploads with `image/png` to the `advisor/logo` subpath
([line 1801](components/ui/universal-image-editor-modal.tsx:1801)). Because the
crop rect uses the bounding rect, the saved file is also tight to the artwork —
which is the point of the feature.

## Phase 4 — Optional polish

- Manual colour override (colour input or eyedropper) for the non-uniform case,
  wired to `colorOverride`.
- **Show original** toggle for before/after comparison.
- Adopt the helper in [`simple-image-editor-modal.tsx`](components/ui/simple-image-editor-modal.tsx:1)
  if banner or thumbnail artwork ever needs it.

Deliberately excluded: any upload-time detection, modal-open detection, or
automatic "we noticed a solid backdrop" suggestion. Every one of those requires
analysing the user's image before they ask for it, which is the behaviour being
avoided. The card stays inert until the button is pressed.

## Risks and edge cases

| Risk | Mitigation |
| --- | --- |
| Tainted canvas throws on `getImageData` | Blob-fetch to a same-origin object URL before reading ([line 47](lib/extract-colors-from-image.ts:47)) |
| Global colour key punches holes in white artwork | Connectivity-scoped flood fill from the border only |
| Grey halo left on white backdrops | Soft-edge alpha ramp |
| Artwork colour equals backdrop colour | Post-removal warning plus the undo toggle |
| Non-uniform border (photo, gradient, textured) | `uniformity` gate → explicit "no solid background" message plus manual override |
| Double-dispose of the Fabric canvas during re-seed | Null the ref immediately after `dispose()`, mirroring the existing cleanup |
| Silent or surprise modification of a brand asset | Nothing runs without a button press — no detection on upload and none on modal open |
| Compounding removals on repeated presses | Every run re-derives from the original bitmap, never from the previous output |
| User drags tolerance and sees no change | The card hint states that undo then press is what re-runs with a new tolerance |
| Trimmed artwork left at the pre-removal scale | `pendingAutoSizeRef` triggers a fit once the rebuilt canvas exists |
| Large source images | Cap the working canvas at 4096 px longest side |
| Existing transparent PNGs | `alreadyTransparent` short-circuit with an informational message |
| Aspect-ratio bucket changes after trim | Expected — the aspect-ratio cap warning and normalizer header bucket recompute on re-seed |

## Files

| Action | File |
| --- | --- |
| Create | [`lib/image-background-removal.ts`](lib/image-background-removal.ts:1) |
| Modify | [`components/ui/universal-image-editor-modal.tsx`](components/ui/universal-image-editor-modal.tsx:294) |
| Modify | [`components/ui/image-editor-controls.tsx`](components/ui/image-editor-controls.tsx:41) |

The modal holds the `bgRemoval` state, the removal/reset handlers, the reseed
helper, the Background card and the transparency-safe backdrops. The controls
component gains only the opt-in `actions` slot that hosts the button.

No call site changed: the feature is reached through the `logo` and `normalizer`
configs, which all 14 logo entry points already use.

## Verification

- Upload or open a logo with a solid white backdrop → the canvas, the previews,
  and the eventual export are unchanged until Remove Background is pressed.
- Drag the tolerance slider without pressing the button → nothing changes. Press
  the button → the new tolerance applies.
- White-backdrop JPEG logo → removal yields a PNG, the auto-fit scale jumps up,
  and the saved `.png` crop is tight to the artwork.
- Black-backdrop PNG logo → same, with the dark artwork preserved.
- Transparent-background PNG → "already transparent" message; trim still tightens it.
- Logo with white text inside a coloured badge → text survives (connectivity check).
- Logo whose artwork touches the border → flood fill leaves the artwork intact and
  the trim box hugs it.
- Metadata-only image (no alpha) → JPEG export preserved, no PNG regression.
- Cross-origin logo URL → no `SecurityError`; friendly error if the fetch fails.
- SVG upload → control hidden; modal behaves exactly as before.
- Dark mode → no white-on-white or black-on-dark invisible preview.
- Every logo entry point listed in the plan for `type="logo"` and
  `type="normalizer"` (Step 1 company logo, banner editor, contact logo,
  contact form slide, benefits Step 1, summary edit modal, edit-client page,
  branding setup card, key contacts, video Step 1, company logo section,
  benefits section editor) renders the control and saves correctly.
- Re-open a saved logo → the removal is re-runnable from the stored original.
