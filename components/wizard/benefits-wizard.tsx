"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";

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
    /**
     * Optional. When provided, a Cancel button renders to the left of the
     * Next / Complete button on every step. The wizard stays presentational: the
     * caller decides what cancelling means (Create Benefits discards the draft
     * and returns to the Benefits list).
     */
    onCancel?: () => void;
    /** Disables the whole footer while the caller's cancel handler is in flight. */
    isCancelling?: boolean;
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
    onCancel,
    isCancelling = false,
    isFirstStep,
    isLastStep,
    children,
    isLoading = false,
}: BenefitsWizardProps) {
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

    // One "busy" switch for the whole footer: while a step transition, a publish or
    // the Cancel discard is in flight nothing in the footer may fire — otherwise a
    // second click could race the purge that Cancel is performing.
    const busy = isProcessing || isLoading || isCancelling;

    const handleComplete = async () => {
        if (busy) return;
        setIsProcessing(true);
        try {
            await onComplete();
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrevious = () => {
        if (busy) return;
        onPrevious();
    };

    const handleCancel = () => {
        if (busy) return;
        onCancel?.();
    };

    const handleNext = async () => {
        if (busy) return;
        setIsProcessing(true);
        try {
            await onNext();
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="mx-10 py-4 min-h-screen duration-300 ease-in-out">
            <div ref={contentRef} className="max-w-4xl mx-auto mb-12">
                {children}
            </div>

            <div
                className="fixed bottom-0 bg-background border-t z-50 transition-all duration-300 ease-in-out"
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
                                // Step 1 has no previous step, so the caller routes it
                                // back to the Benefits list — hence it stays enabled.
                                disabled={busy}
                                title={isFirstStep ? "Back to Benefits" : undefined}
                                size="lg"
                            >
                                <ChevronLeft className="size-5" />
                                Previous
                            </LoadingButton>

                            <div className="flex gap-3">
                                {/* Hands off to the caller, which owns the meaning of
                                    "cancel" — Create Benefits asks "Are you sure?"
                                    before discarding, so no spinner belongs here. */}
                                {onCancel && (
                                    <LoadingButton
                                        variant="outline"
                                        size="lg"
                                        onClick={handleCancel}
                                        disabled={busy}
                                        title="Discard this benefit draft and return to Benefits"
                                        className="text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                                    >
                                        Cancel
                                    </LoadingButton>
                                )}
                                {isLastStep ? (
                                    <LoadingButton
                                        size="lg"
                                        onClick={handleComplete}
                                        isLoading={isLoading || isProcessing}
                                        loadingText="Completing..."
                                        disabled={busy}
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
                                        disabled={busy}
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
