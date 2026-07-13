"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import type {
  BrandImageData,
  BrandImagesData,
  CompanyLogoData,
  CompanyBasicsData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BannerPreviewCard } from "./components/banner-preview-card";
import { CompanyLogoCard } from "./components/company-logo-card";
import { HeroBackgroundCard } from "./components/hero-background-card";
import { WelcomeStatementCard } from "./components/welcome-statement-card";
import { BannerOverlaySettingsCard } from "./components/banner-overlay-settings-card";
import { useHeroOverlaySettings } from "./hooks/use-hero-overlay-settings";
import {
  HERO_RECOMMENDED_SIZE_LABEL,
  HERO_RECOMMENDED_WIDTH,
  HERO_RECOMMENDED_HEIGHT,
  FALLBACK_HEADER_IMAGE,
  convertBrandImageToLogo,
  convertLogoToBrandImage,
  autoCropHeroBackgroundImage,
} from "./utils/hero-utils";

type InlineField = "title" | "description" | null;

interface BannerPreviewSectionProps {
  companyData?: CompanyBasicsData;
  welcomeData?: WelcomeStatementData;
  onCompanyDataChange?: (field: any, value: any) => void;
  onWelcomeDataChange?: (
    field: "headline" | "bodyText" | "isAIGenerated",
    value: any,
  ) => void;
  onHeadshotChange?: (newHeadshot: string) => void;
  onBackgroundChange?: (newBackground: string) => void;
  validationErrors?: Record<string, string[]>;
  isPreviewSticky?: boolean;
  errorFields?: string[];
  useDefaultBody?: boolean;
  onToggleDefaultBody?: (checked: boolean) => void;
  defaultBodyText?: string;
  hideEditingSections?: boolean;
  hidePreviewCard?: boolean;
  renderModalOutside?: boolean;
  /**
   * When true, renders the preview card separately from the editing sections,
   * giving a layout similar to Step 2's approach (prominent preview + organized editors below).
   * Optimized for the Edit Plan workflow's tab-based layout.
   */
  separatePreview?: boolean;
  onModalStateChange?: (state: {
    isOpen: boolean;
    pendingData: BrandImageData | null;
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  }) => void;
  onLogoModalStateChange?: (state: {
    isOpen: boolean;
    pendingData: CompanyLogoData | null;
    onSave: (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => void;
    onClose: () => void;
  }) => void;
  onOpenHeroTextEditor?: (field: "title" | "description") => void;
  onOpenHeroSettingsEditor?: () => void;
  onOpenLogoEditor?: () => void;
  onBackgroundClick?: () => void;
  isEditorOpen?: boolean;
  logoCardRef?: React.RefObject<HTMLDivElement>;
  isLogoCardHighlighted?: boolean;
  onLogoCardHighlightChange?: (highlighted: boolean) => void;
  overlaySettingsCardRef?: React.RefObject<HTMLDivElement>;
  isOverlaySettingsHighlighted?: boolean;
  onOverlaySettingsHighlightChange?: (highlighted: boolean) => void;
  bannerTitleCardRef?: React.RefObject<HTMLDivElement>;
  isBannerTitleHighlighted?: boolean;
  onBannerTitleHighlightChange?: (highlighted: boolean) => void;
  isWelcomeBodyHighlighted?: boolean;
  wrapInCard?: boolean;
}

export function BannerPreviewSection({
  companyData: externalCompanyData,
  welcomeData: externalWelcomeData,
  onCompanyDataChange,
  onWelcomeDataChange,
  onHeadshotChange: externalOnHeadshotChange,
  onBackgroundChange: externalOnBackgroundChange,
  validationErrors = {},
  isPreviewSticky = true,
  errorFields = [],
  useDefaultBody = true,
  onToggleDefaultBody,
  defaultBodyText,
  hideEditingSections = false,
  hidePreviewCard = false,
  renderModalOutside = false,
  onModalStateChange,
  onLogoModalStateChange,
  onOpenHeroTextEditor,
  onOpenHeroSettingsEditor,
  onOpenLogoEditor,
  onBackgroundClick,
  isEditorOpen = false,
  logoCardRef: externalLogoCardRef,
  isLogoCardHighlighted: externalIsLogoCardHighlighted,
  onLogoCardHighlightChange,
  overlaySettingsCardRef: externalOverlaySettingsCardRef,
  isOverlaySettingsHighlighted: externalIsOverlaySettingsHighlighted,
  onOverlaySettingsHighlightChange,
  bannerTitleCardRef: externalBannerTitleCardRef,
  isBannerTitleHighlighted: externalIsBannerTitleHighlighted,
  onBannerTitleHighlightChange,
  isWelcomeBodyHighlighted,
  wrapInCard = false,
  separatePreview = false,
}: BannerPreviewSectionProps = {}) {
  const wizardStore = useNewClientWizardStore();
  const { stepData, saveStepDataLocally, goToStep } = wizardStore;

  const isExternalCompanyMode = !!externalCompanyData;

  const companyData = externalCompanyData || stepData.companyBasics;
  const welcomeData = externalWelcomeData || stepData.welcomeStatement;

  // Hero content state
  const [heroTitle, setHeroTitle] = useState(
    (companyData as any)?.heroTitle ||
    `Welcome to the ${companyData?.companyName || "Company Name"
    } Benefits Hub!`,
  );
  const [heroDescription, setHeroDescription] = useState(
    (companyData as any)?.heroDescription || welcomeData?.bodyText || "",
  );
  const [inlineField, setInlineField] = useState<InlineField>(null);
  const [inlineValue, setInlineValue] = useState("");

  // Refs to prevent infinite loops
  const isUpdatingHeroTitleRef = useRef(false);
  const isUpdatingHeroDescriptionRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Modals state
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [pendingHeroImageData, setPendingHeroImageData] =
    useState<BrandImageData | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const lastModalStateRef = useRef<{
    isOpen: boolean;
    pendingData: BrandImageData | null;
  } | null>(null);

  // Company name editing
  const [isEditCompanyNameOpen, setIsEditCompanyNameOpen] = useState(false);
  const [editedCompanyName, setEditedCompanyName] = useState(
    companyData?.companyName || "",
  );

  // Overlay settings
  const {
    heroOverlayOpacity,
    heroBackgroundOpacity,
    heroContainerBackgroundOpacity,
    heroContainerBlockOpacity,
    heroContainerInverted,
    heroBackgroundInverted,
    heroUseGradient,
    handleSettingsChange,
  } = useHeroOverlaySettings(
    companyData,
    onCompanyDataChange,
    saveStepDataLocally,
    stepData.companyBasics,
  );

  // Derived values: hero uses header, fallback to thumbnail when header empty
  const heroImageData = companyData?.brandImages?.header || companyData?.brandImages?.thumbnail || null;
  const heroBackgroundUrl = heroImageData?.url || "";
  const companyName = companyData?.companyName || "Company Name";

  // Compute heroTitle with default fallback if undefined or empty
  const displayHeroTitle =
    heroTitle && heroTitle.trim()
      ? heroTitle
      : `Welcome to the ${companyName} Benefits Hub!`;

  const welcomeCardData: WelcomeStatementData = {
    headline: displayHeroTitle,
    bodyText: heroDescription,
    isAIGenerated: false,
  };

  const companyLogo =
    typeof companyData?.companyLogo === "string"
      ? companyData.companyLogo
      : companyData?.companyLogo?.url || "";
  const primaryColor = companyData?.primaryColor || "#1F3A60";
  const secondaryColor = companyData?.secondaryColor || "#6B7280";

  // Inline editing handlers
  const handleInlineEditStart = (field: Exclude<InlineField, null>) => {
    // If callback is provided, open modal instead of inline editing
    if (onOpenHeroTextEditor) {
      onOpenHeroTextEditor(field);
      return;
    }
    // Fallback to inline editing if no callback
    setInlineField(field);
    setInlineValue(field === "title" ? heroTitle : heroDescription);
  };

  const handleInlineEditCancel = () => {
    setInlineField(null);
    setInlineValue("");
  };

  const handleInlineEditSave = () => {
    if (!inlineField) return;

    if (inlineField === "title") {
      setHeroTitle(inlineValue);
      if (onCompanyDataChange) {
        onCompanyDataChange("heroTitle", inlineValue);
      } else if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          heroTitle: inlineValue,
        });
      }
    } else {
      setHeroDescription(inlineValue);
      if (onCompanyDataChange) {
        onCompanyDataChange("heroDescription", inlineValue);
      } else if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          heroDescription: inlineValue,
        });
      }
    }

    setInlineField(null);
    setInlineValue("");
  };

  // Background change handler (same logic as Secondary Banner in BrandImagesSection)
  const handleBackgroundChange = (
    newBackground: string | (Partial<BrandImageData> & { url: string }) | null,
  ) => {
    const currentBrandImages = (stepData.companyBasics?.brandImages ||
      {}) as Partial<BrandImagesData>;
    const baseCompanyBasics = stepData.companyBasics || {};

    if (newBackground === "" || newBackground === null) {
      if (externalOnBackgroundChange) {
        externalOnBackgroundChange("");
      } else {
        const updatedBrandImages = {
          ...currentBrandImages,
          header: null,
        };
        if (onCompanyDataChange) {
          onCompanyDataChange("brandImages", updatedBrandImages);
        } else {
          saveStepDataLocally("companyBasics", {
            ...baseCompanyBasics,
            brandImages: updatedBrandImages,
          });
        }
      }
      return;
    }

    const incoming =
      typeof newBackground === "string"
        ? { url: newBackground }
        : newBackground;

    const updatedBrandImages = {
      ...currentBrandImages,
      header: {
        ...(currentBrandImages.header || FALLBACK_HEADER_IMAGE),
        ...incoming,
      },
    };

    if (externalOnBackgroundChange) {
      const headerUrl =
        typeof newBackground === "string"
          ? newBackground
          : (newBackground as BrandImageData).url;
      externalOnBackgroundChange(headerUrl);
    } else if (onCompanyDataChange) {
      onCompanyDataChange("brandImages", updatedBrandImages);
    } else {
      saveStepDataLocally("companyBasics", {
        ...baseCompanyBasics,
        brandImages: updatedBrandImages,
      });
    }
  };

  // Logo handlers
  const handleLogoImageChange = (imageData: BrandImageData) => {
    // Logging: Check what data is received

    const logoData = convertBrandImageToLogo(imageData);

    // Logging: Check what data is saved

    if (onCompanyDataChange) {
      onCompanyDataChange("companyLogo", logoData);
    } else if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        companyLogo: logoData,
      });
    }
  };

  const handleLogoImageRemove = () => {
    if (onCompanyDataChange) {
      onCompanyDataChange("companyLogo", null);
    } else if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        companyLogo: null,
      });
    }
  };

  const internalLogoCardRef = useRef<HTMLDivElement>(null);
  const [internalIsLogoCardHighlighted, setIsLogoCardHighlighted] =
    useState(false);
  const internalOverlaySettingsCardRef = useRef<HTMLDivElement>(null);
  const [
    internalIsOverlaySettingsHighlighted,
    setIsOverlaySettingsHighlighted,
  ] = useState(false);

  // Use external ref if provided, otherwise use internal
  const logoCardRef = externalLogoCardRef || internalLogoCardRef;
  const isLogoCardHighlighted =
    externalIsLogoCardHighlighted !== undefined
      ? externalIsLogoCardHighlighted
      : internalIsLogoCardHighlighted;

  const setLogoCardHighlighted = (highlighted: boolean) => {
    if (onLogoCardHighlightChange) {
      onLogoCardHighlightChange(highlighted);
    } else {
      setIsLogoCardHighlighted(highlighted);
    }
  };

  const overlaySettingsCardRef =
    externalOverlaySettingsCardRef || internalOverlaySettingsCardRef;
  const isOverlaySettingsHighlighted =
    externalIsOverlaySettingsHighlighted !== undefined
      ? externalIsOverlaySettingsHighlighted
      : internalIsOverlaySettingsHighlighted;

  const setOverlaySettingsHighlighted = (highlighted: boolean) => {
    if (onOverlaySettingsHighlightChange) {
      onOverlaySettingsHighlightChange(highlighted);
    } else {
      setIsOverlaySettingsHighlighted(highlighted);
    }
  };

  const scrollToElement = useCallback(
    (elementRef: React.RefObject<HTMLDivElement>) => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const target = elementRef.current;
          if (!target) {
            return;
          }

          // Find scrollable container (modal content with overflow-y-auto)
          let scrollContainer: HTMLElement | null = target.parentElement;
          while (scrollContainer && scrollContainer !== document.body) {
            const style = window.getComputedStyle(scrollContainer);
            const hasOverflow =
              style.overflowY === "auto" ||
              style.overflowY === "scroll" ||
              scrollContainer.classList.contains("overflow-y-auto");
            if (
              hasOverflow &&
              scrollContainer.scrollHeight > scrollContainer.clientHeight
            ) {
              break;
            }
            scrollContainer = scrollContainer.parentElement;
          }

          // Fallback: try to find modal container by class
          const container =
            scrollContainer ||
            (document.querySelector(".overflow-y-auto") as HTMLElement | null);

          if (container) {
            // Use getBoundingClientRect for accurate positioning
            const cardRect = target.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scrollTop = container.scrollTop;
            const cardTop = cardRect.top - containerRect.top + scrollTop;
            const containerCenter = container.clientHeight / 2;
            const scrollPosition = cardTop - containerCenter;

            container.scrollTo({
              top: scrollPosition,
              behavior: "smooth",
            });
          } else {
            // Final fallback to window scroll
            target.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 200); // Small delay to ensure DOM is ready
      });
    },
    [],
  );

  const handleLogoClick = useCallback(() => {
    // Set highlight immediately
    setLogoCardHighlighted(true);

    // Scroll to logo card
    scrollToElement(logoCardRef);

    // Remove highlight after 3 seconds
    setTimeout(() => {
      setLogoCardHighlighted(false);
    }, 3000);

    // If callback is provided, open editor
    if (onOpenLogoEditor) {
      onOpenLogoEditor();
    }
  }, [logoCardRef, setLogoCardHighlighted, scrollToElement, onOpenLogoEditor]);

  const handleContainerClick = useCallback(() => {
    // Set highlight immediately
    setOverlaySettingsHighlighted(true);

    // Scroll to Banner Overlay Settings card
    scrollToElement(overlaySettingsCardRef);

    // Remove highlight after 3 seconds
    setTimeout(() => {
      setOverlaySettingsHighlighted(false);
    }, 3000);

    // If callback is provided, open editor
    if (onOpenHeroSettingsEditor) {
      onOpenHeroSettingsEditor();
    }
  }, [
    overlaySettingsCardRef,
    scrollToElement,
    setOverlaySettingsHighlighted,
    onOpenHeroSettingsEditor,
  ]);

  const handleBackgroundClick = useCallback(() => {
    if (onBackgroundClick) {
      onBackgroundClick();
    }
  }, [onBackgroundClick]);

  // Hero background handlers
  const handleHeroBackgroundImageChange = (imageData: BrandImageData) => {
    handleBackgroundChange(imageData);
  };

  const handleHeroBackgroundImageRemove = () => {
    handleBackgroundChange("");
  };

  const handleHeroBackgroundEditClick = () => {
    const currentImage = companyData?.brandImages?.header || companyData?.brandImages?.thumbnail;
    if (currentImage) {
      setPendingHeroImageData(currentImage);
      setIsHeroModalOpen(true);
    }
  };

  const handleHeroBackgroundFileSelect = (imageData: BrandImageData) => {
    setPendingHeroImageData(imageData);
    setIsHeroModalOpen(true);
  };

  const handleHeroModalSave = useCallback(
    (
      value: string,
      fileName: string,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => {
      if (pendingHeroImageData) {
        const img = new Image();
        img.onload = () => {
          const warnings: string[] = [];
          if (
            img.width < HERO_RECOMMENDED_WIDTH ||
            img.height < HERO_RECOMMENDED_HEIGHT
          ) {
            warnings.push(
              `Below recommended size (${HERO_RECOMMENDED_SIZE_LABEL}). May appear blurry.`,
            );
          }

          handleBackgroundChange({
            ...pendingHeroImageData,
            url: value,
            originalUrl:
              cropData?.originalImage ||
              pendingHeroImageData.originalUrl ||
              value,
            fileName,
            width: img.width,
            height: img.height,
            status: (warnings.length > 0 ? "warning" : "ok") as
              | "ok"
              | "warning"
              | "error",
            warnings,
            cropData: cropData,
          });
        };
        img.onerror = () => {
          handleBackgroundChange({
            ...pendingHeroImageData,
            url: value,
            fileName,
          });
        };
        img.src = value;
      }
      setIsHeroModalOpen(false);
      setPendingHeroImageData(null);
    },
    [pendingHeroImageData],
  );

  const handleHeroModalClose = useCallback(() => {
    setIsHeroModalOpen(false);
    setPendingHeroImageData(null);
  }, []);

  const updateField = (
    field: "headline" | "bodyText" | "isAIGenerated",
    value: any,
  ) => {
    if (isExternalCompanyMode) return;
    if (onWelcomeDataChange) {
      onWelcomeDataChange(field, value);
    } else if (stepData.welcomeStatement) {
      saveStepDataLocally("welcomeStatement", {
        ...stepData.welcomeStatement,
        [field]: value,
      });
    }
  };

  const getDefaultWelcomeBodyText = () => {
    return "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";
  };

  const effectiveDefaultBodyText =
    defaultBodyText || getDefaultWelcomeBodyText();

  const [internalUseDefaultBody, setInternalUseDefaultBody] = useState(
    useDefaultBody ?? true,
  );

  const currentUseDefaultBody = onToggleDefaultBody
    ? useDefaultBody
    : internalUseDefaultBody;

  const handleBodyChange = (value: string) => {
    // Only uncheck if the new value is actually different from the default text
    if (value !== effectiveDefaultBodyText) {
      if (onToggleDefaultBody) {
        onToggleDefaultBody(false);
      } else {
        setInternalUseDefaultBody(false);
      }
    }
    // Update heroDescription immediately for preview
    isUpdatingHeroDescriptionRef.current = true;
    setHeroDescription(value);
    if (onCompanyDataChange) {
      onCompanyDataChange("heroDescription", value);
    } else if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        heroDescription: value,
      });
    }
    updateField("bodyText", value);
    setTimeout(() => {
      isUpdatingHeroDescriptionRef.current = false;
    }, 0);
  };

  const handleToggleDefaultBody = (checked: boolean) => {
    if (onToggleDefaultBody) {
      onToggleDefaultBody(checked);
    } else {
      setInternalUseDefaultBody(checked);
    }
    // If checked, update with default text immediately
    if (checked && effectiveDefaultBodyText) {
      isUpdatingHeroDescriptionRef.current = true;
      setHeroDescription(effectiveDefaultBodyText);
      if (onCompanyDataChange) {
        onCompanyDataChange("heroDescription", effectiveDefaultBodyText);
      } else if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          heroDescription: effectiveDefaultBodyText,
        });
      }
      updateField("bodyText", effectiveDefaultBodyText);
      setTimeout(() => {
        isUpdatingHeroDescriptionRef.current = false;
      }, 0);
    }
  };

  // Company name handler
  const handleSaveCompanyName = () => {
    if (onCompanyDataChange) {
      onCompanyDataChange("companyName", editedCompanyName);
    } else if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        companyName: editedCompanyName,
      });
    }

    const autoHeadline = `Welcome to the ${editedCompanyName} Benefits Hub!`;
    // Update heroTitle immediately for preview
    isUpdatingHeroTitleRef.current = true;
    setHeroTitle(autoHeadline);
    if (onCompanyDataChange) {
      onCompanyDataChange("heroTitle", autoHeadline);
    } else if (stepData.companyBasics) {
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        heroTitle: autoHeadline,
      });
    }

    // Update welcome statement headline (wizard mode only)
    if (!isExternalCompanyMode) {
      if (onWelcomeDataChange) {
        onWelcomeDataChange("headline", autoHeadline);
      } else if (stepData.welcomeStatement) {
        saveStepDataLocally("welcomeStatement", {
          ...stepData.welcomeStatement,
          headline: autoHeadline,
        });
      }
    }

    setTimeout(() => {
      isUpdatingHeroTitleRef.current = false;
    }, 0);
    setIsEditCompanyNameOpen(false);
  };

  // Modal state notifications
  useEffect(() => {
    if (renderModalOutside && onModalStateChange) {
      const currentState = {
        isOpen: isHeroModalOpen,
        pendingData: pendingHeroImageData,
      };

      const lastState = lastModalStateRef.current;
      if (
        !lastState ||
        lastState.isOpen !== currentState.isOpen ||
        lastState.pendingData !== currentState.pendingData
      ) {
        lastModalStateRef.current = currentState;
        onModalStateChange({
          ...currentState,
          onSave: handleHeroModalSave,
          onClose: handleHeroModalClose,
        });
      }
    }
  }, [
    isHeroModalOpen,
    pendingHeroImageData,
    renderModalOutside,
    onModalStateChange,
    handleHeroModalSave,
    handleHeroModalClose,
  ]);

  // Initialize heroTitle and heroDescription on mount
  useEffect(() => {
    if (!hasInitializedRef.current) {
      const initialHeroTitle =
        (companyData as any)?.heroTitle ||
        (isExternalCompanyMode ? "" : welcomeData?.headline) ||
        `Welcome to the ${companyData?.companyName || "Company Name"
        } Benefits Hub!`;
      const initialHeroDescription =
        (companyData as any)?.heroDescription ||
        (isExternalCompanyMode ? "" : welcomeData?.bodyText) ||
        "";

      setHeroTitle(initialHeroTitle);
      setHeroDescription(initialHeroDescription);
      hasInitializedRef.current = true;
    }
  }, []);

  // Sync hero title with welcome headline (only if not updating internally)
  useEffect(() => {
    if (isExternalCompanyMode) return;
    if (!hasInitializedRef.current || isUpdatingHeroTitleRef.current) return;
    const newHeadline = welcomeData?.headline;
    // If headline is undefined or empty, use default value
    if (!newHeadline || !newHeadline.trim()) {
      const defaultTitle = `Welcome to the ${companyName} Benefits Hub!`;
      if (heroTitle !== defaultTitle) {
        isUpdatingHeroTitleRef.current = true;
        setHeroTitle(defaultTitle);
        setTimeout(() => {
          isUpdatingHeroTitleRef.current = false;
        }, 0);
      }
    } else if (newHeadline !== heroTitle) {
      isUpdatingHeroTitleRef.current = true;
      setHeroTitle(newHeadline);
      setTimeout(() => {
        isUpdatingHeroTitleRef.current = false;
      }, 0);
    }
  }, [welcomeData?.headline, heroTitle, companyName]);

  // Sync hero description with welcome body text (only if not updating internally)
  useEffect(() => {
    if (isExternalCompanyMode) return;
    if (!hasInitializedRef.current || isUpdatingHeroDescriptionRef.current)
      return;
    const newBodyText = welcomeData?.bodyText || "";
    if (newBodyText !== heroDescription) {
      isUpdatingHeroDescriptionRef.current = true;
      setHeroDescription(newBodyText);
      setTimeout(() => {
        isUpdatingHeroDescriptionRef.current = false;
      }, 0);
    }
  }, [welcomeData?.bodyText, heroDescription]);

  // Sync hero title when company name changes (only if title matches pattern)
  useEffect(() => {
    if (!hasInitializedRef.current || isUpdatingHeroTitleRef.current) return;
    const newCompanyName = companyData?.companyName;
    if (newCompanyName) {
      const expectedHeadline = `Welcome to the ${newCompanyName} Benefits Hub!`;
      // Only update if current title matches the pattern
      if (
        heroTitle &&
        heroTitle !== expectedHeadline &&
        (heroTitle.includes("Company Name") ||
          (heroTitle.startsWith("Welcome to the") &&
            heroTitle.endsWith("Benefits Hub!")))
      ) {
        isUpdatingHeroTitleRef.current = true;
        setHeroTitle(expectedHeadline);
        setTimeout(() => {
          isUpdatingHeroTitleRef.current = false;
        }, 0);
      }
    }
  }, [companyData?.companyName, heroTitle]);

  // Sync company name in modal
  useEffect(() => {
    setEditedCompanyName(companyData?.companyName || "");
  }, [companyData?.companyName]);

  // Sync heroTitle from companyData.heroTitle (only if not updating internally)
  useEffect(() => {
    if (!hasInitializedRef.current || isUpdatingHeroTitleRef.current) return;
    const newHeroTitle = (companyData as any)?.heroTitle;
    // If heroTitle is undefined or empty, set default value
    if (!newHeroTitle || !newHeroTitle.trim()) {
      const defaultTitle = `Welcome to the ${companyName} Benefits Hub!`;
      if (heroTitle !== defaultTitle) {
        isUpdatingHeroTitleRef.current = true;
        setHeroTitle(defaultTitle);
        setTimeout(() => {
          isUpdatingHeroTitleRef.current = false;
        }, 0);
      }
    } else if (newHeroTitle !== heroTitle) {
      isUpdatingHeroTitleRef.current = true;
      setHeroTitle(newHeroTitle);
      setTimeout(() => {
        isUpdatingHeroTitleRef.current = false;
      }, 0);
    }
  }, [(companyData as any)?.heroTitle, heroTitle, companyName]);

  // Sync heroDescription from companyData.heroDescription (only if not updating internally)
  useEffect(() => {
    if (!hasInitializedRef.current || isUpdatingHeroDescriptionRef.current)
      return;
    const newHeroDescription = (companyData as any)?.heroDescription;
    if (newHeroDescription && newHeroDescription !== heroDescription) {
      isUpdatingHeroDescriptionRef.current = true;
      setHeroDescription(newHeroDescription);
      setTimeout(() => {
        isUpdatingHeroDescriptionRef.current = false;
      }, 0);
    }
  }, [(companyData as any)?.heroDescription, heroDescription]);

  const bannerPreviewCard = (
    <BannerPreviewCard
      heroBackgroundUrl={heroBackgroundUrl}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      companyName={companyName}
      companyLogo={companyLogo}
      heroTitle={displayHeroTitle}
      heroDescription={heroDescription}
      inlineField={inlineField}
      inlineValue={inlineValue}
      onInlineValueChange={setInlineValue}
      onStartInlineEdit={handleInlineEditStart}
      onInlineCancel={handleInlineEditCancel}
      onInlineSave={handleInlineEditSave}
      backgroundOpacity={heroBackgroundOpacity}
      containerBlockOpacity={heroContainerBlockOpacity}
      containerInverted={heroContainerInverted}
      backgroundInverted={heroBackgroundInverted}
      useGradient={heroUseGradient}
      isPreviewSticky={isPreviewSticky}
      hidePreviewCard={hidePreviewCard}
      isEditorOpen={isEditorOpen}
      onLogoClick={onLogoModalStateChange ? handleLogoClick : undefined}
      onContainerClick={handleContainerClick}
      onBackgroundClick={handleBackgroundClick}
    />
  );

  const editingSections = (
    <>
      <CompanyLogoCard
        ref={logoCardRef}
        companyLogo={companyData?.companyLogo}
        onLogoImageChange={handleLogoImageChange}
        onLogoImageRemove={handleLogoImageRemove}
        renderModalOutside={!!onLogoModalStateChange}
        onLogoModalStateChange={onLogoModalStateChange}
        isHighlighted={isLogoCardHighlighted}
      />

      <HeroBackgroundCard
        heroImageData={heroImageData}
        onImageChange={handleHeroBackgroundImageChange}
        onImageRemove={handleHeroBackgroundImageRemove}
        onEditClick={handleHeroBackgroundEditClick}
        onFileSelect={handleHeroBackgroundFileSelect}
        onDefaultPhotoClick={() => setGalleryOpen(true)}
      />

      <WelcomeStatementCard
        welcomeData={externalCompanyData ? welcomeCardData : welcomeData}
        companyName={companyName}
        errorFields={errorFields}
        useDefaultBody={currentUseDefaultBody}
        onToggleDefaultBody={handleToggleDefaultBody}
        defaultBodyText={effectiveDefaultBodyText}
        onHeadlineChange={
          externalCompanyData
            ? (value) => {
                setHeroTitle(value);
                onCompanyDataChange?.("heroTitle", value);
              }
            : undefined
        }
        onBodyChange={handleBodyChange}
        onCompanyNameEdit={
          onCompanyDataChange
            ? () => {
                setEditedCompanyName(companyName || "");
                setIsEditCompanyNameOpen(true);
              }
            : undefined
        }
        bannerTitleCardRef={externalBannerTitleCardRef}
        isBannerTitleHighlighted={externalIsBannerTitleHighlighted}
        isWelcomeBodyHighlighted={isWelcomeBodyHighlighted}
      />

      <BannerOverlaySettingsCard
        ref={overlaySettingsCardRef}
        backgroundOpacity={heroBackgroundOpacity}
        containerBlockOpacity={heroContainerBlockOpacity}
        containerInverted={heroContainerInverted}
        backgroundInverted={heroBackgroundInverted}
        useGradient={heroUseGradient}
        onSettingsChange={handleSettingsChange}
        isHighlighted={isOverlaySettingsHighlighted}
      />

      <ModalGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={async (url) => {
          let fileName = "default-image.png";
          let fileExtension = "png";

          if (url.startsWith("data:image/")) {
            const match = url.match(/data:image\/(\w+);/);
            if (match && match[1]) {
              fileExtension = match[1];
              fileName = `default-image.${fileExtension}`;
            }
          } else {
            const urlMatch = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
            if (urlMatch && urlMatch[1]) {
              fileExtension = urlMatch[1].toLowerCase();
              fileName = `default-image.${fileExtension}`;
            }
          }

          try {
            const { croppedUrl, width, height } =
              await autoCropHeroBackgroundImage(url);

            const warnings: string[] = [];
            if (
              width < HERO_RECOMMENDED_WIDTH ||
              height < HERO_RECOMMENDED_HEIGHT
            ) {
              warnings.push(
                `Below recommended size (${HERO_RECOMMENDED_SIZE_LABEL}). May appear blurry.`,
              );
            }

            const brandImageData: BrandImageData = {
              url: croppedUrl,
              fileName,
              fileSize: 0,
              width,
              height,
              recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
              status: (warnings.length > 0 ? "warning" : "ok") as
                | "ok"
                | "warning"
                | "error",
              warnings,
            };

            handleBackgroundChange(brandImageData);
            setGalleryOpen(false);
          } catch (error) {
            console.error("Failed to auto-crop image:", error);
            const img = new Image();
            img.onload = () => {
              const warnings: string[] = [];
              if (
                img.width < HERO_RECOMMENDED_WIDTH ||
                img.height < HERO_RECOMMENDED_HEIGHT
              ) {
                warnings.push(
                  `Below recommended size (${HERO_RECOMMENDED_SIZE_LABEL}). May appear blurry.`,
                );
              }

              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: img.width,
                height: img.height,
                recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
                status: (warnings.length > 0 ? "warning" : "ok") as
                  | "ok"
                  | "warning"
                  | "error",
                warnings,
              };

              handleBackgroundChange(brandImageData);
              setGalleryOpen(false);
            };
            img.onerror = () => {
              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: 0,
                height: 0,
                recommendedSize: HERO_RECOMMENDED_SIZE_LABEL,
                status: "ok",
                warnings: [],
              };
              handleBackgroundChange(brandImageData);
              setGalleryOpen(false);
            };
            img.src = url;
          }
        }}
      />

      {pendingHeroImageData && !renderModalOutside && (
        <SimpleImageEditorModal
          modalTitle="Background image"
          modalDescription="Upload and edit your image."
          value={pendingHeroImageData.url || ""}
          fileName={pendingHeroImageData.fileName || ""}
          onChange={handleHeroModalSave}
          onRemove={handleHeroModalClose}
          isOpen={isHeroModalOpen}
          onClose={handleHeroModalClose}
          saveButtonText="Save Background"
          canvasWidth={640}
          canvasHeight={600}
          guidelineWidth={580}
          guidelineHeight={240}
          guidelinePadding={20}
        />
      )}

      <Dialog
        open={isEditCompanyNameOpen}
        onOpenChange={setIsEditCompanyNameOpen}
      >
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Edit Banner Headline</DialogTitle>
            <DialogDescription>
              Update the Benefits Hub name. This will automatically update
              the banner headline in preview.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Benefits Hub Name</Label>
              <Input
                id="companyName"
                value={editedCompanyName}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 65);
                  setEditedCompanyName(value);
                  // Update preview in real-time
                  if (value) {
                    const previewHeadline = `Welcome to the ${value} Benefits Hub!`;
                    isUpdatingHeroTitleRef.current = true;
                    setHeroTitle(previewHeadline);
                    setTimeout(() => {
                      isUpdatingHeroTitleRef.current = false;
                    }, 0);
                  }
                }}
                placeholder="Enter company name"
                maxLength={65}
              />
              <p className="text-xs text-muted-foreground text-right">
                {editedCompanyName.length}/65 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // Reset preview to original on cancel
                setEditedCompanyName(companyData?.companyName || "");
                const originalHeadline =
                  welcomeData?.headline ||
                  `Welcome to the ${companyData?.companyName || "Company Name"
                  } Benefits Hub!`;
                setHeroTitle(originalHeadline);
                setIsEditCompanyNameOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCompanyName}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  const content = separatePreview ? (
    <div className="space-y-8">
      {/* Preview Section - prominent, like Step 2's approach */}
      {!hidePreviewCard && (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {bannerPreviewCard}
        </div>
      )}

      {/* Editing Sections - organized below the preview, optimized for tab-based layout */}
      {hideEditingSections ? null : (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Branding & Hero Settings
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure your company logo, hero background image, welcome message, and overlay settings.
            </p>
          </div>
          {editingSections}
        </div>
      )}
    </div>
  ) : (
    <div className="space-y-6">
      {!hidePreviewCard && bannerPreviewCard}
      {hideEditingSections ? null : editingSections}
    </div>
  );

  if (separatePreview) return content;
  if (!wrapInCard) return content;

  return (
    <Card className="shadow-none dark:bg-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl dark:text-gray-100">Banner Preview</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
