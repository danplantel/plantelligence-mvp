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
  insurancePlanId?: string;
  insuranceLoginUrl?: string;
  insuranceBackgroundImage?: string;
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

  // Loading skeleton — mimics the portal layout structure
  if (loading) {
    return (
      <div className="min-h-screen bg-white animate-pulse">
        {/* Fixed header skeleton */}
        <div className="fixed top-0 left-0 w-full z-50 bg-white border-b border-gray-100">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="h-8 w-8 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>

        {/* Hero banner skeleton */}
        <div className="pt-16">
          <div className="h-[320px] bg-gray-100 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="h-8 w-64 bg-gray-200 rounded mx-auto" />
              <div className="h-4 w-96 bg-gray-200 rounded mx-auto" />
            </div>
          </div>
        </div>

        {/* Benefit cards skeleton */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-gray-50 p-6 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-gray-200" />
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-gray-200 rounded" />
                  <div className="h-3 w-3/4 bg-gray-200 rounded" />
                </div>
                <div className="h-10 w-full rounded-lg bg-gray-200" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer skeleton */}
        <div className="border-t border-gray-100 mt-12">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="h-4 w-48 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (error || (!clientData && !loading)) {
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
