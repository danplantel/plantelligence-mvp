"use client";

import { formatUsDate, formatUsTime } from "@/lib/date";
import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Trash2,
  Download,
  FileText,
  Calendar,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { useMarketingPdfStore } from "@/lib/marketing-pdf-store";
import type { MarketingDocument } from "@/lib/marketing-pdf-store";
import { useState } from "react";

interface SavedPdfsSectionProps {
  selectedPlanId: string;
  planName?: string;
}

export function SavedPdfsSection({
  selectedPlanId,
  planName,
}: SavedPdfsSectionProps) {
  const {
    documentsCache,
    isLoading,
    fetchDocuments,
    deleteDocument,
    getDocuments,
    isDeleting,
  } = useMarketingPdfStore();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    title: string;
    viewUrl: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const { toast } = useToast();

  // Get documents from store - will automatically update when cache changes
  const documents = useMemo(() => {
    if (!selectedPlanId) return [];
    return getDocuments(selectedPlanId);
  }, [selectedPlanId, documentsCache, getDocuments]);

  // Fetch documents when plan is selected
  useEffect(() => {
    if (selectedPlanId) {
      fetchDocuments(selectedPlanId).catch((error) => {
        console.error("Failed to fetch documents:", error);
      });
    }
  }, [selectedPlanId, fetchDocuments]);

  // Subscribe to store changes to auto-refresh when documents are added
  useEffect(() => {
    if (selectedPlanId && documentsCache[selectedPlanId]) {
      // Documents are already in cache, component will re-render automatically
    }
  }, [selectedPlanId, documentsCache]);

  const handlePreview = (document: MarketingDocument) => {
    // Use fileUrl if available (especially for newly saved documents with base64 data URLs)
    // Otherwise fall back to API endpoint
    const viewUrl =
      document.fileUrl && document.fileUrl.trim() !== ""
        ? document.fileUrl
        : `/api/documents/${document.id}/view`;
    setPreviewDocument({
      id: document.id,
      title: document.title,
      viewUrl: viewUrl,
    });
    setPreviewOpen(true);
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/view`);
      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: "PDF is downloading...",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Unable to download the document",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (documentId: string, documentTitle: string) => {
    setDocumentToDelete({ id: documentId, title: documentTitle });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete || !selectedPlanId) return;

    const success = await deleteDocument(documentToDelete.id, selectedPlanId);

    if (success) {
      toast({
        title: "Document deleted",
        description: "PDF has been deleted successfully",
      });
    } else {
      toast({
        title: "Delete failed",
        description: "Unable to delete the document. Please try again.",
        variant: "destructive",
      });
    }

    setDocumentToDelete(null);
    setDeleteDialogOpen(false);
  };

  if (!selectedPlanId) {
    return null;
  }

  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Saved PDFs</CardTitle>
          <p className="text-sm text-muted-foreground">
            {planName
              ? `All saved PDFs for ${planName}`
              : "All saved PDFs for selected plan"}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading[selectedPlanId] ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading saved PDFs...</span>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-600">
                No saved PDFs yet. Create and save your first PDF above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((document) => {
                const uploadedDate = formatUsDate(document.uploadedAt);
                const uploadedTime = formatUsTime(document.uploadedAt);

                return (
                  <Card
                    key={document.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2 flex-1">
                          <FileText className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {document.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {document.fileName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-3 w-3 mr-1.5 text-gray-400" />
                          <span>
                            {uploadedDate} at {uploadedTime}
                          </span>
                        </div>
                        {document.language && (
                          <div className="text-xs text-gray-500">
                            Language: {document.language}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handlePreview(document)}
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownload(document.id, document.fileName)
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDeleteClick(document.id, document.title)
                          }
                          disabled={isDeleting(document.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {isDeleting(document.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          isOpen={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewDocument(null);
          }}
          documentUrl={previewDocument.viewUrl}
          documentName={previewDocument.title}
          documentType="application/pdf"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete PDF Document"
        description={`Are you sure you want to delete "${documentToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
