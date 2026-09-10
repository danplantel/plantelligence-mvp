import type { Metadata } from "next";
import { ContactFormPage } from "@/components/pages/contact-form-page";
import { toR2BrandingKey } from "@/lib/branding-image-url";
import { getPresignedReadUrl } from "@/lib/r2";

export const metadata: Metadata = {
  title: "Contact Us | PlanTelligence",
  description:
    "Send a message through the PlanTelligence contact form.",
};

// Do not statically optimize: images are signed per-request and the page
// reads dynamic search params.
export const dynamic = "force-dynamic";

interface ContactPageProps {
  searchParams: Promise<{
    to?: string;
    company?: string;
    name?: string;
    title?: string;
    avatar?: string;
    logo?: string;
  }>;
}

/**
 * Resolve a contact image (headshot or company logo) for anonymous visitors.
 * Stored values are R2 keys (org/...) which the advisor-scoped /api/r2/object
 * proxy cannot serve on this public apex page (no session, no plan subdomain).
 * Sign them into a fresh presigned GET URL so the <img> loads for anyone.
 * Non-R2 http(s) values pass through; base64 data URLs are not carried in links.
 */
async function resolveContactImage(raw: string): Promise<string> {
  const value = raw.slice(0, 2048).trim();
  if (!value) return "";
  const canonicalKey = toR2BrandingKey(value);
  if (canonicalKey) {
    try {
      const signed = await getPresignedReadUrl({ key: canonicalKey });
      if (signed) return signed;
    } catch (error) {
      console.error("Error signing contact-form image:", error);
    }
    return "";
  }
  if (value.startsWith("data:")) return "";
  return value;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;

  const avatar =
    typeof params.avatar === "string"
      ? await resolveContactImage(params.avatar)
      : "";
  const companyLogo =
    typeof params.logo === "string"
      ? await resolveContactImage(params.logo)
      : "";

  return (
    <ContactFormPage
      to={typeof params.to === "string" ? params.to.slice(0, 254) : ""}
      company={
        typeof params.company === "string" ? params.company.slice(0, 160) : ""
      }
      contactName={
        typeof params.name === "string" ? params.name.slice(0, 120) : ""
      }
      contactTitle={
        typeof params.title === "string" ? params.title.slice(0, 120) : ""
      }
      avatar={avatar}
      companyLogo={companyLogo}
    />
  );
}
