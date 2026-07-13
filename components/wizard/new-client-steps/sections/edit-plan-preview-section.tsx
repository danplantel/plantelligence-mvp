"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Smartphone, Monitor, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { ClientPortal } from "@/components/pages/client-portal/client-portal";
import { MissionStatementFields } from "@/components/wizard/new-client-steps/sections/mission-statement-fields";
import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { CompanyLogoCard } from "@/components/wizard/new-client-steps/sections/components/company-logo-card";
import { HeroBackgroundCard } from "@/components/wizard/new-client-steps/sections/components/hero-background-card";
import { WelcomeStatementCard } from "@/components/wizard/new-client-steps/sections/components/welcome-statement-card";
import { BannerOverlaySettingsCard } from "@/components/wizard/new-client-steps/sections/components/banner-overlay-settings-card";
import { useHeroOverlaySettings } from "@/components/wizard/new-client-steps/sections/hooks/use-hero-overlay-settings";
import type {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImageData,
  WelcomeStatementData,
} from "@/types/new-client-wizard";

// ── Constants matching Step 2 ──
const DESKTOP_WIDTH = 1400;
const HEADER_HEIGHT = 72;
const BOTTOM_NAV_HEIGHT = 72;
const MOBILE_ASPECT_RATIO = 21 / 9;
const MOBILE_WIDTH = 390;

type PreviewMode = "desktop" | "mobile";

// ── Mobile preview iframe (same as Step 2) ──
function MobilePreviewFrame({ children, width }: { children: React.ReactNode; width: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(
      '<!DOCTYPE html><html style="overflow-x:hidden"><head>' +
      '<meta name="viewport" content="width=' + width + ', initial-scale=1">' +
      '</head><body style="overflow-x:hidden; width:100%; margin:0"></body></html>',
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
          <div style={{ width: `${width}px`, minHeight: "100%", overflowX: "hidden", overflowY: "auto" }}>
            {children}
          </div>,
          mountNode,
        )}
    </iframe>
  );
}

// ── Build portal data from company data ──
function buildPortalData(companyData: CompanyBasicsData) {
  return {
    companyData: {
      companyName: companyData.companyName || "",
      companyWebsite: companyData.companyWebsite || "",
      companyLogo: companyData.companyLogo?.url || "",
      logoFileName: companyData.companyLogo?.fileName || "",
      brandColor: companyData.primaryColor,
      secondaryColor: companyData.secondaryColor,
      missionHeadline: (companyData as any).missionHeadline || "",
      missionBody: (companyData as any).missionBody || "",
      appointmentLink: (companyData as any).appointmentLink || "",
      backgroundImg: companyData.brandImages?.header?.url || "",
      backgroundImgName: companyData.brandImages?.header?.fileName || "",
      thumbnailImg: companyData.brandImages?.thumbnail?.url || "",
      thumbnailImgName: companyData.brandImages?.thumbnail?.fileName || "",
      disclaimers: "",
      heroTitle: (companyData as any).heroTitle,
      heroDescription: (companyData as any).heroDescription || "",
      heroOverlayOpacity: (companyData as any).heroOverlayOpacity,
      heroBackgroundOpacity: (companyData as any).heroBackgroundOpacity,
      heroContainerOpacity: (companyData as any).heroContainerOpacity,
      heroContainerBackgroundOpacity: (companyData as any).heroContainerBackgroundOpacity,
      heroContainerBlockOpacity: (companyData as any).heroContainerBlockOpacity,
      heroCompanyNameColor: (companyData as any).heroCompanyNameColor,
      heroContainerInverted: (companyData as any).heroContainerInverted,
      heroBackgroundInverted: (companyData as any).heroBackgroundInverted,
      heroUseGradient: (companyData as any).heroUseGradient,
      brandImages: companyData.brandImages,
    },
    keyContacts: [],
    documents: [],
    employeePortalPreview: null,
    categoryPortalVisibility: null,
  } as const;
}

