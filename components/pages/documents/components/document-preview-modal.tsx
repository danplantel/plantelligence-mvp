"use client";

import { Button } from "@/components/ui/button";
import { FileText, Download, X } from "lucide-react";
import { toast } from "sonner";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    blobUrl?: string;
  } | null;
  isLoading: boolean;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  document,
  isLoading,
}: DocumentPreviewModalProps) {
  if (!isOpen) return null;

  const handleDownload = () => {
    if (document?.blobUrl && typeof window !== "undefined") {
      const a = window.document.createElement("a");
      a.href = document.blobUrl;
      a.download = document.title + ".pdf";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      toast.success("Document downloaded");
    }
  };

  const handleClose = () => {
    // Clean up blob URL when closing
    if (document?.blobUrl) {
      URL.revokeObjectURL(document.blobUrl);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold">
              {document?.title || "Loading..."}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {document?.blobUrl && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-2"></div>
                <p className="text-gray-600">Loading document preview...</p>
              </div>
            </div>
          ) : document?.blobUrl ? (
            <iframe
              src={`${document.blobUrl}#view=FitH`}
              className="w-full h-full border-0"
              title={document.title}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Failed to load document preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
