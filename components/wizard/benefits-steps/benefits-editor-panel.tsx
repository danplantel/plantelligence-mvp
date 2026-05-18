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
        faqs: useRef<HTMLDivElement>(null),
        contacts: useRef<HTMLDivElement>(null),
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

                {/* FAQs Section */}
                <div
                    ref={sectionsRef.faqs}
                    className={cn(
                        "transition-all duration-500 rounded-xl",
                        highlightedSection === "faqs" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white" : ""
                    )}
                >
                    <SectionHeader number={3} title="Frequently Asked Questions" />
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-[13px] text-muted-foreground">Manage the questions that appear on this benefit&apos;s page.</p>
                        <Button onClick={addFaq} variant="outline" size="sm" className="h-8 text-[11px] font-bold border-blue-200 text-blue-600 hover:bg-blue-50">
                            <Plus className="w-3.5 h-3.5 mr-1" /> ADD FAQ
                        </Button>
                    </div>
                    <div className="space-y-4">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={step3Data.faqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                                {step3Data.faqs.map((faq, index) => (
                                    <div key={faq.id} className="border border-muted rounded-xl p-4 space-y-4 bg-gray-50/30 shadow-sm relative group/faq">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
                                                    <GripVertical className="w-4 h-4" />
                                                </div>
                                                <Input
                                                    value={faq.question}
                                                    onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
                                                    className="h-9 text-sm font-semibold border-transparent bg-transparent p-0 focus-visible:ring-0 shadow-none"
                                                    placeholder="Enter question"
                                                />
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover/faq:opacity-100 transition-opacity" onClick={() => removeFaq(faq.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <Textarea
                                            value={faq.answer}
                                            onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
                                            className="min-h-[80px] text-sm bg-white border-muted shadow-sm"
                                            placeholder="Enter answer..."
                                        />
                                    </div>
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                {/* Contacts Section */}
                <div
                    ref={sectionsRef.contacts}
                    className={cn(
                        "transition-all duration-500 rounded-xl mb-12",
                        highlightedSection === "messaging" ? "ring-2 ring-blue-500/50 scale-[1.01] shadow-lg p-4 -m-4 bg-white" : ""
                    )}
                >
                    <SectionHeader number={4} title="Assigned Support Contacts" />
                    <p className="text-[13px] text-muted-foreground mb-6">Choose which key contacts will be displayed on this benefit page.</p>
                    <div className="space-y-3">
                        {contactsList.map((contact: any) => {
                            const isSelected = step3Data.supportContacts.some(c => c.contactId === contact.id);
                            const config = step3Data.supportContacts.find(c => c.contactId === contact.id);

                            return (
                                <div key={contact.id} className="space-y-3">
                                    <div
                                        className={cn(
                                            "flex items-center p-3 rounded-xl border transition-all cursor-pointer",
                                            isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-muted bg-white hover:border-muted-foreground/30"
                                        )}
                                        onClick={() => toggleContact(contact.id)}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-colors",
                                            isSelected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-muted-foreground/20"
                                        )}>
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-semibold text-foreground truncate">{contact.name || `${contact.firstName} ${contact.lastName}`}</p>
                                            <p className="text-[12px] text-muted-foreground truncate">{contact.title}</p>
                                        </div>
                                    </div>

                                    {isSelected && config && (
                                        <div className="ml-8 p-4 bg-white rounded-xl border border-blue-100 space-y-4 animate-in slide-in-from-top-2 duration-200 shadow-inner">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Display Role</Label>
                                                <Input
                                                    value={config.title}
                                                    onChange={(e) => updateSupportContact(contact.id, { title: e.target.value })}
                                                    placeholder="e.g. Benefits Specialist"
                                                    className="h-9 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Direct Message / Description</Label>
                                                <Textarea
                                                    value={config.description}
                                                    onChange={(e) => updateSupportContact(contact.id, { description: e.target.value })}
                                                    placeholder="Contact for any questions regarding this benefit."
                                                    className="min-h-[70px] text-xs py-2"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </EditorPanelWrapper>
    );
}
