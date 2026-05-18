import { useState, useEffect, useRef } from "react";
import type { CompanyBasicsData } from "@/types/new-client-wizard";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

export function useHeroOverlaySettings(
  companyData: CompanyBasicsData | undefined,
  onCompanyDataChange?: (field: any, value: any) => void,
  saveStepDataLocally?: (key: string, data: any) => void,
  stepDataCompanyBasics?: any,
) {
  // Single source of truth: store data
  const storeCompanyBasics = useNewClientWizardStore((state) => state.stepData.companyBasics);
  
  // Get source data: store > stepDataCompanyBasics > companyData prop
  const getSourceData = () => {
    return storeCompanyBasics || stepDataCompanyBasics || companyData;
  };

  // Initialize state from source
  const sourceData = getSourceData();
  const [heroOverlayOpacity, setHeroOverlayOpacity] = useState<number>(
    (sourceData as any)?.heroOverlayOpacity ?? 0.67,
  );
  const [heroBackgroundOpacity, setHeroBackgroundOpacity] = useState<number>(
    (sourceData as any)?.heroBackgroundOpacity ?? 1.0,
  );
  // Backward compatibility: use heroContainerOpacity if new fields don't exist
  const legacyContainerOpacity = (sourceData as any)?.heroContainerOpacity ?? 0.67;
  const [heroContainerBackgroundOpacity, setHeroContainerBackgroundOpacity] = useState<number>(
    (sourceData as any)?.heroContainerBackgroundOpacity ?? legacyContainerOpacity,
  );
  const [heroContainerBlockOpacity, setHeroContainerBlockOpacity] = useState<number>(
    (sourceData as any)?.heroContainerBlockOpacity ?? legacyContainerOpacity,
  );
  const [heroContainerInverted, setHeroContainerInverted] = useState<boolean>(
    (sourceData as any)?.heroContainerInverted ?? false,
  );
  const [heroBackgroundInverted, setHeroBackgroundInverted] = useState<boolean>(
    (sourceData as any)?.heroBackgroundInverted ?? false,
  );
  const [heroUseGradient, setHeroUseGradient] = useState<boolean>(
    (sourceData as any)?.heroUseGradient ?? false,
  );

  const isUpdatingRef = useRef(false);

  const handleSettingsChange = (settings: {
    overlayOpacity?: number;
    backgroundOpacity?: number;
    containerBackgroundOpacity?: number;
    containerBlockOpacity?: number;
    containerInverted?: boolean;
    backgroundInverted?: boolean;
    useGradient?: boolean;
  }) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    // Update local state immediately for instant preview
    if (settings.containerBackgroundOpacity !== undefined) {
      setHeroContainerBackgroundOpacity(settings.containerBackgroundOpacity);
    }
    if (settings.containerBlockOpacity !== undefined) {
      setHeroContainerBlockOpacity(settings.containerBlockOpacity);
    }
    if (settings.containerInverted !== undefined) {
      setHeroContainerInverted(settings.containerInverted);
    }
    if (settings.backgroundInverted !== undefined) {
      setHeroBackgroundInverted(settings.backgroundInverted);
    }
    if (settings.useGradient !== undefined) {
      setHeroUseGradient(settings.useGradient);
    }
    if (settings.overlayOpacity !== undefined) {
      setHeroOverlayOpacity(settings.overlayOpacity);
    }
    if (settings.backgroundOpacity !== undefined) {
      setHeroBackgroundOpacity(settings.backgroundOpacity);
    }

    const updatedSettings: any = {};
    
    // Only include fields that are explicitly provided in settings
    if (settings.overlayOpacity !== undefined) {
      updatedSettings.heroOverlayOpacity = settings.overlayOpacity;
    }
    if (settings.backgroundOpacity !== undefined) {
      updatedSettings.heroBackgroundOpacity = settings.backgroundOpacity;
    }
    if (settings.containerBackgroundOpacity !== undefined) {
      updatedSettings.heroContainerBackgroundOpacity = settings.containerBackgroundOpacity;
    }
    if (settings.containerBlockOpacity !== undefined) {
      updatedSettings.heroContainerBlockOpacity = settings.containerBlockOpacity;
    }
    if (settings.containerInverted !== undefined) {
      updatedSettings.heroContainerInverted = settings.containerInverted;
    }
    if (settings.backgroundInverted !== undefined) {
      updatedSettings.heroBackgroundInverted = settings.backgroundInverted;
    }
    if (settings.useGradient !== undefined) {
      updatedSettings.heroUseGradient = settings.useGradient;
    }

    // Get fresh data from store
    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics || stepDataCompanyBasics || companyData || {};

    // Save to store - priority: saveStepDataLocally > onCompanyDataChange
    if (saveStepDataLocally) {
      const preservedBrandImages = currentCompanyBasics.brandImages || {};
      
      // Remove heroOverlayOpacity from currentCompanyBasics if it wasn't explicitly set in this call
      // This prevents the default value (0.67) from being saved when user only changes other opacity settings
      const companyBasicsToMerge = { ...currentCompanyBasics };
      if (settings.overlayOpacity === undefined) {
        // Only remove if it equals the default value (0.67) to preserve custom values from drafts
        if ((companyBasicsToMerge as any).heroOverlayOpacity === 0.67) {
          delete (companyBasicsToMerge as any).heroOverlayOpacity;
        }
      }
      
      const updatedCompanyBasics = {
        ...companyBasicsToMerge,
        ...updatedSettings,
        brandImages: {
          ...preservedBrandImages,
          ...(preservedBrandImages.header && { header: preservedBrandImages.header }),
          ...(preservedBrandImages.thumbnail && { thumbnail: preservedBrandImages.thumbnail }),
          ...(preservedBrandImages.secondaryBanner && { secondaryBanner: preservedBrandImages.secondaryBanner }),
          ...(preservedBrandImages.favicon && { favicon: preservedBrandImages.favicon }),
        },
      };
      
      saveStepDataLocally("companyBasics", updatedCompanyBasics);
    } else if (onCompanyDataChange) {
      // Call onCompanyDataChange for each field
      Object.entries(updatedSettings).forEach(([key, value]) => {
        onCompanyDataChange(key, value);
      });
    }

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  };

  // Single useEffect: sync from store when it changes (e.g., after loading draft)
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    const source = getSourceData();
    if (!source) return;

    // Read values directly from source - backward compatibility for heroContainerOpacity
    const legacyContainerOpacity = (source as any)?.heroContainerOpacity ?? 0.67;
    const newContainerBackgroundOpacity = (source as any)?.heroContainerBackgroundOpacity ?? legacyContainerOpacity;
    const newContainerBlockOpacity = (source as any)?.heroContainerBlockOpacity ?? legacyContainerOpacity;
    const newOverlayOpacity = (source as any)?.heroOverlayOpacity ?? 0.67;
    const newBackgroundOpacity = (source as any)?.heroBackgroundOpacity ?? 1.0;
    const newContainerInverted = (source as any)?.heroContainerInverted ?? false;
    const newBackgroundInverted = (source as any)?.heroBackgroundInverted ?? false;
    const newUseGradient = (source as any)?.heroUseGradient ?? false;

    // Only update if values are different to avoid unnecessary re-renders
    if (newContainerBackgroundOpacity !== heroContainerBackgroundOpacity) {
      setHeroContainerBackgroundOpacity(newContainerBackgroundOpacity);
    }
    if (newContainerBlockOpacity !== heroContainerBlockOpacity) {
      setHeroContainerBlockOpacity(newContainerBlockOpacity);
    }
    if (newOverlayOpacity !== heroOverlayOpacity) {
      setHeroOverlayOpacity(newOverlayOpacity);
    }
    if (newBackgroundOpacity !== heroBackgroundOpacity) {
      setHeroBackgroundOpacity(newBackgroundOpacity);
    }
    if (newContainerInverted !== heroContainerInverted) {
      setHeroContainerInverted(newContainerInverted);
    }
    if (newBackgroundInverted !== heroBackgroundInverted) {
      setHeroBackgroundInverted(newBackgroundInverted);
    }
    if (newUseGradient !== heroUseGradient) {
      setHeroUseGradient(newUseGradient);
    }
  }, [
    storeCompanyBasics,
    heroContainerBackgroundOpacity,
    heroContainerBlockOpacity,
    heroOverlayOpacity,
    heroBackgroundOpacity,
    heroContainerInverted,
    heroBackgroundInverted,
    heroUseGradient,
  ]);

  return {
    heroOverlayOpacity,
    heroBackgroundOpacity,
    heroContainerBackgroundOpacity,
    heroContainerBlockOpacity,
    heroContainerInverted,
    heroBackgroundInverted,
    heroUseGradient,
    handleSettingsChange,
  };
}
