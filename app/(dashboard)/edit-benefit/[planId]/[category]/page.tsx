"use client";

import { useParams } from "next/navigation";
import { BenefitEditPage } from "@/components/pages/benefits/benefit-edit-page";
import { NoAccessNotice } from "@/components/pages/no-access-notice";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { slugToCategory } from "@/lib/benefit-category-slug";

export default function EditBenefitRoute() {
  const params = useParams<{ planId: string; category: string }>();

  const planId = typeof params?.planId === "string" ? params.planId : "";
  // The segment carries a URL-safe slug (e.g. "company-plan-sponsor") because
  // "Company / Plan Sponsor" contains a slash.
  const category =
    typeof params?.category === "string" ? slugToCategory(params.category) : "";

  // T2 Part A: a user who reaches this page directly must see the restricted
  // state rather than the editor. The API enforces the same rule on every read
  // and write — this only decides what to render, and it asks the server rather
  // than guessing.
  const access = usePlanAccess({
    planId,
    category,
    permission: "create_benefits",
    level: "view",
  });

  if (access.status === "denied") {
    return <NoAccessNotice message={access.message} reason={access.reason} />;
  }

  if (access.status === "loading") {
    // Identity is being established; render nothing rather than flashing an
    // editor the user may not be allowed to use.
    return null;
  }

  return <BenefitEditPage planId={planId} category={category} />;
}
