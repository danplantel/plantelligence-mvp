"use client";

import { useParams } from "next/navigation";
import { BenefitEditPage } from "@/components/pages/benefits/benefit-edit-page";
import { slugToCategory } from "@/lib/benefit-category-slug";

export default function EditBenefitRoute() {
  const params = useParams<{ planId: string; category: string }>();

  const planId = typeof params?.planId === "string" ? params.planId : "";
  // The segment carries a URL-safe slug (e.g. "company-plan-sponsor") because
  // "Company / Plan Sponsor" contains a slash.
  const category =
    typeof params?.category === "string" ? slugToCategory(params.category) : "";

  return <BenefitEditPage planId={planId} category={category} />;
}
