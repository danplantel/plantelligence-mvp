"use client";

import { SetupCompleteSection } from "./sections";
import PortalPreviewSection from "./sections/portal-preview-section";

export function NewClientStep3() {
  return (
    <div className="space-y-6">
      <SetupCompleteSection />
      <PortalPreviewSection />
    </div>
  );
}
