import { useEffect, useRef, useCallback } from "react";

export function useFieldFocus(
  isEditorOpen: boolean,
  isEditorAnimating: boolean,
  focusedTextField: "headline" | "body" | null,
  heroTextField: "title" | "description" | null,
  headlineRef: React.RefObject<HTMLInputElement>,
  bodyTextRef: React.RefObject<HTMLTextAreaElement>,
  editorScrollContainerRef: React.RefObject<HTMLDivElement>,
  missionFieldsRef: React.RefObject<HTMLDivElement>,
  scrollToMissionFields: () => void,
) {
  const scrollToBannerTitleSection = useCallback(() => {
    if (!editorScrollContainerRef.current) return;

    const headlineInput = document.querySelector(
      '[data-field="headline"]',
    ) as HTMLInputElement;
    if (!headlineInput) return;

    const element = headlineInput;
    const container = editorScrollContainerRef.current;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const elementTopRelativeToContainer =
      elementRect.top - containerRect.top + container.scrollTop;
    const elementBottomRelativeToContainer =
      elementTopRelativeToContainer + elementRect.height;

    const containerHeight = containerRect.height;
    const containerScrollHeight = container.scrollHeight;

    const targetScrollTop =
      elementTopRelativeToContainer - containerHeight / 2 + elementRect.height / 2;

    const maxScrollTop = containerScrollHeight - containerHeight;
    const finalScrollTop = Math.min(
      Math.max(0, targetScrollTop),
      maxScrollTop,
    );

    container.scrollTo({
      top: finalScrollTop,
      behavior: "smooth",
    });

    setTimeout(() => {
      headlineInput.focus();
      headlineInput.select();
    }, 100);
  }, [editorScrollContainerRef]);

  const scrollToBodyTextSection = useCallback(() => {
    if (!editorScrollContainerRef.current) return;

    const bodyTextarea = document.querySelector(
      '[data-field="bodyText"]',
    ) as HTMLTextAreaElement;
    if (!bodyTextarea) return;

    const element = bodyTextarea;
    const container = editorScrollContainerRef.current;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const elementTopRelativeToContainer =
      elementRect.top - containerRect.top + container.scrollTop;
    const elementBottomRelativeToContainer =
      elementTopRelativeToContainer + elementRect.height;

    const containerHeight = containerRect.height;
    const containerScrollHeight = container.scrollHeight;

    const targetScrollTop =
      elementTopRelativeToContainer - containerHeight / 2 + elementRect.height / 2;

    const maxScrollTop = containerScrollHeight - containerHeight;
    const finalScrollTop = Math.min(
      Math.max(0, targetScrollTop),
      maxScrollTop,
    );

    container.scrollTo({
      top: finalScrollTop,
      behavior: "smooth",
    });

    setTimeout(() => {
      bodyTextarea.focus();
      bodyTextarea.setSelectionRange(0, 0);
    }, 100);
  }, [editorScrollContainerRef]);

  // Focus the appropriate field when modal opens and animation completes
  useEffect(() => {
    if (isEditorOpen && isEditorAnimating && focusedTextField) {
      const focusTimeout = setTimeout(() => {
        if (focusedTextField === "headline" && headlineRef.current) {
          headlineRef.current.focus();
          if (headlineRef.current.value && headlineRef.current.value.trim()) {
            headlineRef.current.select();
          } else {
            headlineRef.current.focus();
            setTimeout(() => {
              if (headlineRef.current) {
                headlineRef.current.focus();
              }
            }, 10);
          }
          scrollToMissionFields();
        } else if (focusedTextField === "body" && bodyTextRef.current) {
          bodyTextRef.current.focus();
          if (bodyTextRef.current.value && bodyTextRef.current.value.trim()) {
            bodyTextRef.current.select();
          } else {
            bodyTextRef.current.focus();
            setTimeout(() => {
              if (bodyTextRef.current) {
                bodyTextRef.current.focus();
              }
            }, 10);
          }
          scrollToMissionFields();
        }
      }, 350);

      return () => clearTimeout(focusTimeout);
    }
  }, [
    isEditorOpen,
    isEditorAnimating,
    focusedTextField,
    headlineRef,
    bodyTextRef,
    scrollToMissionFields,
  ]);

  // Focus hero text field when editor opens
  useEffect(() => {
    if (isEditorOpen && isEditorAnimating && heroTextField) {
      const focusTimeout = setTimeout(() => {
        if (heroTextField === "title") {
          scrollToBannerTitleSection();
        } else if (heroTextField === "description") {
          scrollToBodyTextSection();
        }
      }, 350);

      return () => clearTimeout(focusTimeout);
    }
  }, [
    isEditorOpen,
    isEditorAnimating,
    heroTextField,
    scrollToBannerTitleSection,
    scrollToBodyTextSection,
  ]);

  // Scroll to fields when user manually focuses on them
  useEffect(() => {
    const handleHeadlineFocus = () => {
      scrollToMissionFields();
    };
    const handleBodyFocus = () => {
      scrollToMissionFields();
    };

    const timeoutId = setTimeout(() => {
      const headlineElement = headlineRef.current;
      const bodyElement = bodyTextRef.current;

      if (headlineElement) {
        headlineElement.addEventListener("focus", handleHeadlineFocus);
      }
      if (bodyElement) {
        bodyElement.addEventListener("focus", handleBodyFocus);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const headlineElement = headlineRef.current;
      const bodyElement = bodyTextRef.current;
      if (headlineElement) {
        headlineElement.removeEventListener("focus", handleHeadlineFocus);
      }
      if (bodyElement) {
        bodyElement.removeEventListener("focus", handleBodyFocus);
      }
    };
  }, [scrollToMissionFields, isEditorOpen, headlineRef, bodyTextRef]);
}

