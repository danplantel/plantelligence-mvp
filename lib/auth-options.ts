import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "./prisma";
import { sendSignInNotificationEmail } from "@/lib/email";

const ROOT_DOMAIN = (process.env.ROOT_DOMAIN || "plantel.pro")
  .replace(/^\./, "")
  .toLowerCase();

/**
 * Resolve the Domain attribute for the NextAuth session cookie.
 *
 * When the app is served on the Plantel root domain (apex `plantel.pro` or a
 * subdomain like `waypoint.plantel.pro`), scope the cookie to `.plantel.pro`
 * so it is shared across those hosts.
 *
 * On ANY other host — e.g. a Vercel deployment/dev domain such as
 * `plantel-dev.vercel.app` — the domain must be left unset so the browser
 * stores a host-only cookie. Otherwise the browser silently rejects a
 * `Domain=.plantel.pro` cookie on a host that isn't under `plantel.pro`, the
 * session never persists, and sign-in appears to do nothing after the callback.
 *
 * NextAuth v4 resolves cookie options statically from this config (no per
 * request function), so we infer the host from the environment's canonical
 * app URL. Each Vercel project/environment should set NEXTAUTH_URL to its own
 * URL (e.g. https://plantel-dev.vercel.app for the dev project).
 */
function resolveSessionCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const canonical =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!canonical) return undefined;

  let host = "";
  try {
    host = new URL(canonical).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  return host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)
    ? `.${ROOT_DOMAIN}`
    : undefined;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      credentials: {
        email: {
          label: "email",
          type: "email",
          placeholder: "example@gmail.com",
        },
        password: { label: "password", type: "password" },
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          console.error("[authorize] Missing email or password in credentials");
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        if (!email || !password) {
          console.error("[authorize] Email or password empty after normalization");
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            console.error(
              `[authorize] No user found for email: ${email}`,
            );
            return null;
          }

          if (!user.password) {
            console.error(
              `[authorize] User ${email} has no password set (Google OAuth-only account)`,
            );
            return null;
          }

          const isValidPassword = await bcrypt.compare(
            password,
            user.password,
          );

          if (!isValidPassword) {
            console.error(
              `[authorize] Invalid password for email: ${email}`,
            );
            return null;
          }

          return user;
        } catch (err) {
          console.error("[authorize] Unexpected error during authorization:", err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/signin",
    // signUp: "/signup",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — persistent across browser restarts
  },
  cookies: {
    sessionToken: {
      // __Secure- prefix + secure: true = HTTPS only. On localhost (HTTP),
      // the browser rejects the cookie, causing a sign-in redirect loop.
      // Use un-prefixed + secure: false in development.
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // On the Plantel root domain the cookie is scoped to `.plantel.pro` so
        // it is shared across the apex and all subdomains (waypoint.plantel.pro,
        // etc.). On localhost and on non-Plantel hosts (Vercel preview/dev
        // domains like plantel-dev.vercel.app) the domain is left undefined so
        // the browser stores a host-only cookie — dot-prefixed domains are
        // rejected on localhost and on mismatched hosts.
        domain: resolveSessionCookieDomain(),
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).organizationName =
          (token as any).organizationName || null;
      }
      (session as any).provider = token.provider;
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email as string },
            select: { id: true, organizationName: true },
          });
          token.id = dbUser?.id || user.id;
          token.organizationName = dbUser?.organizationName || null;
        } else {
          token.id = user.id;
          token.organizationName = (user as any)?.organizationName || null;
        }
        // Mark org name as loaded for this token.
        (token as any).__orgNameLoaded = true;
      }
      // Backfill organizationName for sessions created before this field was
      // added to the token (avoids requiring the user to log out/in again).
      if (token.id && !(token as any).__orgNameLoaded) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { organizationName: true },
          });
          token.organizationName = dbUser?.organizationName || null;
        } catch {
          token.organizationName = null;
        }
        (token as any).__orgNameLoaded = true;
      }
      if (account) {
        token.provider = account.provider;
      }

      // Onboarding gate latch. Once true it never resets, so the DB is only
      // queried while the flag is still false — it flips to true on the first
      // session access after the user completes the wizard, then costs nothing
      // afterwards. The flag is mirrored into the JWT and consumed by
      // middleware (see middleware.ts) to replace the old client-side
      // OnboardingGuard, eliminating the per-navigation onboarding-status call.
      if (token.id && !(token as any).onboardingComplete) {
        try {
          const completed = await prisma.wizardSession.findFirst({
            where: { userId: token.id as string, completed: true },
            select: { id: true },
          });
          (token as any).onboardingComplete = !!completed;
        } catch {
          (token as any).onboardingComplete = false;
        }
      }
      return token;
    },
    async signIn(params) {
      const { account, user } = params;

      if (!user?.email) {
        console.error("[signIn callback] No user email provided");
        return false;
      }

      try {
        const existUser = await prisma.user.findFirst({
          where: {
            email: user.email,
          },
        });

        if (!existUser) {
          console.log(
            `[signIn callback] Creating new user for email: ${user.email} via ${account?.provider}`,
          );
          const newUser: Prisma.UserCreateInput = {
            email: user.email,
            provider: (account?.provider as any) || "credentials",
            name: user?.name || "",
          };
          await prisma.user.create({
            data: newUser,
          });
        } else {
          // Existing user — send a sign-in notification email (best-effort).
          try {
            await sendSignInNotificationEmail(user.email, user?.name || existUser.name || undefined);
          } catch (emailErr) {
            console.error("[signIn callback] Failed to send sign-in notification email:", emailErr);
          }

          if (existUser.provider !== (account?.provider as any)) {
            console.log(
              `[signIn callback] Updating provider for ${user.email}: ${existUser.provider} → ${account?.provider}`,
            );
            await prisma.user.update({
              where: { id: existUser.id },
              data: {
                provider: (account?.provider as any) || "credentials",
                name: existUser.name || user?.name || "",
              },
            });
          }
        }

        return true;
      } catch (err) {
        console.error("[signIn callback] Error during sign-in:", err);
        return false;
      }
    },
  },
};
