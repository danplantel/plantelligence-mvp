import { ServiceType } from "@/types/wizard";
import {
  PRIMARY_SERVICE_CATEGORY_OPTIONS,
  categoriesToStep2Services,
  step2ServicesToCategories,
} from "@/lib/service-categories";

export interface ServicesState {
  selectedServices: ServiceType[];
}

export interface ServicesActions {
  onServiceToggle: (service: ServiceType) => void;
}

/** Same category labels as Settings (Primary Service Categories). Re-export for backward compat. */
export const serviceCategoryOptions = [...PRIMARY_SERVICE_CATEGORY_OPTIONS];

export { categoriesToStep2Services, step2ServicesToCategories };
