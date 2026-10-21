/**
 * Full-page navigation to an app path.
 *
 * Kept as a named helper rather than an inline `window.location.href`, following
 * the same pattern as `lib/redirect-to-signin.ts`: jsdom makes `location.href`
 * non-configurable, so tests cannot spy on it and a real assignment prints
 * "Not implemented: navigation to another Document". Mock this module in tests
 * that assert where a flow sends the browser.
 */
export function hardNavigate(path: string): void {
  window.location.href = path;
}
