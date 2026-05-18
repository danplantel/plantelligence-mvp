import { useState, useCallback } from "react";
import type {
  BrandImageData,
  CompanyLogoData,
} from "@/types/new-client-wizard";

export function useModalStates() {
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [pendingHeroImageData, setPendingHeroImageData] =
    useState<BrandImageData | null>(null);
  const [heroModalHandlers, setHeroModalHandlers] = useState<{
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  } | null>(null);

  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [pendingLogoData, setPendingLogoData] =
    useState<CompanyLogoData | null>(null);
  const [logoModalHandlers, setLogoModalHandlers] = useState<{
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  } | null>(null);

  const handleHeroModalStateChange = useCallback(
    (state: {
      isOpen: boolean;
      pendingData: BrandImageData | null;
      onSave: (
        value: string,
        fileName: string,
        cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
      ) => void;
      onClose: () => void;
    }) => {
      setIsHeroModalOpen(state.isOpen);
      setPendingHeroImageData(state.pendingData);
      setHeroModalHandlers({
        onSave: state.onSave,
        onClose: state.onClose,
      });
    },
    [],
  );

  const handleLogoModalStateChange = useCallback(
    (state: {
      isOpen: boolean;
      pendingData: CompanyLogoData | null;
      onSave: (
        value: string,
        fileName: string,
        cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
      ) => void;
      onClose: () => void;
    }) => {
      setIsLogoModalOpen(state.isOpen);
      setPendingLogoData(state.pendingData);
      setLogoModalHandlers({
        onSave: state.onSave,
        onClose: state.onClose,
      });
    },
    [],
  );

  return {
    isHeroModalOpen,
    pendingHeroImageData,
    heroModalHandlers,
    isLogoModalOpen,
    pendingLogoData,
    logoModalHandlers,
    handleHeroModalStateChange,
    handleLogoModalStateChange,
  };
}