// ── Props ──
interface EditPlanPreviewSectionProps {
  companyData: CompanyBasicsData;
  onCompanyDataChange: (field: any, value: any) => void;
  onWelcomeChange: (field: "headline" | "bodyText", value: string) => void;
  welcomeData?: WelcomeStatementData;
  onHeadshotChange: (newHeadshot: string) => void;
  onBackgroundChange: (newBackground: string) => void;
  onLogoChange: (logoData: CompanyLogoData | null) => void;
  defaultWelcomeMessage: string;
  useDefaultWelcomeMessage: boolean;
  setUseDefaultWelcomeMessage: (checked: boolean) => void;
  clientId?: string;
  // Mission statement props
  missionHeadline: string;
  missionBody: string;
  defaultHeadline: string;
  defaultBodyText: string;
  useDefaultHeadline: boolean;
  useDefaultBody: boolean;
  headlineRef: React.RefObject<HTMLInputElement | null>;
  bodyTextRef: React.RefObject<HTMLTextAreaElement | null>;
  handleHeadlineChange: (value: string) => void;
  handleBodyChange: (value: string) => void;
  handleUseDefaultHeadline: (checked: boolean) => void;
  handleUseDefaultBody: (checked: boolean) => void;
  handleGenerateMissionHeadline: () => void;
  handleGenerateMissionBody: () => void;
  headlineCharCount: number;
  bodyCharCount: number;
  isHeadlineValid: boolean;
  isBodyValid: boolean;
  errorFields: string[];
}

