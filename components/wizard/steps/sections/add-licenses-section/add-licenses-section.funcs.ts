import { License } from "@/types/wizard";

export interface AddLicensesState {
  expandedStates: string[];
}

export interface AddLicensesActions {
  onLicensesChange: (licenses: License[]) => void;
  onAddState: () => void;
  onChangeState: (oldState: string, newState: string) => void;
  onAddLicenseToState: (state: string) => void;
  onUpdateLicense: (id: string, updates: Partial<License>) => void;
  onRemoveLicense: (id: string) => void;
  onDuplicateLicense: (id: string) => void;
  onDuplicateState: (state: string) => void;
  onRemoveState: (state: string) => void;
  onToggleStateExpansion: (state: string) => void;
}

export const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "Outside US",
];

export const createNewLicense = (state: string): License => ({
  id: Date.now().toString(),
  state: state,
  type: "" as any,
  number: "",
});

export const createDuplicateLicense = (originalLicense: License): License => ({
  ...originalLicense,
  id: Date.now().toString(),
  number: "", // Reset license number for the duplicate
});

export const createDuplicateLicensesForState = (stateLicenses: License[], newState: string): License[] => {
  return stateLicenses.map((license) => ({
    ...license,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    state: newState,
    number: "", // Reset license numbers for duplicates
  }));
};
