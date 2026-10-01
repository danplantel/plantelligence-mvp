import benefitCategoryBackgrounds from "@/data/gallery-benefit-category-backgrounds.json";

/**
 * Curated backgrounds for the "add default photo" gallery, keyed by benefit category.
 *
 * Extracted from Step 1 so Step 1's Branding accordion and Step 2's editor panel offer
 * the SAME imagery for the same `brandImages.header` slot — they are two views of one
 * field, and a field whose "default photo" differs by which screen you are on is a bug
 * waiting to be reported.
 *
 * The shape mirrors `GalleryBackground` in `components/ui/modalGallery.tsx`, which is
 * the consumer: ModalGallery's `images` prop is structurally typed, so this list can be
 * passed straight in without the two declaring a shared type.
 */
export interface GalleryBackground {
  id: string;
  title: string;
  category: string;
  mode: string;
  src: string;
  altText: string;
}

/** Per-benefit-category gallery images, aligned to the gallery metadata category. */
export const BENEFIT_CATEGORY_GALLERY =
  benefitCategoryBackgrounds as unknown as Record<string, GalleryBackground[]>;

/**
 * Map a benefit-category label to its gallery key.
 *
 * Custom / Company hubs map to the "Wellness" metadata category. Unknown/other
 * categories return null so the default (benefit-hub) gallery is used.
 */
export function toCategoryGalleryKey(
  category?: string,
): "Retirement" | "Group Health" | "Group Life" | "Wellness" | null {
  const c = (category || "").trim().toLowerCase();
  if (c === "retirement") return "Retirement";
  if (c === "group health" || c === "health") return "Group Health";
  if (c === "group life" || c === "life") return "Group Life";
  if (
    c === "custom" ||
    c === "company / plan sponsor" ||
    c === "wellness"
  ) {
    return "Wellness";
  }
  return null;
}
