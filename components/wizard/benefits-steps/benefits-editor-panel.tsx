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
import { ImageIcon, Layout, Mail, HelpCircle, CheckCircle2, Circle, Pencil, Plus, Search, ChevronsUpDown, Trash2, GripVertical, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SupportContact, FAQItem, BenefitsStep1Data, BenefitsStep3Data } from "@/lib/benefits-wizard-store";
import { KeyContact, BrandImageData, CompanyLogoData, MobileHeroPosition } from "@/types/new-client-wizard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from "uuid";
import { BannerOverlaySettingsCard } from "@/components/wizard/new-client-steps/sections/components/banner-overlay-settings-card";
import { HeroBackgroundCard, type HeroSegmentMode } from "@/components/wizard/new-client-steps/sections/components/hero-background-card";

const DEFAULT_HELP_CARDS: HelpCardData[] = [
    {
        id: "access-account",
        title: "Access My Retirement Account",
        paragraphs: [
            "View your balances, plan documents, and investment details all in one place.",
            "Take charge of your retirement plan and stay on top of your progress anytime.",
        ],
        cta: "ACCESS ACCOUNT →",
    },
    {
        id: "financial-planning",
        title: "Financial Planning",
        paragraphs: [
            "Exclusive Benefits for [Company Name] Plan Participants",
            "Elevate your financial journey with personalized planning through [Advisor Name]—a comprehensive service seamlessly integrated with your retirement benefits.",
        ],
        cta: "START PLANNING →",
        href: "/financial-planning",
    },
    {
        id: "rollovers",
        title: "Rollovers & Distributions",
        introBold: "Transitioning to a new employer?",
        paragraphs: [
            "Understand your options for managing the savings you've built. The decision you make now can have a lasting impact on your retirement lifestyle.",
        ],
        cta: "LEARN MORE →",
        href: "/rollovers-distributions",
    },
];

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
        helpCards: useRef<HTMLDivElement>(null),
        insurance: useRef<HTMLDivElement>(null),
    };

    const [highlightedSection, setHighlightedSection] = React.useState<string | null>(null);

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

    const handleBackgroundImageChange = (imageData: BrandImageData) => {
        saveStepData(1, {
            ...step1Data,
            brandImages: {
                ...step1Data.brandImages,
                header: imageData
            }
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

    const addParagraph = (cardId: string) => {
        const updated = helpCards.map((c) =>
            c.id === cardId ? { ...c, paragraphs: [...c.paragraphs, ""] } : c
        );
        saveStepData(1, { ...step1Data, helpCards: updated });
    };

    const updateParagraph = (cardId: string, idx: number, value: string) => {
        const updated = helpCards.map((c) => {
            if (c.id !== cardId) return c;
            const newParagraphs = [...c.paragraphs];
            newParagraphs[idx] = value;
            return { ...c, paragraphs: newParagraphs };
        });
        saveStepData(1, { ...step1Data, helpCards: updated });
    };

    const removeParagraph = (cardId: string, idx: number) => {
        const updated = helpCards.map((c) => {
            if (c.id !== cardId) return c;
            const newParagraphs = c.paragraphs.filter((_, i) => i !== idx);
            return { ...c, paragraphs: newParagraphs };
        });
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
                        <div className="space-y-4">
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
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-foreground">Header Background</Label>
                            <HeroBackgroundCard
                                heroImageData={step1Data.brandImages?.header || null}
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
                            <Label className="text-xs font-bold text-foreground">Display Title</Label>
                            <Input
                                value={step1Data.benefitTitle || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, benefitTitle: e.target.value })}
                                placeholder="e.g. 401(k) Retirement Plan"
                                className="h-11 shadow-sm border-muted"
                                maxLength={24}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Benefit Description</Label>
                            <Textarea
                                value={step1Data.shortDescription || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, shortDescription: e.target.value })}
                                placeholder="Provide a helpful overview for employees..."
                                className="min-h-[120px] shadow-sm border-muted leading-relaxed"
                                maxLength={120}
                            />
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

                {/* Help Cards Section */}
                <div
                    ref={sectionsRef.helpCards}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "helpCards" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={3} title="How Can We Help You Today?" />
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
                                            className="h-9 text-sm"
                                            placeholder="e.g. Transitioning to a new employer?"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                                Paragraphs
                                            </Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[11px] text-blue-600"
                                                onClick={() => addParagraph(card.id)}
                                            >
                                                <Plus className="w-3 h-3 mr-1" /> Add
                                            </Button>
                                        </div>
                                        {card.paragraphs.map((p, idx) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <Textarea
                                                    value={p}
                                                    onChange={(e) => updateParagraph(card.id, idx, e.target.value)}
                                                    className="min-h-[60px] text-sm flex-1"
                                                    placeholder={`Paragraph ${idx + 1}`}
                                                />
                                                {card.paragraphs.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeParagraph(card.id, idx)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                            CTA Button Text
                                        </Label>
                                        <Input
                                            value={card.cta}
                                            onChange={(e) => updateHelpCard(card.id, { cta: e.target.value })}
                                            className="h-9 text-sm"
                                            placeholder="e.g. LEARN MORE →"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-muted-foreground uppercase">
                                            Link Path (optional)
                                        </Label>
                                        <Input
                                            value={card.href || ""}
                                            onChange={(e) => updateHelpCard(card.id, { href: e.target.value || undefined })}
                                            className="h-9 text-sm"
                                            placeholder="e.g. /financial-planning"
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
                {/* Insurance Benefits Access & Materials Section */}
                <div
                    ref={sectionsRef.insurance}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "insurance" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white dark:bg-gray-800" : ""
                    )}
                >
                    <SectionHeader number={4} title="Insurance Benefits Access & Materials" />
                    <p className="text-[13px] text-muted-foreground mb-6">
                        Configure the plan ID and login button shown in the Insurance Benefits Access & Materials section.
                    </p>
                    <div className="space-y-6">
                        <div className="space-y-4">
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
                            <Label className="text-xs font-bold text-foreground">Plan ID #</Label>
                            <Input
                                value={step1Data.insurancePlanId || ""}
                                onChange={(e) => {
                                    // Count only non-dash characters for the limit
                                    const nonDash = e.target.value.replace(/-/g, "");
                                    if (nonDash.length <= 16) {
                                        saveStepData(1, { ...step1Data, insurancePlanId: e.target.value });
                                    }
                                }}
                                placeholder="e.g. AYR-401K-2024"
                                className="h-11 shadow-sm border-muted"
                            />
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] text-muted-foreground">
                                    This appears as &ldquo;PLAN ID: [value]&rdquo; on the Insurance Benefits card.
                                </p>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {(step1Data.insurancePlanId || "").replace(/-/g, "").length}/16
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Register or Login Here Button URL</Label>
                            <Input
                                value={step1Data.insuranceLoginUrl || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, insuranceLoginUrl: e.target.value })}
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
