/**
 * Debug logger for the onboarding route handlers.
 *
 * The wizard APIs used to `console.log` every write, including submitted
 * profile and branding payloads. That flooded the unit-test output and put
 * user data into production logs. Debug lines now survive only in local
 * development, or when `ONBOARDING_DEBUG=1` is set explicitly; tests and
 * production stay silent.
 *
 * `console.error` is deliberately NOT routed through this helper — failure
 * paths should still be visible in production logs.
 */
export function onboardingDebug(...args: unknown[]): void {
  if (
    process.env.NODE_ENV === "development" ||
    process.env.ONBOARDING_DEBUG === "1"
  ) {
    console.log(...args);
  }
}
