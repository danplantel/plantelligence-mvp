"use client";

import { createContext, useContext, useState, useEffect } from "react";
import InviteCodeModal from "@/components/modals/invite-code-modal";
import { isStandaloneDisplay } from "@/lib/pwa/install-prompt";

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

    /**
     * A downloaded (installed) PWA opens straight into the plan's portal — its
     * manifest `start_url` is `/<slug>` — so the Early Access gate must not stand
     * between the participant and their benefits.
     *
     * The gate's pass is a `localStorage` key, and an installed app can run in its
     * own storage partition (iOS home-screen apps, and first launches that never
     * passed the gate in a browser), which made the very first launch of the
     * downloaded app show the invite-code screen. Standalone display mode is the
     * reliable signal that this IS the installed app, so it skips the gate
     * unconditionally; every browser session keeps the existing behaviour.
     */
    if (isStandaloneDisplay()) {
      setIsAuthenticated(true);
      setShowModal(false);
      return;
    }

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
