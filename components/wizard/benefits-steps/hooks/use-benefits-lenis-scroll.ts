import { useEffect, useRef, useCallback } from "react";
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

    // Scroll the editor panel to an absolute offset. Uses the dedicated editor
    // Lenis instance when present (it drives the wrapper's scroll and would
    // otherwise override a raw `wrapper.scrollTo`), falling back to a native
    // scroll. Retries briefly because the editor Lenis instance may still be
    // initializing when validation first opens the panel.
    const scrollEditorTo = useCallback((top: number) => {
        const clamped = Math.max(0, top);
        const attempt = (n: number) => {
            const wrapper = editorScrollContainerRef.current;
            if (lenisEditorRef.current) {
                lenisEditorRef.current.scrollTo(clamped, { duration: 0.8 });
                return;
            }
            if (wrapper) {
                wrapper.scrollTo({ top: clamped, behavior: "smooth" });
            }
            if (n < 6) {
                setTimeout(() => attempt(n + 1), 120);
            }
        };
        attempt(0);
    }, []);

    return {
        editorScrollContainerRef,
        scrollEditorTo,
    };
}
