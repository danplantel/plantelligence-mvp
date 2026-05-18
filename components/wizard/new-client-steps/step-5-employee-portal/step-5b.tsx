"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { BannerPreviewSection } from "../sections/banner-preview-section";
import { BrandingPreviewCard } from "../sections/branding-preview-card";
import { PortalDisclaimers } from "@/components/pages/client-portal/sections/portal-disclaimers";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import type {
  BrandImageData,
  BrandImagesData,
  CompanyBasicsData,
  CompanyLogoData,
  KeyContact,
} from "@/types/new-client-wizard";
import { EditorPanelWrapper } from "../sections/components/editor-panel-wrapper";
import { BannerSectionEditor } from "../sections/components/banner-section-editor";
import { ThumbnailSectionEditor } from "../sections/components/thumbnail-section-editor";
import { MissionSectionEditor } from "../sections/components/mission-section-editor";
import { DisclosuresEditor } from "../sections/components/disclosures-editor";
import { useEditorState } from "../sections/hooks/use-editor-state";
import { useWelcomeData } from "../sections/hooks/use-welcome-data";
import { useMissionData } from "../sections/hooks/use-mission-data";
import { useLenisScroll } from "../sections/hooks/use-lenis-scroll";
import { useThumbnailImage } from "../sections/hooks/use-thumbnail-image";
import { useModalStates } from "../sections/hooks/use-modal-states";
import { useUserAvatar } from "../sections/hooks/use-user-avatar";
import { useFieldFocus } from "../sections/hooks/use-field-focus";
import { autoCropThumbnailImage } from "../sections/utils/thumbnail-utils";
import { Button } from "@/components/ui/button";
import {
  Benefit,
  Disclaimer,
  BenefitsCategory,
} from "@/types/new-client-wizard";
import { BenefitsSectionEditor } from "../sections/components/benefits-section-editor";
import { PortalBenefits } from "@/components/pages/client-portal/sections/portal-benefits";
import { CardContent, Card, CardHeader } from "@/components/ui/card";
import { EyeIcon } from "lucide-react";
import {
  areAllCategoriesHiddenInPortal,
  getCategoryPortalVisibility,
  filterContactsByPortalVisibility,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import { toast } from "sonner";

const defaultHeadline = "Together, We Build a Stronger Future.";
const defaultWelcomeBodyText =
  "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

const DEFAULT_DISCLOSURES_TEXT = `The LPL Financial registered representatives associated with this website may discuss and/or transact business only with residents of the states in which they are properly registered or licensed. No offers may be made or accepted from any resident of any other state.

Securities and financial planning services offered through LPL Financial, a registered investment advisor, Member FINRA / SIPC. Lighthouse Financial Advisors is a separate entity from LPL Financial.

Sarah Johnson | Key West, FL | 123 Lighthouse Way, Key West, FL 33040 | CA Insurance Lic. # 0F77158 | Phone: (305) 555-1122

Michael Frank | Key West, FL | 123 Lighthouse Way, Key West, FL 33040 | CA Insurance Lic. # 0F37907 | Phone: (305) 555-3344

The content is developed from sources believed to be providing accurate information. This material was created for educational and informational purposes only and is not intended as ERISA, tax, legal or investment advice. If you are seeking investment advice specific to your needs, such advice services must be obtained on your own separate from this educational material. Some of this material was developed and produced to provide information on a topic that may be of interest. This is not affiliated with the named representative, broker-dealer, state – or SEC-registered investment advisory firm. The opinions expressed and material provided are for general information and should not be considered a solicitation for the purchase or sale of any security.

®Lighthouse Financial Advisors`;

interface NewClientStep5bProps {
  errorFields?: string[];
}

export function NewClientStep5b({ errorFields = [] }: NewClientStep5bProps) {
  const {
    stepData,
    saveStepDataLocally,
    saveStepDataToServer,
    goToStep,
    currentStep,
  } = useNewClientWizardStore();

  // Hooks
  const editorState = useEditorState({ autoOpen: false });
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
  const disclaimerSectionRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const originalSidebarWidthRef = useRef<string | null>(null);
  const scrollToPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bannerTitleHighlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const benefitsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contactsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Local state
  const [isLogoCardHighlighted, setIsLogoCardHighlighted] = useState(false);
  const [isOverlaySettingsHighlighted, setIsOverlaySettingsHighlighted] =
    useState(false);
  const [isBannerTitleHighlighted, setIsBannerTitleHighlighted] =
    useState(false);
  const [isDisclaimersHighlighted, setIsDisclaimersHighlighted] =
    useState(false);
  const [missionHighlightedField, setMissionHighlightedField] = useState<
    "headline" | "body" | null
  >(null);
  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] =
    useState(false);

  const [useDefaultDisclosures, setUseDefaultDisclosures] = useState(() => {
    if (stepData.disclaimers?.useDefaultDisclosures !== undefined) {
      return stepData.disclaimers.useDefaultDisclosures;
    }
    return !stepData.disclaimers?.disclosuresText;
  });

  const [disclosuresText, setDisclosuresText] = useState(
    () => stepData.disclaimers?.disclosuresText || "",
  );
  const [benefits, setBenefits] = useState<Benefit[]>(() => {
    if (stepData.employeePortalPreview?.benefits) {
      return stepData.employeePortalPreview.benefits;
    }
    // Default benefits if not set
    return [
      {
        id: "retirement",
        title: "Retirement Plan Benefits",
        description:
          "Enrollment guidance, investment options, and retirement resources to help you build a more secure financial future.",
        partnerLogo: "/benefits-logo/Waypoint-WEB.webp",
        image:
          "/benefits-logo/Beach-Summer-Couple-on-Island-Vacation-Holiday-1536x960.webp",
        buttonText: "RETIREMENT BENEFITS>",
        href: "/retirement",
        category: "Retirement",
        isEnabled: true,
      },
      {
        id: "health",
        title: "Health Insurance",
        description:
          "Comprehensive health, dental, and vision benefits to help you and your family stay healthy and protected.",
        partnerLogo: "/benefits-logo/Integrity_H_CMYK.jpeg",
        image: "/benefits-logo/Integrity.jpg",
        buttonText: "HEALTH BENEFITS>",
        href: "/health-insurance",
        category: "Group Health",
        isEnabled: true,
      },
      {
        id: "life",
        title: "Life Insurance",
        description:
          "Life and disability insurance designed to help protect your income and ensure peace of mind for your family.",
        partnerLogo: "/benefits-logo/Sun-Life-Financial.jpg",
        image:
          "/benefits-logo/Hiking-Couple-Looking-Enjoying-Sunset-View-on-Hike.webp",
        buttonText: "LIFE INSURANCE BENEFITS>",
        href: "/life-insurance",
        category: "Group Life",
        isEnabled: true,
      },
      {
        id: "wellness",
        title: "Wellness Programs",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        partnerLogo: "/benefits-logo/wellhub.png",
        image: "/benefits-logo/doing-yoga-1536x960.webp",
        buttonText: "WELLNESS BENEFITS>",
        href: "/wellness-programs",
        category: "Company / Plan Sponsor",
        isEnabled: true,
      },
    ];
  });

  // Sync benefits from store when stepData.employeePortalPreview.benefits is loaded (e.g. from server) so visibility toggles from store show in preview
  const prevStoredBenefitsRef = useRef<Benefit[] | undefined>(undefined);
  useEffect(() => {
    const stored = stepData.employeePortalPreview?.benefits as
      | Benefit[]
      | undefined;
    if (!stored || !Array.isArray(stored) || stored.length === 0) return;
    if (prevStoredBenefitsRef.current !== stored) {
      prevStoredBenefitsRef.current = stored;
      setBenefits(stored);
    }
  }, [stepData.employeePortalPreview?.benefits]);

  // Sync category portal visibility from stepData (e.g. when loading draft) — same as step 5d
  const storedVisibility =
    (stepData.employeePortalPreview as any)?.previewData
      ?.categoryPortalVisibility ??
    (stepData.employeePortalPreview as any)?.categoryPortalVisibility;
  useEffect(() => {
    if (storedVisibility != null && typeof storedVisibility === "object") {
      setCategoryPortalVisibility(
        getCategoryPortalVisibility(storedVisibility),
      );
    }
  }, [storedVisibility]);

  const [highlightedBenefitId, setHighlightedBenefitId] = useState<
    string | null
  >(null);
  const [isBenefitsHighlighted, setIsBenefitsHighlighted] = useState(false);

  // Category Display (Portal Visibility) — same logic as step 5d, so preview hides benefits/contacts when category is hidden
  const [categoryPortalVisibility, setCategoryPortalVisibility] =
    useState<CategoryPortalVisibility>(() =>
      getCategoryPortalVisibility(
        (stepData.employeePortalPreview as any)?.previewData
          ?.categoryPortalVisibility ??
          (stepData.employeePortalPreview as any)?.categoryPortalVisibility,
      ),
    );
  const [isWelcomeBodyHighlighted, setIsWelcomeBodyHighlighted] =
    useState(false);
  const welcomeBodyHighlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const benefitsSectionRef = useRef<HTMLDivElement>(null);

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
      if (benefitsSaveTimeoutRef.current) {
        clearTimeout(benefitsSaveTimeoutRef.current);
      }
      if (contactsSaveTimeoutRef.current) {
        clearTimeout(contactsSaveTimeoutRef.current);
      }
    };
  }, []);

  // Close editor panel when leaving Step 5
  useEffect(() => {
    if (currentStep !== 5 && editorState.isEditorOpen) {
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

  // Listen for editor toggle events for Step 5
  useEffect(() => {
    const handleOpenEditor = () => {
      editorState.setIsEditorOpen(true);
      setTimeout(() => editorState.setIsEditorAnimating(true), 10);
    };

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

    window.addEventListener("openStep5Editor" as any, handleOpenEditor);
    window.addEventListener("closeStep5Editor" as any, handleCloseEditor);

    return () => {
      window.removeEventListener("openStep5Editor" as any, handleOpenEditor);
      window.removeEventListener("closeStep5Editor" as any, handleCloseEditor);
    };
  }, [editorState.isEditorOpen]);

  // Broadcast editor state changes for Step 5
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("step5EditorStateChange", {
        detail: { isOpen: editorState.isEditorOpen },
      }),
    );
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

  // Log stepData to console for debugging (especially disclaimers)
  useEffect(() => {}, [stepData]);

  // Sync disclaimers from step-5a to disclosuresText
  useEffect(() => {
    const disclaimers = stepData.disclaimers?.disclaimers || [];
    const currentDisclosuresText = stepData.disclaimers?.disclosuresText || "";

    // Helper function to format disclaimer with header
    const formatDisclaimer = (disclaimer: any): string => {
      const locations = [
        ...(disclaimer.locations || []),
        ...(disclaimer.customLocation ? [disclaimer.customLocation] : []),
      ];

      let formatted = "";

      // Add header with locations if they exist
      if (locations.length > 0) {
        formatted += locations.join(", ") + "\n\n";
      }

      // Add disclaimer text with preserved whitespace
      formatted += disclaimer.text || "";

      return formatted;
    };

    // If there are disclaimers and disclosuresText is empty or not set
    if (disclaimers.length > 0 && !currentDisclosuresText) {
      // Combine all disclaimer texts with double newline separator, preserving whitespace
      const combinedText = disclaimers
        .map((disclaimer) => formatDisclaimer(disclaimer))
        .filter((text) => text && text.trim())
        .join("\n\n");

      if (combinedText) {
        // Update disclosuresText with combined disclaimers
        setDisclosuresText(combinedText);
        saveStepDataLocally("disclaimers", {
          ...stepData.disclaimers,
          disclosuresText: combinedText,
          useDefaultDisclosures: false,
        });
        setUseDefaultDisclosures(false);
      }
    } else if (disclaimers.length > 0 && currentDisclosuresText) {
      // If disclaimers exist and disclosuresText is already set,
      // check if it needs to be updated (if disclaimers changed)
      const combinedText = disclaimers
        .map((disclaimer) => formatDisclaimer(disclaimer))
        .filter((text) => text && text.trim())
        .join("\n\n");

      // Only update if the combined text is different from current
      if (combinedText && combinedText !== currentDisclosuresText) {
        setDisclosuresText(combinedText);
        saveStepDataLocally("disclaimers", {
          ...stepData.disclaimers,
          disclosuresText: combinedText,
        });
      }
    }
  }, []);

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

  // Handlers
  const handleCompanyDataChange = (field: string, value: any) => {
    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = (store.stepData.companyBasics ||
      {}) as Partial<CompanyBasicsData>;

    const preservedBrandImages = (currentCompanyBasics.brandImages ||
      {}) as Partial<BrandImagesData>;
    const updatedCompanyBasics = {
      ...currentCompanyBasics,
      [field]: value,
      brandImages:
        field === "brandImages"
          ? value
          : {
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
        // Wait for editor to fully open and render before scrolling
        setTimeout(() => {
          if (bannerTitleCardRef.current && editorScrollContainerRef.current) {
            const element = bannerTitleCardRef.current;
            const container = editorScrollContainerRef.current;

            // Wait for container to have proper dimensions
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

              setIsBannerTitleHighlighted(true);
              if (bannerTitleHighlightTimeoutRef.current) {
                clearTimeout(bannerTitleHighlightTimeoutRef.current);
              }
              bannerTitleHighlightTimeoutRef.current = setTimeout(() => {
                setIsBannerTitleHighlighted(false);
              }, 1500);
            });
          }
        }, 350); // Increased delay to ensure editor is fully open
      } else if (field === "description") {
        // Scroll to description field (Welcome Message Body)
        setTimeout(() => {
          if (bannerTitleCardRef.current && editorScrollContainerRef.current) {
            const element = bannerTitleCardRef.current;
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

              setIsWelcomeBodyHighlighted(true);
              if (welcomeBodyHighlightTimeoutRef.current) {
                clearTimeout(welcomeBodyHighlightTimeoutRef.current);
              }
              welcomeBodyHighlightTimeoutRef.current = setTimeout(() => {
                setIsWelcomeBodyHighlighted(false);
              }, 1500);
            });
          }
        }, 350);
      }
    }, 10);
  };

  const handleOpenHeroSettingsEditor = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        if (
          overlaySettingsCardRef.current &&
          editorScrollContainerRef.current
        ) {
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
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        if (thumbnailCardRef.current && editorScrollContainerRef.current) {
          const element = thumbnailCardRef.current;
          const container = editorScrollContainerRef.current;

          // Wait for container to have proper dimensions
          requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + container.scrollTop;

            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;

            const targetScrollTop =
              elementTopRelativeToContainer -
              containerRect.height / 2 +
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
          });
        }
      }, 350); // Increased delay to ensure editor is fully open
    }, 10);
  }, [editorState, thumbnailImage]);

  const handleLogoImageChange = (logoData: CompanyLogoData | null) => {
    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics;
    if (!currentCompanyBasics) return;

    const updatedData = {
      ...currentCompanyBasics,
      companyLogo: logoData,
    };

    saveStepDataLocally("companyBasics", updatedData);

    // Save to server immediately for logo changes (no debounce needed as it's a discrete action)
    saveStepDataToServer("companyBasics", updatedData);
  };

  const handleEditBenefit = (benefitId: string) => {
    editorState.setIsEditorOpen(true);
    setHighlightedBenefitId(benefitId);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        if (benefitsSectionRef.current && editorScrollContainerRef.current) {
          const element = benefitsSectionRef.current;
          const container = editorScrollContainerRef.current;

          // Wait for container to have proper dimensions
          requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();

            const benefitCard = element.querySelector(
              `[data-benefit-id="${benefitId}"]`,
            ) as HTMLElement;

            if (benefitCard) {
              const cardRect = benefitCard.getBoundingClientRect();
              // Calculate scroll position relative to the container
              const targetScrollTop =
                cardRect.top -
                containerRect.top +
                container.scrollTop -
                containerRect.height / 2 +
                cardRect.height / 2;

              container.scrollTo({
                top: targetScrollTop,
                behavior: "smooth",
              });
            } else {
              // Fallback to section top if card not found
              const elementRect = element.getBoundingClientRect();
              const targetScrollTop =
                elementRect.top -
                containerRect.top +
                container.scrollTop -
                containerRect.height / 2 +
                elementRect.height / 2;

              container.scrollTo({
                top: targetScrollTop,
                behavior: "smooth",
              });
            }

            setIsBenefitsHighlighted(true);
            setTimeout(() => {
              setIsBenefitsHighlighted(false);
              setHighlightedBenefitId(null);
            }, 3000);
          });
        }
      }, 350); // Increased delay to ensure editor is fully open
    }, 10);
  };

  const handleContactLogoChange = (
    contactId: string,
    logoUrl: string,
    fileName: string,
    cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
  ) => {
    const currentContacts = stepData.keyContacts?.contacts || [];
    const updatedContacts = currentContacts.map((contact) =>
      contact.id === contactId
        ? {
            ...contact,
            companyLogo: logoUrl,
            companyLogoAssetId: fileName, // Using fileName as assetId for now as per existing pattern
            // If we have more complex asset management, we'd handle it here
          }
        : contact,
    );

    saveStepDataLocally("keyContacts", {
      ...stepData.keyContacts,
      contacts: updatedContacts,
    });
  };

  const handleContactNameChange = (contactId: string, name: string) => {
    const currentContacts = stepData.keyContacts?.contacts || [];
    const updatedContacts = currentContacts.map((contact) =>
      contact.id === contactId
        ? {
            ...contact,
            companyName: name,
          }
        : contact,
    );

    saveStepDataLocally("keyContacts", {
      ...stepData.keyContacts,
      contacts: updatedContacts,
    });
  };

  const handleAddContact = (category: BenefitsCategory, benefitId: string) => {
    const keyContactsData = stepData.keyContacts || { contacts: [] };
    const savedContacts = keyContactsData.contacts || [];
    const defaultCompanyName = stepData?.companyBasics?.companyName || "";
    const defaultCompanyLogo = stepData?.companyBasics?.companyLogo?.url || "";

    // Create new contact with the selected category
    const newContact = {
      id: `contact-${Date.now()}-${Math.random()}`,
      contactType: "individual" as const,
      benefitsCategories: [category],
      role: "HR Generalist" as const,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName:
        category === "Company / Plan Sponsor" ? defaultCompanyName : "",
      companyLogo:
        category === "Company / Plan Sponsor" ? defaultCompanyLogo : undefined,
      companyLogoAssetId: undefined,
      name: "",
      showOnPortal: true,
      isPrimary: false,
      displayScope: "thisPortal" as const,
      isPrimaryByCategory: { [category]: true } as any,
      isPrimaryOverall: false,
      displayEmail: true,
      displayPhone: true,
      displayUrl: false,
      enableContactButton: true,
      benefitsCategory: category,
    };

    const updatedContacts = [...savedContacts, newContact];
    saveStepDataLocally("keyContacts", {
      ...keyContactsData,
      contacts: updatedContacts,
    });

    // Close editor panel
    window.dispatchEvent(new CustomEvent("closeStep5Editor"));

    // Navigate to Step 3b
    setTimeout(() => {
      saveStepDataLocally("step3SubStep", { step3SubStep: "step3b" });
      goToStep(3);

      // Dispatch event to select the new contact in Step 3b
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("selectContact", {
            detail: { contactId: newContact.id },
          }),
        );
      }, 500);
    }, 500);
  };

  const handleEditMission = (field: "headline" | "body") => {
    editorState.setIsEditorOpen(true);
    editorState.setFocusedTextField(field);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      // Wait for editor to fully open and render before scrolling
      setTimeout(() => {
        if (missionFieldsRef.current && editorScrollContainerRef.current) {
          const element = missionFieldsRef.current;
          const container = editorScrollContainerRef.current;

          // Wait for container to have proper dimensions
          requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + container.scrollTop;

            const containerHeight = containerRect.height;
            const targetScrollTop =
              elementTopRelativeToContainer -
              containerHeight / 2 +
              elementRect.height / 2;

            container.scrollTo({
              top: targetScrollTop,
              behavior: "smooth",
            });

            // Focus the field
            if (field === "headline" && headlineRef.current) {
              headlineRef.current.focus();
            } else if (field === "body" && bodyTextRef.current) {
              bodyTextRef.current.focus();
            }

            setMissionHighlightedField(field);
            setTimeout(() => setMissionHighlightedField(null), 1500);
          });
        }
      }, 350); // Increased delay to ensure editor is fully open
    }, 10);
  };

  const handleModalSave = useCallback(
    (
      value: string,
      fileName: string,
      headshotData?: any,
      cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata,
    ) => {
      if (modalStates.pendingLogoData) {
        const updatedImageData: CompanyLogoData = {
          ...modalStates.pendingLogoData,
          url: value,
          originalUrl:
            cropData?.originalImage ||
            modalStates.pendingLogoData.originalUrl ||
            value,
          fileName: fileName,
          cropData: cropData,
        };
        handleLogoImageChange(updatedImageData);
      }
      modalStates.handleLogoModalStateChange({
        isOpen: false,
        pendingData: null,
        onSave: () => {},
        onClose: () => {},
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

  const handleCategoryPortalVisibilityChange = useCallback(
    async (category: string, checked: boolean, updatedBenefits?: Benefit[]) => {
      const next = { ...categoryPortalVisibility, [category]: checked };
      const normalizedNext = getCategoryPortalVisibility(next);
      if (areAllCategoriesHiddenInPortal(normalizedNext)) {
        toast.error("At least one category must stay visible on the Benefits Hub.", {
          description: "Turn visibility back on for another category before hiding this one.",
        });
        return;
      }
      setCategoryPortalVisibility(normalizedNext);
      // Use getState() to get latest (includes benefits just saved by onBenefitsChange)
      const latest = useNewClientWizardStore.getState().stepData;
      const latestPreview =
        (latest.employeePortalPreview as any)?.previewData ??
        (latest.employeePortalPreview as any) ??
        {};
      const previewContent = updatedBenefits
        ? { ...latestPreview, benefits: updatedBenefits }
        : latestPreview;
      const currentSubStep =
        (latest.employeePortalPreview as any)?.step5SubStep ??
        previewContent?.step5SubStep ??
        "preview";
      const flatPayload = {
        ...previewContent,
        categoryPortalVisibility: normalizedNext,
        step5SubStep: currentSubStep,
      };
      saveStepDataLocally("employeePortalPreview", flatPayload);
      try {
        await saveStepDataToServer("employeePortalPreview", flatPayload);
      } catch (err) {
        console.warn("Failed to save category visibility", err);
      }
    },
    [
      categoryPortalVisibility,
      stepData.employeePortalPreview,
      saveStepDataLocally,
      saveStepDataToServer,
    ],
  );

  // Get brand colors for PortalBenefits
  const brandColor = (stepData.companyBasics as any)?.brandColor || "#0D315F";
  const secondaryColor =
    (stepData.companyBasics as any)?.secondaryColor || "#C89B5B";

  return (
    <div
      className="space-y-4 transition-all duration-200"
      style={{
        transition:
          "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out",
      }}
    >
      <Card className="my-10">
        <CardHeader className="text-2xl flex flex-row items-center justify-center font-semibold text-slate-900">
          <EyeIcon className="w-6 h-6 mr-2" color="#23919c" />
          Portal Preview
        </CardHeader>
        <CardContent className="text-center text-slate-500 mt-1">
          Review and customize how your portal will look.
        </CardContent>
      </Card>
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

      <div ref={previewScrollContainerRef}>
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
            onOpenTextEditor={handleEditMission}
          />
        </div>
        {/* Portal Benefits Section */}
        <div data-preview-section="benefits">
          <PortalBenefits
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            keyContacts={
              filterContactsByPortalVisibility(
                (stepData.keyContacts?.contacts ?? []) as unknown as Record<
                  string,
                  unknown
                >[],
                categoryPortalVisibility,
              ) as unknown as KeyContact[]
            }
            categoryPortalVisibility={categoryPortalVisibility}
            benefits={benefits}
            onEdit={handleEditBenefit}
            documents={[
              ...(stepData.complianceDocuments?.spdFile
                ? [stepData.complianceDocuments.spdFile]
                : []),
              ...(stepData.complianceDocuments?.retirementPlanDocuments || []),
              ...(stepData.complianceDocuments?.otherDocuments || []),
            ]}
          />
        </div>

        {/* Portal Disclaimers Section */}
        <div data-preview-section="disclaimers">
          <PortalDisclaimers
            brandColor={brandColor}
            companyData={{
              companyName: stepData.companyBasics?.companyName,
              disclaimers: (() => {
                const orgName =
                  (stepData as any).branding?.organizationName ||
                  stepData.companyBasics?.companyName ||
                  "[Organization Name]";
                const compName =
                  stepData.companyBasics?.companyName || "[Company Name]";

                const text = useDefaultDisclosures
                  ? DEFAULT_DISCLOSURES_TEXT.replace(
                      /[<\\[]Organization Name[>\\]]/g,
                      orgName,
                    ).replace(/[<\\[]Company Name[>\\]]/g, compName)
                  : disclosuresText;

                if (!text) return undefined;

                return text;
              })(),
            }}
            onEdit={() => {
              editorState.setIsEditorOpen(true);
              setTimeout(() => {
                editorState.setIsEditorAnimating(true);
                // Wait for editor to fully open and render before scrolling
                setTimeout(() => {
                  if (
                    disclaimerSectionRef.current &&
                    editorScrollContainerRef.current
                  ) {
                    const element = disclaimerSectionRef.current;
                    const container = editorScrollContainerRef.current;

                    // Wait for container to have proper dimensions
                    requestAnimationFrame(() => {
                      const elementRect = element.getBoundingClientRect();
                      const containerRect = container.getBoundingClientRect();
                      const elementTopRelativeToContainer =
                        elementRect.top -
                        containerRect.top +
                        container.scrollTop;

                      const containerHeight = containerRect.height;
                      const containerScrollHeight = container.scrollHeight;

                      const targetScrollTop =
                        elementTopRelativeToContainer -
                        containerHeight / 2 +
                        elementRect.height / 2;

                      const maxScrollTop =
                        containerScrollHeight - containerHeight;
                      const finalScrollTop = Math.min(
                        Math.max(0, targetScrollTop),
                        maxScrollTop,
                      );
                      console.log("finalScrollTop", finalScrollTop);
                      container.scrollTo({
                        top: finalScrollTop,
                        behavior: "smooth",
                      });
                      setIsDisclaimersHighlighted(true);
                      setTimeout(
                        () => setIsDisclaimersHighlighted(false),
                        1500,
                      );
                    });
                  }
                }, 350); // Increased delay to ensure editor is fully open
              }, 10);
            }}
          />
        </div>

        {/* Skip Button */}
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
          onWelcomeDataChange={(
            field: "headline" | "bodyText" | "isAIGenerated",
            value: any,
          ) => {
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
          isWelcomeBodyHighlighted={isWelcomeBodyHighlighted}
          useDefaultBody={useDefaultWelcomeMessage}
          onToggleDefaultBody={(checked: boolean) => {
            setUseDefaultWelcomeMessage(checked);
            if (checked) {
              handleCompanyDataChange(
                "heroDescription",
                defaultWelcomeBodyText,
              );
              updateField("bodyText", defaultWelcomeBodyText);
            }
          }}
          defaultBodyText={defaultWelcomeBodyText}
          errorFields={errorFields}
        />

        {/* Thumbnail Section */}
        <div ref={thumbnailCardRef}>
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
        </div>

        {/* Mission Section */}
        <div ref={missionFieldsRef}>
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
            onGenerateMissionHeadline={
              missionData.handleGenerateMissionHeadline
            }
            onGenerateMissionBody={missionData.handleGenerateMissionBody}
            highlightedField={missionHighlightedField}
          />
        </div>

        {/* Benefits Section — includes Category Display toggles at top */}
        <div ref={benefitsSectionRef}>
          <BenefitsSectionEditor
            benefits={benefits}
            isHighlighted={isBenefitsHighlighted}
            highlightedBenefitId={highlightedBenefitId}
            keyContacts={stepData.keyContacts?.contacts}
            categoryPortalVisibilityProps={{
              categoryPortalVisibility,
              onCategoryVisibilityChange: handleCategoryPortalVisibilityChange,
            }}
            onBenefitsChange={(newBenefits) => {
              setBenefits(newBenefits);
              const updatedData = {
                ...stepData.employeePortalPreview,
                benefits: newBenefits,
              };

              // Save locally immediately
              saveStepDataLocally("employeePortalPreview", updatedData);

              // Debounce save to server — use getState() so we don't overwrite categoryPortalVisibility
              // or benefits with stale closure data (e.g. when restoring visibility)
              if (benefitsSaveTimeoutRef.current) {
                clearTimeout(benefitsSaveTimeoutRef.current);
              }
              benefitsSaveTimeoutRef.current = setTimeout(() => {
                const latest = useNewClientWizardStore.getState().stepData;
                const latestPreview =
                  (latest.employeePortalPreview as any)?.previewData ??
                  (latest.employeePortalPreview as any) ??
                  {};
                const latestBenefits = (latestPreview?.benefits ??
                  newBenefits) as Benefit[];
                const payload = { ...latestPreview, benefits: latestBenefits };
                saveStepDataToServer("employeePortalPreview", payload);
              }, 1000);
            }}
            onContactLogoChange={(contactId, logoUrl, fileName, cropData) => {
              handleContactLogoChange(contactId, logoUrl, fileName, cropData);

              // Trigger debounced server save for contacts
              const currentContacts = stepData.keyContacts?.contacts || [];
              const updatedContacts = currentContacts.map((contact) =>
                contact.id === contactId
                  ? {
                      ...contact,
                      companyLogo: logoUrl,
                      companyLogoAssetId: fileName,
                    }
                  : contact,
              );

              const updatedData = {
                ...stepData.keyContacts,
                contacts: updatedContacts,
              };

              if (contactsSaveTimeoutRef.current) {
                clearTimeout(contactsSaveTimeoutRef.current);
              }
              contactsSaveTimeoutRef.current = setTimeout(() => {
                saveStepDataToServer("keyContacts", updatedData);
              }, 1000);
            }}
            onAddContact={handleAddContact}
            onContactNameChange={(contactId, name) => {
              handleContactNameChange(contactId, name);

              // Trigger debounced server save for contacts
              const currentContacts = stepData.keyContacts?.contacts || [];
              const updatedContacts = currentContacts.map((contact) =>
                contact.id === contactId
                  ? {
                      ...contact,
                      companyName: name,
                    }
                  : contact,
              );

              const updatedData = {
                ...stepData.keyContacts,
                contacts: updatedContacts,
              };

              if (contactsSaveTimeoutRef.current) {
                clearTimeout(contactsSaveTimeoutRef.current);
              }
              contactsSaveTimeoutRef.current = setTimeout(() => {
                saveStepDataToServer("keyContacts", updatedData);
              }, 1000);
            }}
          />
        </div>

        {/* Disclaimers Section */}
        <div ref={disclaimerSectionRef}>
          <DisclosuresEditor
            disclosuresText={disclosuresText}
            useDefaultDisclosures={useDefaultDisclosures}
            defaultDisclosuresText={DEFAULT_DISCLOSURES_TEXT.replace(
              "[Organization Name]",
              "[Organization Name]",
            ).replace(
              "[Company Name]",
              stepData.companyBasics?.companyName || "[Company Name]",
            )}
            isHighlighted={isDisclaimersHighlighted}
            onDisclosuresTextChange={(value) => {
              setDisclosuresText(value);
              console.log("📝 [FRONTEND] Disclosures Text Changed:", value);
              const updatedDisclaimers = {
                ...stepData.disclaimers,
                disclosuresText: value,
              };

              saveStepDataLocally("disclaimers", updatedDisclaimers);
            }}
            onUseDefaultDisclosuresChange={(checked) => {
              setUseDefaultDisclosures(checked);
              const updatedDisclaimers = {
                ...stepData.disclaimers,
                useDefaultDisclosures: checked,
              };

              saveStepDataLocally("disclaimers", updatedDisclaimers);
            }}
          />
        </div>
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
            onRemove={modalStates.logoModalHandlers.onClose}
            isOpen={modalStates.isLogoModalOpen}
            onClose={modalStates.logoModalHandlers.onClose}
            saveButtonText="Save Logo"
          />
        )}
    </div>
  );
}
