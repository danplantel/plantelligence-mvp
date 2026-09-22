// Ambient declarations for plain stylesheet side-effect imports.
//
// Next.js compiles `import "./globals.css"` and `import "<pkg>/styles.css"` at
// build time, but TypeScript 5.6+ reports
//   "Cannot find module or type declarations for side-effect import"
// for such imports when no ambient declaration exists.
//
// The editor can use a newer TypeScript than the workspace (`typescript@5.2.2`),
// so this shows up as errors on `app/layout.tsx` in the editor even though
// `tsc --noEmit` passes. This declaration keeps both in agreement.
//
// This project uses no CSS Modules (`*.module.css`), so a single wildcard
// declaration is safe here and does not weaken any typed CSS-module imports.

declare module "*.css";
