"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface ClientData {
  id: string;
  companyName: string;
  companyWebsite?: string;
  companyLogo?: string;
  logoFileName?: string;
  brandColor: string;
  secondaryColor: string;
  missionHeadline?: string;
  missionBody?: string;
  appointmentLink?: string;
  heroTitle?: string;
  heroDescription?: string;
  backgroundImg?: string;
  backgroundImgName?: string;
  secondaryBannerImg?: string;
  secondaryBannerImgName?: string;
  disclaimers?: string;
  keyContacts: any[];
  documents?: any[];
  employeePortalPreview?: any;
  categoryPortalVisibility?: Record<string, boolean>;
  spdFile?: string;
  spdFileName?: string;
  sbcFiles?: any[];
  optionalFiles?: any[];
  provideSpanishVersions: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientPortalContextType {
  clientData: ClientData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ClientPortalContext = createContext<ClientPortalContextType>({
  clientData: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function useClientPortal() {
  const context = useContext(ClientPortalContext);
  if (!context) {
    throw new Error("useClientPortal must be used within ClientPortalProvider");
  }
  return context;
}

export function ClientPortalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const clientId = params.id as string;

  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClient = useCallback(async (silent = false) => {
    if (!clientId) return;
    try {
      if (!silent) setLoading(true);
      const url = silent
        ? `/api/clients/${clientId}?t=${Date.now()}&forPortal=1`
        : `/api/clients/${clientId}?forPortal=1`;
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        if (response.status === 404) {
          setError("Client not found");
        } else {
          setError("Failed to load client data");
        }
        return;
      }

      const result = await response.json();
      if (result.success) {
        // Brokers only see portal data after session + ownership checks in GET /api/clients/[id].
        // Draft plans must still preview at /new/view/[id] (wizard + flyers); Archived stays hidden.
        const s = String(result.data.status ?? "");
        if (s === "Archived") {
          setError("Client not found");
          return;
        }
        setClientData(result.data);
      } else {
        setError("Failed to load client data");
      }
    } catch (err) {
      console.error("Error fetching client:", err);
      setError("Failed to load client data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient(false);
  }, [fetchClient]);

  const refetch = useCallback(() => fetchClient(true), [fetchClient]);

  useEffect(() => {
    if (!clientId) return;

    const refetchIfMatch = (e: Event) => {
      const d = (e as CustomEvent<{ clientId?: string }>).detail;
      if (d?.clientId && d.clientId === clientId) {
        void fetchClient(true);
      }
    };

    window.addEventListener("plan-documents-persisted", refetchIfMatch);
    window.addEventListener("benefits-updated", refetchIfMatch);

    return () => {
      window.removeEventListener("plan-documents-persisted", refetchIfMatch);
      window.removeEventListener("benefits-updated", refetchIfMatch);
    };
  }, [clientId, fetchClient]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF6]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !clientData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF6]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
          <p className="text-gray-600">
            The client portal you're looking for doesn't exist or is no longer
            available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClientPortalContext.Provider value={{ clientData, loading, error, refetch }}>
      {children}
    </ClientPortalContext.Provider>
  );
}
