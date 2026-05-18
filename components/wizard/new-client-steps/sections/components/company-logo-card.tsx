"use client";

import { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import type {
  BrandImageData,
  CompanyLogoData,
} from "@/types/new-client-wizard";

interface CompanyLogoCardProps {
  companyLogo: CompanyLogoData | null | undefined;
  onLogoImageChange: (imageData: BrandImageData) => void;
  onLogoImageRemove: () => void;
  renderModalOutside?: boolean;
  onLogoModalStateChange?: (state: {
    isOpen: boolean;
    pendingData: CompanyLogoData | null;
    onSave: (value: string, fileName: string) => void;
    onClose: () => void;
  }) => void;
  isHighlighted?: boolean;
}

const convertLogoToBrandImage = (
  logoData: CompanyLogoData | null,
): BrandImageData | undefined => {
  if (!logoData) return undefined;

  const brandImage: BrandImageData = {
    url: logoData.url, // Cropped image for UI
    originalUrl: logoData.cropData?.originalImage, // Original image for reset
    fileName: logoData.fileName,
    fileSize: logoData.fileSize,
    width: logoData.width,
    height: logoData.height,
    recommendedSize: "900×900 px",
    status:
      logoData.warnings && logoData.warnings.length > 0 ? "warning" : "ok",
    warnings: logoData.warnings || [],
    cropData: logoData.cropData, // Preserve cropData with originalImage
  };

  // Logging: Check what data is converted


  return brandImage;
};

export const CompanyLogoCard = forwardRef<HTMLDivElement, CompanyLogoCardProps>(
  function CompanyLogoCard(
    {
      companyLogo,
      onLogoImageChange,
      onLogoImageRemove,
      renderModalOutside = false,
      onLogoModalStateChange,
      isHighlighted = false,
    },
    ref,
  ) {
    const handleLogoModalStateChangeFromUpload = (state: {
      isOpen: boolean;
      pendingData: BrandImageData | null;
      onSave: (
        value: string,
        fileName: string,
        cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
      ) => void;
      onClose: () => void;
    }) => {
      if (onLogoModalStateChange) {
        const logoData: CompanyLogoData | null = state.pendingData
          ? {
            url: state.pendingData.url,
            fileName: state.pendingData.fileName,
            fileSize: state.pendingData.fileSize,
            width: state.pendingData.width,
            height: state.pendingData.height,
            hasTransparency:
              state.pendingData.url.includes("data:image/png") ||
              state.pendingData.url.includes("data:image/svg"),
            warnings: state.pendingData.warnings || [],
            cropData: state.pendingData.cropData, // Preserve cropData
          }
          : null;

        onLogoModalStateChange({
          isOpen: state.isOpen,
          pendingData: logoData,
          onSave: state.onSave, // Pass through - it will call onImageChange with BrandImageData containing cropData
          onClose: state.onClose,
        });
      }
    };

    return (
      <div
        ref={ref}
        className="transition-all duration-300"
      >
        <BrandImageUpload
          slotKey="companyLogo"
          slot={{
            title: "Company Logo",
            description: "",
            recommendedSize: "900×900 px",
            accept: ".svg,.png,.jpg,.jpeg",
            required: true,
            previewAspectRatio: 1,
            previewLabel: "Logo preview",
            defaultPhoteButton: false,
          }}
          currentImage={convertLogoToBrandImage(companyLogo || null)}
          onImageChange={onLogoImageChange}
          onImageRemove={onLogoImageRemove}
          hideButtons={true}
          useUniversalModal={true}
          universalModalType="normalizer"
          maxFileSize={100}
          renderModalOutside={!!onLogoModalStateChange}
          onModalStateChange={handleLogoModalStateChangeFromUpload}
          isHighlighted={isHighlighted}
        />
      </div>
    );
  },
);
