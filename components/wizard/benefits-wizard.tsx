"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "sonner";
import { WizardStepper } from "./wizard-stepper";

export interface WizardStep {
    id: number;
    title: string;
    description: string;
    completed: boolean;
}

interface BenefitsWizardProps {
    steps: WizardStep[];
    currentStep: number;
    totalSteps: number;
    onNext: () => void;
    onPrevious: () => void;
    onComplete: () => void;
    isFirstStep: boolean;
    isLastStep: boolean;
    children: React.ReactNode;
    isLoading?: boolean;
}

export function BenefitsWizard({
    steps,
    currentStep,
    totalSteps,
    onNext,
    onPrevious,
    onComplete,
    isFirstStep,
    isLastStep,
    children,
    isLoading = false,
}: BenefitsWizardProps) {
    const currentStepData = steps.find((step) => step.id === currentStep);
    const currentStepTitle = currentStepData?.title || "";

    const [isProcessing, setIsProcessing] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const originalSidebarWidthRef = useRef<string | null>(null);

    // Listen for editor state changes
    useEffect(() => {
        const handleEditorStateChange = (event: any) => {
            setIsEditorOpen(event.detail.isOpen);
        };

        window.addEventListener("step1EditorStateChange" as any, handleEditorStateChange);
        window.addEventListener("step2EditorStateChange" as any, handleEditorStateChange);
        window.addEventListener("step5EditorStateChange" as any, handleEditorStateChange);

        return () => {
            window.removeEventListener("step1EditorStateChange" as any, handleEditorStateChange);
            window.removeEventListener("step2EditorStateChange" as any, handleEditorStateChange);
            window.removeEventListener("step5EditorStateChange" as any, handleEditorStateChange);
        };
    }, []);

    // Handle global sidebar width shift
    useEffect(() => {
        const sidebarWidth = "36rem";
        if (isEditorOpen) {
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

        return () => {
            if (originalSidebarWidthRef.current !== null) {
                document.documentElement.style.removeProperty("--sidebar-width");
            }
        };
    }, [isEditorOpen]);

    const handleComplete = async () => {
        if (isProcessing || isLoading) return;
        setIsProcessing(true);
        try {
            await onComplete();
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrevious = () => {
        if (isProcessing || isLoading) return;
        onPrevious();
    };

    const handleNext = async () => {
        if (isProcessing || isLoading) return;
        setIsProcessing(true);
        try {
            await onNext();
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="mx-10 py-4 min-h-screen transition-all duration-300 ease-in-out">
            <div className="mb-2">
                <WizardStepper
                    steps={steps}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    currentStepTitle={currentStepTitle}
                    showEditorButton={currentStep === 1}
                />
            </div>

            <div ref={contentRef} className="mb-12">
                {children}
            </div>

            <div
                className="fixed bottom-0 bg-white border-t z-50 transition-all duration-300 ease-in-out"
                style={{
                    left: "var(--sidebar-width, 0)",
                    width: "calc(100% - var(--sidebar-width, 0))",
                }}
            >
                <div className="mx-10">
                    <Card className="shadow-none border-0">
                        <CardContent className="flex justify-between items-center p-4 relative">
                            <LoadingButton
                                variant="outline"
                                onClick={handlePrevious}
                                isLoading={isProcessing}
                                loadingText="Previous"
                                disabled={isFirstStep || isLoading || isProcessing}
                                size="lg"
                            >
                                <ChevronLeft className="size-5" />
                                Previous
                            </LoadingButton>

                            <div className="flex gap-3">
                                {isLastStep ? (
                                    <LoadingButton
                                        size="lg"
                                        onClick={handleComplete}
                                        isLoading={isLoading || isProcessing}
                                        loadingText="Completing..."
                                    >
                                        Complete
                                        <ChevronRight className="size-5" />
                                    </LoadingButton>
                                ) : (
                                    <LoadingButton
                                        size="lg"
                                        onClick={handleNext}
                                        isLoading={isLoading || isProcessing}
                                        loadingText="Next..."
                                    >
                                        Next
                                        <ChevronRight className="size-5" />
                                    </LoadingButton>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
