import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "./prisma";

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
        // In production, set the domain to .plantel.pro so the session cookie
        // is shared across the apex domain and all subdomains (waypoint.plantel.pro, etc.).
        // On localhost, leave domain undefined — browsers reject dot-prefixed domains
        // on localhost.
        domain:
          process.env.NODE_ENV === "production"
            ? ".plantel.pro"
            : undefined,
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      (session as any).provider = token.provider;
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email as string },
            select: { id: true },
          });
          token.id = dbUser?.id || user.id;
        } else {
          token.id = user.id;
        }
      }
      if (account) {
        token.provider = account.provider;
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
        } else if (existUser.provider !== (account?.provider as any)) {
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

        return true;
      } catch (err) {
        console.error("[signIn callback] Error during sign-in:", err);
        return false;
      }
    },
  },
};
