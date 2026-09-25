import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      organizationName?: string | null;
      organizationEmail?: string | null;
      /**
       * Team & Collaborator Access (T1): the Organization that owns this user.
       * Mirrored from the JWT; null only for a session that predates the
       * backfill and has not been refreshed yet.
       */
      organizationId?: string | null;
    };
  }
}
