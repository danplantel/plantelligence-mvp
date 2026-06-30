import Providers from "@/components/layout/providers";
import { Toaster as ToasterContainer } from "@/components/ui/toaster";
import { Toaster } from "@/components/ui/sonner";
import { PageTitleProvider } from "@/hooks/usePageTitleContext";
import { LoadingProvider } from "@/contexts/loading-context";
import "@uploadthing/react/styles.css";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.className} ${dmSerifDisplay.variable} ${redHatDisplay.variable}`}
      >
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
