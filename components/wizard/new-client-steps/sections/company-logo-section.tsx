"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, AlertTriangle, Upload, X } from "lucide-react";
import { CompanyLogoData } from "@/types/new-client-wizard";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { BrandingImage } from "@/components/ui/branding-image";
import { uploadBrandingToR2 } from "@/lib/branding-r2";
import { toast } from "sonner";

interface CompanyLogoSectionProps {
  logoData: CompanyLogoData | null;
  onLogoChange: (logoData: CompanyLogoData | null) => void;
  errorFields?: string[];
  validationErrors?: string[];
  noCard?: boolean;
  /** When set (e.g. edit client page), logo is uploaded to R2 on save and key is passed to onLogoChange. */
  clientId?: string;
}

export function CompanyLogoSection({
  logoData,
  onLogoChange,
  errorFields = [],
  validationErrors = [],
  noCard = false,
  clientId,
}: CompanyLogoSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [pendingLogoData, setPendingLogoData] =
    useState<CompanyLogoData | null>(null);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      "image/svg+xml",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported format. Please upload SVG, PNG, or JPEG.");
      return;
    }

    // Convert file to base64 data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURL = e.target?.result as string;

      // Create image to get dimensions and analyze
      const img = new Image();
      img.onload = () => {
        const warnings: string[] = [];

        // Check recommended size (900x900+)
        if (img.width < 900 || img.height < 900) {
          warnings.push("Recommendation: 900+ pixels wide");
        }

        // Check for transparency (PNG/SVG have transparency, JPEG doesn't)
        const hasTransparency =
          file.type === "image/png" || file.type === "image/svg+xml";

        // Only warn about transparency for JPEG files
        if (file.type === "image/jpeg") {
          warnings.push("No transparency — will render on white");
          warnings.push("Background may not be white");
        }

        // Create logo data
        const newLogoData: CompanyLogoData = {
          url: dataURL,
          fileName: file.name,
          fileSize: file.size,
          width: img.width,
          height: img.height,
          hasTransparency,
          warnings,
        };

        // Set pending data and open modal
        setPendingLogoData(newLogoData);
        setIsModalOpen(true);
      };

      img.src = dataURL;
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    onLogoChange(null);
  };

  const handleModalSave = async (value: string, fileName: string) => {
    if (!pendingLogoData) {
      setIsModalOpen(false);
      setPendingLogoData(null);
      return;
    }
    let url = value;
    if (clientId && value.startsWith("data:")) {
      setIsSavingLogo(true);
      try {
        const key = await uploadBrandingToR2({
          dataUrlOrFile: value,
          fileName: fileName || "logo.png",
          clientId,
          slot: "logo",
        });
        if (key) url = key;
        else toast.error("Logo upload failed. Saving locally.");
      } catch {
        toast.error("Logo upload failed. Saving locally.");
      } finally {
        setIsSavingLogo(false);
      }
    }
    const updatedLogoData: CompanyLogoData = {
      ...pendingLogoData,
      url,
      fileName: fileName,
    };
    onLogoChange(updatedLogoData);
    setIsModalOpen(false);
    setPendingLogoData(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setPendingLogoData(null);
  };

  const content = (
    <div className="space-y-4">
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-accent-blue bg-accent-blue/5"
            : "border-gray-300 hover:border-gray-400"
        } ${
          errorFields.includes("companyLogo") || validationErrors.length > 0
            ? "border-red-500"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".svg,.png,.jpg,.jpeg";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              handleFileSelect(file);
            }
          };
          input.click();
        }}
      >
        {logoData ? (
          <div className="space-y-3">
            {/* Compact preview row — image + info side by side */}
            <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {/* Logo preview */}
              <div className="flex items-center justify-center flex-shrink-0 w-full sm:w-auto min-h-[60px]">
                <BrandingImage
                  src={logoData.url}
                  alt="Company Logo Preview"
                  className="max-h-14 max-w-[180px] object-contain"
                />
              </div>

              {/* File info + actions */}
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1 min-w-0">
                {/* File Name & Size */}
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium truncate max-w-[160px]">
                    {logoData.fileName}
                  </span>
                  {logoData.fileSize > 0 && (
                    <span className="text-gray-400 shrink-0">
                      •{" "}
                      {logoData.fileSize > 1024 * 1024
                        ? `${(logoData.fileSize / (1024 * 1024)).toFixed(1)} MB`
                        : `${(logoData.fileSize / 1024).toFixed(1)} KB`}
                    </span>
                  )}
                  {logoData.width && logoData.height && (
                    <span className="text-gray-400 shrink-0">
                      • {logoData.width}×{logoData.height}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove();
                    }}
                    className="text-red-600 hover:text-red-700 hover:border-red-600"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {Array.isArray(logoData.warnings) &&
              logoData.warnings.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {logoData.warnings.map((warning, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-amber-600 border-amber-300"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {warning}
                    </Badge>
                  ))}
                </div>
              )}
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-8 h-8 mx-auto text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">No file selected</p>
              <p className="text-xs text-gray-500">
                Drag & drop or click to upload
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorFields.includes("companyLogo") && (
        <p className="text-sm text-red-500">
          Unsupported format. Please upload SVG, PNG, or JPEG.
        </p>
      )}
      {validationErrors.length > 0 && (
        <p className="text-sm text-red-500">{validationErrors[0]}</p>
      )}
    </div>
  );

  return (
    <>
      {noCard ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Company Logo *</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload SVG/PNG (preferred), or JPEG. JPEG should be on a white
            background. Recommended size: at least 900 pixels wide.
          </p>
          {content}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-accent-blue" />
              Company Logo *
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload SVG/PNG (preferred), or JPEG. JPEG should be on a white
              background. Recommended size: at least 900 pixels wide.
            </p>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      )}

      {/* Universal Image Editor Modal */}
      {pendingLogoData && (
        <UniversalImageEditorModal
          type="normalizer"
          value={pendingLogoData.url || ""}
          fileName={pendingLogoData.fileName || ""}
          onChange={handleModalSave}
          onRemove={handleModalClose}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
