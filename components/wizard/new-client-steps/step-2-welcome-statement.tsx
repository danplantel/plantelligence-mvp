"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { BannerPreviewSection } from "./sections/banner-preview-section";
import { BrandingPreviewCard } from "./sections/branding-preview-card";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import type {
  BrandImageData,
  CompanyLogoData,
} from "@/types/new-client-wizard";
import { EditorPanelWrapper } from "./sections/components/editor-panel-wrapper";
import { BannerSectionEditor } from "./sections/components/banner-section-editor";
import { ThumbnailSectionEditor } from "./sections/components/thumbnail-section-editor";
import { MissionSectionEditor } from "./sections/components/mission-section-editor";
import { useEditorState } from "./sections/hooks/use-editor-state";
import { useWelcomeData } from "./sections/hooks/use-welcome-data";
import { useMissionData } from "./sections/hooks/use-mission-data";
import { useLenisScroll } from "./sections/hooks/use-lenis-scroll";
import { useThumbnailImage } from "./sections/hooks/use-thumbnail-image";
import { useModalStates } from "./sections/hooks/use-modal-states";
import { useUserAvatar } from "./sections/hooks/use-user-avatar";
import { useScrollSync } from "./sections/hooks/use-scroll-sync";
import { useFieldFocus } from "./sections/hooks/use-field-focus";
import { autoCropThumbnailImage } from "./sections/utils/thumbnail-utils";
import { deleteFromR2 } from "@/lib/upload-to-r2";

const defaultHeadline = "Here to Support You - Today and Every Day.";
const defaultWelcomeBodyText =
  "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

interface NewClientStep2Props {
  errorFields?: string[];
}

