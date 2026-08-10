"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
  const [isInfoVisible, setIsInfoVisible] = useState(true);

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
      {isInfoVisible && (
        <Alert className="relative mb-6 border-blue-200 bg-blue-50 pr-10 dark:border-blue-800 dark:bg-blue-950/30">
          <AlertTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Plan Documents Overview
          </AlertTitle>
          {showWizardNextHint && (
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
              This is how the documents will display on the Benefits Hub. Please confirm order, titles and descriptions of document cards, you can edit them here.            </AlertDescription>
          )}
          <button
            type="button"
            onClick={() => setIsInfoVisible(false)}
            className="absolute top-2 right-2 p-1 rounded-md text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:text-accent-blue-light dark:hover:text-white dark:hover:bg-accent-blue/20 transition-colors"
            aria-label="Close info banner"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

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
