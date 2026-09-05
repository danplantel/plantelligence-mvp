"use client";

import React, { useRef, useEffect, useState } from "react";
import { useBenefitsWizardStore, HelpCardData } from "@/lib/benefits-wizard-store";
import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImageIcon, Layout, Mail, HelpCircle, CheckCircle2, Circle, Pencil, Search, ChevronsUpDown, Trash2, GripVertical, Settings, Video, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SupportContact, FAQItem, BenefitsStep1Data, BenefitsStep3Data } from "@/lib/benefits-wizard-store";
import { KeyContact, BrandImageData, CompanyLogoData, MobileHeroPosition } from "@/types/new-client-wizard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from "uuid";
import { BannerOverlaySettingsCard } from "@/components/wizard/new-client-steps/sections/components/banner-overlay-settings-card";
import { HeroBackgroundCard, type HeroSegmentMode } from "@/components/wizard/new-client-steps/sections/components/hero-background-card";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import { toNextImageSrc } from "@/lib/branding-image-url";
import { toast } from "sonner";

export const DEFAULT_HELP_CARDS: HelpCardData[] = [
    {
        id: "access-account",
        title: "Access My Retirement Account",
        paragraphs: [
            "View your balances, plan documents, and investment details all in one place.",
            "Take charge of your retirement plan and stay on top of your progress anytime.",
        ],
        cta: "",
    },
    {
        id: "financial-planning",
        title: "Financial Planning",
        paragraphs: [
            "Exclusive Benefits for [Company Name] Plan Participants",
            "Elevate your financial journey with personalized planning through [Advisor Name]—a comprehensive service seamlessly integrated with your retirement benefits.",
        ],
        cta: "",
    },
    {
        id: "rollovers",
        title: "Rollovers & Distributions",
        introBold: "Transitioning to a new employer?",
        paragraphs: [
            "Understand your options for managing the savings you've built. The decision you make now can have a lasting impact on your retirement lifestyle.",
        ],
        cta: "",
    },
];

/** Help card "paragraph" length limits — a single paragraph (not multiple) with
 *  min/max character bounds keeps the "How Can We Help You Today?" cards a
 *  consistent height on the portal. */
const HELP_CARD_PARAGRAPH_MIN = 40;
const HELP_CARD_PARAGRAPH_MAX = 220;

interface BenefitsEditorPanelProps {
    isOpen: boolean;
    isAnimating: boolean;
    onClose: () => void;
    activeSection?: string | null;
    editorScrollContainerRef?: React.RefObject<HTMLDivElement>;
    /** Called when the user switches between Edit / Desktop / Mobile in Hero Background */
    onHeroSegmentModeChange?: (mode: HeroSegmentMode) => void;
    /** Layout variant passed through to EditorPanelWrapper */
    variant?: 'fixed' | 'inline';
}

