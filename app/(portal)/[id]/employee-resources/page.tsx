"use client";

import { useParams } from "next/navigation";

import { EmployeeResourcesPortalPage } from "@/components/pages/employee-resources/employee-resources-portal-page";

/**
 * Employee Resources — the fifth hub (TF-6).
 *
 * The page body lives in [`EmployeeResourcesPortalPage`](<../../../components/pages/employee-resources/employee-resources-portal-page.tsx:60>)
 * because the dashboard's plan-scoped preview renders the same page beside the portal's
 * Editing Panel. This route only resolves the plan from `[id]`, which the portal
 * addresses by slug.
 */
export default function EmployeeResourcesPage() {
  const params = useParams();
  const clientId = typeof params?.id === "string" ? params.id : "";

  if (!clientId) return null;

  return <EmployeeResourcesPortalPage clientId={clientId} />;
}
