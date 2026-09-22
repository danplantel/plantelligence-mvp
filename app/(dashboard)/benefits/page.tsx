"use client";

import { BenefitsListPage } from "@/components/pages/benefits/benefits-list";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect } from "react";

export default function BenefitsPage() {
  const { setTitle } = usePageTitleContext();

  useEffect(() => {
    setTitle("Benefits");
  }, [setTitle]);

  return <BenefitsListPage />;
}
