"use client";

/**
 * Step 5c — Invite Your Team.
 *
 * Shown only when the organization's team size is above "Just me". Reached from
 * 5b Compliance Disclosures; its footer action ("Send Invites & Finish" /
 * "Invite Later") finishes onboarding.
 *
 * Placeholder: the invite builder content is intentionally left for a
 * follow-up — the surrounding sub-stepper navigation and actions are already
 * wired.
 */
export function Step5cTeam() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-left space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Invite Your Team
        </h2>
        <p className="text-sm text-muted-foreground">
          Add teammates who should have access to your workspace.
        </p>
      </div>

      {/* TODO: Step 5c — Team invite builder */}
    </div>
  );
}
