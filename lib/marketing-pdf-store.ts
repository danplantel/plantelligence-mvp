import { create } from "zustand";

export interface MarketingDocument {
  id: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  language?: string;
  uploadedAt: string;
}

interface MarketingPdfStore {
  // Documents cache by clientId
  documentsCache: Record<string, MarketingDocument[]>;
  // Optimistic deletions - track documents being deleted
  deletingDocuments: Set<string>;
  // Loading states
  isLoading: Record<string, boolean>;
  // Last fetch time for cache invalidation
  lastFetchTime: Record<string, number>;

  // Actions
  fetchDocuments: (clientId: string) => Promise<void>;
  deleteDocument: (documentId: string, clientId: string) => Promise<boolean>;
  addDocument: (document: MarketingDocument, clientId: string) => void;
  updateDocument: (documentId: string, updates: Partial<MarketingDocument>, clientId: string) => void;
  clearCache: (clientId?: string) => void;
  getDocuments: (clientId: string) => MarketingDocument[];
  isDeleting: (documentId: string) => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useMarketingPdfStore = create<MarketingPdfStore>((set, get) => ({
  documentsCache: {},
  deletingDocuments: new Set(),
  isLoading: {},
  lastFetchTime: {},

  fetchDocuments: async (clientId: string) => {
    const state = get();
    
    // Check cache validity
    const lastFetch = state.lastFetchTime[clientId];
    const now = Date.now();
    if (lastFetch && now - lastFetch < CACHE_DURATION && state.documentsCache[clientId]) {
      return; // Use cached data
    }

    set((state) => ({
      isLoading: { ...state.isLoading, [clientId]: true },
    }));

    try {
      const response = await fetch(`/api/documents/client/${clientId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const clientDocs = Array.isArray(result.data) ? result.data : [];

        // Filter documents that are marketing PDFs
        const marketingDocs = clientDocs
          .filter((doc: any) => {
            // Must have fileUrl
            if (!doc.fileUrl || doc.fileUrl.trim() === "") {
              return false;
            }

            // Exclude SPD and SBC documents
            if (doc.type === "SPD" || doc.type === "SBC") {
              return false;
            }

            // Include documents with "Poster" in title or type "Document"
            if (
              doc.type === "Document" ||
              doc.title?.toLowerCase().includes("poster") ||
              doc.title?.toLowerCase().includes("marketing")
            ) {
              return true;
            }

            return false;
          })
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            language: doc.language,
            uploadedAt: doc.uploadedAt,
          })) as MarketingDocument[];

        set((state) => ({
          documentsCache: { ...state.documentsCache, [clientId]: marketingDocs },
          lastFetchTime: { ...state.lastFetchTime, [clientId]: Date.now() },
          isLoading: { ...state.isLoading, [clientId]: false },
        }));
      } else {
        throw new Error(result.error || "Failed to fetch documents");
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
      set((state) => ({
        isLoading: { ...state.isLoading, [clientId]: false },
      }));
      throw error;
    }
  },

  deleteDocument: async (documentId: string, clientId: string) => {
    const state = get();
    
    // Optimistic update - remove from cache immediately
    const currentDocs = state.documentsCache[clientId] || [];
    const updatedDocs = currentDocs.filter((doc) => doc.id !== documentId);
    
    set((state) => ({
      documentsCache: { ...state.documentsCache, [clientId]: updatedDocs },
      deletingDocuments: new Set([...Array.from(state.deletingDocuments), documentId]),
    }));

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Rollback on error
        set((state) => ({
          documentsCache: { ...state.documentsCache, [clientId]: currentDocs },
          deletingDocuments: new Set(
            Array.from(state.deletingDocuments).filter((id) => id !== documentId)
          ),
        }));
        throw new Error("Failed to delete document");
      }

      // Success - keep the optimistic update
      set((state) => ({
        deletingDocuments: new Set(
          Array.from(state.deletingDocuments).filter((id) => id !== documentId)
        ),
      }));

      return true;
    } catch (error) {
      console.error("Delete error:", error);
      // Rollback already handled above
      return false;
    }
  },

  addDocument: (document: MarketingDocument, clientId: string) => {
    set((state) => {
      const currentDocs = state.documentsCache[clientId] || [];
      // Check if document already exists (avoid duplicates)
      const exists = currentDocs.some((doc) => doc.id === document.id);
      if (exists) {
        return state;
      }
      return {
        documentsCache: {
          ...state.documentsCache,
          [clientId]: [document, ...currentDocs],
        },
      };
    });
  },

  updateDocument: (
    documentId: string,
    updates: Partial<MarketingDocument>,
    clientId: string
  ) => {
    set((state) => {
      const currentDocs = state.documentsCache[clientId] || [];
      const updatedDocs = currentDocs.map((doc) =>
        doc.id === documentId ? { ...doc, ...updates } : doc
      );
      return {
        documentsCache: {
          ...state.documentsCache,
          [clientId]: updatedDocs,
        },
      };
    });
  },

  clearCache: (clientId?: string) => {
    if (clientId) {
      set((state) => {
        const newCache = { ...state.documentsCache };
        delete newCache[clientId];
        const newLastFetch = { ...state.lastFetchTime };
        delete newLastFetch[clientId];
        return {
          documentsCache: newCache,
          lastFetchTime: newLastFetch,
        };
      });
    } else {
      set({
        documentsCache: {},
        lastFetchTime: {},
      });
    }
  },

  getDocuments: (clientId: string) => {
    return get().documentsCache[clientId] || [];
  },

  isDeleting: (documentId: string) => {
    return get().deletingDocuments.has(documentId);
  },
}));

