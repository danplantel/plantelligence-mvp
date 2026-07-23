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

        // Normalize: trim whitespace and lowercase email
        // Prevents subtle mismatches from auto-fill, whitespace, or casing
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

          // User exists but has no password set (e.g. Google OAuth-only account)
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
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        // Add id from the token to the session user object
        session.user.id = token.id as string;
      }

      (session as any).provider = token.provider;
      (session as any).organizationName = token.organizationName;

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
          token.organizationName = dbUser?.organizationName || undefined;
        } else {
          token.id = user.id;
        }
      }

      // On every JWT refresh, ensure organizationName is in the token
      if (!token.organizationName) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { organizationName: true },
          });
          if (dbUser?.organizationName) {
            token.organizationName = dbUser.organizationName;
          }
        } catch {
          // Silently ignore
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
        // Search by email only (not email + provider) to handle cross-provider sign-in
        const existUser = await prisma.user.findFirst({
          where: {
            email: user.email,
          },
        });

        if (!existUser) {
          // No existing user — create a new one (OAuth first-time sign-in)
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
          // User exists with a different provider — update their provider
          // This allows a user who signed up via email to also sign in with Google
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
        // Do NOT return false for DB errors on an existing user;
        // the user was already authenticated by the provider/authorize step.
        // Only return false if the user truly doesn't exist and we can't create them.
        return false;
      }
    },
  },
};
