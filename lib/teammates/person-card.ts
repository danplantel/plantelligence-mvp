/**
 * person-card — the shape of a colleague's profile card.
 *
 * Deliberately its own dependency-free module, split from `person-card.server.ts` the same way
 * `dashboard-tasks.ts` is split from `dashboard-tasks.server.ts`: the dialog that renders the card is
 * a client component, and it must be able to name this type without importing the module that reads
 * the database. The words here are the CONTRACT between the read and the card — the server returns
 * exactly this, and the card renders exactly this, so neither can quietly change what the other gets.
 */

export interface PersonCard {
  userId: string;
  /** Never blank: the seat's name, else the login's, else the login's email. */
  name: string;
  email: string;
  /**
   * The ORGANIZATION's shared address — the second Email row Settings → Profile shows, and the one
   * that screen edits. It is identical for every member of the organization, which is why the card
   * labels it rather than printing it as if it were theirs. Null when none has been set.
   */
  organizationEmail: string | null;
  /** The login's picture, else the seat's, else null — the resolver's one precedence. */
  headshot: string | null;

  /** The seat's standing in the organization: "Owner" | "Team Member" | "Collaborator". */
  standingLabel: string;
  /** The most privileged role they hold across their plans, or "Owner". Null when neither. */
  roleLabel: string | null;

  /** All three are the SEAT's, so they are null for the Owner — who holds no seat. */
  jobTitle: string | null;
  phone: string | null;
  phoneExtension: string | null;
  designations: string[];

  /** True when the reader opened their own card — the Message button is meaningless then. */
  isSelf: boolean;
  /** Exactly what `POST /api/messages/threads` would accept for this pair, so it cannot 403. */
  canMessage: boolean;
}
