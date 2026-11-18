"use client";

import { EmployeeResourcesListPage } from "@/components/pages/employee-resources/employee-resources-plans-list";

/**
 * Employee Resources — the dashboard index for the portal's fifth hub (TF-6).
 *
 * The hub itself is not a benefit category, so it is not a row in
 * [`app/(dashboard)/benefits/page.tsx`](<../benefits/page.tsx>) — it needs a
 * destination of its own, which is the sidebar's `Employee Resources` link. The page
 * title is set by the list component, the same arrangement /benefits uses.
 */
export default function EmployeeResourcesPage() {
  return <EmployeeResourcesListPage />;
}
