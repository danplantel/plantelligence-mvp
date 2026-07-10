"use client";

import { useState, useEffect, useRef } from "react";

export function useBenefitsEditorState() {
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isEditorAnimating, setIsEditorAnimating] = useState(false);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [highlightedField, setHighlightedField] = useState<string | null>(null);

    // Listen for editor toggle events
    useEffect(() => {
        const handleOpenEditor = (event: any) => {
            const sectionId = event.detail?.sectionId || null;
            const fieldId = event.detail?.fieldId || null;

            setActiveSection(sectionId);
            setHighlightedField(fieldId);
            setIsEditorOpen(true);
            setTimeout(() => setIsEditorAnimating(true), 10);
        };

        const handleCloseEditorEvent = () => {
            handleCloseEditor();
        };

        window.addEventListener("openBenefitsEditor" as any, handleOpenEditor);
        window.addEventListener("closeBenefitsEditor" as any, handleCloseEditorEvent);

        return () => {
            window.removeEventListener("openBenefitsEditor" as any, handleOpenEditor);
            window.removeEventListener("closeBenefitsEditor" as any, handleCloseEditorEvent);
        };
    }, []);

    // Broadcast editor state changes for the wizard sidebar logic
    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent("step5EditorStateChange", {
                detail: { isOpen: isEditorOpen },
            }),
        );
    }, [isEditorOpen]);

    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCloseEditor = () => {
        setIsEditorAnimating(false);
        setActiveSection(null);
        setHighlightedField(null);
        closeTimerRef.current = setTimeout(() => {
            setIsEditorOpen(false);
            closeTimerRef.current = null;
        }, 200);
    };

    // Clear any pending close timer on unmount to prevent stale state updates
    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    return {
        isEditorOpen,
        isEditorAnimating,
        activeSection,
        highlightedField,
        setIsEditorOpen,
        setIsEditorAnimating,
        setActiveSection,
        setHighlightedField,
        handleCloseEditor,
    };
}
