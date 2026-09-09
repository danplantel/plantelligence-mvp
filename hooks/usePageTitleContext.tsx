"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface PageTitleContextType {
  title: string;
  setTitle: (title: string) => void;
  /** Secondary label shown next to the page title (e.g. the selected plan's company name). */
  subtitle: string;
  setSubtitle: (subtitle: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(
  undefined,
);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  // A new page title resets any subtitle left behind by the previous page,
  // so a stale plan/company name never lingers after navigation. Pages that
  // render a subtitle re-apply it in their own effect after setting the title.
  const handleSetTitle = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setSubtitle("");
  }, []);

  return (
    <PageTitleContext.Provider
      value={{ title, setTitle: handleSetTitle, subtitle, setSubtitle }}
    >
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleContext() {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    return { title: "", setTitle: () => {}, subtitle: "", setSubtitle: () => {} };
  }
  return context;
}
