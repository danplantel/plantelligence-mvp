# Shared Image Editor Core — Extraction Plan

## Goal

Reduce the duplicated Fabric.js plumbing between
[`simple-image-editor-modal.tsx`](components/ui/simple-image-editor-modal.tsx) and
[`universal-image-editor-modal.tsx`](components/ui/universal-image-editor-modal.tsx)
**without** merging them into a single mega-component.

- Keep both modals as public, independently evolving components.
- Extract only the stable, bug-prone shared pieces so fixes (like the recent
  Center button refactor) land in one place.

## Scope boundaries

In scope:

- Shared editor controls (Scale slider + Center/Reset/Auto-size).
- Shared client-side crop/export math (DPR-safe crop source scaling, crop
  metadata percentages, transparency detection).
- Shared Fabric canvas lifecycle hook (init/dispose, uniform scaling,
  Shift-centered scaling, guideline overlay rendering).

Out of scope (stay in the individual modals):

- Type configs and preview formats (Universal only).
- R2 upload/persistence (Universal only).
- ZIP import / drag-and-drop (Universal only).
- `exportScale` and `canvasOverlay` (Simple only).
- Headshot circle coverage, aspect-ratio caps, header metrics (Universal only).

## Current duplication inventory

| Concern | Simple modal | Universal modal |
| --- | --- | --- |
| Canvas init/dispose | [lines 463-656](components/ui/simple-image-editor-modal.tsx:463) | [lines 1188-1386](components/ui/universal-image-editor-modal.tsx:1188) |
| Object event wiring + uniform scaling + Shift-centered scaling | [lines 758-977](components/ui/simple-image-editor-modal.tsx:758) | [lines 1417-1579](components/ui/universal-image-editor-modal.tsx:1417) |
| Guideline overlay drawing | [lines 898-944](components/ui/simple-image-editor-modal.tsx:898) | [lines 1475-1551](components/ui/universal-image-editor-modal.tsx:1475) |
| Center / Reset / Auto-size buttons | [lines 1749-1778](components/ui/simple-image-editor-modal.tsx:1749) | [lines 3033-3062](components/ui/universal-image-editor-modal.tsx:3033) |
| Scale slider + % readout | [lines 1693-1747](components/ui/simple-image-editor-modal.tsx:1693) | [lines 2967-3014](components/ui/universal-image-editor-modal.tsx:2967) |
| DPR-safe crop source scaling | [lines 573-596](components/ui/simple-image-editor-modal.tsx:573), [lines 1074-1095](components/ui/simple-image-editor-modal.tsx:1074) | [lines 1718-1745](components/ui/universal-image-editor-modal.tsx:1718) |
| Crop metadata (percentages) | [lines 998-1039](components/ui/simple-image-editor-modal.tsx:998) | [lines 1776-1813](components/ui/universal-image-editor-modal.tsx:1776) |
| Transparency detection | PNG-only (n/a) | [lines 1747-1755](components/ui/universal-image-editor-modal.tsx:1747) |

## Phase 1 — Shared controls component

New file: [`components/ui/image-editor-controls.tsx`](components/ui/image-editor-controls.tsx)

Extract the Scale slider + Center/Reset/Auto-size button row used by both modals.

Proposed props:

- `scale`, `baseScale`, `minScale`, `maxScale` (controlled values)
- `onScaleChange(newScale: number)` — slider drag updates
- `onScaleCommit()` — slider release (Simple debounces preview; Universal can
  call its preview/safe-zone refresh)
- `onCenter()`, `onReset()`, `onAutoSize()`
- `disabled?: boolean`
- `showScale?: boolean` (Universal sets false when `config.allowScaling` is false)
- `slot?: React.ReactNode` for extra buttons (Universal's canvas-mode toggle, the
  Show Guidelines checkbox can stay outside)

