"use client";

import { createContext, useContext, useState, useEffect } from "react";
import InviteCodeModal from "@/components/modals/invite-code-modal";

interface InviteCodeContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

const InviteCodeContext = createContext<InviteCodeContextType | undefined>(
  undefined,
);

export function InviteCodeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const hasAuthenticated = localStorage.getItem(
      "plantelligence_authenticated",
    );
    if (hasAuthenticated === "true") {
      setIsAuthenticated(true);
      setShowModal(false);
    } else {
      setShowModal(true);
    }
  }, []);

  const handleClose = () => {
    setShowModal(false);
    setIsAuthenticated(true);
    localStorage.setItem("plantelligence_authenticated", "true");
  };

  return (
    <InviteCodeContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      {!isClient ? (
        // Show loading state during hydration
        <div>Loading...</div>
      ) : !isAuthenticated ? (
        <InviteCodeModal open={showModal} handleClose={handleClose} />
      ) : (
        children
      )}
    </InviteCodeContext.Provider>
  );
}

export function useInviteCode() {
  const context = useContext(InviteCodeContext);
  if (context === undefined) {
    throw new Error("useInviteCode must be used within an InviteCodeProvider");
  }
  return context;
}
