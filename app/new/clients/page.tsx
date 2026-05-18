"use client";

import { ClientsListDashboardPage } from "@/components/pages/clients-list-dashboard";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useEffect } from "react";

export default function ClientsPage() {
  const { setTitle } = usePageTitleContext();

  useEffect(() => {
    setTitle("All Plans");
  }, [setTitle]);

  return <ClientsListDashboardPage />;
}
