import Providers from "@/components/layout/providers";
import { Toaster as ToasterContainer } from "@/components/ui/toaster";
import { Toaster } from "@/components/ui/sonner";
import { PageTitleProvider } from "@/hooks/usePageTitleContext";
import { LoadingProvider } from "@/contexts/loading-context";
import "@uploadthing/react/styles.css";
import type { Metadata } from "next";
import { Manrope, Playfair_Display, Sora, Lora, Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { getServerSession } from "next-auth";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { InviteCodeProvider } from "@/components/providers/invite-code-provider";

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
  title: "PlanTelligence",
  description: "PlanTelligence - Your AI-Powered Financial Planning Assistant",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/favicon-32x32.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
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
        </ThemeProvider>
      </body>
    </html>
  );
}
