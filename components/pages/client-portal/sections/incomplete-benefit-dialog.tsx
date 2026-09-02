"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { useRouter } from "next/navigation";

interface IncompleteBenefitDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    category: BenefitsCategory;
    missingInfo: string[];
    clientId: string;
}

export function IncompleteBenefitDialog({
    isOpen,
    onOpenChange,
    category,
    missingInfo,
    clientId,
}: IncompleteBenefitDialogProps) {
    const router = useRouter();

    const handleGoToWizard = () => {
        // Encode the category to ensure it's safe for URL
        const encodedCategory = encodeURIComponent(category);
        router.push(`/benefits?planId=${clientId}&category=${encodedCategory}`);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <DialogTitle className="text-xl">Incomplete Benefit Setup</DialogTitle>
                    </div>
                    <DialogDescription>
                        The <span className="font-bold text-gray-900">{category}</span> section needs more information before it can be fully displayed to employees.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Missing Information:</h4>
                    <ul className="space-y-2">
                        {missingInfo.map((info, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                {info}
                            </li>
                        ))}
                    </ul>
                </div>

                <DialogFooter className="flex sm:justify-between items-center gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Maybe Later
                    </Button>
                    <Button onClick={handleGoToWizard} className="bg-[#23919C] hover:bg-[#1b727a] text-white gap-2">
                        Finish Setup in Wizard
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
