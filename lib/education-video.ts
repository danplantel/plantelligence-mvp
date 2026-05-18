import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IEducationPlans {
  educationPlans: string[];
}

interface IEducationPlansAction {
  updateEducationPlans: (educations: string[]) => void;
}

const useEducationPlansStore = create<
  IEducationPlans & { actions: IEducationPlansAction }
>()(
  persist(
    (set) => ({
      educationPlans: [],
      actions: {
        updateEducationPlans: (educationPlans: string[]) =>
          set((state) => ({ educationPlans })),
      },
    }),
    {
      name: "education-video-storage",
      getStorage: () => localStorage,
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !["actions"].includes(key)),
        ),
    },
  ),
);

export const useEducationPlansActions = () =>
  useEducationPlansStore((state) => state.actions);
export const useEducationPlans = () =>
  useEducationPlansStore((state) => state.educationPlans);

export default useEducationPlansStore;