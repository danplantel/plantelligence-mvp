"use client";

import { Headshot } from "@/components/ui/headshot";
import { initials } from "@/components/pages/my-benefits-team/utils";

interface Contact {
  name?: string;
  headshot?: string;
}

interface PrimaryVisualProps {
  contact: Contact;
}

export function PrimaryVisual({ contact }: { contact: Contact }) {
  return (
    <Headshot
      src={contact.headshot}
      alt="Photo"
      fallback={
        <span className="text-7xl text-white">
          {initials(contact.name)}
        </span>
      }
    />
  );
}
