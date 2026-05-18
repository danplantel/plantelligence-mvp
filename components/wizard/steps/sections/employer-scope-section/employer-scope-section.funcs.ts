export interface EmployerScopeSectionProps {
  onScopeChange: (servesMultipleEmployers: boolean) => void;
}

export interface EmployerScopeState {
  servesMultipleEmployers: boolean;
}

export interface EmployerScopeActions {
  onScopeChange: (value: boolean) => void;
}

export const onScopeChangeInternal = (
  value: boolean,
  setServesMultipleEmployers: (value: boolean) => void,
  onScopeChange: (servesMultipleEmployers: boolean) => void
) => {
  setServesMultipleEmployers(value);
  onScopeChange(value);
};
