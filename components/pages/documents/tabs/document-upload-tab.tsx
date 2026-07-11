"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ComplianceDocumentsUpload } from "../components/compliance-documents-upload";

interface DocumentUploadTabProps {
  selectedPlan: string;
  onHasUnsavedChangesChange?: (hasUnsaved: boolean) => void;
  showSaveButton?: boolean;
  onDocumentsSaved?: () => void;
  onSaveFunctionReady?: (saveFn: () => Promise<void>) => void;
  onDocumentsAdded?: () => void;
}

export function DocumentUploadTab({
  selectedPlan,
  onHasUnsavedChangesChange,
  showSaveButton = true,
  onDocumentsSaved,
  onSaveFunctionReady,
  onDocumentsAdded,
}: DocumentUploadTabProps) {
  if (!selectedPlan) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Please select a plan above to upload documents
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ComplianceDocumentsUpload
      clientId={selectedPlan}
      showPreview={false}
      showInfoCard={false}
      brandColor="#002B5B"
      accentColor="#6B7280"
      showSaveButton={showSaveButton}
      onHasUnsavedChangesChange={onHasUnsavedChangesChange}
      onSave={onDocumentsSaved}
      onSaveFunctionReady={onSaveFunctionReady}
      onDocumentsAdded={onDocumentsAdded}
    />
  );
}
