import { useState, useEffect, useRef } from "react";

const PREVIEW_TRANSITION_OFFSET_TOP = 480;
const PREVIEW_SCROLL_SENSITIVITY = 1.0;

export function usePreviewSticky(
  showPreview: boolean,
  isPreviewSticky: boolean,
  hidePreviewCard: boolean,
  overlaySettingsCardRef: React.RefObject<HTMLDivElement>,
) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [previewTranslateYPx, setPreviewTranslateYPx] = useState(0);
  const [isCardFixed, setIsCardFixed] = useState(false);
  const previewCardRef = useRef<HTMLDivElement | null>(null);
  const cardInitialTopRef = useRef<number | null>(null);
  const cardInitialLeftRef = useRef<number | null>(null);
  const cardInitialWidthRef = useRef<number | null>(null);
  const previewLastScrollYRef = useRef<number>(0);

  useEffect(() => {
    if (hidePreviewCard || !isPreviewSticky) return;
    const cardElement = previewCardRef.current;
    if (!cardElement || !showPreview) {
      setIsCardFixed(false);
      setPreviewTranslateYPx(0);
      cardInitialTopRef.current = null;
      return;
    }

    cardInitialTopRef.current = null;
    cardInitialLeftRef.current = null;
    cardInitialWidthRef.current = null;

    const updateInitialPosition = () => {
      if (cardElement && cardInitialTopRef.current === null) {
        const rect = cardElement.getBoundingClientRect();
        cardInitialTopRef.current = rect.top + window.scrollY;
        cardInitialLeftRef.current = rect.left;
        cardInitialWidthRef.current = rect.width;
      }
    };

    const handleScroll = () => {
      const cardElement = previewCardRef.current;
      if (!cardElement) return;

      if (
        cardInitialTopRef.current === null ||
        cardInitialLeftRef.current === null ||
        cardInitialWidthRef.current === null
      ) {
        updateInitialPosition();
        return;
      }

      const currentScrollY = window.scrollY;
      const headerHeight = 64;
      const cardTop = cardInitialTopRef.current;
      const cardTopRelativeToViewport = cardTop - currentScrollY;
      const threshold = headerHeight + 20;
      const shouldBeFixed = cardTopRelativeToViewport <= threshold;

      setIsCardFixed((prev) => {
        if (prev !== shouldBeFixed) {
          return shouldBeFixed;
        }
        return prev;
      });

      const overlaySettingsCard = overlaySettingsCardRef.current;
      let overlaySettingsTop = null;
      if (overlaySettingsCard) {
        const rect = overlaySettingsCard.getBoundingClientRect();
        overlaySettingsTop = rect.top + window.scrollY;
      }

      if (shouldBeFixed || currentScrollY > cardTop) {
        if (
          overlaySettingsTop !== null &&
          currentScrollY >= overlaySettingsTop - PREVIEW_TRANSITION_OFFSET_TOP
        ) {
          const startTransition =
            overlaySettingsTop - PREVIEW_TRANSITION_OFFSET_TOP;
          const scrollSinceStart = currentScrollY - startTransition;
          const maxTranslateYPx = -2000;
          const translateYPx = Math.max(
            maxTranslateYPx,
            -scrollSinceStart * PREVIEW_SCROLL_SENSITIVITY,
          );

          setPreviewTranslateYPx(translateYPx);
          const viewportHeight = window.innerHeight;
          const translateYVh = (translateYPx / viewportHeight) * 100;
          setIsPreviewVisible(translateYVh > -100);
        } else {
          setPreviewTranslateYPx(0);
          setIsPreviewVisible(true);
        }
      } else {
        setPreviewTranslateYPx(0);
        setIsPreviewVisible(true);
      }

      previewLastScrollYRef.current = currentScrollY;
    };

    updateInitialPosition();
    previewLastScrollYRef.current = window.scrollY;

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [showPreview, hidePreviewCard, isPreviewSticky]);

  useEffect(() => {
    if (hidePreviewCard) return;
    if (isPreviewSticky) {
      setIsCardFixed(false);
      setPreviewTranslateYPx(0);
      cardInitialTopRef.current = null;
      cardInitialLeftRef.current = null;
      cardInitialWidthRef.current = null;
    }
  }, [isPreviewSticky, hidePreviewCard]);

  return {
    isPreviewVisible,
    previewTranslateYPx,
    isCardFixed,
    previewCardRef,
    overlaySettingsCardRef,
    cardInitialLeftRef,
    cardInitialWidthRef,
  };
}