export function NewClientStep2({ errorFields = [] }: NewClientStep2Props) {
  const { stepData, saveStepDataLocally, goToStep, currentStep } =
    useNewClientWizardStore();

  // Hooks
  const editorState = useEditorState({ autoOpen: true });
  const { welcomeData, updateField } = useWelcomeData();
  const missionData = useMissionData();
  const { userAvatar } = useUserAvatar();
  const modalStates = useModalStates();
  const thumbnailImage = useThumbnailImage();

  // Refs
  const previewCardRef = useRef<HTMLDivElement>(null);
  const missionFieldsRef = useRef<HTMLDivElement>(null);
  const logoCardRef = useRef<HTMLDivElement>(null);
  const overlaySettingsCardRef = useRef<HTMLDivElement>(null);
  const thumbnailCardRef = useRef<HTMLDivElement>(null);
  const bannerTitleCardRef = useRef<HTMLDivElement>(null);
  const bannerPreviewSectionRef = useRef<HTMLDivElement>(null);
  const brandingPreviewCardRef = useRef<HTMLDivElement>(null);
  const previewScrollContainerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const originalSidebarWidthRef = useRef<string | null>(null);
  const scrollToPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bannerTitleHighlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Local state
  const [isLogoCardHighlighted, setIsLogoCardHighlighted] = useState(false);
  const [isOverlaySettingsHighlighted, setIsOverlaySettingsHighlighted] =
    useState(false);
  const [isBannerTitleHighlighted, setIsBannerTitleHighlighted] =
    useState(false);

  // Always start with checkbox checked by default
  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] = useState(true);

  const editorIsOpen =
    editorState.isEditorOpen || editorState.isEditorAnimating;

  // Lenis scroll setup
  const { editorScrollContainerRef, scrollSyncSourceRef } = useLenisScroll(
    editorState.isEditorOpen,
  );

  // Field focus
  const scrollToMissionFields = useCallback(() => {
    if (missionFieldsRef.current && editorScrollContainerRef.current) {
      const element = missionFieldsRef.current;
      const container = editorScrollContainerRef.current;

      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const elementTopRelativeToContainer =
        elementRect.top - containerRect.top + container.scrollTop;
      const elementBottomRelativeToContainer =
        elementTopRelativeToContainer + elementRect.height;

      const containerHeight = container.clientHeight;
      const containerScrollHeight = container.scrollHeight;

      const targetScrollTop =
        elementBottomRelativeToContainer - containerHeight;

      const maxScrollTop = containerScrollHeight - containerHeight;
      const finalScrollTop = Math.min(
        Math.max(0, targetScrollTop),
        maxScrollTop,
      );

      container.scrollTo({
        top: finalScrollTop,
        behavior: "smooth",
      });
    }
  }, []);

  useFieldFocus(
    editorState.isEditorOpen,
    editorState.isEditorAnimating,
    editorState.focusedTextField,
    editorState.heroTextField,
    headlineRef,
    bodyTextRef,
    editorScrollContainerRef,
    missionFieldsRef,
    scrollToMissionFields,
  );

  // Initialize smooth transitions for page layout
  useEffect(() => {
    if (!document.body.style.transition.includes("padding-left")) {
      const existingTransition = document.body.style.transition || "";
      document.body.style.transition = existingTransition
        ? `${existingTransition}, padding-left 200ms ease-in-out`
        : "padding-left 200ms ease-in-out";
    }

    const rootStyle = document.documentElement.style;
    if (!rootStyle.transition.includes("--sidebar-width")) {
      const existingTransition = rootStyle.transition || "";
      rootStyle.transition = existingTransition
        ? `${existingTransition}, --sidebar-width 200ms ease-in-out`
        : "--sidebar-width 200ms ease-in-out";
    }
  }, []);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollToPreviewTimeoutRef.current) {
        clearTimeout(scrollToPreviewTimeoutRef.current);
      }
      if (thumbnailImage.thumbnailHighlightTimeoutRef.current) {
        clearTimeout(thumbnailImage.thumbnailHighlightTimeoutRef.current);
      }
      if (bannerTitleHighlightTimeoutRef.current) {
        clearTimeout(bannerTitleHighlightTimeoutRef.current);
      }
    };
  }, []);

  // Close editor panel when leaving Step 2
  useEffect(() => {
    if (currentStep !== 2 && editorState.isEditorOpen) {
      if (headlineRef.current) {
        headlineRef.current.blur();
      }
      if (bodyTextRef.current) {
        bodyTextRef.current.blur();
      }
      editorState.setIsEditorAnimating(false);
      editorState.setFocusedTextField(null);
      editorState.setHeroTextField(null);
      setTimeout(() => {
        editorState.setIsEditorOpen(false);
      }, 200);
    }
  }, [currentStep, editorState.isEditorOpen]);

  // Listen for close event before step transition
  useEffect(() => {
    const handleCloseEditor = () => {
      if (editorState.isEditorOpen) {
        if (headlineRef.current) {
          headlineRef.current.blur();
        }
        if (bodyTextRef.current) {
          bodyTextRef.current.blur();
        }
        editorState.setIsEditorAnimating(false);
        editorState.setFocusedTextField(null);
        editorState.setHeroTextField(null);
        setTimeout(() => {
          editorState.setIsEditorOpen(false);
        }, 200);
      }
    };

    window.addEventListener("closeStep2Editor", handleCloseEditor);
    return () => {
      window.removeEventListener("closeStep2Editor", handleCloseEditor);
    };
  }, [editorState.isEditorOpen]);

  // Handle animation for editor modal
  useEffect(() => {
    if (editorState.isEditorOpen) {
      setTimeout(() => editorState.setIsEditorAnimating(true), 10);
    } else {
      editorState.setIsEditorAnimating(false);
      if (headlineRef.current) {
        headlineRef.current.blur();
      }
      if (bodyTextRef.current) {
        bodyTextRef.current.blur();
      }
      editorState.setFocusedTextField(null);
      editorState.setHeroTextField(null);

      setTimeout(() => {
        if (previewCardRef.current) {
          const elementTop = previewCardRef.current.getBoundingClientRect().top;
          const elementHeight =
            previewCardRef.current.getBoundingClientRect().height;
          const viewportHeight = window.innerHeight;
          const elementCenter = elementTop + elementHeight / 2;
          const viewportCenter = viewportHeight / 2;
          const scrollOffset = elementCenter - viewportCenter;

          if (Math.abs(scrollOffset) > 50) {
            window.scrollBy({
              top: scrollOffset,
              behavior: "smooth",
            });
          }
        }
      }, 250);
    }
  }, [editorState.isEditorOpen]);

  // Shift bottom panel when side panel is open or animating
  useEffect(() => {
    const sidebarWidth = "36rem";
    const shouldShift =
      editorState.isEditorOpen || editorState.isEditorAnimating;

    if (shouldShift) {
      if (originalSidebarWidthRef.current === null) {
        originalSidebarWidthRef.current =
          document.documentElement.style.getPropertyValue("--sidebar-width");
      }

      document.documentElement.style.setProperty(
        "--sidebar-width",
        sidebarWidth,
      );
    } else {
      if (originalSidebarWidthRef.current !== null) {
        if (originalSidebarWidthRef.current) {
          document.documentElement.style.setProperty(
            "--sidebar-width",
            originalSidebarWidthRef.current,
          );
        } else {
          document.documentElement.style.removeProperty("--sidebar-width");
        }
        originalSidebarWidthRef.current = null;
      }
    }
  }, [editorState.isEditorOpen, editorState.isEditorAnimating]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    setTimeout(() => {
      const wizardContent = Array.from(document.querySelectorAll("div")).find(
        (el) => {
          const htmlEl = el as HTMLElement;
          return (
            htmlEl.className.includes("mb-20") &&
            htmlEl.scrollHeight > htmlEl.clientHeight
          );
        },
      ) as HTMLElement | undefined;

      if (wizardContent) {
        wizardContent.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  }, []);

  // Set default text when checkbox is checked on mount
  useEffect(() => {
    if (useDefaultWelcomeMessage) {
      const currentBodyText = stepData.companyBasics?.heroDescription || welcomeData.bodyText || "";
      // Only set default text if current text is empty
      if (!currentBodyText || currentBodyText.trim() === "") {
        handleCompanyDataChange("heroDescription", defaultWelcomeBodyText);
        updateField("bodyText", defaultWelcomeBodyText);
      }
    }
  }, []); // Run only on mount

  // Handlers
  const handleCompanyDataChange = (field: string, value: any) => {
    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics;

    if (currentCompanyBasics) {
      const preservedBrandImages = currentCompanyBasics.brandImages || {};
      const updatedCompanyBasics = {
        ...currentCompanyBasics,
        [field]: value,
        brandImages: {
          ...preservedBrandImages,
          ...(preservedBrandImages.header && {
            header: preservedBrandImages.header,
          }),
          ...(preservedBrandImages.thumbnail && {
            thumbnail: preservedBrandImages.thumbnail,
          }),
          ...(preservedBrandImages.secondaryBanner && {
            secondaryBanner: preservedBrandImages.secondaryBanner,
          }),
          ...(preservedBrandImages.favicon && {
            favicon: preservedBrandImages.favicon,
          }),
        },
      };

      saveStepDataLocally("companyBasics", updatedCompanyBasics);
    }
  };

  const handleHeadshotChange = (newHeadshot: string) => {
    if (stepData.companyBasics?.brandImages) {
      const updatedBrandImages = {
        ...stepData.companyBasics.brandImages,
        thumbnail: {
          ...stepData.companyBasics.brandImages.thumbnail,
          url: newHeadshot,
        },
      };
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        brandImages: updatedBrandImages,
      });
    }
  };

  const handleBackgroundChange = (newBackground: string) => {
    if (stepData.companyBasics?.brandImages) {
      const updatedBrandImages = {
        ...stepData.companyBasics.brandImages,
        header: {
          ...stepData.companyBasics.brandImages.header,
          url: newBackground,
        },
      };
      saveStepDataLocally("companyBasics", {
        ...stepData.companyBasics,
        brandImages: updatedBrandImages,
      });
    }
  };

  const handleOpenHeroTextEditor = (field: "title" | "description") => {
    editorState.setHeroTextField(field);
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      if (field === "title") {
        setTimeout(() => {
          if (bannerTitleCardRef.current && editorScrollContainerRef.current) {
            const element = bannerTitleCardRef.current;
            const container = editorScrollContainerRef.current;

            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + container.scrollTop;
            const elementBottomRelativeToContainer =
              elementTopRelativeToContainer + elementRect.height;

            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;

            const paddingBottom = 20;
            const targetScrollTop =
              elementBottomRelativeToContainer -
              containerHeight +
              paddingBottom;

            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(
              Math.max(0, targetScrollTop),
              maxScrollTop,
            );

            container.scrollTo({
              top: finalScrollTop,
              behavior: "smooth",
            });

            setIsBannerTitleHighlighted(true);
            if (bannerTitleHighlightTimeoutRef.current) {
              clearTimeout(bannerTitleHighlightTimeoutRef.current);
            }
            bannerTitleHighlightTimeoutRef.current = setTimeout(() => {
              setIsBannerTitleHighlighted(false);
            }, 1500);
          }
        }, 150);
      }
    }, 10);
  };

  const handleOpenHeroSettingsEditor = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        if (overlaySettingsCardRef.current && editorScrollContainerRef.current) {
          const element = overlaySettingsCardRef.current;
          const container = editorScrollContainerRef.current;

          requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + container.scrollTop;

            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;

            const targetScrollTop =
              elementTopRelativeToContainer -
              containerHeight / 2 +
              elementRect.height / 2;

            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(
              Math.max(0, targetScrollTop),
              maxScrollTop,
            );

            container.scrollTo({
              top: finalScrollTop,
              behavior: "smooth",
            });

            setIsOverlaySettingsHighlighted(true);
            setTimeout(() => {
              setIsOverlaySettingsHighlighted(false);
            }, 1500);
          });
        }
      }, 350);
    }, 10);
  };

  const handleOpenLogoEditor = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        if (logoCardRef.current && editorScrollContainerRef.current) {
          const element = logoCardRef.current;
          const container = editorScrollContainerRef.current;

          requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + container.scrollTop;

            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;

            const targetScrollTop =
              elementTopRelativeToContainer -
              containerHeight / 2 +
              elementRect.height / 2;

            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(
              Math.max(0, targetScrollTop),
              maxScrollTop,
            );

            container.scrollTo({
              top: finalScrollTop,
              behavior: "smooth",
            });

            setIsLogoCardHighlighted(true);
            setTimeout(() => {
              setIsLogoCardHighlighted(false);
            }, 1500);
          });
        }
      }, 350);
    }, 10);
  };

  const handleBackgroundClick = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        // Find the background editor section - it's inside BannerSectionEditor
        // We can scroll to the top of the editor as it's the first section
        if (editorScrollContainerRef.current) {
          editorScrollContainerRef.current.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      }, 350);
    }, 10);
  };

  const openEditorAndScrollToThumbnail = useCallback(() => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      setTimeout(() => {
        if (thumbnailCardRef.current && editorScrollContainerRef.current) {
          const element = thumbnailCardRef.current;
          const container = editorScrollContainerRef.current;

          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const elementTopRelativeToContainer =
            elementRect.top - containerRect.top + container.scrollTop;
          const elementBottomRelativeToContainer =
            elementTopRelativeToContainer + elementRect.height;

          const containerHeight = containerRect.height;
          const containerScrollHeight = container.scrollHeight;

          const paddingBottom = 20;
          const targetScrollTop =
            elementBottomRelativeToContainer - containerHeight + paddingBottom;

          const maxScrollTop = containerScrollHeight - containerHeight;
          const finalScrollTop = Math.min(
            Math.max(0, targetScrollTop),
            maxScrollTop,
          );

          container.scrollTo({
            top: finalScrollTop,
            behavior: "smooth",
          });

          thumbnailImage.setIsThumbnailHighlighted(true);
          if (thumbnailImage.thumbnailHighlightTimeoutRef.current) {
            clearTimeout(thumbnailImage.thumbnailHighlightTimeoutRef.current);
          }
          thumbnailImage.thumbnailHighlightTimeoutRef.current = setTimeout(
            () => {
              thumbnailImage.setIsThumbnailHighlighted(false);
            },
            1500,
          );
        }
      }, 150);
    }, 10);
  }, [editorState, thumbnailImage]);

  const handleLogoImageChange = (logoData: CompanyLogoData | null) => {
    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics;
    if (!currentCompanyBasics) return;

    saveStepDataLocally("companyBasics", {
      ...currentCompanyBasics,
      companyLogo: logoData,
    });
  };

  const handleLogoRemove = useCallback(async () => {
    const currentLogo = stepData.companyBasics?.companyLogo?.url ?? modalStates.pendingLogoData?.url;
    await deleteFromR2(currentLogo);
    handleLogoImageChange(null);
    modalStates.handleLogoModalStateChange({
      isOpen: false,
      pendingData: null,
      onSave: () => { },
      onClose: () => { },
    });
  }, [stepData.companyBasics?.companyLogo?.url, modalStates.pendingLogoData?.url, modalStates]);

  const handleModalSave = useCallback(
    async (
      value: string,
      fileName: string,
      headshotData?: any,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => {
      if (!modalStates.pendingLogoData) {
        modalStates.handleLogoModalStateChange({
          isOpen: false,
          pendingData: null,
          onSave: () => { },
          onClose: () => { },
        });
        return;
      }
      let logoUrl = value;
      const draftClientId = useNewClientWizardStore.getState().draftClientId;
      if (draftClientId && value.startsWith("data:")) {
        try {
          const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
          const r2Key = await uploadBrandingToR2({
            dataUrlOrFile: value,
            fileName: fileName || "logo.png",
            clientId: draftClientId,
            slot: "logo",
          });
          if (r2Key) logoUrl = r2Key;
        } catch (_) {
          // keep data URL on failure
        }
      }
      const updatedImageData: CompanyLogoData = {
        ...modalStates.pendingLogoData,
        url: logoUrl,
        originalUrl:
          cropData?.originalImage ||
          modalStates.pendingLogoData.originalUrl ||
          logoUrl,
        fileName: fileName,
        cropData: cropData,
      };
      handleLogoImageChange(updatedImageData);
      modalStates.handleLogoModalStateChange({
        isOpen: false,
        pendingData: null,
        onSave: () => { },
        onClose: () => { },
      });
    },
    [modalStates.pendingLogoData, handleLogoImageChange, modalStates],
  );

  const handleThumbnailModalSave = (
    value: string,
    fileName: string,
    cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
  ) => {
    const pendingData = thumbnailImage.pendingThumbnailData;
    if (!pendingData) {
      thumbnailImage.setIsThumbnailModalOpen(false);
      thumbnailImage.setPendingThumbnailData(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const warnings: string[] = [];
      const recWidth = 900;
      const recHeight = 900;
      if (img.width < recWidth || img.height < recHeight) {
        warnings.push(
          `Below recommended size (900×900 px). May appear blurry.`,
        );
      }

      const updatedBrandImages = {
        ...(stepData.companyBasics?.brandImages || {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }),
        thumbnail: {
          ...pendingData,
          url: value,
          originalUrl:
            cropData?.originalImage || pendingData.originalUrl || value,
          fileName,
          width: img.width,
          height: img.height,
          status: (warnings.length > 0 ? "warning" : "ok") as
            | "ok"
            | "warning"
            | "error",
          warnings,
          cropData: cropData,
        },
      };

      if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          brandImages: updatedBrandImages,
        });
      }

      thumbnailImage.setIsThumbnailModalOpen(false);
      thumbnailImage.setPendingThumbnailData(null);
    };

    img.onerror = () => {
      const updatedBrandImages = {
        ...(stepData.companyBasics?.brandImages || {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }),
        thumbnail: {
          ...pendingData,
          url: value,
          originalUrl:
            cropData?.originalImage || pendingData.originalUrl || value,
          fileName,
          cropData: cropData,
        },
      };

      if (stepData.companyBasics) {
        saveStepDataLocally("companyBasics", {
          ...stepData.companyBasics,
          brandImages: updatedBrandImages,
        });
      }

      thumbnailImage.setIsThumbnailModalOpen(false);
      thumbnailImage.setPendingThumbnailData(null);
    };

    img.src = value;
  };

  return (
    <div
      className="space-y-4 transition-all duration-200 dark:text-gray-100"
      style={{
        transition:
          "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out",
      }}
    >
      {/* Toggle edit panel button */}
      <div className="flex items-center gap-3 px-4 py-3 -mx-4 rounded-lg bg-gray-100 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => {
            if (editorIsOpen) {
              editorState.handleCloseEditor();
            } else {
              editorState.setIsEditorOpen(true);
              setTimeout(() => editorState.setIsEditorAnimating(true), 10);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {editorIsOpen ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close Edit Panel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Branding & Messaging
            </>
          )}
        </button>
      </div>

      {/* Banner Preview only (no editing controls) */}
      <div ref={bannerPreviewSectionRef} data-preview-section="banner">
        <BannerPreviewSection
          onCompanyDataChange={handleCompanyDataChange}
          isPreviewSticky={false}
          hideEditingSections
          renderModalOutside={true}
          onLogoModalStateChange={modalStates.handleLogoModalStateChange}
          onOpenHeroTextEditor={handleOpenHeroTextEditor}
          logoCardRef={logoCardRef}
          isLogoCardHighlighted={isLogoCardHighlighted}
          onLogoCardHighlightChange={setIsLogoCardHighlighted}
          overlaySettingsCardRef={overlaySettingsCardRef}
          isOverlaySettingsHighlighted={isOverlaySettingsHighlighted}
          onOverlaySettingsHighlightChange={setIsOverlaySettingsHighlighted}
          onOpenHeroSettingsEditor={handleOpenHeroSettingsEditor}
          onOpenLogoEditor={handleOpenLogoEditor}
          onBackgroundClick={handleBackgroundClick}
        />
      </div>

      <div
        ref={previewScrollContainerRef}
        className="overflow-y-auto max-h-screen"
      >
        <div ref={brandingPreviewCardRef}>
          <BrandingPreviewCard
            missionHeadline={missionData.missionHeadline}
            missionBody={missionData.missionBody}
            userAvatar={userAvatar}
            onHeadshotChange={handleHeadshotChange}
            onBackgroundChange={handleBackgroundChange}
            onWelcomeMessageChange={(headline, bodyText) => {
              updateField("headline", headline);
              updateField("bodyText", bodyText);
              if (stepData.companyBasics) {
                saveStepDataLocally("companyBasics", {
                  ...stepData.companyBasics,
                  heroTitle: headline,
                  heroDescription: bodyText,
                });
              }
            }}
            onEditHeadshot={openEditorAndScrollToThumbnail}
            onEditBackground={() => {
              goToStep(1);
            }}
            onOpenTextEditor={(field: "headline" | "body") => {
              editorState.setFocusedTextField(field);
              editorState.setIsEditorOpen(true);
              setTimeout(() => editorState.setIsEditorAnimating(true), 10);
            }}
          />
        </div>
      </div>

      {/* Side editor panel */}
      <EditorPanelWrapper
        isOpen={editorState.isEditorOpen}
        isAnimating={editorState.isEditorAnimating}
        editorScrollContainerRef={editorScrollContainerRef}
        onClose={editorState.handleCloseEditor}
      >
        {/* Banner Section */}
        <BannerSectionEditor
          onCompanyDataChange={handleCompanyDataChange}
          onWelcomeDataChange={(field, value) => {
            if (field === "headline") updateField("headline", value);
            if (field === "bodyText") updateField("bodyText", value);
            if (field === "isAIGenerated") {
              updateField("isAIGenerated", value);
            }

            const store = useNewClientWizardStore.getState();
            const currentWelcome = store.stepData.welcomeStatement || {
              headline: "",
              bodyText: "",
              isAIGenerated: false,
            };
            store.saveStepDataLocally("welcomeStatement", {
              ...currentWelcome,
              [field]: value,
            });
          }}
          onModalStateChange={modalStates.handleHeroModalStateChange}
          onLogoModalStateChange={modalStates.handleLogoModalStateChange}
          onOpenHeroTextEditor={handleOpenHeroTextEditor}
          logoCardRef={logoCardRef}
          isLogoCardHighlighted={isLogoCardHighlighted}
          onLogoCardHighlightChange={setIsLogoCardHighlighted}
          overlaySettingsCardRef={overlaySettingsCardRef}
          isOverlaySettingsHighlighted={isOverlaySettingsHighlighted}
          onOverlaySettingsHighlightChange={setIsOverlaySettingsHighlighted}
          bannerTitleCardRef={bannerTitleCardRef}
          isBannerTitleHighlighted={isBannerTitleHighlighted}
          onBannerTitleHighlightChange={setIsBannerTitleHighlighted}
          useDefaultBody={useDefaultWelcomeMessage}
          onToggleDefaultBody={(checked) => {
            setUseDefaultWelcomeMessage(checked);
            if (checked) {
              handleCompanyDataChange(
                "heroDescription",
                defaultWelcomeBodyText,
              );
              updateField("bodyText", defaultWelcomeBodyText);
            } else {
              // Clear the message when unchecking
              handleCompanyDataChange("heroDescription", "");
              updateField("bodyText", "");
            }
          }}
          defaultBodyText={defaultWelcomeBodyText}
          errorFields={errorFields}
        />

        {/* Thumbnail Section */}
        <ThumbnailSectionEditor
          currentImage={
            stepData.companyBasics?.brandImages?.thumbnail || undefined
          }
          isHighlighted={thumbnailImage.isThumbnailHighlighted}
          onImageChange={thumbnailImage.handleThumbnailImageChange}
          onImageRemove={thumbnailImage.handleThumbnailImageRemove}
          onDefaultPhotoClick={() => thumbnailImage.setGalleryOpen(true)}
          onEditClick={thumbnailImage.handleThumbnailEditClick}
          onFileSelect={thumbnailImage.handleThumbnailFileSelect}
        />

        {/* Mission Section */}
        <MissionSectionEditor
          missionHeadline={missionData.missionHeadline}
          missionBody={missionData.missionBody}
          defaultHeadline={defaultHeadline}
          defaultBodyText={defaultWelcomeBodyText}
          useDefaultHeadline={missionData.useDefaultHeadline}
          useDefaultBody={missionData.useDefaultBody}
          headlineCharCount={missionData.headlineCharCount}
          bodyCharCount={missionData.bodyCharCount}
          isHeadlineValid={missionData.isHeadlineValid}
          isBodyValid={missionData.isBodyValid}
          errorFields={errorFields}
          headlineRef={headlineRef}
          bodyTextRef={bodyTextRef}
          onHeadlineChange={missionData.handleHeadlineChange}
          onBodyChange={missionData.handleBodyChange}
          onUseDefaultHeadlineChange={missionData.handleUseDefaultHeadline}
          onUseDefaultBodyChange={missionData.handleUseDefaultBody}
          onGenerateMissionHeadline={missionData.handleGenerateMissionHeadline}
          onGenerateMissionBody={missionData.handleGenerateMissionBody}
        />

        {/* Spacer for scroll */}
        <div
          data-section-id="thumbnail"
          ref={missionFieldsRef}
          style={{ minHeight: "1px", height: "60px" }}
        />
      </EditorPanelWrapper>

      {/* Modal Gallery */}
      <ModalGallery
        open={thumbnailImage.galleryOpen}
        onOpenChange={thumbnailImage.setGalleryOpen}
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
              await autoCropThumbnailImage(url);
            const warnings: string[] = [];
            const recWidth = 900;
            const recHeight = 900;
            if (width < recWidth || height < recHeight) {
              warnings.push(
                `Below recommended size (900×900 px). May appear blurry.`,
              );
            }

            const brandImageData: BrandImageData = {
              url: croppedUrl,
              fileName,
              fileSize: 0,
              width,
              height,
              recommendedSize: "900×900 px",
              status: (warnings.length > 0 ? "warning" : "ok") as
                | "ok"
                | "warning"
                | "error",
              warnings,
            };

            thumbnailImage.handleThumbnailImageChange(brandImageData);
            thumbnailImage.setGalleryOpen(false);
          } catch (error) {
            console.error("Failed to auto-crop image:", error);
            const img = new Image();
            img.onload = () => {
              const warnings: string[] = [];
              const recWidth = 900;
              const recHeight = 900;
              if (img.width < recWidth || img.height < recHeight) {
                warnings.push(
                  `Below recommended size (900×900 px). May appear blurry.`,
                );
              }

              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: img.width,
                height: img.height,
                recommendedSize: "900×900 px",
                status: (warnings.length > 0 ? "warning" : "ok") as
                  | "ok"
                  | "warning"
                  | "error",
                warnings,
              };

              thumbnailImage.handleThumbnailImageChange(brandImageData);
              thumbnailImage.setGalleryOpen(false);
            };

            img.onerror = () => {
              const brandImageData: BrandImageData = {
                url,
                fileName,
                fileSize: 0,
                width: 0,
                height: 0,
                recommendedSize: "900×900 px",
                status: "ok",
                warnings: [],
              };

              thumbnailImage.handleThumbnailImageChange(brandImageData);
              thumbnailImage.setGalleryOpen(false);
            };

            img.src = url;
          }
        }}
      />

      {/* SimpleImageEditorModal for Thumbnail */}
      {thumbnailImage.pendingThumbnailData && (
        <SimpleImageEditorModal
          modalTitle="Thumbnail image"
          modalDescription="This image is used in square thumbnail placements across your Employee Hub. Upload a centered image with space around the edges."
          value={thumbnailImage.pendingThumbnailData.url || ""}
          originalValue={thumbnailImage.pendingThumbnailData.originalUrl}
          fileName={thumbnailImage.pendingThumbnailData.fileName || ""}
          existingCropData={thumbnailImage.pendingThumbnailData.cropData}
          onChange={handleThumbnailModalSave}
          onRemove={() => {
            thumbnailImage.setIsThumbnailModalOpen(false);
            thumbnailImage.setPendingThumbnailData(null);
          }}
          isOpen={thumbnailImage.isThumbnailModalOpen}
          onClose={() => {
            thumbnailImage.setIsThumbnailModalOpen(false);
            thumbnailImage.setPendingThumbnailData(null);
          }}
          saveButtonText="Save Thumbnail"
          canvasWidth={600}
          canvasHeight={600}
          guidelineWidth={400}
          guidelineHeight={450}
          guidelinePadding={20}
        />
      )}

      {/* SimpleImageEditorModal for Hero Background */}
      {modalStates.isHeroModalOpen &&
        modalStates.pendingHeroImageData &&
        modalStates.heroModalHandlers && (
          <SimpleImageEditorModal
            modalTitle="Background image"
            modalDescription="Upload and edit your image."
            value={modalStates.pendingHeroImageData.url || ""}
            originalValue={modalStates.pendingHeroImageData.originalUrl}
            fileName={modalStates.pendingHeroImageData.fileName || ""}
            existingCropData={modalStates.pendingHeroImageData.cropData}
            onChange={modalStates.heroModalHandlers.onSave}
            onRemove={modalStates.heroModalHandlers.onClose}
            isOpen={modalStates.isHeroModalOpen}
            onClose={modalStates.heroModalHandlers.onClose}
            saveButtonText="Save Background"
            canvasWidth={640}
            canvasHeight={600}
            guidelineWidth={580}
            guidelineHeight={240}
            guidelinePadding={20}
          />
        )}

      {/* UniversalImageEditorModal for Company Logo */}
      {modalStates.isLogoModalOpen &&
        modalStates.pendingLogoData &&
        modalStates.logoModalHandlers && (
          <UniversalImageEditorModal
            type="normalizer"
            modalTitle="Company Logo"
            modalDescription="Upload and edit your company logo."
            value={modalStates.pendingLogoData.url || ""}
            originalValue={modalStates.pendingLogoData.originalUrl}
            fileName={modalStates.pendingLogoData.fileName || ""}
            existingCropData={modalStates.pendingLogoData.cropData}
            onChange={handleModalSave}
            onRemove={handleLogoRemove}
            isOpen={modalStates.isLogoModalOpen}
            onClose={modalStates.logoModalHandlers.onClose}
            saveButtonText="Save Logo"
          />
        )}
    </div>
  );
}
