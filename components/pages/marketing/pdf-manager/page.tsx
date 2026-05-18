"use client";

import { formatUsDate, formatUsTime } from "@/lib/date";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Download,
  FileText,
  Building,
  Calendar,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { Label } from "@/components/ui/label";
import { useMarketingPdfStore } from "@/lib/marketing-pdf-store";
import type { MarketingDocument } from "@/lib/marketing-pdf-store";

interface Client {
  id: string;
  companyName: string;
  status?: string;
}

export function MarketingPdfManagerPage() {
  const {
    documentsCache,
    isLoading,
    fetchDocuments,
    deleteDocument,
    clearCache,
    getDocuments,
    isDeleting,
  } = useMarketingPdfStore();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
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

  // Get documents from store
  const documents = useMemo(() => {
    if (!selectedPlanId) return [];
    return getDocuments(selectedPlanId);
  }, [selectedPlanId, documentsCache, getDocuments]);

  // Filter documents by search term
  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents;
    const lowerSearch = searchTerm.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(lowerSearch) ||
        doc.fileName.toLowerCase().includes(lowerSearch),
    );
  }, [documents, searchTerm]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      fetchDocuments(selectedPlanId).catch((error) => {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to load documents",
          variant: "destructive",
        });
      });
    }
  }, [selectedPlanId, fetchDocuments, toast]);

  const fetchClients = async () => {
    try {
      setIsLoadingClients(true);
      const response = await fetch("/api/clients");
      const result = await response.json();

      if (result.success) {
        const activeClients = (result.data || []).filter(
          (client: Client) => client.status === "Active",
        );
        setClients(activeClients);
      }
    } catch (error) {
      console.error("Failed to fetch clients", error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedPlanId) return;
    clearCache(selectedPlanId);
    try {
      await fetchDocuments(selectedPlanId);
      toast({
        title: "Refreshed",
        description: "Documents list has been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh documents",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (document: MarketingDocument) => {
    // Use fileUrl if available (from client documents API), otherwise use view endpoint
    const viewUrl = document.fileUrl || `/api/documents/${document.id}/view`;
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Marketing PDF Manager</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage all marketing PDFs created with PDF Builder
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={!selectedPlanId || isLoading[selectedPlanId]}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  isLoading[selectedPlanId] ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Plan Selection */}
          <div className="space-y-2 mb-6">
            <Label>Select Plan</Label>
            <Select
              value={selectedPlanId}
              onValueChange={setSelectedPlanId}
              disabled={isLoadingClients}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue
                  placeholder={
                    isLoadingClients ? "Loading plans..." : "Choose a plan..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Plans</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents or clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Documents Grid */}
          {isLoading[selectedPlanId] ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading documents...</span>
              </div>
            </div>
          ) : !selectedPlanId ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-600 text-lg">
                Please select a plan to view marketing PDFs.
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-600 text-lg">
                {documents.length === 0
                  ? "No marketing PDFs found for this plan. Create your first PDF using the PDF Builder."
                  : "No documents match your search filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((document) => {
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
