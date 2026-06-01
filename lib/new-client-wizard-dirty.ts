import type { NewClientWizardState } from "@/lib/new-client-wizard-store";

export type WizardDirtySnapshot = Pick<
  NewClientWizardState,
  "isCompleted" | "stepData" | "currentStep" | "draftClientId"
>;

function hasMeaningfulWizardContent(
  stepData: NewClientWizardState["stepData"],
): boolean {
  const cb = stepData.companyBasics;
  const ws = stepData.welcomeStatement;
  const kc = stepData.keyContacts;
  const cd = stepData.complianceDocuments;

  if (cb?.companyName?.trim()) return true;
  if (cb?.planType?.trim()) return true;
  if (cb?.companyLogo?.url) return true;
  const bi = cb?.brandImages;
  if (
    bi?.header?.url ||
    bi?.thumbnail?.url ||
    bi?.secondaryBanner?.url ||
    bi?.favicon?.url
  ) {
    return true;
  }
  if (cb?.missionHeadline?.trim() || cb?.missionBody?.trim()) return true;
  if (cb?.heroTitle?.trim() || cb?.heroDescription?.trim()) return true;

  if (ws?.headline?.trim() || ws?.bodyText?.trim()) return true;

  if (kc?.contacts && kc.contacts.length > 0) return true;

  if (cd?.spdFile) return true;
  if ((cd?.retirementPlanDocuments?.length ?? 0) > 0) return true;
  if ((cd?.otherDocuments?.length ?? 0) > 0) return true;

  const disclosures = stepData.disclaimers?.disclosuresText?.trim();
  if (disclosures) return true;

  return false;
}

/** True when leaving Create Plan could discard work the user has started. */
export function hasUnsavedWizardWork(snapshot: WizardDirtySnapshot): boolean {
  if (snapshot.isCompleted) return false;
  if (snapshot.draftClientId) return true;
  if (snapshot.currentStep > 1) return true;
  return hasMeaningfulWizardContent(snapshot.stepData);
}
