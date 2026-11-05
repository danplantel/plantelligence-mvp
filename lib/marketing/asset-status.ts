/**
 * A marketing asset's publishing status — and the colour it wears.
 *
 * The Marketing page and the portal's News & Events panel both show these, and
 * both used to spell the list and the colours themselves. One source, so a
 * "Published" post cannot be green in the dashboard and grey in the panel.
 */

export type MarketingAssetStatus =
  | "Draft"
  | "Ready for Review"
  | "Published"
  | "Scheduled"
  | "Hidden"
  | "Archived";

/** Every status, in the order the pickers offer them. */
export const MARKETING_ASSET_STATUSES: MarketingAssetStatus[] = [
  "Draft",
  "Ready for Review",
  "Published",
  "Scheduled",
  "Hidden",
  "Archived",
];

/** The chip / pill classes for each status. */
export const MARKETING_ASSET_STATUS_CLASSES: Record<
  MarketingAssetStatus,
  string
> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-300",
  "Ready for Review": "bg-amber-50 text-amber-700 border-amber-300",
  Published: "bg-green-50 text-green-700 border-green-300",
  Scheduled: "bg-blue-50 text-blue-700 border-blue-300",
  Hidden: "bg-yellow-50 text-yellow-700 border-yellow-300",
  Archived: "bg-red-50 text-red-700 border-red-300",
};

/**
 * The chip classes for a status read off a row.
 *
 * Rows predate this list and the API stores whatever it was given, so an
 * unrecognised value falls back to the Draft chip rather than rendering an
 * unstyled pill with invisible text.
 */
export function marketingAssetStatusClass(
  status: string | null | undefined,
): string {
  return (
    MARKETING_ASSET_STATUS_CLASSES[status as MarketingAssetStatus] ??
    MARKETING_ASSET_STATUS_CLASSES.Draft
  );
}
