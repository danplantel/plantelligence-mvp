import {
    Benefit,
    KeyContact,
    BenefitsCategory,
} from "@/types/new-client-wizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Info,
    ExternalLink,
    User,
    Image as ImageIcon,
    Plus,
    Eye,
    EyeOff,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BrandingImage } from "@/components/ui/branding-image";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { useState, useCallback, useRef } from "react";
import type { CropMetadata } from "@/components/ui/simple-image-editor-modal";

interface CategoryPortalVisibilityProps {
    categoryPortalVisibility: Record<string, boolean>;
    onCategoryVisibilityChange: (category: string, checked: boolean, updatedBenefits?: Benefit[]) => void;
}

interface BenefitsSectionEditorProps {
    benefits: Benefit[];
    onBenefitsChange: (benefits: Benefit[]) => void;
    keyContacts?: KeyContact[];
    isHighlighted?: boolean;
    highlightedBenefitId?: string | null;
    onContactLogoChange?: (
        contactId: string,
        logoUrl: string,
        fileName: string,
        cropData?: CropMetadata,
    ) => void;
    onAddContact?: (category: BenefitsCategory, benefitId: string) => void;
    onContactNameChange?: (contactId: string, name: string) => void;
    /** Optional: Category Display (Portal Visibility) toggles — show at top of Benefits section */
    categoryPortalVisibilityProps?: CategoryPortalVisibilityProps;
}

