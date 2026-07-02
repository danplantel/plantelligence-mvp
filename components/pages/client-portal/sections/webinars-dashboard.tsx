"use client";

import { HaveQuestionsSection } from "./have-questions-section";
import { DocumentsSection } from "./documents-section";
import { WebinarsSection } from "./webinars-section";

interface WebinarsDashboardProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  enableEditing?: boolean;
}

export function WebinarsDashboard({
  brandColor,
  secondaryColor,
  clientId,
  enableEditing = false,
}: WebinarsDashboardProps) {
  return (
    <>
      <WebinarsSection brandColor={brandColor} secondaryColor={secondaryColor} clientId={clientId} />
    </>
  );
}
