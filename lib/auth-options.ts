import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "./prisma";

const SALT = "$2b$10$79lD55dzSIAAVfHGPCRt.e";

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
        password: { label: "password", type: "password" }, // Include password field here
      },
      async authorize(credentials: any) {
        try {
          if (!credentials) {
            throw new Error("Invalid credentials.");
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });
          if (!user) {
            throw new Error("Invalid credentials.");
          }

          const isValidPassword = await bcrypt.compare(
            credentials.password,
            user.password || "",
          );

          if (!isValidPassword) {
            throw new Error("Invalid credentials.");
          }

          return user;
        } catch (err) {
          throw new Error("Invalid credentials.");
        }
      },
    }),
  ],
  pages: {
    signIn: "/",
    // signUp: "/signup",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        // Add id from the token to the session user object
        session.user.id = token.id as string;
      }

      (session as any).provider = token.provider;

      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // For OAuth providers (Google), user.id is the provider's 'sub' (e.g. Google numeric ID),
        // not the MongoDB _id. Look up the actual MongoDB user by email.
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email as string },
            select: { id: true },
          });
          token.id = dbUser?.id || user.id;
        } else {
          // For credentials provider, user.id is already the MongoDB _id
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
        return false;
      }

      // Search by email only (not email + provider) to handle cross-provider sign-in
      const existUser = await prisma.user.findFirst({
        where: {
          email: user.email,
        },
      });

      if (!existUser) {
        // No existing user — create a new one
        const newUser: Prisma.UserCreateInput = {
          email: user.email,
          provider: (account?.provider as any) || "local",
          name: user?.name || "",
        };
        await prisma.user.create({
          data: newUser,
        });
      } else if (existUser.provider !== (account?.provider as any)) {
        // User exists with a different provider — update their provider
        // This allows a user who signed up via email to also sign in with Google
        await prisma.user.update({
          where: { id: existUser.id },
          data: {
            provider: (account?.provider as any) || "local",
            name: existUser.name || user?.name || "",
          },
        });
      }

      return true;
    },
  },
};
