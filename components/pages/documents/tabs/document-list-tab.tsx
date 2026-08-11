"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentsTableView } from "../views/documents-table-view";
import type { Document, SortColumn, SortDirection } from "../types";

interface DocumentListTabProps {
  selectedPlan: string;
  isLoading: boolean;
  documents: Document[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onPreview: (documentId: string, title: string) => void;
  onDownload: (documentId: string, fileName: string) => void;
  onDelete: (documentId: string, documentTitle: string) => void;
  getDocumentType: (doc: Document) => string;
  onEdit?: (documentId: string, title: string, updates?: { category?: string }) => void;
  /** Passed through to DocumentsTableView – hides the Category dropdown when true. */
  disableCategoryEdit?: boolean;
  availableCategories?: string[];
  /** Switches parent to Upload tab when list is empty */
  onGoToUpload?: () => void;
  /** Compact rows with smaller font sizes (wizard List tab). */
  compact?: boolean;
  /** Hide the upload time, showing only the date. */
  hideUploadedTime?: boolean;
  /** Show tooltips on the quick action buttons. */
  showActionTooltips?: boolean;
  /** Render Edit/Delete as direct buttons instead of the "..." menu. */
  showDirectEditDelete?: boolean;
}

export function DocumentListTab({
  selectedPlan,
  isLoading,
  documents,
  sortColumn,
  sortDirection,
  onSort,
  onPreview,
  onDownload,
  onDelete,
  getDocumentType,
  onEdit,
  availableCategories,
  onGoToUpload,
  compact = false,
  hideUploadedTime = false,
  showActionTooltips = false,
  showDirectEditDelete = false,
  disableCategoryEdit = false,
}: DocumentListTabProps) {
  if (!selectedPlan) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8 dark:text-gray-400">
            Please select a plan to view document list
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

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 max-w-lg mx-auto rounded-lg border border-dashed border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-gray-900 text-lg font-semibold dark:text-gray-100">
          No documents for this plan yet
        </p>
        <p className="text-muted-foreground text-sm dark:text-gray-400">
          Upload files on the Upload Documents tab for this client. They will appear here and in
          preview.
        </p>
        {onGoToUpload ? (
          <Button type="button" onClick={onGoToUpload}>
            Upload documents
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="dark:text-gray-100">Document List</CardTitle>
      </CardHeader>
      <CardContent>
        <DocumentsTableView
          documents={documents}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
          getDocumentType={getDocumentType}
          onEdit={onEdit}
          availableCategories={availableCategories}
          compact={compact}
          hideUploadedTime={hideUploadedTime}
          showActionTooltips={showActionTooltips}
          showDirectEditDelete={showDirectEditDelete}
          disableCategoryEdit={disableCategoryEdit}
        />
      </CardContent>
    </Card>
  );
}
