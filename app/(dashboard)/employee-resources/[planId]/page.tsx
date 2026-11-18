"use client";

import { useParams } from "next/navigation";

import { EmployeeResourcesPreview } from "@/components/pages/employee-resources/employee-resources-preview";

/**
 * Employee Resources admin (TF-6).
 *
 * The fifth hub is not a benefit category, so it has no Create/Edit Benefit page to live
 * on. This surface shows the plan's REAL portal page — and the portal's own Editing
 * Panel, armed on the hub's hero section — instead of a second editor beside it. See
 * [`EmployeeResourcesPreview`](../../../components/pages/employee-resources/employee-resources-preview.tsx:86)
 * for why the panel is the one inside the frame rather than a re-implementation.
 */
export default function EmployeeResourcesAdminPage() {
  const params = useParams();
  const planId = typeof params?.planId === "string" ? params.planId : "";

  if (!planId) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <p className="text-sm text-neutral-600">Select a plan first.</p>
      </div>
    );
  }

  return <EmployeeResourcesPreview planId={planId} />;
}
