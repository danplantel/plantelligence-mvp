"use client";

import { useParams } from "next/navigation";

import { EmployeeResourcesEditor } from "@/components/pages/benefits/employee-resources-editor";

/**
 * Employee Resources admin (TF-6).
 *
 * The fifth hub is not a benefit category, so it has no Create/Edit Benefit page to
 * live on. This is its own surface: the enable toggle plus the same Quick Answers
 * builder, scoped to this plan.
 */
export default function EmployeeResourcesAdminPage() {
  const params = useParams();
  const planId = params.planId as string;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Employee Resources
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-gray-400">
          Publish an HR hub beside the benefit categories.
        </p>
      </div>

      {planId ? (
        <EmployeeResourcesEditor planId={planId} />
      ) : (
        <p className="text-sm text-neutral-600">Select a plan first.</p>
      )}
    </div>
  );
}
