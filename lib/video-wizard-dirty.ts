import type { VideoWizardState } from "@/lib/video-wizard-store";

type VideoDirtySnapshot = Pick<
  VideoWizardState,
  "currentStep" | "isCompleted" | "stepData"
>;

function hasAnyContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some((item) => hasAnyContent(item));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasAnyContent(item),
    );
  }
  return false;
}

export function hasUnsavedVideoWizardWork(snapshot: VideoDirtySnapshot): boolean {
  if (snapshot.isCompleted) return false;
  if (snapshot.currentStep > 1) return true;
  return hasAnyContent(snapshot.stepData);
}