export function BenefitsEditorPanel({
    isOpen,
    isAnimating,
    onClose,
    activeSection,
    highlightedField,
    editorScrollContainerRef: externalScrollRef,
    variant,
    onHeroSegmentModeChange,
}: BenefitsEditorPanelProps & { highlightedField?: string | null }) {
    const { stepData, saveStepData } = useBenefitsWizardStore();
    const step1Data = (stepData.step1 || {}) as BenefitsStep1Data;
    const step3Data = (stepData.step3 || { faqs: [], supportContacts: [] }) as BenefitsStep3Data;

    // Resolve R2 keys (org/...) to the same-origin proxy so a header background that was
    // pre-populated from the User profile in Step 1 displays correctly in the editor.
    const resolvedHeaderUrl = step1Data.brandImages?.header?.url
        ? toNextImageSrc(
              step1Data.brandImages.header.url,
              step1Data.brandImages.header.url,
          )
        : null;

    // ── Hero Background segment mode & position state ──
    const [heroSegmentMode, setHeroSegmentMode] = useState<HeroSegmentMode>("edit");
    const desktopHeroPosition: MobileHeroPosition =
        (step1Data as any)?.desktopHeroBackgroundPosition ?? { x: 50, y: 50 };
    const mobileHeroPosition: MobileHeroPosition =
        (step1Data as any)?.mobileHeroBackgroundPosition ?? { x: 50, y: 50 };
    const internalScrollRef = useRef<HTMLDivElement>(null);
    const editorScrollContainerRef = externalScrollRef || internalScrollRef;
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

    // Refs for scrolling
    const sectionsRef = {
        branding: useRef<HTMLDivElement>(null),
        messaging: useRef<HTMLDivElement>(null),
        planVideo: useRef<HTMLDivElement>(null),
        helpCards: useRef<HTMLDivElement>(null),
        insurance: useRef<HTMLDivElement>(null),
    };

    const [videoUploading, setVideoUploading] = useState(false);
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);

    const [highlightedSection, setHighlightedSection] = React.useState<string | null>(null);

    // When an editor input is focused, ask the preview to scroll to the
    // corresponding element. Maps editor field keys → preview data-preview-field.
    const focusPreviewField = (field: string) => {
        window.dispatchEvent(new CustomEvent("benefitsPreviewScrollTo", { detail: { field } }));
    };

    // Sync highlightedField (cardId) with accordion open state.
    // Only the clicked card's accordion opens; all others close.
    useEffect(() => {
        if (highlightedField && sectionsRef.helpCards) {
            setOpenAccordionItems([highlightedField]);
        }
    }, [highlightedField]);

    // Resolve help cards from store or defaults
    const helpCards = step1Data.helpCards && step1Data.helpCards.length > 0
        ? step1Data.helpCards
        : DEFAULT_HELP_CARDS;

    // Scroll to section when activeSection changes
    useEffect(() => {
        if (activeSection && isOpen) {
            setHighlightedSection(activeSection);

            const element = sectionsRef[activeSection as keyof typeof sectionsRef]?.current;
            if (element && editorScrollContainerRef.current) {
                const container = editorScrollContainerRef.current;
                setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const targetScroll = rect.top - containerRect.top + container.scrollTop - 20;
                    container.scrollTo({ top: targetScroll, behavior: "smooth" });
                }, 350);
            }

            const timer = setTimeout(() => setHighlightedSection(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [activeSection, isOpen]);

    // --- Logic from Step 1 ---
    const handleLogoChange = (imageData: BrandImageData) => {
        saveStepData(1, {
            ...step1Data,
            companyLogo: {
                url: imageData.url,
                fileName: imageData.fileName,
                fileSize: imageData.fileSize,
                width: imageData.width,
                height: imageData.height,
                hasTransparency: false,
                warnings: [],
            } as CompanyLogoData
        });
    };

    const handleInnerHeaderImageChange = (imageData: BrandImageData) => {
        saveStepData(1, {
            ...step1Data,
            innerHeaderImage: {
                url: imageData.url,
                fileName: imageData.fileName,
                fileSize: imageData.fileSize,
                width: imageData.width,
                height: imageData.height,
                hasTransparency: false,
                warnings: [],
            } as CompanyLogoData
        });
    };

    const handleBackgroundImageChange = (imageData: BrandImageData) => {
        saveStepData(1, {
            ...step1Data,
            brandImages: {
                ...step1Data.brandImages,
                header: imageData
            }
        });
    };

    // Plan Video upload handler
    const handlePlanVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("video/")) {
            toast.error("Please select a valid video file.");
            return;
        }

        setVideoUploading(true);
        setVideoUploadProgress(0);

        try {
            const clientId = step1Data?.planId || undefined;
            const key = await uploadFileToR2({
                file,
                purpose: "upload",
                clientId,
                fileName: file.name,
                subPath: "plan-videos",
                onProgress: (loaded, total) => {
                    setVideoUploadProgress(Math.round((loaded / total) * 100));
                },
            });

            if (key) {
                // Store the raw R2 key — the GET handler will generate a presigned URL for portal viewers
                saveStepData(1, {
                    ...step1Data,
                    planVideo: key,
                    planVideoFileName: file.name,
                    planVideoRemoved: false,
                });
            } else {
                toast.error("Failed to upload video. Please try again.");
            }
        } catch (err) {
            console.error("Video upload error:", err);
            toast.error("An error occurred while uploading the video.");
        } finally {
            setVideoUploading(false);
            setVideoUploadProgress(0);
            e.target.value = "";
        }
    };

    const handleRemovePlanVideo = () => {
        saveStepData(1, {
            ...step1Data,
            planVideo: undefined,
            planVideoFileName: undefined,
            planVideoRemoved: true,
        });
    };

    // Hero overlay settings handler
    const handleOverlaySettingsChange = (settings: {
        backgroundOpacity?: number;
        containerBlockOpacity?: number;
        containerInverted?: boolean;
        backgroundInverted?: boolean;
        useGradient?: boolean;
    }) => {
        const updated: any = { ...step1Data };
        if (settings.backgroundOpacity !== undefined) {
            updated.heroBackgroundOpacity = settings.backgroundOpacity;
        }
        if (settings.containerBlockOpacity !== undefined) {
            updated.heroContainerBlockOpacity = settings.containerBlockOpacity;
        }
        if (settings.containerInverted !== undefined) {
            updated.heroContainerInverted = settings.containerInverted;
        }
        if (settings.backgroundInverted !== undefined) {
            updated.heroBackgroundInverted = settings.backgroundInverted;
        }
        if (settings.useGradient !== undefined) {
            updated.heroUseGradient = settings.useGradient;
        }
        saveStepData(1, updated);
    };

    // --- Help Cards Logic ---
    const updateHelpCard = (id: string, updates: Partial<HelpCardData>) => {
        const updated = helpCards.map((c) => c.id === id ? { ...c, ...updates } : c);
        saveStepData(1, { ...step1Data, helpCards: updated });
    };

    // A help card has exactly one paragraph — stored as a single-element array so
    // HelpCardData (paragraphs: string[]) stays unchanged while the UI (and card
    // heights on the portal) remain consistent.
    const updateCardParagraph = (cardId: string, value: string) => {
        const updated = helpCards.map((c) =>
            c.id === cardId ? { ...c, paragraphs: [value] } : c
        );
        saveStepData(1, { ...step1Data, helpCards: updated });
    };

    const SectionHeader = ({ number, title }: { number: number, title: string }) => (
        <div className="mb-6">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                Section {number}: {title}
            </h3>
            <div className="h-px w-12 bg-border mt-2" />
        </div>
    );

    return (
        <EditorPanelWrapper
            isOpen={isOpen}
            isAnimating={isAnimating}
            onClose={onClose}
            editorScrollContainerRef={editorScrollContainerRef}
            variant={variant}
            headerBadge={
                step1Data?.benefitCategory ? (
                    <span className="inline-flex items-center rounded-md bg-accent-blue/10 px-2 py-0.5 text-xs font-semibold text-accent-blue">
                        {step1Data.benefitCategory}
                    </span>
                ) : undefined
            }
        >
            <div className="flex flex-col gap-12 p-6 pb-20">
                {/* Branding Section */}
                <div
                    ref={sectionsRef.branding}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "branding" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={1} title="Branding" />
                    <div className="space-y-8">
                        <div className="space-y-4" onMouseDown={() => focusPreviewField("companyLogo")}>
                            <Label className="text-xs font-bold text-foreground">Provider Logo</Label>
                            <BrandImageUpload
                                slotKey="companyLogo"
                                slot={{
                                    title: "",
                                    description: "This logo identifies the benefit provider (e.g. Waypoint, Integrity).",
                                    recommendedSize: "900×900 px",
                                    accept: ".svg,.png,.jpg,.jpeg",
                                    required: true,
                                    previewAspectRatio: 1,
                                    previewLabel: "Logo Preview",
                                }}
                                currentImage={step1Data.companyLogo ? {
                                    url: step1Data.companyLogo.url,
                                    fileName: step1Data.companyLogo.fileName,
                                    fileSize: step1Data.companyLogo.fileSize || 0,
                                    width: step1Data.companyLogo.width || 0,
                                    height: step1Data.companyLogo.height || 0,
                                    recommendedSize: "900x900",
                                    status: "ok",
                                    warnings: [],
                                } as BrandImageData : undefined}
                                onImageChange={handleLogoChange}
                                onImageRemove={() => saveStepData(1, { ...step1Data, companyLogo: null })}
                                hideButtons={true}
                                useUniversalModal={true}
                                universalModalType="normalizer"
                            />
                        </div>
                        <div className="space-y-4" onMouseDownCapture={() => focusPreviewField("brandImagesHeader")}>
                            <Label className="text-xs font-bold text-foreground">Header Background</Label>
                            <HeroBackgroundCard
                                heroImageData={
                                    step1Data.brandImages?.header
                                        ? {
                                              ...step1Data.brandImages.header,
                                              previewUrl:
                                                  resolvedHeaderUrl ?? undefined,
                                              url:
                                                  resolvedHeaderUrl ??
                                                  step1Data.brandImages.header.url,
                                          }
                                        : null
                                }
                                onImageChange={handleBackgroundImageChange}
                                onImageRemove={() => saveStepData(1, {
                                    ...step1Data,
                                    brandImages: { ...step1Data.brandImages, header: null }
                                })}
                                onEditClick={() => {}}
                                onFileSelect={handleBackgroundImageChange}
                                onDefaultPhotoClick={() => {}}
                                segmentMode={heroSegmentMode}
                                onSegmentModeChange={(mode) => {
                                    setHeroSegmentMode(mode);
                                    if (onHeroSegmentModeChange) {
                                        onHeroSegmentModeChange(mode);
                                    }
                                }}
                                desktopPosition={desktopHeroPosition}
                                onDesktopPositionChange={(pos) => {
                                    saveStepData(1, { ...step1Data, desktopHeroBackgroundPosition: pos } as any);
                                }}
                                mobilePosition={mobileHeroPosition}
                                onMobilePositionChange={(pos) => {
                                    saveStepData(1, { ...step1Data, mobileHeroBackgroundPosition: pos } as any);
                                }}
                            />
                        </div>
                        <div className="space-y-4" onMouseDown={() => focusPreviewField("innerHeaderImage")}>
                            <Label className="text-xs font-bold text-foreground">Inner Header Image</Label>
                            <BrandImageUpload
                                slotKey="innerHeaderImage"
                                slot={{
                                    title: "",
                                    description: "Full-height image displayed in the right column of the hero section. Replaces the Benefits Logo when set.",
                                    recommendedSize: "1200×1600 px",
                                    accept: ".png,.jpg,.jpeg",
                                    required: false,
                                    previewAspectRatio: 0.75,
                                    previewLabel: "Inner Header Preview",
                                }}
                                currentImage={step1Data.innerHeaderImage ? {
                                    url: step1Data.innerHeaderImage.url,
                                    fileName: step1Data.innerHeaderImage.fileName,
                                    fileSize: step1Data.innerHeaderImage.fileSize || 0,
                                    width: step1Data.innerHeaderImage.width || 0,
                                    height: step1Data.innerHeaderImage.height || 0,
                                    recommendedSize: "1200x1600",
                                    status: "ok",
                                    warnings: [],
                                } as BrandImageData : undefined}
                                onImageChange={handleInnerHeaderImageChange}
                                onImageRemove={() => saveStepData(1, { ...step1Data, innerHeaderImage: null })}
                                hideButtons={true}
                                useUniversalModal={true}
                                universalModalType="normalizer"
                                universalModalCustomConfig={{
                                    outlinePadding: 0,
                                }}
                            />
                        </div>

                        {/* Hero Overlay Settings */}
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-foreground">Hero Overlay Settings</Label>
                            <BannerOverlaySettingsCard
                                backgroundOpacity={step1Data.heroBackgroundOpacity ?? 1.0}
                                containerBlockOpacity={step1Data.heroContainerBlockOpacity ?? 0.67}
                                containerInverted={step1Data.heroContainerInverted ?? false}
                                backgroundInverted={step1Data.heroBackgroundInverted ?? false}
                                useGradient={step1Data.heroUseGradient ?? false}
                                onSettingsChange={handleOverlaySettingsChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Messaging Section */}
                <div
                    ref={sectionsRef.messaging}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "messaging" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={2} title="Benefit Messaging" />
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Intro Headline</Label>
                            <Input
                                value={step1Data.benefitTitle || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, benefitTitle: e.target.value })}
                                onFocus={() => focusPreviewField("benefitTitle")}
                                placeholder="e.g. 401(k) Retirement Plan"
                                className="h-11 shadow-sm border-muted"
                                maxLength={35}
                            />
                            <div className="flex justify-end">
                                <span
                                    className={`text-[11px] tabular-nums ${
                                        (step1Data.benefitTitle || "").length >= 33
                                            ? "text-red-500"
                                            : (step1Data.benefitTitle || "").length < 10
                                                ? "text-amber-500"
                                                : "text-green-600"
                                    }`}
                                >
                                    {(step1Data.benefitTitle || "").length}/35
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Intro Message</Label>
                            <Textarea
                                value={step1Data.shortDescription || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, shortDescription: e.target.value })}
                                onFocus={() => focusPreviewField("shortDescription")}
                                placeholder="Provide a helpful overview for employees..."
                                className="min-h-[120px] shadow-sm border-muted leading-relaxed"
                                maxLength={450}
                            />
                            <div className="flex justify-end">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {(step1Data.shortDescription || "").length}/450
                                </span>
                            </div>
                        </div>

                        {/* Closing & Signature */}
                        <div className="space-y-3 pt-4 border-t border-border">
                            <Label className="text-xs font-bold text-foreground">Closing & Signature</Label>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="emsig-user"
                                        name="signatureMode"
                                        checked={(step1Data.signatureMode || "user") === "user"}
                                        onFocus={() => focusPreviewField("messaging")}
                                        onChange={() => saveStepData(1, { ...step1Data, signatureMode: "user" })}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="emsig-user" className="text-xs font-normal cursor-pointer">Use Contact&rsquo;s Name & Title</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="emsig-custom"
                                        name="signatureMode"
                                        checked={(step1Data.signatureMode || "user") === "custom"}
                                        onFocus={() => focusPreviewField("messaging")}
                                        onChange={() => saveStepData(1, { ...step1Data, signatureMode: "custom" })}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="emsig-custom" className="text-xs font-normal cursor-pointer">Custom Signature</Label>
                                </div>
                            </div>

                            {(step1Data.signatureMode || "user") === "custom" && (
                                <div className="space-y-3 pl-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={step1Data.customClosing || ""}
                                                onChange={(e) => saveStepData(1, { ...step1Data, customClosing: e.target.value })}
                                                onFocus={() => focusPreviewField("messaging")}
                                                placeholder='Closing text e.g. "We hope to inspire you to save!"'
                                                className="h-9 shadow-sm border-muted text-xs flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => saveStepData(1, { ...step1Data, customClosingBold: !(step1Data.customClosingBold ?? true) })}
                                                className={`h-9 w-9 flex items-center justify-center rounded text-xs font-bold transition-colors ${(step1Data.customClosingBold ?? true) ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                title="Bold"
                                            >B</button>
                                            <button
                                                type="button"
                                                onClick={() => saveStepData(1, { ...step1Data, customClosingItalic: !step1Data.customClosingItalic })}
                                                className={`h-9 w-9 flex items-center justify-center rounded text-xs italic transition-colors ${step1Data.customClosingItalic ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                title="Italic"
                                            >I</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={step1Data.customSignatureName || ""}
                                                onChange={(e) => saveStepData(1, { ...step1Data, customSignatureName: e.target.value })}
                                                onFocus={() => focusPreviewField("messaging")}
                                                placeholder='Signature name e.g. "[Name] - [Position]"'
                                                className="h-9 shadow-sm border-muted text-xs flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => saveStepData(1, { ...step1Data, customSignatureNameBold: !step1Data.customSignatureNameBold })}
                                                className={`h-9 w-9 flex items-center justify-center rounded text-xs font-bold transition-colors ${step1Data.customSignatureNameBold ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                title="Bold"
                                            >B</button>
                                            <button
                                                type="button"
                                                onClick={() => saveStepData(1, { ...step1Data, customSignatureNameItalic: !step1Data.customSignatureNameItalic })}
                                                className={`h-9 w-9 flex items-center justify-center rounded text-xs italic transition-colors ${step1Data.customSignatureNameItalic ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                title="Italic"
                                            >I</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={step1Data.customSignatureCompany || ""}
                                                onChange={(e) => saveStepData(1, { ...step1Data, customSignatureCompany: e.target.value })}
                                                onFocus={() => focusPreviewField("messaging")}
                                                placeholder='Company Name'
                                                className="h-9 shadow-sm border-muted text-xs flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => saveStepData(1, { ...step1Data, customSignatureCompanyBold: !step1Data.customSignatureCompanyBold })}
                                                className={`h-9 w-9 flex items-center justify-center rounded text-xs font-bold transition-colors ${step1Data.customSignatureCompanyBold ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                title="Bold"
                                            >B</button>
                                            <button
                                                type="button"
                                                onClick={() => saveStepData(1, { ...step1Data, customSignatureCompanyItalic: !(step1Data.customSignatureCompanyItalic ?? true) })}
                                                className={`h-9 w-9 flex items-center justify-center rounded text-xs italic transition-colors ${(step1Data.customSignatureCompanyItalic ?? true) ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                title="Italic"
                                            >I</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Per-line style controls for "Use Contact's Name & Title" mode */}
                            {(step1Data.signatureMode || "user") === "user" && (
                                <div className="space-y-2 pl-4">
                                    <Label className="text-[11px] text-muted-foreground">Text Style</Label>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">Closing</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => saveStepData(1, { ...step1Data, customClosingBold: !(step1Data.customClosingBold ?? true) })}
                                                    className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${(step1Data.customClosingBold ?? true) ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                    title="Bold"
                                                >B</button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveStepData(1, { ...step1Data, customClosingItalic: !step1Data.customClosingItalic })}
                                                    className={`h-7 w-7 flex items-center justify-center rounded text-[11px] italic transition-colors ${step1Data.customClosingItalic ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                    title="Italic"
                                                >I</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">Signature Name</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => saveStepData(1, { ...step1Data, customSignatureNameBold: !step1Data.customSignatureNameBold })}
                                                    className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${step1Data.customSignatureNameBold ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                    title="Bold"
                                                >B</button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveStepData(1, { ...step1Data, customSignatureNameItalic: !step1Data.customSignatureNameItalic })}
                                                    className={`h-7 w-7 flex items-center justify-center rounded text-[11px] italic transition-colors ${step1Data.customSignatureNameItalic ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                    title="Italic"
                                                >I</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">Company Name</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => saveStepData(1, { ...step1Data, customSignatureCompanyBold: !step1Data.customSignatureCompanyBold })}
                                                    className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${step1Data.customSignatureCompanyBold ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                    title="Bold"
                                                >B</button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveStepData(1, { ...step1Data, customSignatureCompanyItalic: !(step1Data.customSignatureCompanyItalic ?? true) })}
                                                    className={`h-7 w-7 flex items-center justify-center rounded text-[11px] italic transition-colors ${(step1Data.customSignatureCompanyItalic ?? true) ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                                                    title="Italic"
                                                >I</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Plan Video Section */}
                <div
                    ref={sectionsRef.planVideo}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "planVideo" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={3} title="Plan Video" />
                    <p className="text-[13px] text-muted-foreground mb-6">
                        Upload a video to replace the image in the right column of the Retirement Journey section.
                        If no video is uploaded, the default category image will be shown instead.
                    </p>

                    {/* Video Section Overrides */}
                    <div className="space-y-4 mb-6 p-4 border border-muted rounded-lg bg-white dark:bg-gray-800">
                        <Label className="text-xs font-bold text-foreground">Video Section Text</Label>
                        <p className="text-[11px] text-muted-foreground -mt-2">
                            Customize the header, subtitle, and body text shown in the Retirement Journey section below the welcome banner.
                        </p>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-medium text-muted-foreground">Header</Label>
                                <Input
                                    value={step1Data.journeyHeader || ""}
                                    onChange={(e) => saveStepData(1, { ...step1Data, journeyHeader: e.target.value })}
                                    onFocus={() => focusPreviewField("journeyHeader")}
                                    placeholder="Section Header"
                                    className="h-9 shadow-sm border-muted text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-medium text-muted-foreground">Subtitle</Label>
                                <Input
                                    value={step1Data.journeySubtitle || ""}
                                    onChange={(e) => saveStepData(1, { ...step1Data, journeySubtitle: e.target.value })}
                                    onFocus={() => focusPreviewField("journeySubtitle")}
                                    placeholder="e.g. Build your future with confidence."
                                    className="h-9 shadow-sm border-muted text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-medium text-muted-foreground">Body Text</Label>
                                <Textarea
                                    value={step1Data.journeyBodyText || ""}
                                    onChange={(e) => saveStepData(1, { ...step1Data, journeyBodyText: e.target.value })}
                                    onFocus={() => focusPreviewField("journeyBodyText")}
                                    placeholder="Preview of the featured video."
                                    className="min-h-[80px] shadow-sm border-muted text-sm leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-xs font-bold text-foreground">Upload Plan Video</Label>
                        {step1Data.planVideo ? (
                            <Card className="border border-muted shadow-sm">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Video className="w-5 h-5 text-blue-600" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {step1Data.planVideoFileName || "Uploaded Video"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Video uploaded successfully</p>
                                        </div>
                                    </div>
                                    <div className="aspect-video overflow-hidden rounded-lg bg-black">
                                        <video
                                            src={step1Data.planVideo?.startsWith("http") || step1Data.planVideo?.startsWith("/api/")
                                                ? step1Data.planVideo
                                                : `/api/r2/object?key=${encodeURIComponent(step1Data.planVideo || "")}`}
                                            controls
                                            className="h-full w-full object-contain"
                                            playsInline
                                            preload="metadata"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRemovePlanVideo}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        Remove Video
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <label
                                        className={cn(
                                            "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
                                            videoUploading && "opacity-50 pointer-events-none"
                                        )}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {videoUploading ? `Uploading... ${videoUploadProgress}%` : "Choose Video File"}
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={handlePlanVideoUpload}
                                            onFocus={() => focusPreviewField("planVideo")}
                                            className="hidden"
                                            disabled={videoUploading}
                                        />
                                    </label>
                                </div>
                                {videoUploading && (
                                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${videoUploadProgress}%` }}
                                        />
                                    </div>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    Accepted formats: MP4, WebM, OGG. The video will be displayed in the right column of the plan page.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Help Cards Section */}
                <div
                    ref={sectionsRef.helpCards}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "helpCards" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={4} title="How Can We Help You Today?" />
                    <p className="text-[13px] text-muted-foreground mb-6">
                        Customize the three cards that appear in the &ldquo;How Can We Help You Today?&rdquo; section.
                    </p>
                    <Accordion
                        type="multiple"
                        value={openAccordionItems}
                        onValueChange={setOpenAccordionItems}
                        className="space-y-3"
                    >
                        {helpCards.map((card) => (
                            <AccordionItem key={card.id} value={card.id} className="border border-muted rounded-xl px-4 shadow-sm bg-white dark:bg-gray-800 dark:border-gray-600">
                                <AccordionTrigger className="text-sm font-semibold py-4 hover:no-underline">
                                    {card.title || "Untitled Card"}
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pb-4">
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                            Card Title
                                        </Label>
                                        <Input
                                            value={card.title}
                                            onChange={(e) => updateHelpCard(card.id, { title: e.target.value })}
                                            onFocus={() => focusPreviewField("helpCards")}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                            Intro (optional bold text)
                                        </Label>
                                        <Input
                                            value={card.introBold || ""}
                                            onChange={(e) => updateHelpCard(card.id, { introBold: e.target.value || undefined })}
                                            onFocus={() => focusPreviewField("helpCards")}
                                            className="h-9 text-sm"
                                            placeholder="e.g. Transitioning to a new employer?"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                            Paragraph
                                        </Label>
                                        <Textarea
                                            value={card.paragraphs[0] ?? ""}
                                            onChange={(e) => updateCardParagraph(card.id, e.target.value)}
                                            onFocus={() => focusPreviewField("helpCards")}
                                            className="min-h-[80px] text-sm"
                                            placeholder="Enter the card description..."
                                            maxLength={HELP_CARD_PARAGRAPH_MAX}
                                        />
                                        <div className="flex flex-wrap items-center justify-between gap-1">
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {(card.paragraphs[0] ?? "").length} / {HELP_CARD_PARAGRAPH_MAX} characters
                                            </span>
                                            {(card.paragraphs[0] ?? "").trim().length < HELP_CARD_PARAGRAPH_MIN && (
                                                <span className="text-[11px] text-amber-600">
                                                    Minimum {HELP_CARD_PARAGRAPH_MIN} characters
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                            CTA Button Text
                                        </Label>
                                        <Input
                                            value={card.cta}
                                            onChange={(e) => updateHelpCard(card.id, { cta: e.target.value })}
                                            onFocus={() => focusPreviewField("helpCards")}
                                            className="h-9 text-sm"
                                            placeholder="e.g. LEARN MORE →"
                                        />
                                    </div>
                                    {card.cta?.trim() ? (
                                        <div className="space-y-2">
                                            <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                                Link Path <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                value={card.href || ""}
                                                onChange={(e) => updateHelpCard(card.id, { href: e.target.value || undefined })}
                                                onFocus={() => focusPreviewField("helpCards")}
                                                className={cn(
                                                    "h-9 text-sm",
                                                    !card.href?.trim() && "border-red-400 focus-visible:ring-red-400",
                                                )}
                                                placeholder="e.g. /financial-planning"
                                                required
                                            />
                                            {!card.href?.trim() && (
                                                <p className="text-[11px] text-red-500">
                                                    Link path is required when a button text is added.
                                                </p>
                                            )}
                                        </div>
                                    ) : null}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                {/* Benefit Access & Materials Section */}
                <div
                    ref={sectionsRef.insurance}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "insurance" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={5} title="Benefit Access & Materials" />
                    <p className="text-[13px] text-muted-foreground mb-6">
                        Configure the plan ID and login button shown in the Insurance Benefits Access & Materials section.
                    </p>
                    <div className="space-y-6">
                        <div className="space-y-4" onMouseDown={() => focusPreviewField("insuranceBackgroundImage")}>
                            <Label className="text-xs font-bold text-foreground">Background Image</Label>
                            <BrandImageUpload
                                slotKey="insuranceBg"
                                slot={{
                                    title: "",
                                    description: "This image displays behind the Insurance Benefits Access & Materials section heading.",
                                    recommendedSize: "1920×1080 px",
                                    accept: ".png,.jpg,.jpeg",
                                    required: false,
                                    previewAspectRatio: 2.75,
                                    previewLabel: "Insurance Background Preview",
                                    defaultPhoteButton: true,
                                }}
                                currentImage={step1Data.insuranceBackgroundImage ? {
                                    url: step1Data.insuranceBackgroundImage,
                                    fileName: "insurance-bg.png",
                                    fileSize: 0,
                                    width: 0,
                                    height: 0,
                                    recommendedSize: "1920×1080",
                                    status: "ok",
                                    warnings: [],
                                } as BrandImageData : undefined}
                                onImageChange={(imageData) => saveStepData(1, { ...step1Data, insuranceBackgroundImage: imageData.url })}
                                onImageRemove={() => saveStepData(1, { ...step1Data, insuranceBackgroundImage: undefined })}
                                onDefaultPhotoClick={() => {
                                    const defaultBgs: Record<string, string> = {
                                        "Retirement": "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1920&q=80",
                                        "Group Health": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&q=80",
                                        "Group Life": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1920&q=80",
                                        "Company / Plan Sponsor": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1920&q=80",
                                    };
                                    const defaultBg = defaultBgs[step1Data?.benefitCategory || "Retirement"];
                                    saveStepData(1, { ...step1Data, insuranceBackgroundImage: defaultBg });
                                }}
                                hideButtons={true}
                                useUniversalModal={true}
                                universalModalType="normalizer"
                            />
                        </div>

                        {/* Insurance Overlay Settings — only Container Opacity */}
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-foreground">Overlay Darkness</Label>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                        {Math.round((step1Data.insuranceContainerBlockOpacity ?? 0.8) * 100)}% opacity
                                    </span>
                                </div>
                                <Slider
                                    value={[step1Data.insuranceContainerBlockOpacity ?? 0.8]}
                                    onValueChange={([value]) => saveStepData(1, { ...step1Data, insuranceContainerBlockOpacity: value })}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    className="w-full"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Controls how dark the overlay is over the background image. Higher values = darker overlay.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Plan / Group ID</Label>
                            <Input
                                value={step1Data.insurancePlanId || ""}
                                onMouseDown={() => focusPreviewField("insurancePlanId")}
                                onFocus={() => focusPreviewField("insurancePlanId")}
                                onChange={(e) => {
                                    // Auto-format to xxxx-xxxx-xxxx pattern
                                    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
                                    const groups = [];
                                    for (let i = 0; i < raw.length; i += 4) {
                                        groups.push(raw.slice(i, i + 4));
                                    }
                                    const formatted = groups.join("-");
                                    saveStepData(1, { ...step1Data, insurancePlanId: formatted });
                                }}
                                placeholder="xxxx-xxxx-xxxx"
                                className="h-11 shadow-sm border-muted font-mono tracking-wider"
                            />
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] text-muted-foreground">
                                    This appears as &ldquo;PLAN / GROUP ID: [value]&rdquo; on the Insurance Benefits card.
                                </p>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {(step1Data.insurancePlanId || "").replace(/-/g, "").length}/12
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Register or Login Here Button URL <span className="text-red-500">*</span></Label>
                            <Input
                                value={step1Data.insuranceLoginUrl || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, insuranceLoginUrl: e.target.value })}
                                onMouseDown={() => focusPreviewField("insuranceLoginUrl")}
                                onFocus={() => focusPreviewField("insuranceLoginUrl")}
                                placeholder="e.g. https://portal.empower.com/auth/login"
                                className="h-11 shadow-sm border-muted"
                                type="url"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Full URL for the &ldquo;REGISTER OR LOGIN HERE&rdquo; button.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </EditorPanelWrapper>
    );
}
