"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Building2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface BrandChangeConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (applyToAllPlans: boolean) => void;
    changeType: "name" | "logo" | "both";
}

export function BrandChangeConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    changeType,
}: BrandChangeConfirmationModalProps) {
    const [selectedOption, setSelectedOption] = useState<"plan" | "profile">("plan");

    const handleApplyChange = () => {
        const applyToAllPlans = selectedOption === "profile";
        onConfirm(applyToAllPlans);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-accent-blue/10 flex items-center justify-center mb-4">
                        <Building2 className="w-6 h-6 text-accent-blue" />
                    </div>
                    <DialogTitle className="text-center text-xl">
                        You&apos;re changing your company branding
                    </DialogTitle>
                    <DialogDescription className="text-center pt-2 text-base">
                        This logo and company name are currently used across your plans. How would you like to apply this change?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    <RadioGroup
                        value={selectedOption}
                        onValueChange={(value) => setSelectedOption(value as "plan" | "profile")}
                        className="space-y-4"
                    >
                        {/* Option A: Only for this plan */}
                        <div
                            className={`relative flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${selectedOption === "plan"
                                ? "border-accent-blue bg-accent-blue/5"
                                : "border-gray-200 hover:border-gray-300"
                                }`}
                            onClick={() => setSelectedOption("plan")}
                        >
                            <RadioGroupItem value="plan" id="plan" className="mt-0.5" />
                            <div className="flex-1">
                                <Label htmlFor="plan" className="font-semibold text-base cursor-pointer">
                                    Only for this plan
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    This change will apply only to this plan&apos;s participant experience
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Other plans will remain unchanged
                                </p>
                            </div>
                        </div>

                        {/* Option B: Update my firm profile */}
                        <div
                            className={`relative flex items-start space-x-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${selectedOption === "profile"
                                ? "border-accent-blue bg-accent-blue/5"
                                : "border-gray-200 hover:border-gray-300"
                                }`}
                            onClick={() => setSelectedOption("profile")}
                        >
                            <RadioGroupItem value="profile" id="profile" className="mt-0.5" />
                            <div className="flex-1">
                                <Label htmlFor="profile" className="font-semibold text-base cursor-pointer">
                                    Update my firm profile
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    This will update your company name/logo across all plans
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    You can review and edit this anytime in Profile Settings
                                </p>
                            </div>
                        </div>
                    </RadioGroup>

                    {/* Tertiary link - only show if Option B is selected */}
                    {selectedOption === "profile" && (
                        <div className="mt-4 flex justify-center">
                            <Link
                                href="/settings/profile"
                                target="_blank"
                                className="text-sm text-accent-blue hover:text-accent-blue/80 flex items-center gap-1 transition-colors"
                            >
                                Review firm profile first
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full sm:w-auto order-2 sm:order-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApplyChange}
                        className="w-full sm:w-auto bg-accent-blue hover:bg-accent-blue/90 order-1 sm:order-2"
                    >
                        Apply Change
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
