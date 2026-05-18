import { useEffect, useRef, useCallback } from "react";
import Lenis from "@studio-freight/lenis";

export function useBenefitsLenisScroll(isEditorOpen: boolean) {
    const lenisRef = useRef<Lenis | null>(null);
    const lenisRafIdRef = useRef<number | null>(null);
    const lenisEditorRef = useRef<Lenis | null>(null);
    const lenisEditorRafIdRef = useRef<number | null>(null);
    const editorScrollContainerRef = useRef<HTMLDivElement>(null);
    const editorManualScrollAtRef = useRef(0);
    const mainScrollPercentRef = useRef(0);
    const scrollSyncSourceRef = useRef<"main" | "editor" | null>(null);
    const lastSyncAtRef = useRef(0);

    const syncEditorScrollToPercent = useCallback((percent: number) => {
        const el = editorScrollContainerRef.current;
        if (!el) return;

        const clamped = Math.max(0, Math.min(100, percent));
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable <= 0) return;

        const target = (clamped / 100) * scrollable;

        if (lenisEditorRef.current) {
            lenisEditorRef.current.scrollTo(target, { immediate: true });
        } else {
            el.scrollTop = target;
        }
    }, []);

    const syncMainScrollToPercent = useCallback((percent: number) => {
        if (!lenisRef.current) return;

        const clamped = Math.max(0, Math.min(100, percent));
        const scrollable =
            document.documentElement.scrollHeight - window.innerHeight;

        if (scrollable <= 0) return;

        const target = (clamped / 100) * scrollable;
        lenisRef.current.scrollTo(target, { immediate: true });
    }, []);

    const syncScroll = useCallback(
        (source: "main" | "editor", percent: number) => {
            const now = performance.now();

            if (
                scrollSyncSourceRef.current &&
                scrollSyncSourceRef.current !== source
            ) {
                return;
            }

            if (now - lastSyncAtRef.current < 16) return;

            scrollSyncSourceRef.current = source;
            lastSyncAtRef.current = now;

            if (source === "main") {
                syncEditorScrollToPercent(percent);
            } else {
                syncMainScrollToPercent(percent);
            }

            requestAnimationFrame(() => {
                scrollSyncSourceRef.current = null;
            });
        },
        [syncEditorScrollToPercent, syncMainScrollToPercent],
    );

    // Enable Lenis smooth scroll for main page
    useEffect(() => {
        if (typeof window === "undefined") return;

        const lenis = new Lenis({
            duration: 0.8,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
        lenisRef.current = lenis;

        const handleLenisScroll = ({
            scroll,
            limit,
        }: {
            scroll: number;
            limit: number;
        }) => {
            const percent = limit > 0 ? (scroll / limit) * 100 : 0;
            mainScrollPercentRef.current = percent;

            if (!isEditorOpen) return;

            const now = performance.now();
            if (now - editorManualScrollAtRef.current < 300) {
                return;
            }

            syncScroll("main", percent);
        };

        lenis.on("scroll", handleLenisScroll);

        const raf = (time: number) => {
            lenis.raf(time);
            lenisRafIdRef.current = requestAnimationFrame(raf);
        };

        lenisRafIdRef.current = requestAnimationFrame(raf);

        return () => {
            lenis.off("scroll", handleLenisScroll);
            if (lenisRafIdRef.current !== null) {
                cancelAnimationFrame(lenisRafIdRef.current);
                lenisRafIdRef.current = null;
            }
            lenis.destroy();
            lenisRef.current = null;
        };
    }, [syncScroll, isEditorOpen]);

    // Lenis instance for the side editor panel
    useEffect(() => {
        if (!isEditorOpen) return;

        const wrapper = editorScrollContainerRef.current;
        if (!wrapper) return;

        const content = wrapper.querySelector(
            "[data-lenis-content]",
        ) as HTMLElement | null;
        if (!content) return;

        const lenis = new Lenis({
            wrapper,
            content,
            duration: 0.9,
        });

        lenisEditorRef.current = lenis;

        // Initial sync from main to editor to prevent jump-to-top
        const mainScrollPercent = mainScrollPercentRef.current;
        if (mainScrollPercent > 0) {
            const scrollable = wrapper.scrollHeight - wrapper.clientHeight;
            if (scrollable > 0) {
                const target = (mainScrollPercent / 100) * scrollable;
                lenis.scrollTo(target, { immediate: true });
            }
        }

        const handleEditorScroll = ({
            scroll,
            limit,
        }: {
            scroll: number;
            limit: number;
        }) => {
            const percent = limit > 0 ? (scroll / limit) * 100 : 0;
            syncScroll("editor", percent);
        };

        lenis.on("scroll", handleEditorScroll);

        const raf = (time: number) => {
            lenis.raf(time);
            lenisEditorRafIdRef.current = requestAnimationFrame(raf);
        };
        lenisEditorRafIdRef.current = requestAnimationFrame(raf);

        return () => {
            lenis.off("scroll", handleEditorScroll);
            if (lenisEditorRafIdRef.current !== null) {
                cancelAnimationFrame(lenisEditorRafIdRef.current);
                lenisEditorRafIdRef.current = null;
            }
            lenis.destroy();
            lenisEditorRef.current = null;
        };
    }, [isEditorOpen, syncScroll]);

    // Track manual scrolls inside the editor
    useEffect(() => {
        const wrapper = editorScrollContainerRef.current;
        if (!wrapper) return;

        const markManual = () => {
            editorManualScrollAtRef.current = performance.now();
        };

        wrapper.addEventListener("wheel", markManual, { passive: true });
        wrapper.addEventListener("touchmove", markManual, { passive: true });

        return () => {
            wrapper.removeEventListener("wheel", markManual);
            wrapper.removeEventListener("touchmove", markManual);
        };
    }, []);

    return {
        editorScrollContainerRef,
        scrollSyncSourceRef,
    };
}
