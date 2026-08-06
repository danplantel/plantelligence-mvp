"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { BannerPreviewSection } from "./sections/banner-preview-section";
import { BrandingPreviewCard } from "./sections/branding-preview-card";
import { SimpleImageEditorModal } from "@/components/ui/simple-image-editor-modal";
import { ModalGallery } from "@/components/ui/modalGallery";
import type {
  BrandImageData,
  CompanyLogoData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";
import { EditorPanelWrapper } from "./sections/components/editor-panel-wrapper";
import { BannerSectionEditor } from "./sections/components/banner-section-editor";
import { ThumbnailSectionEditor } from "./sections/components/thumbnail-section-editor";
import { WelcomeStatementCard } from "./sections/components/welcome-statement-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Smartphone, Monitor } from "lucide-react";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { ClientPortal } from "@/components/pages/client-portal/client-portal";

const defaultHeadline = "Here to Support You - Today and Every Day.";
const defaultWelcomeBodyText =
  "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

/** Native preview widths for each mode */
const DESKTOP_WIDTH = 1400;
const HEADER_HEIGHT = 72;
const BOTTOM_NAV_HEIGHT = 72;
/** Mobile preview aspect ratio (18:9 phone) */
const MOBILE_ASPECT_RATIO = 18 / 9;
/** Mobile preview width in px */
const MOBILE_WIDTH = 200;
/** Reference mobile viewport width — content renders at 390 px and scales down */
const REFERENCE_MOBILE_WIDTH = 390;

type PreviewMode = "desktop" | "mobile";

/** Mobile preview iframe with CSS-transform scaling */
function MobilePreviewFrame({ children, width }: { children: React.ReactNode; width: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const scale = width / REFERENCE_MOBILE_WIDTH;
  const innerHeight = Math.round((width * MOBILE_ASPECT_RATIO) / scale);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(
      '<!DOCTYPE html><html style="overflow:hidden"><head>' +
      '<meta name="viewport" content="width=' + REFERENCE_MOBILE_WIDTH + ', initial-scale=1">' +
      '</head><body style="overflow:hidden; width:100%; height:100%; margin:0"></body></html>',
    );
    doc.close();

    const parentStyles = Array.from(
      document.querySelectorAll("style, link[rel=stylesheet]"),
    ) as (HTMLStyleElement | HTMLLinkElement)[];
    parentStyles.forEach((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      doc.head.appendChild(clone);
    });

    document.body.classList.forEach((cls) => doc.body.classList.add(cls));

    const rootStyles = getComputedStyle(document.documentElement);
    const vars = Array.from(document.documentElement.style).filter((k) =>
      k.startsWith("--"),
    );
    vars.forEach((k) => {
      doc.documentElement.style.setProperty(k, rootStyles.getPropertyValue(k));
    });

    setMountNode(doc.body);
    return () => setMountNode(null);
  }, [width]);

  const height = Math.round(width * MOBILE_ASPECT_RATIO);

  return (
    <iframe
      ref={iframeRef}
      title="Mobile Preview"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: "none",
        background: "white",
        flexShrink: 0,
        maxHeight: "100%",
      }}
    >
      {mountNode &&
        createPortal(
          <div
            style={{
              width: `${REFERENCE_MOBILE_WIDTH}px`,
              height: `${innerHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            className="[&::-webkit-scrollbar]:hidden"
          >
            {children}
          </div>,
          mountNode,
        )}
    </iframe>
  );
}

interface NewClientStep2Props {
  errorFields?: string[];
}

export function NewClientStep2({ errorFields = [] }: NewClientStep2Props) {
  const { stepData, saveStepDataLocally, goToStep, currentStep, draftClientId } =
    useNewClientWizardStore();

  // Resolve company-level branding for the PortalHeader
  const planCompanyLogo = stepData.companyBasics?.companyLogo?.url ?? undefined;
  const brandColor = stepData.companyBasics?.primaryColor || "#1F3A60";
  const secondaryColor = stepData.companyBasics?.secondaryColor || "#6B7280";

  // ── Build ClientPortal data from wizard store (used in mobile & desktop preview) ──
  const portalData = useMemo(() => {
    const cb = stepData.companyBasics;
    return {
      companyData: {
        companyName: cb?.companyName || "",
        companyWebsite: cb?.companyWebsite || "",
        companyLogo: cb?.companyLogo?.url || "",
        logoFileName: cb?.companyLogo?.fileName || "",
        brandColor: cb?.primaryColor,
        secondaryColor: cb?.secondaryColor,
        missionHeadline: cb?.missionHeadline || "",
        missionBody: cb?.missionBody || "",
        appointmentLink: cb?.appointmentLink || "",
        backgroundImg: cb?.brandImages?.header?.url || "",
        backgroundImgName: cb?.brandImages?.header?.fileName || "",
        thumbnailImg: cb?.brandImages?.thumbnail?.url || "",
        thumbnailImgName: cb?.brandImages?.thumbnail?.fileName || "",
        disclaimers: "",
        heroTitle: cb?.heroTitle,
        heroDescription: cb?.heroDescription || defaultWelcomeBodyText,
        heroOverlayOpacity: cb?.heroOverlayOpacity,
        heroBackgroundOpacity: cb?.heroBackgroundOpacity,
        heroContainerOpacity: cb?.heroContainerOpacity,
        heroContainerBackgroundOpacity: cb?.heroContainerBackgroundOpacity,
        heroContainerBlockOpacity: cb?.heroContainerBlockOpacity,
        heroCompanyNameColor: cb?.heroCompanyNameColor,
        heroContainerInverted: cb?.heroContainerInverted,
        heroBackgroundInverted: cb?.heroBackgroundInverted,
        heroUseGradient: cb?.heroUseGradient,
        desktopHeroBackgroundPosition: (cb as any)?.desktopHeroBackgroundPosition,
        mobileHeroBackgroundPosition: (cb as any)?.mobileHeroBackgroundPosition,
        brandImages: cb?.brandImages,
      },
      keyContacts: [],
      documents: [],
      employeePortalPreview: stepData.employeePortalPreview,
      categoryPortalVisibility: null,
    };
  }, [stepData.companyBasics, stepData.employeePortalPreview]);

  // Hooks
  const editorState = useEditorState({ autoOpen: true });
  const { welcomeData, updateField } = useWelcomeData();
  const missionData = useMissionData();
  const { userAvatar } = useUserAvatar();
  const modalStates = useModalStates();
  const thumbnailImage = useThumbnailImage();

  // State for fixed bar
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(52);

  // Refs
  const previewCardRef = useRef<HTMLDivElement>(null);
  const missionFieldsRef = useRef<HTMLDivElement>(null);
  const logoCardRef = useRef<HTMLDivElement>(null);
  const overlaySettingsCardRef = useRef<HTMLDivElement>(null);
  const thumbnailCardRef = useRef<HTMLDivElement>(null);
  const bannerTitleCardRef = useRef<HTMLDivElement>(null);
  const heroBackgroundCardRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
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
  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] = useState(true);

  const editorIsOpen =
    editorState.isEditorOpen || editorState.isEditorAnimating;

  // ── Preview mode ──
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const previewContentRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  // Lenis scroll setup — disable main Lenis so wheel events reach the preview
  const { editorScrollContainerRef, scrollSyncSourceRef } = useLenisScroll(
    editorState.isEditorOpen, true,
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
      const finalScrollTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);
      container.scrollTo({ top: finalScrollTop, behavior: "smooth" });
    }
  }, []);

  // Generic helper to scroll the editor container to a given element,
  // aligning it near the top or bottom of the visible panel.
  const scrollEditorToElement = useCallback(
    (element: HTMLElement, align: "top" | "bottom" = "top") => {
      const container = editorScrollContainerRef.current;
      if (!container) return;
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const elementTopRelativeToContainer =
        elementRect.top - containerRect.top + container.scrollTop;
      const elementBottomRelativeToContainer =
        elementTopRelativeToContainer + elementRect.height;
      const containerHeight = containerRect.height;
      const containerScrollHeight = container.scrollHeight;
      const padding = 16;
      const targetScrollTop =
        align === "bottom"
          ? elementBottomRelativeToContainer - containerHeight + padding
          : elementTopRelativeToContainer - padding;
      const maxScrollTop = containerScrollHeight - containerHeight;
      const finalScrollTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);
      container.scrollTo({ top: finalScrollTop, behavior: "smooth" });
    },
    [editorScrollContainerRef],
  );

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

  // ── Scroll to the top-most required field when validation errors appear ──
  useEffect(() => {
    if (!errorFields || errorFields.length === 0) return;

    // Only handle Step 2 relevant fields (in document order within the panel)
    const step2Fields = [
      "brandImages.header",
      "headline",
      "bodyText",
      "missionHeadline",
      "missionBody",
    ];
    const errored = step2Fields.filter((f) => errorFields.includes(f));
    if (errored.length === 0) return;

    // Resolve the top-most errored section
    let targetRef: React.RefObject<HTMLDivElement> | null = null;
    let align: "top" | "bottom" = "top";
    if (errored.includes("brandImages.header")) {
      targetRef = heroBackgroundCardRef;
    } else if (errored.includes("headline") || errored.includes("bodyText")) {
      targetRef = heroContentRef;
    } else if (
      errored.includes("missionHeadline") ||
      errored.includes("missionBody")
    ) {
      targetRef = missionFieldsRef;
      align = "bottom";
    }
    if (!targetRef) return;
    const resolvedTargetRef: React.RefObject<HTMLDivElement> = targetRef;

    // Ensure the editor is open so the scroll is visible
    if (!editorState.isEditorOpen) {
      editorState.setIsEditorOpen(true);
      setTimeout(() => editorState.setIsEditorAnimating(true), 10);
    }

    // Wait for the editor to render/animate before scrolling
    const timer = setTimeout(() => {
      if (resolvedTargetRef.current) {
        scrollEditorToElement(resolvedTargetRef.current, align);
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorFields]);

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
      if (scrollToPreviewTimeoutRef.current) clearTimeout(scrollToPreviewTimeoutRef.current);
      if (thumbnailImage.thumbnailHighlightTimeoutRef.current) clearTimeout(thumbnailImage.thumbnailHighlightTimeoutRef.current);
      if (bannerTitleHighlightTimeoutRef.current) clearTimeout(bannerTitleHighlightTimeoutRef.current);
    };
  }, []);

  // Close editor panel when leaving Step 2
  useEffect(() => {
    if (currentStep !== 2 && editorState.isEditorOpen) {
      if (headlineRef.current) headlineRef.current.blur();
      if (bodyTextRef.current) bodyTextRef.current.blur();
      editorState.setIsEditorAnimating(false);
      editorState.setFocusedTextField(null);
      editorState.setHeroTextField(null);
      setTimeout(() => { editorState.setIsEditorOpen(false); }, 200);
    }
  }, [currentStep, editorState.isEditorOpen]);

  // Listen for close event before step transition
  useEffect(() => {
    const handleCloseEditor = () => {
      if (editorState.isEditorOpen) {
        if (headlineRef.current) headlineRef.current.blur();
        if (bodyTextRef.current) bodyTextRef.current.blur();
        editorState.setIsEditorAnimating(false);
        editorState.setFocusedTextField(null);
        editorState.setHeroTextField(null);
        setTimeout(() => { editorState.setIsEditorOpen(false); }, 200);
      }
    };
    window.addEventListener("closeStep2Editor", handleCloseEditor);
    return () => window.removeEventListener("closeStep2Editor", handleCloseEditor);
  }, [editorState.isEditorOpen]);

  // Handle animation for editor modal
  useEffect(() => {
    if (editorState.isEditorOpen) {
      setTimeout(() => editorState.setIsEditorAnimating(true), 10);
    } else {
      editorState.setIsEditorAnimating(false);
      if (headlineRef.current) headlineRef.current.blur();
      if (bodyTextRef.current) bodyTextRef.current.blur();
      editorState.setFocusedTextField(null);
      editorState.setHeroTextField(null);
      setTimeout(() => {
        if (previewCardRef.current) {
          const elementTop = previewCardRef.current.getBoundingClientRect().top;
          const elementHeight = previewCardRef.current.getBoundingClientRect().height;
          const viewportHeight = window.innerHeight;
          const elementCenter = elementTop + elementHeight / 2;
          const viewportCenter = viewportHeight / 2;
          const scrollOffset = elementCenter - viewportCenter;
          if (Math.abs(scrollOffset) > 50) {
            window.scrollBy({ top: scrollOffset, behavior: "smooth" });
          }
        }
      }, 250);
    }
  }, [editorState.isEditorOpen]);

  // Sidebar widening — matches benefits/step-2 behavior.
  // When the editor opens, widen --sidebar-width to 36rem so the header
  // and toolbar shift right, creating space for the fixed overlay editor.
  useEffect(() => {
    const sidebarWidth = "36rem";
    const shouldShift = editorState.isEditorOpen || editorState.isEditorAnimating;
    if (shouldShift) {
      if (originalSidebarWidthRef.current === null) {
        originalSidebarWidthRef.current = document.documentElement.style.getPropertyValue("--sidebar-width");
      }
      document.documentElement.style.setProperty("--sidebar-width", sidebarWidth);
    } else {
      if (originalSidebarWidthRef.current !== null) {
        if (originalSidebarWidthRef.current) {
          document.documentElement.style.setProperty("--sidebar-width", originalSidebarWidthRef.current);
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
          return htmlEl.className.includes("mb-20") && htmlEl.scrollHeight > htmlEl.clientHeight;
        },
      ) as HTMLElement | undefined;
      if (wizardContent) wizardContent.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }, []);

  // Measure bar height
  useEffect(() => {
    if (barRef.current) {
      setBarHeight(barRef.current.offsetHeight);
      const observer = new ResizeObserver(() => {
        if (barRef.current) setBarHeight(barRef.current.offsetHeight);
      });
      observer.observe(barRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Set default text when checkbox is checked on mount
  useEffect(() => {
    if (useDefaultWelcomeMessage) {
      const currentBodyText = stepData.companyBasics?.heroDescription || welcomeData.bodyText || "";
      if (!currentBodyText || currentBodyText.trim() === "") {
        handleCompanyDataChange("heroDescription", defaultWelcomeBodyText);
        updateField("bodyText", defaultWelcomeBodyText);
      }
    }
  }, []);

  // ── Lock body scroll while on Step 2 ──
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // ── Scale calculation ──
  const updateScale = useCallback(() => {
    if (previewMode === "mobile") return;
    const content = previewContentRef.current;
    const scrollable = scrollableRef.current;
    if (!content || !scrollable) return;
    const availableWidth = scrollable.clientWidth;
    const newScale = Math.min(availableWidth / DESKTOP_WIDTH, 1);
    setScale(newScale);
    const contentHeight = content.scrollHeight;
    setScaledHeight(contentHeight * newScale);
  }, [previewMode]);

  useEffect(() => {
    if (previewMode === "mobile") return;
    const raf = requestAnimationFrame(() => updateScale());
    return () => cancelAnimationFrame(raf);
  }, [updateScale, editorState.isEditorOpen, previewMode]);

  // Observe the scaled content div for size changes (e.g. images loading)
  // so scaledHeight stays in sync with actual content height.
  useEffect(() => {
    const content = previewContentRef.current;
    if (!content || previewMode === "mobile") return;
    const observer = new ResizeObserver(() => {
      updateScale();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [updateScale, previewMode]);

  useEffect(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable) return;
    const observer = new ResizeObserver(() => {
      if (previewMode !== "mobile") updateScale();
    });
    observer.observe(scrollable);
    return () => observer.disconnect();
  }, [updateScale, previewMode]);

  useEffect(() => {
    if (previewMode !== "mobile") {
      const timer = setTimeout(() => updateScale(), 100);
      return () => clearTimeout(timer);
    }
  }, [previewMode, updateScale]);

  useEffect(() => {
    if (previewMode === "mobile") {
      setScale(1);
      setScaledHeight(undefined);
    }
  }, [previewMode]);

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
          ...(preservedBrandImages.header && { header: preservedBrandImages.header }),
          ...(preservedBrandImages.thumbnail && { thumbnail: preservedBrandImages.thumbnail }),
          ...(preservedBrandImages.secondaryBanner && { secondaryBanner: preservedBrandImages.secondaryBanner }),
          ...(preservedBrandImages.favicon && { favicon: preservedBrandImages.favicon }),
        },
      };
      saveStepDataLocally("companyBasics", updatedCompanyBasics);
    }
  };

  const handleHeadshotChange = (newHeadshot: string) => {
    if (stepData.companyBasics?.brandImages) {
      const updatedBrandImages = {
        ...stepData.companyBasics.brandImages,
        thumbnail: { ...stepData.companyBasics.brandImages.thumbnail, url: newHeadshot },
      };
      saveStepDataLocally("companyBasics", { ...stepData.companyBasics, brandImages: updatedBrandImages });
    }
  };

  const handleBackgroundChange = (newBackground: string) => {
    if (stepData.companyBasics?.brandImages) {
      const updatedBrandImages = {
        ...stepData.companyBasics.brandImages,
        header: { ...stepData.companyBasics.brandImages.header, url: newBackground },
      };
      saveStepDataLocally("companyBasics", { ...stepData.companyBasics, brandImages: updatedBrandImages });
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
            const elementTopRelativeToContainer = elementRect.top - containerRect.top + container.scrollTop;
            const elementBottomRelativeToContainer = elementTopRelativeToContainer + elementRect.height;
            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;
            const paddingBottom = 20;
            const targetScrollTop = elementBottomRelativeToContainer - containerHeight + paddingBottom;
            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);
            container.scrollTo({ top: finalScrollTop, behavior: "smooth" });
            setIsBannerTitleHighlighted(true);
            if (bannerTitleHighlightTimeoutRef.current) clearTimeout(bannerTitleHighlightTimeoutRef.current);
            bannerTitleHighlightTimeoutRef.current = setTimeout(() => setIsBannerTitleHighlighted(false), 1500);
          }
        }, 150);
      }
    }, 10);
  };

  const handleOpenHeroSettingsEditor = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      setTimeout(() => {
        if (overlaySettingsCardRef.current && editorScrollContainerRef.current) {
          const element = overlaySettingsCardRef.current;
          const container = editorScrollContainerRef.current;
          requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const elementTopRelativeToContainer = elementRect.top - containerRect.top + container.scrollTop;
            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;
            const targetScrollTop = elementTopRelativeToContainer - containerHeight / 2 + elementRect.height / 2;
            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);
            container.scrollTo({ top: finalScrollTop, behavior: "smooth" });
            setIsOverlaySettingsHighlighted(true);
            setTimeout(() => setIsOverlaySettingsHighlighted(false), 1500);
          });
        }
      }, 350);
    }, 10);
  };

  const handleOpenLogoEditor = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      setTimeout(() => {
        if (logoCardRef.current && editorScrollContainerRef.current) {
          const element = logoCardRef.current;
          const container = editorScrollContainerRef.current;
          requestAnimationFrame(() => {
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const elementTopRelativeToContainer = elementRect.top - containerRect.top + container.scrollTop;
            const containerHeight = containerRect.height;
            const containerScrollHeight = container.scrollHeight;
            const targetScrollTop = elementTopRelativeToContainer - containerHeight / 2 + elementRect.height / 2;
            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);
            container.scrollTo({ top: finalScrollTop, behavior: "smooth" });
            setIsLogoCardHighlighted(true);
            setTimeout(() => setIsLogoCardHighlighted(false), 1500);
          });
        }
      }, 350);
    }, 10);
  };

  const handleBackgroundClick = () => {
    editorState.setIsEditorOpen(true);
    setTimeout(() => {
      editorState.setIsEditorAnimating(true);
      setTimeout(() => {
        if (editorScrollContainerRef.current) {
          editorScrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
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
          const elementTopRelativeToContainer = elementRect.top - containerRect.top + container.scrollTop;
          const elementBottomRelativeToContainer = elementTopRelativeToContainer + elementRect.height;
          const containerHeight = containerRect.height;
          const containerScrollHeight = container.scrollHeight;
          const paddingBottom = 20;
          const targetScrollTop = elementBottomRelativeToContainer - containerHeight + paddingBottom;
          const maxScrollTop = containerScrollHeight - containerHeight;
          const finalScrollTop = Math.min(Math.max(0, targetScrollTop), maxScrollTop);
          container.scrollTo({ top: finalScrollTop, behavior: "smooth" });
          thumbnailImage.setIsThumbnailHighlighted(true);
          if (thumbnailImage.thumbnailHighlightTimeoutRef.current) clearTimeout(thumbnailImage.thumbnailHighlightTimeoutRef.current);
          thumbnailImage.thumbnailHighlightTimeoutRef.current = setTimeout(() => thumbnailImage.setIsThumbnailHighlighted(false), 1500);
        }
      }, 150);
    }, 10);
  }, [editorState, thumbnailImage]);

  const handleLogoImageChange = (logoData: CompanyLogoData | null) => {
    const store = useNewClientWizardStore.getState();
    const currentCompanyBasics = store.stepData.companyBasics;
    if (!currentCompanyBasics) return;
    saveStepDataLocally("companyBasics", { ...currentCompanyBasics, companyLogo: logoData });
  };

  const handleLogoRemove = useCallback(async () => {
    const currentLogo = stepData.companyBasics?.companyLogo?.url ?? modalStates.pendingLogoData?.url;
    await deleteFromR2(currentLogo);
    handleLogoImageChange(null);
    modalStates.handleLogoModalStateChange({ isOpen: false, pendingData: null, onSave: () => {}, onClose: () => {} });
  }, [stepData.companyBasics?.companyLogo?.url, modalStates.pendingLogoData?.url, modalStates]);

  const handleModalSave = useCallback(
    async (value: string, fileName: string, headshotData?: any, cropData?: import("@/components/ui/simple-image-editor-modal").CropMetadata) => {
      if (!modalStates.pendingLogoData) {
        modalStates.handleLogoModalStateChange({ isOpen: false, pendingData: null, onSave: () => {}, onClose: () => {} });
        return;
      }
      let logoUrl = value;
      const draftClientId = useNewClientWizardStore.getState().draftClientId;
      if (draftClientId && value.startsWith("data:")) {
        try {
          const { uploadBrandingToR2 } = await import("@/lib/branding-r2");
          const r2Key = await uploadBrandingToR2({ dataUrlOrFile: value, fileName: fileName || "logo.png", clientId: draftClientId, slot: "logo" });
          if (r2Key) logoUrl = r2Key;
        } catch (_) {}
      }
      const updatedImageData: CompanyLogoData = {
        ...modalStates.pendingLogoData,
        url: logoUrl,
        originalUrl: cropData?.originalImage || modalStates.pendingLogoData.originalUrl || logoUrl,
        fileName: fileName,
        cropData: cropData,
      };
      handleLogoImageChange(updatedImageData);
      modalStates.handleLogoModalStateChange({ isOpen: false, pendingData: null, onSave: () => {}, onClose: () => {} });
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
      if (img.width < recWidth || img.height < recHeight) warnings.push("Below recommended size (900×900 px). May appear blurry.");
      const updatedBrandImages = {
        ...(stepData.companyBasics?.brandImages || { header: null, thumbnail: null, secondaryBanner: null, favicon: null }),
        thumbnail: { ...pendingData, url: value, originalUrl: cropData?.originalImage || pendingData.originalUrl || value, fileName, width: img.width, height: img.height, status: (warnings.length > 0 ? "warning" : "ok") as "ok" | "warning" | "error", warnings, cropData: cropData },
      };
      if (stepData.companyBasics) saveStepDataLocally("companyBasics", { ...stepData.companyBasics, brandImages: updatedBrandImages });
      thumbnailImage.setIsThumbnailModalOpen(false);
      thumbnailImage.setPendingThumbnailData(null);
    };
    img.onerror = () => {
      const updatedBrandImages = {
        ...(stepData.companyBasics?.brandImages || { header: null, thumbnail: null, secondaryBanner: null, favicon: null }),
        thumbnail: { ...pendingData, url: value, originalUrl: cropData?.originalImage || pendingData.originalUrl || value, fileName, cropData: cropData },
      };
      if (stepData.companyBasics) saveStepDataLocally("companyBasics", { ...stepData.companyBasics, brandImages: updatedBrandImages });
      thumbnailImage.setIsThumbnailModalOpen(false);
      thumbnailImage.setPendingThumbnailData(null);
    };
    img.src = value;
  };

  const totalFixedHeight = HEADER_HEIGHT + barHeight + BOTTOM_NAV_HEIGHT;
  const togglePreviewMode = () => setPreviewMode((prev) => (prev === "desktop" ? "mobile" : "desktop"));

  // ── Scroll the preview to a field when its editor input is focused/clicked ──
  const focusPreviewField = (field: string) => {
    window.dispatchEvent(
      new CustomEvent("benefitsPreviewScrollTo", { detail: { field } }),
    );
  };

  useEffect(() => {
    const handlePreviewScroll = (e: Event) => {
      const field = (e as CustomEvent<{ field?: string }>).detail?.field;
      if (!field) return;
      const container = document.querySelector(
        "[data-preview-scroll-container]",
      );
      if (!container) return;

      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-preview-field="${field}"]`);
        if (!el) return;
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const elCenter = elRect.top + elRect.height / 2;
        const containerCenter =
          containerRect.top + container.clientHeight / 2;
        const delta = elCenter - containerCenter;
        const maxScroll =
          (container as HTMLElement).scrollHeight -
          (container as HTMLElement).clientHeight;
        const targetScroll = Math.min(
          Math.max(0, (container as HTMLElement).scrollTop + delta),
          maxScroll,
        );
        (container as HTMLElement).scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      });
    };
    window.addEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
    return () =>
      window.removeEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
  }, []);

  const previewContent = (
    <>
      <div ref={bannerPreviewSectionRef} data-preview-section="banner" data-preview-field="banner">
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
      <div ref={previewScrollContainerRef} className="overflow-y-auto max-h-screen">
        <div ref={brandingPreviewCardRef} data-preview-field="mission">
          <BrandingPreviewCard
            missionHeadline={missionData.missionHeadline}
            missionBody={missionData.missionBody}
            userAvatar={userAvatar}
            onHeadshotChange={handleHeadshotChange}
            onBackgroundChange={handleBackgroundChange}
            onWelcomeMessageChange={(headline, bodyText) => {
              updateField("headline", headline);
              updateField("bodyText", bodyText);
              if (stepData.companyBasics) saveStepDataLocally("companyBasics", { ...stepData.companyBasics, heroTitle: headline, heroDescription: bodyText });
            }}
            onEditHeadshot={openEditorAndScrollToThumbnail}
            onEditBackground={() => goToStep(1)}
            onOpenTextEditor={(field: "headline" | "body") => {
              editorState.setFocusedTextField(field);
              editorState.setIsEditorOpen(true);
              setTimeout(() => editorState.setIsEditorAnimating(true), 10);
            }}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="w-full transition-all duration-200">
      {/* Spacer */}
      <div style={{ height: HEADER_HEIGHT + barHeight }} />

      {/* Fixed toolbar */}
      <div
        className="fixed top-0 z-[45]"
        style={{
          left: "var(--sidebar-width, 18rem)",
          width: "calc(100% - var(--sidebar-width, 18rem))",
        }}
      >
        <div style={{ height: `${HEADER_HEIGHT}px` }} />
        <div
          ref={barRef}
          className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          {/* Left: Edit Panel toggle */}
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
                Open Edit Panel
              </>
            )}
          </button>

          {/* Right: Mobile/Desktop preview toggle */}
          <button
            type="button"
            onClick={togglePreviewMode}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            title={previewMode === "mobile" ? "Switch to Desktop preview" : "Switch to Mobile preview"}
          >
            {previewMode === "mobile" ? (
              <><Monitor className="w-4 h-4" /> Desktop Preview</>
            ) : (
              <><Smartphone className="w-4 h-4" /> Mobile Preview</>
            )}
          </button>
        </div>
      </div>


      {/* ── Fixed-overlay editor panel (slides in from the left) ── */}
      <EditorPanelWrapper
        isOpen={editorState.isEditorOpen}
        isAnimating={editorState.isEditorAnimating}
        editorScrollContainerRef={editorScrollContainerRef}
        onClose={editorState.handleCloseEditor}
        sections={[
          {
            title: "Images",
            content: (
              <div>
                <BannerSectionEditor
                  onCompanyDataChange={handleCompanyDataChange}
                  onWelcomeDataChange={(field, value) => {
                    if (field === "headline") updateField("headline", value);
                    if (field === "bodyText") updateField("bodyText", value);
                    if (field === "isAIGenerated") updateField("isAIGenerated", value);
                    const store = useNewClientWizardStore.getState();
                    const currentWelcome = store.stepData.welcomeStatement || { headline: "", bodyText: "", isAIGenerated: false };
                    store.saveStepDataLocally("welcomeStatement", { ...currentWelcome, [field]: value });
                  }}
                  onModalStateChange={modalStates.handleHeroModalStateChange}
                  onLogoModalStateChange={modalStates.handleLogoModalStateChange}
                  onOpenHeroTextEditor={handleOpenHeroTextEditor}
                  logoCardRef={logoCardRef} isLogoCardHighlighted={isLogoCardHighlighted} onLogoCardHighlightChange={setIsLogoCardHighlighted}
                  overlaySettingsCardRef={overlaySettingsCardRef} isOverlaySettingsHighlighted={isOverlaySettingsHighlighted} onOverlaySettingsHighlightChange={setIsOverlaySettingsHighlighted}
                  bannerTitleCardRef={bannerTitleCardRef} isBannerTitleHighlighted={isBannerTitleHighlighted} onBannerTitleHighlightChange={setIsBannerTitleHighlighted}
                  heroBackgroundCardRef={heroBackgroundCardRef}
                  useDefaultBody={useDefaultWelcomeMessage}
                  onToggleDefaultBody={(checked) => {
                    setUseDefaultWelcomeMessage(checked);
                    if (checked) { handleCompanyDataChange("heroDescription", defaultWelcomeBodyText); updateField("bodyText", defaultWelcomeBodyText); }
                    else { handleCompanyDataChange("heroDescription", ""); updateField("bodyText", ""); }
                  }}
                  defaultBodyText={defaultWelcomeBodyText} errorFields={errorFields}
                  onHeroSegmentModeChange={(mode) => {
                    if (mode === "desktop" && previewMode !== "desktop") {
                      setPreviewMode("desktop");
                    } else if (mode === "mobile" && previewMode !== "mobile") {
                      setPreviewMode("mobile");
                    }
                  }}
                  onFieldFocus={() => focusPreviewField("banner")}
                />
                <ThumbnailSectionEditor
                  currentImage={stepData.companyBasics?.brandImages?.thumbnail || undefined}
                  isHighlighted={thumbnailImage.isThumbnailHighlighted}
                  onImageChange={thumbnailImage.handleThumbnailImageChange} onImageRemove={thumbnailImage.handleThumbnailImageRemove}
                  onDefaultPhotoClick={() => thumbnailImage.setGalleryOpen(true)}
                  onEditClick={thumbnailImage.handleThumbnailEditClick} onFileSelect={thumbnailImage.handleThumbnailFileSelect}
                  onFieldFocus={() => focusPreviewField("banner")}
                />
              </div>
            ),
          },
          {
            title: "Hero Content",
            content: (
              <div ref={heroContentRef}>
                <Card className="dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm dark:text-gray-100">Welcome Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <WelcomeStatementCard
                    welcomeData={{
                      headline: stepData.companyBasics?.heroTitle || welcomeData.headline || "",
                      bodyText: stepData.companyBasics?.heroDescription || welcomeData.bodyText || "",
                      isAIGenerated: false,
                    }}
                    companyName={stepData.companyBasics?.companyName || "Company Name"}
                    errorFields={errorFields}
                    useDefaultBody={useDefaultWelcomeMessage}
                    onToggleDefaultBody={(checked) => {
                      setUseDefaultWelcomeMessage(checked);
                      if (checked) {
                        handleCompanyDataChange("heroDescription", defaultWelcomeBodyText);
                        updateField("bodyText", defaultWelcomeBodyText);
                      } else {
                        handleCompanyDataChange("heroDescription", "");
                        updateField("bodyText", "");
                      }
                    }}
                    defaultBodyText={defaultWelcomeBodyText}
                    onHeadlineChange={(value) => {
                      handleCompanyDataChange("heroTitle", value);
                      updateField("headline", value);
                    }}
                    onBodyChange={(value) => {
                      handleCompanyDataChange("heroDescription", value);
                      updateField("bodyText", value);
                    }}
                    bannerTitleCardRef={bannerTitleCardRef}
                    isBannerTitleHighlighted={isBannerTitleHighlighted}
                    onFieldFocus={() => focusPreviewField("banner")}
                  />
                </CardContent>
              </Card>
              </div>
            ),
          },
          {
            title: "Company Mission Statement",
            content: (
              <div>
                <MissionSectionEditor
                  missionHeadline={missionData.missionHeadline} missionBody={missionData.missionBody}
                  defaultHeadline={defaultHeadline} defaultBodyText={missionData.defaultMissionBody}
                  useDefaultHeadline={missionData.useDefaultHeadline} useDefaultBody={missionData.useDefaultBody}
                  headlineCharCount={missionData.headlineCharCount} bodyCharCount={missionData.bodyCharCount}
                  isHeadlineValid={missionData.isHeadlineValid} isBodyValid={missionData.isBodyValid}
                  errorFields={errorFields} headlineRef={headlineRef} bodyTextRef={bodyTextRef}
                  onHeadlineChange={missionData.handleHeadlineChange} onBodyChange={missionData.handleBodyChange}
                  onUseDefaultHeadlineChange={missionData.handleUseDefaultHeadline} onUseDefaultBodyChange={missionData.handleUseDefaultBody}
                  onGenerateMissionHeadline={missionData.handleGenerateMissionHeadline} onGenerateMissionBody={missionData.handleGenerateMissionBody}
                  thumbnailImgUrl={stepData.companyBasics?.brandImages?.thumbnail?.url}
                  onFieldFocus={() => focusPreviewField("mission")}
                />
                <div data-section-id="thumbnail" ref={missionFieldsRef} style={{ minHeight: "1px", height: "60px" }} />
              </div>
            ),
          },
        ]}
      />

      {/* ════════════════════════════════════════════════
          Scalable preview — flex column
          ════════════════════════════════════════════════ */}
      <div
        className="fixed z-40 flex flex-col"
        style={{
          top: `${HEADER_HEIGHT + barHeight}px`,
          left: "var(--sidebar-width, 18rem)",
          width: "calc(100% - var(--sidebar-width, 18rem))",
          height: `calc(100vh - ${totalFixedHeight}px)`,
        }}
      >
        {/* Portal header — sticky at top of the scroll container.
            Hidden in mobile mode where it's rendered inside the iframe. */}
        {previewMode !== "mobile" && (
          <div className="sticky top-0 z-10 shadow-md">
            <PortalHeader
              companyData={{ companyLogo: planCompanyLogo }}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              clientId={draftClientId}
              categoryPortalVisibility={null}
              benefits={null}
              enableNavigation={false}
            />
          </div>
        )}

        <div
          ref={scrollableRef}
          data-preview-scroll-container
          className={`flex-1 overflow-x-hidden bg-gray-300 dark:bg-gray-950 flex flex-col items-center ${
            previewMode === "mobile" ? "overflow-y-hidden justify-center" : "overflow-y-auto"
          }`}
        >
          {previewMode === "mobile" ? (
            /* ── Mobile phone frame — centered without scrolling ── */
            <div className="flex items-center justify-center w-full py-6 px-4 flex-shrink-0">
              <div
                className="relative rounded-[36px] border-[4px] border-gray-800 dark:border-gray-700 bg-gray-900 shadow-2xl flex-shrink-0 overflow-hidden"
                style={{ width: MOBILE_WIDTH + 20 }}
              >
                {/* Phone notch */}
                <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-[90px] h-[5px] bg-gray-900 dark:bg-gray-800 rounded-full z-50" />
                {/* Side buttons (decorative) */}
                <div className="absolute top-24 -left-[3px] w-[3px] h-8 bg-gray-700 dark:bg-gray-600 rounded-l" />
                <div className="absolute top-36 -left-[3px] w-[3px] h-12 bg-gray-700 dark:bg-gray-600 rounded-l" />
                <div className="absolute top-20 -right-[3px] w-[3px] h-10 bg-gray-700 dark:bg-gray-600 rounded-r" />
                <div className="flex items-center justify-center py-2">
                  <MobilePreviewFrame width={MOBILE_WIDTH}>
                    <div className="sticky top-0 w-full z-50 shrink-0">
                      <PortalHeader
                        companyData={{ companyLogo: planCompanyLogo }}
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        clientId={draftClientId}
                        categoryPortalVisibility={null}
                        benefits={null}
                        enableNavigation={false}
                      />
                    </div>
                    <div>
                      <ClientPortal
                        data={portalData}
                        className="!min-h-0"
                        hideHeader={true}
                        hideFooter={true}
                        hideBenefits={true}
                        clientId={draftClientId}
                        onHeroTitleClick={() => handleOpenHeroTextEditor("title")}
                        onHeroDescriptionClick={() => handleOpenHeroTextEditor("description")}
                        onMissionHeadlineClick={() => {
                          editorState.setFocusedTextField("headline");
                          editorState.setIsEditorOpen(true);
                          setTimeout(() => editorState.setIsEditorAnimating(true), 10);
                        }}
                        onMissionBodyClick={() => {
                          editorState.setFocusedTextField("body");
                          editorState.setIsEditorOpen(true);
                          setTimeout(() => editorState.setIsEditorAnimating(true), 10);
                        }}
                      />
                    </div>
                  </MobilePreviewFrame>
                </div>
              </div>
            </div>
          ) : (
            /* ── Desktop: scaled preview using ClientPortal to
             *    match the benefits hub landing page UI. ── */
            <div style={{ height: scaledHeight != null ? `${scaledHeight}px` : "100%" }}>
              <div
                ref={previewContentRef}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "center top",
                  width: `${DESKTOP_WIDTH}px`,
                  overflowX: "hidden",
                }}
              >
                <ClientPortal
                  data={portalData}
                  hideHeader={true}
                  hideFooter={true}
                  hideBenefits={true}
                  clientId={draftClientId}
                  onHeroTitleClick={() => handleOpenHeroTextEditor("title")}
                  onHeroDescriptionClick={() => handleOpenHeroTextEditor("description")}
                  onMissionHeadlineClick={() => {
                    editorState.setFocusedTextField("headline");
                    editorState.setIsEditorOpen(true);
                    setTimeout(() => editorState.setIsEditorAnimating(true), 10);
                  }}
                  onMissionBodyClick={() => {
                    editorState.setFocusedTextField("body");
                    editorState.setIsEditorOpen(true);
                    setTimeout(() => editorState.setIsEditorAnimating(true), 10);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ModalGallery
        open={thumbnailImage.galleryOpen}
        onOpenChange={thumbnailImage.setGalleryOpen}
        onSelect={async (url) => {
          let fileName = "default-image.png";
          let fileExtension = "png";
          if (url.startsWith("data:image/")) {
            const match = url.match(/data:image\/(\w+);/);
            if (match && match[1]) { fileExtension = match[1]; fileName = `default-image.${fileExtension}`; }
          } else {
            const urlMatch = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i);
            if (urlMatch && urlMatch[1]) { fileExtension = urlMatch[1].toLowerCase(); fileName = `default-image.${fileExtension}`; }
          }
          try {
            const { croppedUrl, width, height } = await autoCropThumbnailImage(url);
            const warnings: string[] = [];
            const recWidth = 900; const recHeight = 900;
            if (width < recWidth || height < recHeight) warnings.push("Below recommended size (900×900 px). May appear blurry.");
            const brandImageData: BrandImageData = { url: croppedUrl, fileName, fileSize: 0, width, height, recommendedSize: "900×900 px", status: (warnings.length > 0 ? "warning" : "ok") as "ok" | "warning" | "error", warnings };
            thumbnailImage.handleThumbnailImageChange(brandImageData);
            thumbnailImage.setGalleryOpen(false);
          } catch (error) {
            console.error("Failed to auto-crop image:", error);
            const img = new Image();
            img.onload = () => {
              const warnings: string[] = [];
              const recWidth = 900; const recHeight = 900;
              if (img.width < recWidth || img.height < recHeight) warnings.push("Below recommended size (900×900 px). May appear blurry.");
              const brandImageData: BrandImageData = { url, fileName, fileSize: 0, width: img.width, height: img.height, recommendedSize: "900×900 px", status: (warnings.length > 0 ? "warning" : "ok") as "ok" | "warning" | "error", warnings };
              thumbnailImage.handleThumbnailImageChange(brandImageData);
              thumbnailImage.setGalleryOpen(false);
            };
            img.onerror = () => {
              const brandImageData: BrandImageData = { url, fileName, fileSize: 0, width: 0, height: 0, recommendedSize: "900×900 px", status: "ok", warnings: [] };
              thumbnailImage.handleThumbnailImageChange(brandImageData);
              thumbnailImage.setGalleryOpen(false);
            };
            img.src = url;
          }
        }}
      />

      {thumbnailImage.pendingThumbnailData && (
        <SimpleImageEditorModal
          modalTitle="Thumbnail image"
          modalDescription="This image is used in square thumbnail placements across your Employee Hub. Upload a centered image with space around the edges."
          value={thumbnailImage.pendingThumbnailData.url || ""}
          originalValue={thumbnailImage.pendingThumbnailData.originalUrl}
          fileName={thumbnailImage.pendingThumbnailData.fileName || ""}
          existingCropData={thumbnailImage.pendingThumbnailData.cropData}
          onChange={handleThumbnailModalSave}
          onRemove={() => { thumbnailImage.setIsThumbnailModalOpen(false); thumbnailImage.setPendingThumbnailData(null); }}
          isOpen={thumbnailImage.isThumbnailModalOpen}
          onClose={() => { thumbnailImage.setIsThumbnailModalOpen(false); thumbnailImage.setPendingThumbnailData(null); }}
          saveButtonText="Save Thumbnail"
          canvasWidth={600} canvasHeight={600}
          guidelineWidth={400} guidelineHeight={450} guidelinePadding={20}
        />
      )}

      {modalStates.isHeroModalOpen && modalStates.pendingHeroImageData && modalStates.heroModalHandlers && (
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
          canvasWidth={640} canvasHeight={600}
          guidelineWidth={580} guidelineHeight={240} guidelinePadding={20}
        />
      )}
    </div>
  );
}
