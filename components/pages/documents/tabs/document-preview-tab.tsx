"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DocumentsCardsView } from "../views/documents-cards-view";
import type { RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { BenefitsCategory } from "@/types/new-client-wizard";

interface DocumentPreviewTabProps {
  selectedPlan: string;
  isLoading: boolean;
  documents: RetirementDocumentItem[];
  onDelete: (documentId: string, documentTitle: string) => void;
  onDownload: (documentId: string, fileName: string) => void;
  onDocumentsChange?: () => void;
  /** When true (wizard), show hint about footer Next button */
  showWizardNextHint?: boolean;
  onSaveEdit?: (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => Promise<void>;
  brandColor?: string;
  accentColor?: string;
}

export function DocumentPreviewTab({
  selectedPlan,
  isLoading,
  documents,
  onDelete,
  onDownload,
  onDocumentsChange,
  showWizardNextHint = false,
  onSaveEdit,
  brandColor,
  accentColor,
}: DocumentPreviewTabProps) {
  if (!selectedPlan) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8 dark:text-gray-400">
            Please select a plan to view document preview
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-blue"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3 dark:bg-accent-blue/10 dark:border-accent-blue/30">
        <div className="text-blue-500 mt-0.5 dark:text-accent-blue-light">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-blue-800 font-medium dark:text-accent-blue-light">This is how the documents will display on the Benefits Hub. Please confirm order, titles and descriptions of document cards, you can edit them here.</p>
          {showWizardNextHint && (
            <p className="text-sm text-blue-700 dark:text-accent-blue-light">From this stage, clicking the footer Next button will take you to the next step.</p>
          )}
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-600 text-lg dark:text-gray-400">No documents found.</p>
        </div>
      ) : (
        <DocumentsCardsView
          documents={documents}
          onDelete={onDelete}
          onDownload={onDownload}
          onDocumentsChange={onDocumentsChange}
          onSaveEdit={onSaveEdit}
          brandColor={brandColor}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}
