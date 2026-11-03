import type {
  BrandImageData,
  BrandImagesData,
} from "@/types/new-client-wizard";

/**
 * The plan's Brand Images, in the shape `BrandImagesSection` expects.
 *
 * The portal payload stores some slots in `brandImages` and the older ones in
 * their own Client columns (`backgroundImg`, `thumbnailImg`,
 * `secondaryBannerImg`). Both editors that expose a hero slot need the same
 * reading, so it lives here rather than in each of them — and every slot is
 * carried through so a save can never blank one the panel does not show.
 */
export function brandImagesFromClient(
  clientData: Record<string, any> | null,
): BrandImagesData {
  const raw = (clientData?.brandImages ?? {}) as Record<string, any>;
  return {
    header:
      raw.header ??
      brandImageFromLegacy(
        clientData?.backgroundImg,
        clientData?.backgroundImgName,
      ),
    thumbnail:
      raw.thumbnail ??
      brandImageFromLegacy(
        clientData?.thumbnailImg,
        clientData?.thumbnailImgName,
      ),
    secondaryBanner:
      raw.secondaryBanner ??
      brandImageFromLegacy(
        clientData?.secondaryBannerImg,
        clientData?.secondaryBannerImgName,
      ),
    favicon: raw.favicon ?? null,
    // The Employee Resources hub's band has no Client column: it lives in
    // `employeePortalPreview.employeeResourcesHeroImage`.
    employeeResourcesHero:
      raw.employeeResourcesHero ??
      brandImageFromLegacy(
        clientData?.employeePortalPreview?.employeeResourcesHeroImage,
        null,
      ),
  } as BrandImagesData;
}

/** Turn a legacy URL/name pair into the BrandImageData shape the cards read. */
export function brandImageFromLegacy(
  url?: string | null,
  fileName?: string | null,
): BrandImageData | null {
  if (!url) return null;
  return {
    url,
    fileName: fileName ?? "",
    fileSize: 0,
    width: 0,
    height: 0,
    recommendedSize: "1440×400 px",
    status: "ok",
    warnings: [],
  };
}
