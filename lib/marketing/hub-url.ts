/**
 * Canonical Benefits Hub entry path (employee-facing portal root).
 * Must stay aligned with portal routing (e.g. portal-plan-header base path).
 */

export function getBenefitsHubPath(clientId: string): string {
  const id = String(clientId || "").trim();
  if (!id) {
    throw new Error("clientId is required for Benefits Hub URL");
  }
  return `/new/view/${id}`;
}

/**
 * Absolute URL used in flyer QR codes. Requires server env configuration.
 */
export function getBenefitsHubAbsoluteUrl(clientId: string): string {
  const path = getBenefitsHubPath(clientId);
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "";

  if (!base) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL to build flyer Hub QR links",
    );
  }

  return `${base}${path}`;
}
