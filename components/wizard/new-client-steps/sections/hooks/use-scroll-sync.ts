import { useEffect, useRef, useCallback } from "react";

export function useScrollSync(
  isEditorOpen: boolean,
  editorScrollContainerRef: React.RefObject<HTMLDivElement>,
  brandingPreviewCardRef: React.RefObject<HTMLDivElement>,
  bannerPreviewSectionRef: React.RefObject<HTMLDivElement>,
  missionFieldsRef: React.RefObject<HTMLDivElement>,
  scrollSyncSourceRef: React.MutableRefObject<"main" | "editor" | null>,
  isUserTypingRef: React.MutableRefObject<boolean>,
) {
  useEffect(() => {
    if (
      !isEditorOpen ||
      !editorScrollContainerRef.current ||
      !brandingPreviewCardRef.current
    ) {
      return;
    }

    const editorContainer = editorScrollContainerRef.current;
    const brandingCard = brandingPreviewCardRef.current;
    const bannerSection = bannerPreviewSectionRef.current;

    let lastScrollY = window.scrollY;
    let capturedScrollY = window.scrollY;
    let scrollTimeout: NodeJS.Timeout | null = null;
    let rafId: number | null = null;

    const observerOptions = {
      root: null,
      rootMargin: "-5% 0px -5% 0px",
      threshold: [
        0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6,
        0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1,
      ],
    };

    const syncEditorScroll = () => {
      if (scrollSyncSourceRef.current !== null) return;
      if (isUserTypingRef.current) return;

      const allSections: HTMLElement[] = [];
      if (bannerSection) {
        allSections.push(bannerSection);
      }
      if (brandingCard) {
        const previewSections = brandingCard.querySelectorAll(
          "[data-preview-section]",
        );
        previewSections.forEach((section) => {
          allSections.push(section as HTMLElement);
        });
      }

      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < capturedScrollY;
      const isNearTop = currentScrollY < 100;

      if ((isScrollingUp && isNearTop) || currentScrollY === 0) {
        if (bannerSection) {
          const bannerRect = bannerSection.getBoundingClientRect();
          if (bannerRect.bottom > 0 && bannerRect.top < window.innerHeight) {
            scrollSyncSourceRef.current = "main";
            editorContainer.scrollTo({
              top: 0,
              behavior: "smooth",
            });
            setTimeout(() => {
              scrollSyncSourceRef.current = null;
            }, 500);
            return;
          }
        }
      }

      let closestSection: HTMLElement | null = null;
      let minDistance = Infinity;
      const viewportCenter = window.innerHeight / 2;

      for (const section of allSections) {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);

        if (
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          distance < minDistance
        ) {
          minDistance = distance;
          closestSection = section;
        }
      }

      if (!closestSection) return;

      const sectionId = closestSection.getAttribute("data-preview-section");
      if (!sectionId) return;

      const editorSection = editorContainer.querySelector(
        `[data-section-id="${sectionId}"]`,
      ) as HTMLElement;

      if (editorSection) {
        scrollSyncSourceRef.current = "main";

        if (sectionId === "banner") {
          editorContainer.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        } else {
          if (sectionId === "mission" && missionFieldsRef.current) {
            const element = missionFieldsRef.current;
            const elementRect = element.getBoundingClientRect();
            const containerRect = editorContainer.getBoundingClientRect();

            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + editorContainer.scrollTop;
            const elementBottomRelativeToContainer =
              elementTopRelativeToContainer + elementRect.height;

            const containerHeight = editorContainer.clientHeight;
            const containerScrollHeight = editorContainer.scrollHeight;

            const targetScrollTop =
              elementBottomRelativeToContainer - containerHeight;

            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(
              Math.max(0, targetScrollTop),
              maxScrollTop,
            );

            editorContainer.scrollTo({
              top: finalScrollTop,
              behavior: "smooth",
            });
          } else {
            const elementRect = editorSection.getBoundingClientRect();
            const containerRect = editorContainer.getBoundingClientRect();

            const elementTopRelativeToContainer =
              elementRect.top - containerRect.top + editorContainer.scrollTop;
            const elementBottomRelativeToContainer =
              elementTopRelativeToContainer + elementRect.height;
            const containerHeight = containerRect.height;
            const containerScrollHeight = editorContainer.scrollHeight;

            const paddingBottom = 20;
            const targetScrollTop =
              elementBottomRelativeToContainer -
              containerHeight +
              paddingBottom;

            const maxScrollTop = containerScrollHeight - containerHeight;
            const finalScrollTop = Math.min(
              Math.max(0, targetScrollTop),
              maxScrollTop,
            );

            editorContainer.scrollTo({
              top: finalScrollTop,
              behavior: "smooth",
            });
          }
        }

        setTimeout(() => {
          scrollSyncSourceRef.current = null;
        }, 500);
      }
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (scrollSyncSourceRef.current !== null) return;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        syncEditorScroll();
      });
    };

    const observer = new IntersectionObserver(
      handleIntersection,
      observerOptions,
    );

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      capturedScrollY = lastScrollY;
      lastScrollY = currentScrollY;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      if (scrollSyncSourceRef.current === null) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          syncEditorScroll();
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const allSections: HTMLElement[] = [];

    if (bannerSection) {
      allSections.push(bannerSection);
    }

    if (brandingCard) {
      const previewSections = brandingCard.querySelectorAll(
        "[data-preview-section]",
      );
      previewSections.forEach((section) => {
        allSections.push(section as HTMLElement);
      });
    }

    allSections.forEach((section) => {
      observer.observe(section);
    });

    // Sync immediately on open
    syncEditorScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isEditorOpen]);
}

