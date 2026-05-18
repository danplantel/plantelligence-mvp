// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    
    // Add pathname to headers for layout detection
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    
    // Check if user is trying to access onboarding after completion
    if (pathname.startsWith('/new/onboarding') && req.nextauth?.token?.id) {
      try {
        // Check if user has completed onboarding
        const hasCompleted = await prisma.wizardSession.findFirst({
          where: {
            userId: req.nextauth.token.id as string,
            completed: true,
          }
        });

        if (hasCompleted) {
          // Redirect to dashboard if onboarding is already completed
          return NextResponse.redirect(new URL('/new/dashboard', req.url));
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Continue to onboarding if there's an error
      }
    }
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Require auth for all protected routes
        return !!token;
      },
    },
  }
);

export const config = { 
  matcher: [
    "/dashboard/:path*",
    "/new/:path*",
    "/onboarding/:path*"
  ] 
};
