import { useEffect, useRef } from "react";
import Lenis from "@studio-freight/lenis";

export function useBenefitsLenisScroll(isEditorOpen: boolean, disableMain?: boolean) {
    const lenisRef = useRef<Lenis | null>(null);
    const lenisRafIdRef = useRef<number | null>(null);
    const lenisEditorRef = useRef<Lenis | null>(null);
    const lenisEditorRafIdRef = useRef<number | null>(null);
    const editorScrollContainerRef = useRef<HTMLDivElement>(null);
    const mainScrollPercentRef = useRef(0);

    // Enable Lenis smooth scroll for main page
    // Skip when disableMain is true (e.g. Step 2 where the preview uses native scroll)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (disableMain) return;

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
    }, [disableMain]);

    // Lenis instance for the side editor panel — fully independent from main scroll
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

        const raf = (time: number) => {
            lenis.raf(time);
            lenisEditorRafIdRef.current = requestAnimationFrame(raf);
        };
        lenisEditorRafIdRef.current = requestAnimationFrame(raf);

        return () => {
            if (lenisEditorRafIdRef.current !== null) {
                cancelAnimationFrame(lenisEditorRafIdRef.current);
                lenisEditorRafIdRef.current = null;
            }
            lenis.destroy();
            lenisEditorRef.current = null;
        };
    }, [isEditorOpen]);

    return {
        editorScrollContainerRef,
    };
}
