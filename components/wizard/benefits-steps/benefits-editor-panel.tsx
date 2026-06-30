"use client";

import React, { useRef, useEffect } from "react";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { EditorPanelWrapper } from "@/components/wizard/new-client-steps/sections/components/editor-panel-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImageIcon, Layout, Mail, HelpCircle, CheckCircle2, Circle, Pencil, Plus, Search, ChevronsUpDown, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SupportContact, FAQItem, BenefitsStep1Data, BenefitsStep3Data } from "@/lib/benefits-wizard-store";
import { KeyContact, BrandImageData, CompanyLogoData } from "@/types/new-client-wizard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "uuid";

interface BenefitsEditorPanelProps {
    isOpen: boolean;
    isAnimating: boolean;
    onClose: () => void;
    activeSection?: string | null;
    editorScrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export function BenefitsEditorPanel({
    isOpen,
    isAnimating,
    onClose,
    activeSection,
    highlightedField,
    editorScrollContainerRef: externalScrollRef,
}: BenefitsEditorPanelProps & { highlightedField?: string | null }) {
    const { stepData, saveStepData } = useBenefitsWizardStore();
    const step1Data = (stepData.step1 || {}) as BenefitsStep1Data;
    const step3Data = (stepData.step3 || { faqs: [], supportContacts: [] }) as BenefitsStep3Data;
    const internalScrollRef = useRef<HTMLDivElement>(null);
    const editorScrollContainerRef = externalScrollRef || internalScrollRef;

    // Refs for scrolling
    const sectionsRef = {
        branding: useRef<HTMLDivElement>(null),
        messaging: useRef<HTMLDivElement>(null),
    };

    const [highlightedSection, setHighlightedSection] = React.useState<string | null>(null);

    // Scroll to section when activeSection changes
    useEffect(() => {
        if (activeSection && isOpen) {
            setHighlightedSection(activeSection);

            const element = sectionsRef[activeSection as keyof typeof sectionsRef]?.current;
            if (element && editorScrollContainerRef.current) {
                const container = editorScrollContainerRef.current;

                // Wait for editor to fully open
                setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const targetScroll = rect.top - containerRect.top + container.scrollTop - 20;

                    container.scrollTo({
                        top: targetScroll,
                        behavior: "smooth"
                    });
                }, 350);
            }

            // Remove highlight after some time
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

    // --- Logic from Step 3 ---
    const updateFaq = (id: string, updates: Partial<FAQItem>) => {
        const newFaqs = step3Data.faqs.map((faq) =>
            faq.id === id ? { ...faq, ...updates } : faq,
        );
        saveStepData(3, { ...step3Data, faqs: newFaqs });
    };

    const addFaq = () => {
        const id = uuidv4();
        const newFaq: FAQItem = {
            id,
            question: "New Question?",
            answer: "Provide an answer here.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true,
        };
        saveStepData(3, {
            ...step3Data,
            faqs: [newFaq, ...step3Data.faqs],
        });
    };

    const removeFaq = (id: string) => {
        const newFaqs = step3Data.faqs.filter((faq) => faq.id !== id);
        saveStepData(3, { ...step3Data, faqs: newFaqs });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = step3Data.faqs.findIndex((f) => f.id === active.id);
            const newIndex = step3Data.faqs.findIndex((f) => f.id === over.id);
            const newFaqs = arrayMove(step3Data.faqs, oldIndex, newIndex);
            saveStepData(3, { ...step3Data, faqs: newFaqs });
        }
    };

    // --- Support Contacts Logic ---
    const allContacts = (step1Data.selectedPlan?.keyContacts || []) as any[];
    const contactsList = Array.isArray(allContacts) ? allContacts : (allContacts as any).contacts || [];

    const toggleContact = (contactId: string) => {
        const existing = step3Data.supportContacts.find((c) => c.contactId === contactId);
        if (existing) {
            const newContacts = step3Data.supportContacts.filter((c) => c.contactId !== contactId);
            saveStepData(3, { ...step3Data, supportContacts: newContacts });
        } else {
            const contact = contactsList.find((c: any) => c.id === contactId);
            const newContact: SupportContact = {
                contactId,
                title: contact?.title || "Support Contact",
                description: "Contact for any questions regarding this benefit.",
                enabled: true,
            };
            saveStepData(3, {
                ...step3Data,
                supportContacts: [...step3Data.supportContacts, newContact],
            });
        }
    };

    const updateSupportContact = (contactId: string, updates: Partial<SupportContact>) => {
        const newContacts = step3Data.supportContacts.map((c) =>
            c.contactId === contactId ? { ...c, ...updates } : c
        );
        saveStepData(3, { ...step3Data, supportContacts: newContacts });
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
        >
            <div className="flex flex-col gap-12 p-6 pb-20">
                {/* Branding Section */}
                <div
                    ref={sectionsRef.branding}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "branding" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white" : ""
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
                            <BrandImageUpload
                                slotKey="header"
                                slot={{
                                    title: "",
                                    description: "This image displays behind the welcome headline.",
                                    recommendedSize: "1920×1080 px",
                                    accept: ".png,.jpg,.jpeg",
                                    required: true,
                                    previewAspectRatio: 2.75,
                                    previewLabel: "Hero Background Preview",
                                }}
                                currentImage={step1Data.brandImages?.header || undefined}
                                onImageChange={handleBackgroundImageChange}
                                onImageRemove={() => saveStepData(1, {
                                    ...step1Data,
                                    brandImages: { ...step1Data.brandImages, header: null }
                                })}
                                hideButtons={true}
                                useUniversalModal={true}
                                universalModalType="normalizer"
                            />
                        </div>
                    </div>
                </div>

                {/* Messaging Section */}
                <div
                    ref={sectionsRef.messaging}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "messaging" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white" : ""
                    )}
                >
                    <SectionHeader number={2} title="Benefit Messaging" />
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Benefit Portal Title</Label>
                            <Input
                                value={step1Data.benefitTitle || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, benefitTitle: e.target.value })}
                                placeholder="e.g. 401(k) Retirement Plan"
                                className="h-11 shadow-sm border-muted"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Summary Description</Label>
                            <Textarea
                                value={step1Data.shortDescription || ""}
                                onChange={(e) => saveStepData(1, { ...step1Data, shortDescription: e.target.value })}
                                placeholder="Provide a helpful overview for employees..."
                                className="min-h-[120px] shadow-sm border-muted leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </EditorPanelWrapper>
    );
}