export function EditPlanPreviewSection({
  companyData,
  onCompanyDataChange,
  onWelcomeChange,
  welcomeData,
  onHeadshotChange,
  onBackgroundChange,
  onLogoChange,
  defaultWelcomeMessage,
  useDefaultWelcomeMessage,
  setUseDefaultWelcomeMessage,
  clientId,
  missionHeadline,
  missionBody,
  defaultHeadline,
  defaultBodyText,
  useDefaultHeadline,
  useDefaultBody,
  headlineRef,
  bodyTextRef,
  handleHeadlineChange,
  handleBodyChange,
  handleUseDefaultHeadline,
  handleUseDefaultBody,
  handleGenerateMissionHeadline,
  handleGenerateMissionBody,
  headlineCharCount,
  bodyCharCount,
  isHeadlineValid,
  isBodyValid,
  errorFields,
}: EditPlanPreviewSectionProps) {
  // ── Editor panel state ──
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorAnimating, setIsEditorAnimating] = useState(false);
  const editorIsOpen = isEditorOpen || isEditorAnimating;

  // ── Preview mode ──
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const togglePreviewMode = () =>
    setPreviewMode((prev) => (prev === "desktop" ? "mobile" : "desktop"));

  // ── Refs ──
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(52);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const logoCardRef = useRef<HTMLDivElement>(null);
  const overlaySettingsCardRef = useRef<HTMLDivElement>(null);
  const bannerTitleCardRef = useRef<HTMLDivElement>(null);

  // ── Scale state and calculations (desktop only) ──
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

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
  }, [updateScale, isEditorOpen, previewMode]);

  useEffect(() => {
    const content = previewContentRef.current;
    if (!content || previewMode === "mobile") return;
    const observer = new ResizeObserver(() => updateScale());
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

  // ── Measure bar height ──
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

  // ── Editor panel handlers ──
  const handleCloseEditor = useCallback(() => {
    setIsEditorAnimating(false);
    setIsEditorOpen(false);
  }, []);

  const handleOpenEditor = useCallback(() => {
    setIsEditorOpen(true);
    setTimeout(() => setIsEditorAnimating(true), 10);
  }, []);

  const handleToggleEditor = useCallback(() => {
    if (editorIsOpen) {
      handleCloseEditor();
    } else {
      handleOpenEditor();
    }
  }, [editorIsOpen, handleCloseEditor, handleOpenEditor]);

  // ── Overlay settings ──
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
    undefined,
    undefined,
  );

  // ── Portal data for ClientPortal preview ──
  const portalData = useMemo(() => buildPortalData(companyData), [companyData]);

  // ── Image change handlers for editor cards ──
  const handleHeroImageChange = useCallback(
    (imageData: BrandImageData) => {
      const currentBrandImages = companyData.brandImages || {};
      if (onCompanyDataChange) {
        onCompanyDataChange("brandImages", {
          ...currentBrandImages,
          header: imageData,
        });
      }
    },
    [companyData.brandImages, onCompanyDataChange],
  );

  const handleHeroImageRemove = useCallback(() => {
    const currentBrandImages = companyData.brandImages || {};
    if (onCompanyDataChange) {
      onCompanyDataChange("brandImages", {
        ...currentBrandImages,
        header: null,
      });
    }
  }, [companyData.brandImages, onCompanyDataChange]);

  const handleLogoImageChange = useCallback(
    (imageData: BrandImageData) => {
      const logoData: CompanyLogoData = {
        url: imageData.url,
        fileName: imageData.fileName || "",
        fileSize: imageData.fileSize || 0,
        width: imageData.width || 0,
        height: imageData.height || 0,
        hasTransparency:
          imageData.url.includes("data:image/png") ||
          imageData.url.includes("data:image/svg"),
        warnings: imageData.warnings || [],
        cropData: imageData.cropData as any,
      };
      onLogoChange(logoData);
    },
    [onLogoChange],
  );

  const handleLogoImageRemove = useCallback(() => {
    onLogoChange(null);
  }, [onLogoChange]);

  const handleWelcomeHeadlineChange = useCallback(
    (value: string) => {
      onCompanyDataChange("heroTitle", value);
    },
    [onCompanyDataChange],
  );

  const handleWelcomeBodyChange = useCallback(
    (value: string) => {
      onCompanyDataChange("heroDescription", value);
    },
    [onCompanyDataChange],
  );

  const handleToggleDefaultBody = useCallback(
    (checked: boolean) => {
      setUseDefaultWelcomeMessage(checked);
      if (checked) {
        onCompanyDataChange("heroDescription", defaultWelcomeMessage);
      }
    },
    [setUseDefaultWelcomeMessage, onCompanyDataChange, defaultWelcomeMessage],
  );

  const heroImageData =
    companyData?.brandImages?.header || companyData?.brandImages?.thumbnail || null;

  const welcomeCardData: WelcomeStatementData = {
    headline:
      (companyData as any)?.heroTitle ||
      `Welcome to the ${companyData?.companyName || "Company Name"} Benefits Hub!`,
    bodyText: (companyData as any)?.heroDescription || "",
    isAIGenerated: false,
  };

  // ── Editor panel sections ──
  const editorSections = [
    {
      title: "Images",
      content: (
        <div className="space-y-4">
          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">Company Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyLogoCard
                ref={logoCardRef}
                companyLogo={companyData?.companyLogo}
                onLogoImageChange={handleLogoImageChange}
                onLogoImageRemove={handleLogoImageRemove}
                isHighlighted={false}
              />
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">Hero Background</CardTitle>
            </CardHeader>
            <CardContent>
              <HeroBackgroundCard
                heroImageData={heroImageData}
                onImageChange={handleHeroImageChange}
                onImageRemove={handleHeroImageRemove}
                onEditClick={() => {}}
                onFileSelect={(data) => handleHeroImageChange(data)}
                onDefaultPhotoClick={() => {}}
              />
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      title: "Hero Content",
      content: (
        <div className="space-y-4">
          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">Welcome Message</CardTitle>
            </CardHeader>
            <CardContent>
              <WelcomeStatementCard
                welcomeData={welcomeCardData}
                companyName={companyData?.companyName || "Company Name"}
                errorFields={errorFields}
                useDefaultBody={useDefaultWelcomeMessage}
                onToggleDefaultBody={handleToggleDefaultBody}
                defaultBodyText={defaultWelcomeMessage}
                onHeadlineChange={handleWelcomeHeadlineChange}
                onBodyChange={handleWelcomeBodyChange}
              />
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm dark:text-gray-100">Overlay Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <BannerOverlaySettingsCard
                ref={overlaySettingsCardRef}
                backgroundOpacity={heroBackgroundOpacity}
                containerBlockOpacity={heroContainerBlockOpacity}
                containerInverted={heroContainerInverted}
                backgroundInverted={heroBackgroundInverted}
                useGradient={heroUseGradient}
                onSettingsChange={handleSettingsChange}
                isHighlighted={false}
              />
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      title: "Mission Statement",
      content: (
        <Card className="dark:bg-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm dark:text-gray-100">Mission Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <MissionStatementFields
              missionHeadline={missionHeadline}
              missionBody={missionBody}
              defaultHeadline={defaultHeadline}
              defaultBodyText={defaultBodyText}
              useDefaultHeadline={useDefaultHeadline}
              useDefaultBody={useDefaultBody}
              headlineCharCount={headlineCharCount}
              bodyCharCount={bodyCharCount}
              isHeadlineValid={isHeadlineValid}
              isBodyValid={isBodyValid}
              errorFields={errorFields}
              headlineRef={headlineRef as any}
              bodyTextRef={bodyTextRef as any}
              onHeadlineChange={handleHeadlineChange}
              onBodyChange={handleBodyChange}
              onUseDefaultHeadlineChange={handleUseDefaultHeadline}
              onUseDefaultBodyChange={handleUseDefaultBody}
              onGenerateMissionHeadline={handleGenerateMissionHeadline}
              onGenerateMissionBody={handleGenerateMissionBody}
              showUseDefault={false}
            />
          </CardContent>
        </Card>
      ),
    },
  ];

  const totalFixedHeight = HEADER_HEIGHT + barHeight + BOTTOM_NAV_HEIGHT;

  return (
    <div className="w-full relative min-h-[600px]">
      {/* Spacer for fixed toolbar */}
      <div style={{ height: HEADER_HEIGHT + barHeight }} />

      {/* ── Fixed toolbar ── */}
      <div className="fixed top-0 left-0 right-0 z-[45]">
        <div style={{ height: `${HEADER_HEIGHT}px` }} />
        <div
          ref={barRef}
          className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          {/* Left: Edit Panel toggle */}
          <button
            type="button"
            onClick={handleToggleEditor}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {editorIsOpen ? (
              <>
                <X className="w-4 h-4" />
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

          {/* Right: preview mode toggle */}
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

      {/* ── Editor Panel (slides in from left) ── */}
      <EditorPanelWrapper
        isOpen={isEditorOpen}
        isAnimating={isEditorAnimating}
        onClose={handleCloseEditor}
        sections={editorSections}
        variant="inline"
      />

      {/* ── Preview area ── */}
      <div
        className="flex flex-col"
        style={{
          height: `calc(100vh - ${totalFixedHeight}px - 4rem)`, // account for page padding
          minHeight: "400px",
        }}
      >
        {/* PortalHeader (sticky at top, hidden in mobile) */}
        {previewMode !== "mobile" && (
          <div className="sticky top-0 z-10 shadow-md flex-shrink-0">
            <PortalHeader
              companyData={{ companyLogo: companyData?.companyLogo?.url ?? undefined }}
              brandColor={companyData?.primaryColor || "#1F3A60"}
              secondaryColor={companyData?.secondaryColor || "#6B7280"}
              clientId={clientId}
              categoryPortalVisibility={null}
              benefits={null}
            />
          </div>
        )}

        {/* Scrollable preview content */}
        <div
          ref={scrollableRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-300 dark:bg-gray-950 flex flex-col items-center"
        >
          {previewMode === "mobile" ? (
            <MobilePreviewFrame width={MOBILE_WIDTH}>
              <div className="fixed top-0 left-0 w-full z-50">
                <PortalHeader
                  companyData={{ companyLogo: companyData?.companyLogo?.url ?? undefined }}
                  brandColor={companyData?.primaryColor || "#1F3A60"}
                  secondaryColor={companyData?.secondaryColor || "#6B7280"}
                  clientId={clientId}
                  categoryPortalVisibility={null}
                  benefits={null}
                />
              </div>
              <div className="pt-20">
                <ClientPortal
                  data={portalData as any}
                  hideHeader={true}
                  hideFooter={false}
                  clientId={clientId}
                />
              </div>
            </MobilePreviewFrame>
          ) : (
            /* ── Desktop: scaled preview ── */
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
                  data={portalData as any}
                  hideHeader={true}
                  hideFooter={false}
                  clientId={clientId}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