export function BenefitsSectionEditor({
    benefits,
    onBenefitsChange,
    keyContacts = [],
    isHighlighted,
    highlightedBenefitId,
    onContactLogoChange,
    onAddContact,
    onContactNameChange,
    categoryPortalVisibilityProps,
}: BenefitsSectionEditorProps) {
    const [editingLogoContactId, setEditingLogoContactId] = useState<
        string | null
    >(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingUploadContactId, setPendingUploadContactId] = useState<string | null>(null);

    const handleTitleChange = (id: string, title: string) => {
        onBenefitsChange(benefits.map((b) => (b.id === id ? { ...b, title } : b)));
    };

    const getVisibilityKey = (benefit: Benefit): string => {
        const cat = benefit.category || getBenefitCategory(benefit.title);
        if (cat === "Company / Plan Sponsor") return "Other";
        return cat || "Other";
    };

    const handleVisibilityChange = (id: string, isEnabled: boolean) => {
        const benefit = benefits.find((b) => b.id === id);
        const newBenefits = benefits.map((b) => (b.id === id ? { ...b, isEnabled } : b));
        onBenefitsChange(newBenefits);
        if (benefit && categoryPortalVisibilityProps) {
            const visibilityKey = getVisibilityKey(benefit);
            categoryPortalVisibilityProps.onCategoryVisibilityChange(visibilityKey, isEnabled, newBenefits);
        }
    };

    const handleDescriptionChange = (id: string, description: string) => {
        onBenefitsChange(benefits.map((b) => (b.id === id ? { ...b, description } : b)));
    };

    const handleContactChange = (benefitId: string, contactId: string) => {
        onBenefitsChange(
            benefits.map((b) => (b.id === benefitId ? { ...b, contactId } : b)),
        );
    };

    const getBenefitCategory = (title: string): BenefitsCategory | undefined => {
        const categoryMap: Record<string, BenefitsCategory> = {
            "Retirement Plan Benefits": "Retirement",
            "Health Insurance": "Group Health",
            "Life Insurance": "Group Life",
            "Wellness Programs": "Company / Plan Sponsor",
        };
        return categoryMap[title];
    };

    const getResolvedContact = (benefit: Benefit): KeyContact | undefined => {
        if (benefit.contactId) {
            return keyContacts.find((c) => c.id === benefit.contactId);
        }

        const targetCategory =
            benefit.category || getBenefitCategory(benefit.title);
        if (!targetCategory) return undefined;

        // Find primary contact for this category
        return (
            keyContacts.find(
                (contact) =>
                    contact.benefitsCategories?.includes(targetCategory as any) &&
                    (contact.isPrimary || contact.isPrimaryOverall),
            ) ||
            keyContacts.find(
                (contact) =>
                    contact.benefitsCategories?.includes(targetCategory as any),
            )
        );
    };

    const getContactsForBenefit = (benefit: Benefit) => {
        const targetCategory =
            benefit.category || getBenefitCategory(benefit.title);
        if (!targetCategory) return [];

        return keyContacts
            .filter((c) => c.benefitsCategories?.includes(targetCategory as any))
            .sort((a, b) => {
                const isAPrimary = a.isPrimary || a.isPrimaryOverall;
                const isBPrimary = b.isPrimary || b.isPrimaryOverall;

                if (isAPrimary && !isBPrimary) return -1;
                if (!isAPrimary && isBPrimary) return 1;

                return 0;
            });
    };

    const handleLogoSave = useCallback(
        (
            value: string,
            fileName: string,
            headshotData?: any,
            cropData?: CropMetadata,
        ) => {
            if (editingLogoContactId && onContactLogoChange) {
                onContactLogoChange(editingLogoContactId, value, fileName, cropData);
            }
            setEditingLogoContactId(null);
        },
        [editingLogoContactId, onContactLogoChange],
    );

    const resizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = e.target;
        target.style.height = "auto";
        target.style.height = `${Math.max(40, target.scrollHeight)}px`;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && pendingUploadContactId && onContactLogoChange) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onContactLogoChange(pendingUploadContactId, base64, file.name);
                setEditingLogoContactId(pendingUploadContactId);
                setPendingUploadContactId(null);
            };
            reader.readAsDataURL(file);
        }
        // Reset input value to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div
            data-section-id="benefits"
            className={`pt-6 border-t border-border transition-all duration-300`}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
            />
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Section 3: Benefits
                </h3>
                <div className="h-px w-12 bg-border mt-2" />
            </div>

            <div className="space-y-6">
                {benefits.map((benefit) => {
                    const resolvedContact = getResolvedContact(benefit);
                    const resolvedLogo = resolvedContact?.companyLogo;
                    const resolvedName = resolvedContact?.companyName || "";

                    return (
                        <div
                            key={benefit.id}
                            data-benefit-id={benefit.id}
                            className={`space-y-4 p-4 border rounded-lg transition-all duration-500 ${highlightedBenefitId === benefit.id
                                ? "bg-white ring-2 ring-accent-blue/40 scale-[1.02] shadow-sm"
                                : "bg-card"
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
                                <div className="flex items-center gap-2">
                                    {(() => {
                                        const isVisible = categoryPortalVisibilityProps
                                            ? categoryPortalVisibilityProps.categoryPortalVisibility[getVisibilityKey(benefit)] !== false
                                            : benefit.isEnabled !== false;
                                        return isVisible ? (
                                            <Eye className="w-4 h-4 text-accent-blue" />
                                        ) : (
                                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                                        );
                                    })()}
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Visibility
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor={`visible-${benefit.id}`}
                                        className="text-[10px] font-bold uppercase cursor-pointer"
                                    >
                                        {(() => {
                                            const isVisible = categoryPortalVisibilityProps
                                                ? categoryPortalVisibilityProps.categoryPortalVisibility[getVisibilityKey(benefit)] !== false
                                                : benefit.isEnabled !== false;
                                            return isVisible ? "Visible" : "Hidden";
                                        })()}
                                    </Label>
                                    <Switch
                                        id={`visible-${benefit.id}`}
                                        checked={
                                            categoryPortalVisibilityProps
                                                ? categoryPortalVisibilityProps.categoryPortalVisibility[getVisibilityKey(benefit)] !== false
                                                : benefit.isEnabled !== false
                                        }
                                        onCheckedChange={(checked) =>
                                            handleVisibilityChange(benefit.id, checked)
                                        }
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label
                                    htmlFor={`title-${benefit.id}`}
                                    className="text-xs font-medium text-muted-foreground uppercase"
                                >
                                    Benefit Title
                                </Label>
                                <Input
                                    id={`title-${benefit.id}`}
                                    value={benefit.title}
                                    onChange={(e) =>
                                        handleTitleChange(benefit.id, e.target.value)
                                    }
                                    placeholder="Enter benefit title"
                                    className="font-dm-serif text-lg"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label
                                    htmlFor={`description-${benefit.id}`}
                                    className="text-xs font-medium text-muted-foreground uppercase"
                                >
                                    Description
                                </Label>
                                <Textarea
                                    id={`description-${benefit.id}`}
                                    value={benefit.description || ""} // Should be "base text" or just empty if undefined
                                    onChange={(e) => {
                                        handleDescriptionChange(benefit.id, e.target.value);
                                        resizeTextarea(e);
                                    }}
                                    onFocus={(e) => resizeTextarea(e as any)}
                                    // Set initial height on mount/value change could be tricky without ref, 
                                    // but we can just use min-h and let it grow on input.
                                    // Or use a callback ref.
                                    ref={(ref) => {
                                        if (ref) {
                                            ref.style.height = "auto";
                                            ref.style.height = `${Math.max(40, ref.scrollHeight)}px`;
                                        }
                                    }}
                                    placeholder="Enter benefit description"
                                    className="min-h-[40px] text-sm leading-relaxed resize-none overflow-hidden"
                                    rows={1}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase">
                                        Partner Name & Logo (optional)
                                    </Label>
                                    {(() => {
                                        const relevantContacts = getContactsForBenefit(benefit);
                                        const currentContactId = benefit.contactId || resolvedContact?.id || "";

                                        if (relevantContacts.length > 0) {
                                            return (
                                                <div className="flex items-center gap-3 w-full">
                                                    {/* Logo Section */}
                                                    <div className="flex-shrink-0">
                                                        {resolvedLogo ? (
                                                            <div className="relative">
                                                                <div
                                                                    className="w-12 h-12 rounded border border-gray-200 bg-white flex items-center justify-center p-1 cursor-pointer hover:border-accent-blue transition-colors"
                                                                    onClick={() => {
                                                                        if (resolvedContact) {
                                                                            setEditingLogoContactId(resolvedContact.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <BrandingImage
                                                                        src={resolvedLogo}
                                                                        alt="Partner Logo"
                                                                        className="max-w-full max-h-full object-contain"
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (resolvedContact && onContactLogoChange) {
                                                                            onContactLogoChange(resolvedContact.id, "", "");
                                                                        }
                                                                    }}
                                                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 shadow-sm transition-colors"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="w-12 h-12 border border-dashed rounded flex flex-col items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                                                onClick={() => {
                                                                    if (resolvedContact) {
                                                                        setPendingUploadContactId(resolvedContact.id);
                                                                        fileInputRef.current?.click();
                                                                    }
                                                                }}
                                                            >
                                                                <ImageIcon className="w-4 h-4 text-muted-foreground mb-0.5" />
                                                                <span className="text-[8px] text-muted-foreground uppercase font-medium">
                                                                    Upload
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Contact Selector */}
                                                    <div className="flex-1">
                                                        <Select
                                                            value={currentContactId}
                                                            onValueChange={(val) => handleContactChange(benefit.id, val)}
                                                        >
                                                            <SelectTrigger className="h-12 w-full">
                                                                <SelectValue placeholder="Select contact" />
                                                            </SelectTrigger>
                                                            <SelectContent className="z-[60]">
                                                                {relevantContacts.map((contact) => (
                                                                    <SelectItem key={contact.id} value={contact.id}>
                                                                        <div className="flex flex-col items-start text-left py-0.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-medium text-sm">
                                                                                    {contact.firstName || contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.name || "Unnamed Contact"}
                                                                                </span>
                                                                                {contact.isPrimaryOverall && (
                                                                                    <span className="text-[10px] bg-accent-blue/10 text-accent-blue px-1 rounded font-semibold uppercase">Primary</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                                                                {contact.companyName && (
                                                                                    <span className="truncate max-w-[120px]">
                                                                                        {contact.companyName}
                                                                                    </span>
                                                                                )}
                                                                                {contact.benefitsCategories?.[0] && (
                                                                                    <>
                                                                                        <span>•</span>
                                                                                        <span className="italic">{contact.benefitsCategories[0]}</span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="p-3 border border-dashed rounded-lg bg-muted/10 flex items-center justify-between w-full">
                                                <p className="text-sm text-muted-foreground italic">
                                                    Please add a contact to manage partner details.
                                                </p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-accent-blue hover:bg-accent-blue/5 h-8"
                                                    onClick={() => {
                                                        const category =
                                                            benefit.category ||
                                                            getBenefitCategory(benefit.title);
                                                        if (category && onAddContact) {
                                                            onAddContact(category, benefit.id);
                                                        }
                                                    }}
                                                >
                                                    <Plus className="w-3 h-3 mr-1" />
                                                    Add Contact
                                                </Button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingLogoContactId && (
                <UniversalImageEditorModal
                    type="normalizer"
                    value={
                        keyContacts.find((c) => c.id === editingLogoContactId)
                            ?.companyLogo || ""
                    }
                    fileName="partner-logo"
                    onChange={handleLogoSave}
                    onRemove={() => setEditingLogoContactId(null)}
                    isOpen={!!editingLogoContactId}
                    onClose={() => setEditingLogoContactId(null)}
                    autoSizeOnOpen={true}
                />
            )}
        </div>
    );
}
