"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DocumentsUploadPage() {
  const router = useRouter();

  // Redirect to main documents page with upload tab
  useEffect(() => {
    router.replace("/new/documents?tab=upload");
  }, [router]);

  return null;
}
