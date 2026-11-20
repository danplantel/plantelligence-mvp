/**
 * Participant-facing copy calls the person a SPECIALIST.
 *
 * The dashboard is the advisor's own product, but the person a participant meets
 * on their benefits page is introduced as their specialist — so every portal
 * surface renders stored copy through this.
 *
 * It is a DISPLAY-time swap on purpose:
 *  - topics seeded before the rename still hold "Talk to an Advisor" in the
 *    database (and an advisor may have typed it themselves), so the portal must
 *    read correctly without rewriting anyone's rows;
 *  - `{{advisor_name}}` / `{{advisor_firm}}` keep their names — the underscore is
 *    a word character, so neither token matches the word boundary below — and
 *    every stored answer still resolves them;
 *  - CTA *targets* (`target: "advisor"`) are identifiers, not copy, and are never
 *    passed through here.
 */
export function participantCopy(text: string): string {
  return (
    text
      // The article first: "Talk to an Advisor" must not become "Talk to an
      // Specialist". These run before the bare-word swaps below.
      .replace(/\bAn Advisor\b/g, "A Specialist")
      .replace(/\ban Advisor\b/g, "a Specialist")
      .replace(/\bAn advisor\b/g, "a specialist")
      .replace(/\ban advisor\b/g, "a specialist")
      .replace(/\bAdvisors\b/g, "Specialists")
      .replace(/\badvisors\b/g, "specialists")
      .replace(/\bAdvisor\b/g, "Specialist")
      .replace(/\badvisor\b/g, "specialist")
  );
}
