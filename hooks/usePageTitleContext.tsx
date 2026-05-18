"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface PageTitleContextType {
  title: string;
  setTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(
  undefined,
);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");

  const handleSetTitle = (newTitle: string) => {
    setTitle(newTitle);
  };

  return (
    <PageTitleContext.Provider value={{ title, setTitle: handleSetTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleContext() {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    return { title: "", setTitle: () => {} };
  }
  return context;
}