Standardize the slider percent math on the guarded version already used by
Universal ([lines 2973-2979](components/ui/universal-image-editor-modal.tsx:2973)):

- `range = maxScale - minScale`
- guard `range === 0 || !Number.isFinite(range)` → 50
- clamp result to `[0, 100]`

This removes ~45 lines from each modal and, importantly, makes the
Center/Reset/Auto-size behavior a single source of truth.

## Phase 2 — Shared crop/export math

New file: [`lib/image-editor-crop.ts`](lib/image-editor-crop.ts) (browser-only,
no server imports).

Extract the DPR-safe logic that has near-identical copies with matching comments:

1. `getBackingScale(canvas: FabricCanvas): number`
   - From Universal [lines 1718-1724](components/ui/universal-image-editor-modal.tsx:1718):
     `lowerCanvasEl.width / canvas.getWidth()`, defaulting to `1`.
   - Simple currently derives the same value as `img.naturalWidth / logicalW`
     (from an exported PNG), which is equivalent but indirect. Switch Simple to
     `getBackingScale()` where it exports from the live canvas.

2. `cropToDataUrl({ canvas, rect, scale }): string`
   - Wraps the `cropCanvas` + `ctx.drawImage(srcRect → destRect)` logic from
     Simple [lines 1084-1095](components/ui/simple-image-editor-modal.tsx:1084)
     and Universal [lines 1731-1745](components/ui/universal-image-editor-modal.tsx:1731).
   - Parameters: source canvas element, crop rect in logical px, destination
     width/height, backing scale.

3. `detectTransparency(canvas: HTMLCanvasElement): boolean`
   - From Universal [lines 1747-1755](components/ui/universal-image-editor-modal.tsx:1747).
   - Returns true if any alpha < 255; Simple can later use it too if needed.

4. `buildCropMetadata(activeObject, canvasWidth, canvasHeight, cropRect): CropMetadata`
   - Consolidates the percentage math from Simple
     [lines 998-1039](components/ui/simple-image-editor-modal.tsx:998) and
     Universal [lines 1776-1813](components/ui/universal-image-editor-modal.tsx:1776).
   - The crop-rect derivation itself stays in each modal (they compute the rect
     differently), but the rect → percentage/`CropMetadata` mapping is shared.

## Phase 3 — Shared Fabric lifecycle hook

New file: [`hooks/use-fabric-image-editor.ts`](hooks/use-fabric-image-editor.ts)

Extract only the boilerplate that is identical in both modals:

- Canvas creation + disposal and the `fabricCanvasRef` plumbing.
- Uniform scaling sync (`object:scaling` keeps `scaleX === scaleY`) from
  Simple [lines 814-827](components/ui/simple-image-editor-modal.tsx:814) and
  Universal [lines 1435-1443](components/ui/universal-image-editor-modal.tsx:1435).
- Shift-key centered-scaling toggle from
  Simple [lines 867-883](components/ui/simple-image-editor-modal.tsx:867) and
  Universal [lines 1446-1462](components/ui/universal-image-editor-modal.tsx:1446).
- `after:render` guideline overlay registration, parameterized by a
  `drawOverlay(ctx, canvas, state)` callback so each modal keeps its own
  guideline shapes (rect vs circle).

Because each modal's event handlers diverge (Simple debounces previews via
`isEditingRef` + timeouts; Universal regenerates immediately), the hook should
**not** own preview generation. It accepts callbacks:

- `onObjectModified(obj)`
- `onObjectMoving(obj)`
- `onScale(obj)`
- `drawOverlay(ctx, canvas, state)`

Return value: `{ canvasRef, fabricCanvasRef }`.

This removes the canvas lifecycle + input plumbing duplication while leaving each
modal's state machine intact.

## Phase 4 — Wire up and verify

1. Replace the inline button/slider block in Simple
   ([lines 1693-1778](components/ui/simple-image-editor-modal.tsx:1693)) with
   [`image-editor-controls.tsx`](components/ui/image-editor-controls.tsx).
