"use client";

import { useState, useEffect } from "react";

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

    // Broadcast editor state changes for the wizard sidebar logic.
    // Uses a benefits-specific event name so the new-client wizard's
    // sidebar-widening logic (which listens for "step5EditorStateChange")
    // does not interfere with the benefits Elementor layout.
    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent("benefitsEditorStateChange", {
                detail: { isOpen: isEditorOpen },
            }),
        );
    }, [isEditorOpen]);

    const handleCloseEditor = () => {
        setIsEditorAnimating(false);
        setActiveSection(null);
        setHighlightedField(null);
        setTimeout(() => {
            setIsEditorOpen(false);
        }, 200);
    };

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
