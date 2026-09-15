import { authOptions } from "@/lib/auth-options";
import NextAuth from "next-auth/next";

/**
 * NextAuth route handlers.
 *
 * The session cookie is intentionally left host-only (see lib/auth-options.ts).
 * Portal pages are now served at the environment root ({ROOT_DOMAIN}/{slug}),
 * so there is no cross-subdomain session sharing to configure.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
