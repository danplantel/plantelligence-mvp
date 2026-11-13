import Link from "next/link";

import { LegalDocument } from "@/components/legal/legal-document";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  PLATFORM_SUPPORT_EMAIL,
  platformLegalHref,
  type LegalDoc,
} from "@/lib/legal/legal-config";

const DOC_LABELS: Record<LegalDoc, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

interface PlatformLegalDocumentPageProps {
  doc: LegalDoc;
  /** The policy Markdown generated from its root-level `.md` source. */
  markdown: string;
}

/**
 * The public shell for the Platform-level legal documents.
 *
 * Unlike the Benefits Hub pages, these are not plan-scoped: they describe the
 * PlanTelligence dashboard/account product and are linked from the marketing
 * site and the dashboard account menu. The shell is deliberately dependency-free
 * so it renders the same on the marketing origin (where the root layout skips
 * the app providers) and on the app origin.
 */
export function PlatformLegalDocumentPage({
  doc,
  markdown,
}: PlatformLegalDocumentPageProps) {
  const otherDoc: LegalDoc = doc === "privacy" ? "terms" : "privacy";
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-[#14243A]">
      {/* Fixed so the wordmark and the way back stay reachable while the policy
          is scrolled. The blurred translucent backing keeps the text legible
          over the document without hiding the background entirely. */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#E7E1D8] bg-[#FBF9F6]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FBF9F6]/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            aria-label="PlanTelligence home"
            className="inline-flex items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/plantelligence-logos/pt_web_light.png"
              alt="PlanTelligence"
              className="h-8 w-auto"
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[#526072] transition-colors hover:text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60]"
          >
            Back to home
          </Link>
        </div>
      </header>

      {/* Top padding clears the fixed header (logo + vertical padding). */}
      <main className="mx-auto max-w-3xl px-5 pb-10 pt-28 sm:px-8 sm:pb-14 sm:pt-32">
        <LegalDocument
          markdown={markdown}
          context={{
            effectiveDate: LEGAL_EFFECTIVE_DATE,
            lastUpdated: LEGAL_LAST_UPDATED,
          }}
        />

        <nav
          aria-label="Legal documents"
          className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#E7E1D8] pt-6 text-sm"
        >
          <Link
            href={platformLegalHref(otherDoc)}
            className="font-medium text-[#1F3A60] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60]"
          >
            {DOC_LABELS[otherDoc]}
          </Link>
          <a
            href={`mailto:${PLATFORM_SUPPORT_EMAIL}`}
            className="font-medium text-[#1F3A60] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60]"
          >
            Contact support
          </a>
        </nav>
      </main>

      <footer className="border-t border-[#E7E1D8]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-6 text-xs text-[#5F6B7A] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {year} PlanTelligence. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-4">
            <Link
              href={platformLegalHref("privacy")}
              className="transition-colors hover:text-[#14243A] underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            <Link
              href={platformLegalHref("terms")}
              className="transition-colors hover:text-[#14243A] underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
