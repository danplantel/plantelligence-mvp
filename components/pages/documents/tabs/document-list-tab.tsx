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
  availableCategories?: string[];
  /** Switches parent to Upload tab when list is empty */
  onGoToUpload?: () => void;
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
      <div className="px-6 pb-2">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3 dark:bg-accent-blue/10 dark:border-accent-blue/30">
          <div className="text-blue-500 mt-0.5 dark:text-accent-blue-light">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
          </div>
          <div>
            <p className="text-sm text-blue-800 font-medium dark:text-accent-blue-light">Please confirm document categories, then click Next to preview Document sections.</p>
          </div>
        </div>
      </div>
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
        />
      </CardContent>
    </Card>
  );
}