2. Replace the inline block in Universal
   ([lines 2967-3062](components/ui/universal-image-editor-modal.tsx:2967)).
3. Swap the duplicated crop/export math for
   [`lib/image-editor-crop.ts`](lib/image-editor-crop.ts) in both save/preview paths.
4. Adopt [`use-fabric-image-editor.ts`](hooks/use-fabric-image-editor.ts) in both
   modals, moving only the shared boilerplate and passing type-specific callbacks.
5. Run `pnpm lint` and `npx tsc --noEmit`.
6. Manual QA across representative flows:
   - Headshot (circle guide, coverage warning) — Universal `type="headshot"`.
   - Logo / normalizer (safe zone, AR cap, header metrics, compact mode) —
     Universal `type="logo"` / `type="normalizer"`.
   - Background / banner / thumbnail (frame crop, `exportScale`, `canvasOverlay`) —
     Simple.
   - Confirm Center now only horizontal-centers in both, Reset and Auto-size are
     unchanged.

## Risks and mitigations

- **Behavioral drift during extraction** — Phase by phase, each phase leaves the
  app green (lint + typecheck + targeted QA) before the next.
- **Subtle crop differences** — Keep crop-rect derivation in each modal; only the
  rect → output mapping is shared.
- **Preview debounce divergence** — The hook does not own preview generation, so
  the Simple vs Universal debounce behavior is preserved.

## Deliverables

1. [`components/ui/image-editor-controls.tsx`](components/ui/image-editor-controls.tsx)
2. [`lib/image-editor-crop.ts`](lib/image-editor-crop.ts)
3. [`hooks/use-fabric-image-editor.ts`](hooks/use-fabric-image-editor.ts)
4. Updated [`simple-image-editor-modal.tsx`](components/ui/simple-image-editor-modal.tsx)
   and [`universal-image-editor-modal.tsx`](components/ui/universal-image-editor-modal.tsx)
   to consume the shared pieces.

## Implementation status

Completed. `pnpm`-style `eslint` on all touched files and `npx tsc --noEmit`
both pass with no errors.

- **Phase 1** — [`image-editor-controls.tsx`](components/ui/image-editor-controls.tsx)
  extracted and wired into both modals (simple JSX replaced; universal scale +
  checkbox + buttons replaced; the "Show Guidelines" checkbox is passed as
  `children`; Universal's `config.allowScaling` maps to `showScale`).
- **Phase 2** — [`image-editor-crop.ts`](lib/image-editor-crop.ts) provides
  `getBackingScale`, `drawCroppedImage`, `cropImageToDataUrl`,
  `detectTransparency`, and `buildCropMetadata`. Universal's save path now uses
  `getBackingScale` + `drawCroppedImage` + `detectTransparency` +
  `buildCropMetadata`; Simple's three crop-draw sites (initial preview,
  `generatePreview`, and `handleSave`) now use `cropImageToDataUrl`, and its
  metadata uses `buildCropMetadata`.
- **Phase 3 (scoped)** — [`use-fabric-image-editor.ts`](hooks/use-fabric-image-editor.ts)
  provides the byte-for-byte duplicated input plumbing (`handleUniformScale` and
  `installShiftCenteredScaling`) and both modals consume them. Deliberately left
  per-modal: full canvas init/dispose (Simple keys off `isInitializedRef` +
  guideline metrics; Universal off responsive dims + `isDetectingMode` + config
  fit rules) and the guideline overlay bodies (rect vs safe-zone/circle, drawn
  from modal state) — these differ too much to share without regression risk.
- **Remaining manual QA** — a browser run is recommended to visually confirm:
  headshot circle editor, logo/normalizer safe-zone editor, and
  background/thumbnail (Simple) frame editor still position/export correctly,
  and that Center horizontal-centers only while Reset/Auto-size are unchanged.
