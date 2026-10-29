import Providers from "@/components/layout/providers";
import { Toaster as ToasterContainer } from "@/components/ui/toaster";
import { Toaster } from "@/components/ui/sonner";
import { PageTitleProvider } from "@/hooks/usePageTitleContext";
import { LoadingProvider } from "@/contexts/loading-context";
import "@uploadthing/react/styles.css";
import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display, Sora, Lora, Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { InviteCodeProvider } from "@/components/providers/invite-code-provider";
import {
  getAppOrigin,
  isLocalHost,
  isMarketingHost,
  requestHostFromHeaders,
} from "@/lib/marketing/host";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

// ── Portal typography theme fonts ────────────────────────────────────────────
// Self-hosted at build time by next/font — no runtime requests to Google's CDN.
// These variables are only consumed by the Client Portal (see
// lib/typography-themes.ts and app/(portal)/[id]/layout.tsx), so the dashboard
// keeps using Manrope. All four are variable fonts, so weights 400–700 for the
// headline/body roles are covered without listing individual weights.
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSerifDisplay = localFont({
  src: "../public/fonts/DMSerifDisplay-Regular.ttf",
  variable: "--font-dm-serif-display",
  display: "swap",
  fallback: ["serif"],
  weight: "300",
});

const redHatDisplay = localFont({
  src: "../public/fonts/RedHatDisplay-VariableFont_wght.ttf",
  variable: "--font-red-hat-display",
  display: "swap",
  weight: "300",
});

export const metadata: Metadata = {
  /**
   * `metadataBase` is what turns the file-convention OG image
   * (`app/opengraph-image.tsx`) into an absolute URL. Without it Next falls back
   * to the *request* origin and logs a `metadataBase` warning on every app and
   * portal page. It must be the app origin, not the marketing one: the marketing
   * page overrides this in `app/page.tsx#generateMetadata` with its own origin.
   */
  metadataBase: new URL(getAppOrigin()),
  title: "PlanTelligence",
  description: "PlanTelligence - Your AI-Powered Financial Planning Assistant",
  applicationName: "PlanTelligence",
  /**
   * The web app manifest is served by a route handler so it can be resolved PER PLAN: on a portal
   * page it returns the plan's own name and `start_url` (derived from the portal's slug), which is
   * what makes the participant's installed app open their benefits portal rather than the
   * dashboard. The portal also updates this link with the plan slug once it knows it — see
   * components/pages/client-portal/sections/portal-install-app.tsx.
   */
  manifest: "/api/pwa/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PlanTelligence",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/pwa/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/pwa/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

/**
 * `themeColor` belongs to the viewport export (Next 14 warns when it is declared in `metadata`).
 * It colours the browser/PWA chrome around the page rather than describing the document.
 */
export const viewport: Viewport = {
  themeColor: "#1F3A60",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  const requestHeaders = headers();
  const requestHost = requestHostFromHeaders(requestHeaders);
  /**
   * The Early Access invite gate belongs to the product, not the public
   * marketing site. The marketing host renders the landing page standalone:
   * mounting the gate there would cover the page with a sign-in modal.
   *
   * A loopback host previews both sites from one origin, so only its root
   * (`/`) is the marketing page; `/signin`, `/dashboard`, and the participant
   * portals still need the app providers. Middleware stamps `x-pathname` on
   * every request it handles.
   */
  const isMarketing =
    isMarketingHost(requestHost) ||
    (isLocalHost(requestHost) && requestHeaders.get("x-pathname") === "/");
  // Font CSS variables MUST live on <html> (not <body>): the portal sets
  // --font-headline / --font-body to values that reference these variables
  // (e.g. var(--font-playfair), …). A nested var() resolves against the
  // element that declares the outer property, so the underlying variables
  // must be present at or above where the theme is applied — including
  // document.documentElement, which the Step 2 live previews target.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSerifDisplay.variable} ${redHatDisplay.variable} ${playfairDisplay.variable} ${sora.variable} ${lora.variable} ${outfit.variable}`}
    >
      <body className={manrope.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          {isMarketing ? (
            children
          ) : (
            <InviteCodeProvider>
              <PageTitleProvider>
                <LoadingProvider>
                  <Providers session={session}>
                    <ToasterContainer />
                    {children}
                    <Toaster richColors />
                  </Providers>
                </LoadingProvider>
              </PageTitleProvider>
            </InviteCodeProvider>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
