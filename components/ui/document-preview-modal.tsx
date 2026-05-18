"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string | any;
  documentName: string;
  documentType?: string;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  documentUrl,
  documentName,
  documentType = "application/pdf",
}: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loadingError, setLoadingError] = useState(false);
  const [isDataUrl, setIsDataUrl] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Convert base64 data URLs to blob URLs for better iframe compatibility
  useEffect(() => {
    if (!documentUrl || !isOpen) {
      // Clean up blob URL when modal closes or documentUrl is empty
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
      setIsDataUrl(false);
      return;
    }

      const urlString =
        typeof documentUrl === "string" ? documentUrl : String(documentUrl);

    // Check if it's a base64 data URL
    const isDataUrlCheck =
      typeof urlString === "string" &&
      (urlString.startsWith("data:") ||
        urlString.startsWith("data:application/pdf"));

    setIsDataUrl(isDataUrlCheck);

    // If it's not a data URL or it's already a blob URL or API endpoint, use it directly
    if (
      !isDataUrlCheck ||
      urlString.startsWith("blob:") ||
      urlString.startsWith("/api/") ||
      urlString.startsWith("http")
    ) {
      // Clean up previous blob URL if exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
      return;
    }

    // Convert data URL to blob URL
    const convertDataUrlToBlob = async () => {
      try {
        // Extract base64 data from data URL
        const base64Data = urlString.includes(",")
          ? urlString.split(",")[1]
          : urlString.replace(/^data:application\/pdf;base64,/, "");

        // Decode base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
    }

        // Create blob from binary data
        const blob = new Blob([bytes], { type: "application/pdf" });
        const newBlobUrl = URL.createObjectURL(blob);

        // Clean up previous blob URL if exists
        setBlobUrl((prevBlobUrl) => {
          if (prevBlobUrl) {
            URL.revokeObjectURL(prevBlobUrl);
          }
          blobUrlRef.current = newBlobUrl;
          return newBlobUrl;
        });
      } catch (error) {
        console.error("Error converting data URL to blob URL:", error);
        // If conversion fails, fall back to original href
        setBlobUrl((prevBlobUrl) => {
          if (prevBlobUrl) {
            URL.revokeObjectURL(prevBlobUrl);
          }
          blobUrlRef.current = null;
          return null;
        });
      }
    };

    convertDataUrlToBlob();

    // Cleanup function
    return () => {
      setBlobUrl((prevBlobUrl) => {
        if (prevBlobUrl) {
          URL.revokeObjectURL(prevBlobUrl);
        }
        blobUrlRef.current = null;
        return null;
      });
    };
  }, [documentUrl, isOpen]);

  // Handle escape key to close modal and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Clean up blob URL when modal closes
  useEffect(() => {
    if (!isOpen && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }
  }, [isOpen]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    const urlString =
      typeof documentUrl === "string" ? documentUrl : String(documentUrl);

    // Use blob URL if available (for converted data URLs), otherwise use original URL
    const downloadUrl = blobUrl || urlString;

    // If it's an API endpoint, fetch and download
    if (
      downloadUrl.startsWith("/api/") ||
      downloadUrl.startsWith("http") ||
      downloadUrl.startsWith("blob:")
    ) {
      try {
        // For blob URLs, create download link directly
        if (downloadUrl.startsWith("blob:")) {
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = documentName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          // For API endpoints, fetch and download
          const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = documentName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("Error downloading document:", error);
        // Fallback to opening in new tab
        window.open(downloadUrl, "_blank");
      }
    } else {
      // For data URLs, use direct download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getFileExtension = (fileName: string) => {
    return fileName.split(".").pop()?.toLowerCase() || "";
  };

  const isPdf =
    documentType === "application/pdf" ||
    getFileExtension(documentName) === "pdf";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate max-w-md">
              {documentName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="h-8 w-8 p-0"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="h-8 w-8 p-0"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Rotate Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                className="h-8 w-8 p-0"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              {/* Download Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-8 px-3"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          className="flex-1 overflow-hidden bg-gray-100 h-full"
          style={{ height: "calc(100vh - 80px)" }}
        >
          {loadingError ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-gray-400 mb-4">404</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Something&apos;s missing
                </h2>
                <p className="text-gray-600 mb-6">
                  Sorry, the document you are looking for doesn&apos;t exist,
                  has been moved, or the link may have expired.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={onClose}
                    className="bg-accent-blue text-white"
                  >
                    Go back
                  </Button>
                  <Button onClick={handleDownload} variant="outline">
                    Download to view
                  </Button>
                </div>
              </div>
            </div>
          ) : isPdf ? (
              <iframe
              src={`${blobUrl || (typeof documentUrl === "string" ? documentUrl : String(documentUrl))}#view=FitH&zoom=${zoom}&toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-0"
                title={documentName}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  width: "100%",
                  height: "100%",
                  border: "none",
                  margin: 0,
                  padding: 0,
                }}
                onError={() => setLoadingError(true)}
              />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Preview not available for this file type
                </p>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download to view
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
