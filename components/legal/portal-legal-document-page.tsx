"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { LegalDocument } from "@/components/legal/legal-document";
import { useClientPortal } from "@/contexts/client-portal-context";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  portalLegalHref,
  type PortalLegalDoc,
} from "@/lib/legal/legal-config";

const DOC_LABELS: Record<PortalLegalDoc, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

interface PortalLegalDocumentPageProps {
  doc: PortalLegalDoc;
  /** The policy Markdown generated from its root-level `.md` source. */
  markdown: string;
}

/**
 * The participant-facing shell for both Benefits Hub legal documents.
 *
 * It resolves the plan's Publishing Organization once — the same precedence the
 * portal layout uses for the footer's `[Organization Name]` — so the policy text
 * addresses the organization the participant actually sees, then hands the
 * Markdown to the shared renderer.
 */
export function PortalLegalDocumentPage({
  doc,
  markdown,
}: PortalLegalDocumentPageProps) {
  const { clientData, profile } = useClientPortal();
  const params = useParams();
  const clientId = params.id as string;

  const branding = (clientData as { branding?: { organizationName?: string } } | null)
    ?.branding;
  const organizationName =
    (branding?.organizationName || "").trim() ||
    (profile?.organizationName || "").trim() ||
    (clientData?.companyName || "").trim() ||
    "your employer";

  const organizationContact =
    (profile?.email || "").trim() ||
    "Contact your employer's benefits administrator.";

  const otherDoc: PortalLegalDoc = doc === "privacy" ? "terms" : "privacy";
  const otherHref = portalLegalHref(clientId, otherDoc);
  const homeHref = clientId ? `/${clientId}` : "/";
  const companyName = clientData?.companyName || "Benefits Hub";

  return (
    <div className="min-h-[60vh] bg-white font-red-hat">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          <span aria-hidden="true">&larr;</span>
          Back to {companyName}
        </Link>

        <div className="mt-6">
          <LegalDocument
            markdown={markdown}
            context={{
              organizationName,
              organizationContact,
              effectiveDate: LEGAL_EFFECTIVE_DATE,
              lastUpdated: LEGAL_LAST_UPDATED,
            }}
          />
        </div>

        <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-200 pt-5 text-sm">
          {otherHref ? (
            <Link
              href={otherHref}
              className="font-medium text-[#1F3A60] underline-offset-4 hover:underline"
            >
              {DOC_LABELS[otherDoc]}
            </Link>
          ) : null}
          <Link
            href={homeHref}
            className="font-medium text-[#1F3A60] underline-offset-4 hover:underline"
          >
            Benefits Hub Home
          </Link>
        </nav>
      </div>
    </div>
  );
}
