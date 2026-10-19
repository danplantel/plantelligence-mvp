/**
 * The one place the post-account-deletion redirect lives.
 *
 * Kept as a named helper rather than an inline `window.location.assign` so the
 * Settings page can be tested without jsdom's non-configurable `location`.
 */
export const SIGN_IN_PATH = "/signin";

export function redirectToSignIn() {
  window.location.assign(SIGN_IN_PATH);
}
