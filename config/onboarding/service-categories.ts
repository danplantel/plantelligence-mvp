/**
 * Primary service-category option list.
 *
 * The canonical definitions (and the id ↔ label mapping to `ServiceType`) live
 * in `lib/service-categories.ts`; this module re-exports them so everything the
 * onboarding rule calls "config" is reachable from one place.
 */
export {
  PRIMARY_SERVICE_CATEGORY_OPTIONS,
  type PrimaryServiceCategory,
  categoryToStep2ServiceType,
  step2ServiceTypeToCategory,
  categoriesToStep2Services,
  step2ServicesToCategories,
  getDocumentCategoryDisplayLabel,
  normalizePrimaryServiceCategories,
} from "@/lib/service-categories";
