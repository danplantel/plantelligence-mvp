import type { HelpCardLayoutEntry, ProviderContact } from "@/types/benefit";

/**
 * The Employee Resources hub's "How Can We Help You Today?" settings.
 *
 * A benefit hub keeps these on its `Benefit` row (`insurancePlanId`,
 * `insuranceLoginUrl`, `providerContact`, `helpCards`, `helpCardColumns`). Employee
 * Resources is NOT a benefit category, so it has no `Benefit` row to hold them — the
 * Editing Panel stores them on the plan instead, inside
 * `employeePortalPreview.employeeResourcesHelp` (the same JSON blob that already
 * carries this hub's header image).
 *
 * Keeping the shape here means the panel, the page and any preview read ONE source
 * of truth, and the Account Access card / card layout cannot drift between what the
 * advisor arranges and what a participant sees.
 */
export interface EmployeeResourcesHelpSettings {
  /** `Benefit.insurancePlanId` equivalent — printed as "PLAN / GROUP ID: …". */
  insurancePlanId: string;
  /** `Benefit.insuranceLoginUrl` equivalent — the Account Access CTA destination. */
  insuranceLoginUrl: string;
  /** `Benefit.providerContact` equivalent — the "Administered by …" line. */
  providerContact: ProviderContact | null;
  /** Card order + primary + show/hide, exactly like `Benefit.helpCards`. */
  helpCards: HelpCardLayoutEntry[];
  /** 3 or 4 cards per row, exactly like `Benefit.helpCardColumns`. */
  helpCardColumns: number | null;
}

/** The defaults a plan that has never opened this panel sees. */
export const EMPTY_EMPLOYEE_RESOURCES_HELP: EmployeeResourcesHelpSettings = {
  insurancePlanId: "",
  insuranceLoginUrl: "",
  providerContact: null,
  helpCards: [],
  helpCardColumns: null,
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/**
 * Read this hub's settings off a plan payload, tolerating a missing / legacy blob.
 *
 * Everything is normalised to the editor's shape so the panel always drafts a
 * complete object (rather than `undefined` fields it would then have to guard).
 */
export function readEmployeeResourcesHelp(
  clientData: unknown,
): EmployeeResourcesHelpSettings {
  const preview = asRecord(asRecord(clientData).employeePortalPreview);
  const raw = asRecord(preview.employeeResourcesHelp);

  const helpCards = Array.isArray(raw.helpCards)
    ? (raw.helpCards as HelpCardLayoutEntry[]).filter(
        (entry): entry is HelpCardLayoutEntry =>
          !!entry && typeof entry.id === "string",
      )
    : [];

  const columns = Number(raw.helpCardColumns);

  return {
    insurancePlanId:
      typeof raw.insurancePlanId === "string" ? raw.insurancePlanId : "",
    insuranceLoginUrl:
      typeof raw.insuranceLoginUrl === "string" ? raw.insuranceLoginUrl : "",
    providerContact:
      raw.providerContact && typeof raw.providerContact === "object"
        ? (raw.providerContact as ProviderContact)
        : null,
    helpCards,
    helpCardColumns: Number.isFinite(columns) && columns > 0 ? columns : null,
  };
}
