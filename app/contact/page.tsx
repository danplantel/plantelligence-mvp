import type { Metadata } from "next";
import { ContactFormPage } from "@/components/pages/contact-form-page";

export const metadata: Metadata = {
  title: "Contact Us | PlanTelligence",
  description:
    "Send a message through the PlanTelligence contact form.",
};

interface ContactPageProps {
  searchParams: Promise<{
    to?: string;
    company?: string;
    name?: string;
  }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;

  return (
    <ContactFormPage
      to={typeof params.to === "string" ? params.to.slice(0, 254) : ""}
      company={
        typeof params.company === "string" ? params.company.slice(0, 160) : ""
      }
      contactName={
        typeof params.name === "string" ? params.name.slice(0, 120) : ""
      }
    />
  );
}
