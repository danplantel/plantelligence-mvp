/**
 * useBenefitEditorStore — holds the current editor session's BenefitData.
 * NOT persisted to localStorage. Populated from API on load, saved to API on save.
 *
 * This store replaces the localStorage-based video/file backup patterns
 * that previously existed in benefits-editor-panel.tsx and benefit-portal-preview.tsx.
 */

import { create } from "zustand";
import type { BenefitData } from "@/types/benefit";

export interface BenefitEditorState {
  /** The full benefit being edited (null until loaded from API) */
  benefit: BenefitData | null;

  /** Whether data is currently being loaded from API */
  loading: boolean;

  /** Whether a save is in progress */
  saving: boolean;

  /** Error message if load or save failed */
  error: string | null;

  // Actions
  /** Load benefit data from API response */
  hydrate: (data: BenefitData) => void;

  /** Update specific fields (partial merge) */
  update: (patch: Partial<BenefitData>) => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set saving state */
  setSaving: (saving: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset the store (called when leaving editor or switching categories) */
  reset: () => void;
}

const initialState = {
  benefit: null as BenefitData | null,
  loading: false,
  saving: false,
  error: null as string | null,
};

export const useBenefitEditorStore = create<BenefitEditorState>((set) => ({
  ...initialState,

  hydrate: (data: BenefitData) =>
    set({ benefit: data, loading: false, error: null }),

  update: (patch: Partial<BenefitData>) =>
    set((state) => {
      if (!state.benefit) return state;
      return {
        benefit: { ...state.benefit, ...patch },
        error: null,
      };
    }),

  setLoading: (loading: boolean) => set({ loading }),

  setSaving: (saving: boolean) => set({ saving }),

  setError: (error: string | null) => set({ error }),

  reset: () => set({ ...initialState }),
}));
