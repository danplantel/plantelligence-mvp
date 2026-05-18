import { useState, useEffect, useRef } from "react";

export function useEditorState(
  options: { autoOpen?: boolean } = { autoOpen: true },
) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorAnimating, setIsEditorAnimating] = useState(false);
  const [focusedTextField, setFocusedTextField] = useState<
    "headline" | "body" | null
  >(null);
  const [heroTextField, setHeroTextField] = useState<
    "title" | "description" | null
  >(null);

  // Auto-open side panel when landing on Step 2
  useEffect(() => {
    if (options.autoOpen) {
      setIsEditorOpen(true);
      setTimeout(() => setIsEditorAnimating(true), 10);
    }
  }, [options.autoOpen]);

  // Listen for editor toggle events from WizardStepper
  useEffect(() => {
    const handleOpenEditor = () => {
      setIsEditorOpen(true);
      setTimeout(() => setIsEditorAnimating(true), 10);
    };

    const handleCloseEditorEvent = () => {
      handleCloseEditor();
    };

    window.addEventListener("openStep2Editor" as any, handleOpenEditor);
    window.addEventListener("closeStep2Editor" as any, handleCloseEditorEvent);

    return () => {
      window.removeEventListener("openStep2Editor" as any, handleOpenEditor);
      window.removeEventListener(
        "closeStep2Editor" as any,
        handleCloseEditorEvent,
      );
    };
  }, []);

  // Broadcast editor state changes to WizardStepper
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("step2EditorStateChange", {
        detail: { isOpen: isEditorOpen },
      }),
    );
  }, [isEditorOpen]);

  const handleCloseEditor = () => {
    setIsEditorAnimating(false);
    setFocusedTextField(null);
    setHeroTextField(null);
    setTimeout(() => {
      setIsEditorOpen(false);
    }, 200);
  };

  return {
    isEditorOpen,
    isEditorAnimating,
    focusedTextField,
    heroTextField,
    setIsEditorOpen,
    setIsEditorAnimating,
    setFocusedTextField,
    setHeroTextField,
    handleCloseEditor,
  };
}

