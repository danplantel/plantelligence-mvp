/**
 * The red **Live** badge every portal Editing Panel wears in its header.
 *
 * Portal panels edit the participant-facing page directly, so the badge is a
 * warning colour rather than a neutral chip. Kept in one component so the
 * `PortalEditorShell` panels and the benefit panel (which owns its own
 * `EditorPanelWrapper`) cannot drift.
 */
export function PortalLiveBadge() {
  return (
    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
      Live
    </span>
  );
}
